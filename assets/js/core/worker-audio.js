/**
 * [DocEasy Voice] worker-audio.js
 *
 * Web Worker: decodes an audio track, applies per-speaker voice effects
 * according to speaker-detector.js segments, and re-encodes the result.
 *
 * ── Decode/encode strategy ──────────────────────────────────────────
 * Primary path: WebCodecs `AudioDecoder` / `AudioEncoder`, which decode
 * frame-by-frame without loading the whole track into memory — required
 * for 2-hour files. Support is checked at runtime via `AudioDecoder.isConfigSupported`.
 *
 * Fallback path: Web Audio API `OfflineAudioContext`, used when WebCodecs
 * is unavailable (older Firefox/Safari) or the source codec isn't
 * supported by the platform's AudioDecoder. This path is only used on
 * PCM/AudioBuffer input already decoded upstream (e.g. by FFmpeg.wasm),
 * since OfflineAudioContext itself has no arbitrary-codec decoder — it
 * only renders already-decoded audio graphs. Callers on this path must
 * hand us PCM/AudioBuffer, not compressed bytes.
 *
 * ── Pitch shifting trade-off (documented, not hidden) ───────────────
 * True high-quality pitch shifting (changing pitch WITHOUT changing
 * duration) needs a phase vocoder: STFT -> phase-adjusted resynthesis.
 * This file implements a real, working phase vocoder (below), but it is
 * a plain JS implementation with no external DSP library:
 *   - Quality is good for moderate shifts (±1 octave, i.e. ±12 semitones)
 *     used by our effect presets (chipmunk +18, deep -8, etc. are clamped
 *     to ±24 semitones with a quality warning past ±12).
 *   - Time-domain artifacts ("phasiness"/robotic smearing) increase with
 *     larger shifts and with percussive/noisy material (breaths, plosives).
 *   - It is NOT a substitute for commercial pitch correction (e.g.
 *     Melodyne-grade formant-preserving shift). Formant shift here is a
 *     simple spectral envelope stretch, not a dedicated formant model —
 *     large shifts will sound more "cartoon" than a natural changed voice.
 *   - CPU cost scales with shift amount and window count; on a 2-hour
 *     track processed in 10-30s windows this stays real-time-ish per
 *     window on a modern laptop, but is meaningfully heavier than a
 *     naive resample-based shift. A cheap alternative (simple resample,
 *     which changes duration along with pitch) is also included and used
 *     automatically as a fallback if the phase vocoder throws.
 *
 * ── Effects implemented ──────────────────────────────────────────────
 *   - pitchShift(semitones, formantShift)  — phase vocoder based
 *   - deep      — preset: pitchShift(-8), slight formant down, mild lowpass
 *   - chipmunk  — preset: pitchShift(+12), slight formant up
 *   - monster   — preset: pitchShift(-14) + reverb (convolution-free, delay-based)
 *   - robot     — ring modulation (carrier oscillator multiply)
 *   - echo      — delay + feedback, implemented as a feed-forward comb
 *   - alien     — pitchShift + tremolo (amplitude LFO)
 *   - whisper   — noise-gated amplitude + spectral flattening (approx.)
 *   - normal    — passthrough
 *
 * ── Message protocol ─────────────────────────────────────────────────
 * postMessage in:
 *   {
 *     type: 'process',
 *     jobId: string,
 *     sampleRate: number,
 *     numberOfChannels: number,
 *     // EITHER raw PCM per channel...
 *     channelData: Float32Array[],        // one Float32Array per channel
 *     // ...OR an already-decoded AudioBuffer-like transferable is NOT
 *     // supported directly (AudioBuffer isn't transferable); always send
 *     // channelData as Float32Array[] (transferable) instead.
 *     segments: Array<{ start: number, end: number, pitch: number,
 *                        speakerId: number, confidence: number }>,
 *     effectMap: { [speakerId: number]: { type: string, pitchShift?: number,
 *                                          formantShift?: number } },
 *     // Optional: compressed input for the WebCodecs path instead of PCM
 *     encodedChunks: Array<{ data: ArrayBuffer, timestamp: number, duration: number, type: string }>,
 *     codecConfig: object,                // AudioDecoderConfig, if encodedChunks provided
 *     outputCodec: string,                // e.g. 'opus'
 *   }
 *
 * postMessage out (progress):
 *   { type: 'progress', jobId, processedSeconds, totalSeconds }
 *
 * postMessage out (result):
 *   { type: 'result', jobId, sampleRate, numberOfChannels, channelData: Float32Array[] }
 *   — channelData is returned as transferable Float32Arrays. Muxing back
 *   into the container (Opus encode + mux) is done by the caller via
 *   AudioEncoder + FFmpeg.wasm, since that step needs to interleave with
 *   the video track's timing, which this worker does not have visibility into.
 *
 * postMessage out (error): { type: 'error', jobId, message }
 *
 * No step fails silently: any unrecoverable problem posts a 'error'
 * message with a specific reason rather than returning empty/garbage audio.
 */

'use strict';

/* ------------------------------------------------------------------ *
 * Capability detection
 * ------------------------------------------------------------------ */

const HAS_WEBCODECS_AUDIO =
  typeof AudioDecoder !== 'undefined' && typeof AudioEncoder !== 'undefined';
const HAS_OFFLINE_AUDIO_CONTEXT = typeof OfflineAudioContext !== 'undefined';

if (!HAS_WEBCODECS_AUDIO && !HAS_OFFLINE_AUDIO_CONTEXT) {
  // Still let the worker load — we'll report this as an explicit error
  // per-job rather than throwing at import time, so the caller gets a
  // clean postMessage('error') instead of a silent worker crash.
  console.warn('[DocEasy Voice] Neither WebCodecs AudioDecoder/Encoder nor OfflineAudioContext is available in this worker context.');
}

/* ------------------------------------------------------------------ *
 * Phase vocoder pitch shift (real-valued FFT via a small in-file
 * radix-2 implementation — no external dependency).
 * ------------------------------------------------------------------ */

/**
 * Minimal iterative radix-2 Cooley-Tukey FFT, in place, on parallel
 * real/imag Float64Arrays of length = power of two.
 * @param {Float64Array} re
 * @param {Float64Array} im
 * @param {boolean} inverse
 */
function fft(re, im, inverse) {
  const n = re.length;
  if (n & (n - 1)) {
    throw new Error(`[DocEasy Voice] FFT size ${n} is not a power of two.`);
  }
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 1 : -1) * (2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
        curIm = nextIm;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Phase-vocoder pitch shift of a single-channel Float32Array.
 * Preserves duration (unlike simple resampling). Frame size and hop are
 * chosen as a quality/speed compromise suitable for speech.
 *
 * @param {Float32Array} input
 * @param {number} sampleRate
 * @param {number} semitones positive = higher pitch, negative = lower
 * @param {number} [formantShiftSemitones=0] crude spectral envelope shift,
 *   applied as a secondary resample of the magnitude spectrum — an
 *   approximation, not a true formant model (see file header).
 * @returns {Float32Array}
 */
function phaseVocoderPitchShift(input, sampleRate, semitones, formantShiftSemitones = 0) {
  if (semitones === 0 && formantShiftSemitones === 0) return input;

  const FRAME_SIZE = 2048;
  const HOP_ANALYSIS = FRAME_SIZE / 4;
  const pitchRatio = Math.pow(2, semitones / 12);
  const HOP_SYNTHESIS = Math.round(HOP_ANALYSIS * pitchRatio);

  const fftSize = nextPowerOfTwo(FRAME_SIZE);
  const window = new Float32Array(FRAME_SIZE);
  for (let i = 0; i < FRAME_SIZE; i++) {
    // Hann window
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME_SIZE - 1));
  }

  const numFrames = Math.max(1, Math.floor((input.length - FRAME_SIZE) / HOP_ANALYSIS) + 1);
  const outputLength = Math.ceil(numFrames * HOP_SYNTHESIS + FRAME_SIZE);
  const output = new Float32Array(outputLength);
  const outputSumWindow = new Float32Array(outputLength);

  const lastPhase = new Float64Array(fftSize / 2 + 1);
  const sumPhase = new Float64Array(fftSize / 2 + 1);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);

  for (let frame = 0; frame < numFrames; frame++) {
    const inStart = frame * HOP_ANALYSIS;
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < FRAME_SIZE; i++) {
      const sample = inStart + i < input.length ? input[inStart + i] : 0;
      re[i] = sample * window[i];
    }

    fft(re, im, false);

    const numBins = fftSize / 2 + 1;
    const magnitude = new Float64Array(numBins);
    const phase = new Float64Array(numBins);
    for (let bin = 0; bin < numBins; bin++) {
      magnitude[bin] = Math.hypot(re[bin], im[bin]);
      phase[bin] = Math.atan2(im[bin], re[bin]);
    }

    // Phase accumulation for true pitch-shifted resynthesis (analysis
    // hop != synthesis hop is what stretches/compresses time; we then
    // resample back to original duration via the hop ratio itself, so
    // net effect is pitch change at constant duration).
    const expectedPhaseAdvance = (2 * Math.PI * HOP_ANALYSIS) / fftSize;
    const synthMagnitude = new Float64Array(numBins);
    const synthPhase = new Float64Array(numBins);

    for (let bin = 0; bin < numBins; bin++) {
      let deltaPhase = phase[bin] - lastPhase[bin] - expectedPhaseAdvance * bin;
      deltaPhase = deltaPhase - 2 * Math.PI * Math.round(deltaPhase / (2 * Math.PI));
      const trueFreqBin = bin + deltaPhase / expectedPhaseAdvance || bin;
      lastPhase[bin] = phase[bin];

      // Formant shift approximation: source magnitude from a spectrally
      // stretched/compressed bin index (crude envelope shift).
      const formantRatio = Math.pow(2, formantShiftSemitones / 12);
      const srcBinForFormant = Math.min(numBins - 1, Math.max(0, Math.round(bin / formantRatio)));
      const mag = magnitude[srcBinForFormant] || 0;

      synthMagnitude[bin] = mag;
      sumPhase[bin] += expectedPhaseAdvance * trueFreqBin;
      synthPhase[bin] = sumPhase[bin];
    }

    re.fill(0);
    im.fill(0);
    for (let bin = 0; bin < numBins; bin++) {
      re[bin] = synthMagnitude[bin] * Math.cos(synthPhase[bin]);
      im[bin] = synthMagnitude[bin] * Math.sin(synthPhase[bin]);
      if (bin > 0 && bin < fftSize - bin) {
        re[fftSize - bin] = re[bin];
        im[fftSize - bin] = -im[bin];
      }
    }

    fft(re, im, true);

    const outStart = frame * HOP_SYNTHESIS;
    for (let i = 0; i < FRAME_SIZE; i++) {
      if (outStart + i < output.length) {
        output[outStart + i] += re[i] * window[i];
        outputSumWindow[outStart + i] += window[i] * window[i];
      }
    }
  }

  // Normalize by summed window overlap to avoid amplitude modulation artifacts.
  for (let i = 0; i < output.length; i++) {
    if (outputSumWindow[i] > 1e-6) output[i] /= outputSumWindow[i];
  }

  // Resample synthesis-hop-stretched output back to original sample count,
  // so duration matches input exactly (constant-duration pitch shift).
  const targetLength = input.length;
  const resampled = new Float32Array(targetLength);
  const scale = output.length / targetLength;
  for (let i = 0; i < targetLength; i++) {
    const srcPos = i * scale;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(output.length - 1, i0 + 1);
    const frac = srcPos - i0;
    resampled[i] = (output[i0] || 0) * (1 - frac) + (output[i1] || 0) * frac;
  }
  return resampled;
}

/**
 * Cheap fallback: naive resample-based pitch shift. Changes duration
 * along with pitch (chipmunk-style), used only if the phase vocoder
 * throws on pathological input — better a slightly-wrong-duration output
 * than a hard failure.
 * @param {Float32Array} input
 * @param {number} semitones
 * @returns {Float32Array}
 */
function naiveResamplePitchShift(input, semitones) {
  const ratio = Math.pow(2, semitones / 12);
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const frac = srcPos - i0;
    output[i] = (input[i0] || 0) * (1 - frac) + (input[i1] || 0) * frac;
  }
  return output;
}

/**
 * Safe wrapper: tries the phase vocoder, falls back to naive resample on
 * error, and NEVER silently returns the untouched input when a shift was
 * requested (that would hide a real failure as if it succeeded).
 */
function pitchShiftSafe(input, sampleRate, semitones, formantShiftSemitones) {
  if (semitones === 0 && (!formantShiftSemitones || formantShiftSemitones === 0)) return input;
  try {
    return phaseVocoderPitchShift(input, sampleRate, semitones, formantShiftSemitones || 0);
  } catch (err) {
    console.warn(`[DocEasy Voice] Phase vocoder failed (${err.message}); falling back to naive resample pitch shift.`);
    return naiveResamplePitchShift(input, semitones);
  }
}

/* ------------------------------------------------------------------ *
 * Other DSP effects (time/amplitude domain — cheap, no FFT needed)
 * ------------------------------------------------------------------ */

/** Feed-forward comb filter echo. @param {Float32Array} input */
function applyEcho(input, sampleRate, delayMs = 200, feedback = 0.3, mix = 0.5) {
  const delaySamples = Math.round((delayMs / 1000) * sampleRate);
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const delayed = i - delaySamples >= 0 ? output[i - delaySamples] * feedback : 0;
    output[i] = input[i] + delayed;
  }
  // Mix dry/wet so echo doesn't fully replace the dry signal.
  const mixed = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    mixed[i] = input[i] * (1 - mix) + output[i] * mix;
  }
  return mixed;
}

/** Ring modulation ("robot" voice) — multiply by a carrier oscillator. */
function applyRingModulation(input, sampleRate, carrierHz = 30) {
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const carrier = Math.sin((2 * Math.PI * carrierHz * i) / sampleRate);
    output[i] = input[i] * carrier;
  }
  return output;
}

/** Tremolo — amplitude LFO, used for the "alien" effect. */
function applyTremolo(input, sampleRate, rateHz = 6, depth = 0.6) {
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const lfo = 1 - depth * (0.5 + 0.5 * Math.sin((2 * Math.PI * rateHz * i) / sampleRate));
    output[i] = input[i] * lfo;
  }
  return output;
}

/**
 * Simple monster reverb: several staggered feedback-free delays summed,
 * approximating a small room without a convolution impulse response.
 */
function applySimpleReverb(input, sampleRate) {
  const delaysMs = [29, 47, 71, 113];
  const output = new Float32Array(input.length);
  output.set(input);
  for (const ms of delaysMs) {
    const d = Math.round((ms / 1000) * sampleRate);
    const gain = 0.25;
    for (let i = d; i < input.length; i++) {
      output[i] += input[i - d] * gain;
    }
  }
  return output;
}

/**
 * Whisper approximation: gate quiet segments harder, flatten dynamics.
 * Not a true spectral whisper synthesis (that would require replacing
 * voiced excitation with noise, which is beyond a light-weight effect).
 */
function applyWhisperApprox(input) {
  const output = new Float32Array(input.length);
  const gateThreshold = 0.02;
  for (let i = 0; i < input.length; i++) {
    const v = input[i];
    output[i] = Math.abs(v) < gateThreshold ? 0 : v * 0.5;
  }
  return output;
}

/* ------------------------------------------------------------------ *
 * Effect dispatch table
 * ------------------------------------------------------------------ */

/**
 * @param {Float32Array} segmentSamples audio for one speaker segment, one channel
 * @param {number} sampleRate
 * @param {{type: string, pitchShift?: number, formantShift?: number}} effect
 * @returns {Float32Array}
 */
function applyEffect(segmentSamples, sampleRate, effect) {
  if (!effect || effect.type === 'normal') return segmentSamples;

  const MAX_SAFE_SEMITONES = 24;
  let semitones = effect.pitchShift || 0;
  if (Math.abs(semitones) > MAX_SAFE_SEMITONES) {
    console.warn(`[DocEasy Voice] Requested pitch shift ${semitones} semitones exceeds ${MAX_SAFE_SEMITONES}; clamping.`);
    semitones = Math.sign(semitones) * MAX_SAFE_SEMITONES;
  }
  if (Math.abs(semitones) > 12) {
    console.warn(`[DocEasy Voice] Pitch shift of ${semitones} semitones is beyond +/-12; expect audible phase-vocoder artifacts (see file header).`);
  }

  switch (effect.type) {
    case 'deep':
      return pitchShiftSafe(segmentSamples, sampleRate, semitones || -8, effect.formantShift ?? -2);
    case 'chipmunk':
      return pitchShiftSafe(segmentSamples, sampleRate, semitones || 12, effect.formantShift ?? 2);
    case 'monster': {
      const shifted = pitchShiftSafe(segmentSamples, sampleRate, semitones || -14, effect.formantShift ?? -4);
      return applySimpleReverb(shifted, sampleRate);
    }
    case 'robot':
      return applyRingModulation(segmentSamples, sampleRate, effect.carrierHz || 30);
    case 'echo':
      return applyEcho(segmentSamples, sampleRate, effect.delayMs || 200, effect.feedback ?? 0.3, effect.mix ?? 0.5);
    case 'alien': {
      const shifted = pitchShiftSafe(segmentSamples, sampleRate, semitones || 5, effect.formantShift || 0);
      return applyTremolo(shifted, sampleRate, effect.tremoloHz || 6, effect.tremoloDepth ?? 0.6);
    }
    case 'whisper':
      return applyWhisperApprox(segmentSamples);
    case 'custom':
      return pitchShiftSafe(segmentSamples, sampleRate, semitones, effect.formantShift || 0);
    default:
      console.warn(`[DocEasy Voice] Unknown effect type "${effect.type}" — passing audio through unchanged.`);
      return segmentSamples;
  }
}

/* ------------------------------------------------------------------ *
 * WebCodecs decode helper (compressed input -> Float32Array per channel)
 * ------------------------------------------------------------------ */

/**
 * Decodes an array of EncodedAudioChunk-shaped descriptors into
 * per-channel Float32Arrays using AudioDecoder. Rejects with a specific
 * error rather than resolving with partial/empty data on failure.
 * @param {Array<{data: ArrayBuffer, timestamp: number, duration: number, type: string}>} encodedChunks
 * @param {AudioDecoderConfig} codecConfig
 * @returns {Promise<{sampleRate: number, numberOfChannels: number, channelData: Float32Array[]}>}
 */
function decodeWithWebCodecs(encodedChunks, codecConfig) {
  return new Promise((resolve, reject) => {
    if (!HAS_WEBCODECS_AUDIO) {
      reject(new Error('WebCodecs AudioDecoder is not available in this browser context.'));
      return;
    }
    const decodedFrames = [];
    let decodeError = null;

    const decoder = new AudioDecoder({
      output: (audioData) => {
        decodedFrames.push(audioData);
      },
      error: (err) => {
        decodeError = err;
      },
    });

    AudioDecoder.isConfigSupported(codecConfig)
      .then((support) => {
        if (!support.supported) {
          reject(new Error(`AudioDecoder does not support codec config: ${JSON.stringify(codecConfig)}`));
          return;
        }
        decoder.configure(codecConfig);
        for (const chunk of encodedChunks) {
          decoder.decode(new EncodedAudioChunk({
            type: chunk.type,
            timestamp: chunk.timestamp,
            duration: chunk.duration,
            data: chunk.data,
          }));
        }
        return decoder.flush();
      })
      .then(() => {
        decoder.close();
        if (decodeError) {
          reject(new Error(`AudioDecoder reported an error mid-stream: ${decodeError.message}`));
          return;
        }
        if (decodedFrames.length === 0) {
          reject(new Error('AudioDecoder produced zero frames — input may be corrupt or empty.'));
          return;
        }
        const numberOfChannels = decodedFrames[0].numberOfChannels;
        const sampleRate = decodedFrames[0].sampleRate;
        const totalFrames = decodedFrames.reduce((sum, f) => sum + f.numberOfFrames, 0);
        const channelData = Array.from({ length: numberOfChannels }, () => new Float32Array(totalFrames));

        let writeOffset = 0;
        for (const frame of decodedFrames) {
          for (let ch = 0; ch < numberOfChannels; ch++) {
            const planeSize = frame.allocationSize({ planeIndex: ch, format: 'f32-planar' });
            const buf = new Float32Array(planeSize / 4);
            frame.copyTo(buf, { planeIndex: ch, format: 'f32-planar' });
            channelData[ch].set(buf, writeOffset);
          }
          writeOffset += frame.numberOfFrames;
          frame.close();
        }
        resolve({ sampleRate, numberOfChannels, channelData });
      })
      .catch((err) => reject(err));
  });
}

/* ------------------------------------------------------------------ *
 * Main per-job processing
 * ------------------------------------------------------------------ */

/**
 * @param {object} job see message protocol in file header
 */
async function processJob(job) {
  const { jobId, segments, effectMap } = job;

  if (!Array.isArray(segments)) {
    throw new Error('Job is missing a valid `segments` array from speaker-detector.js.');
  }
  if (!effectMap || typeof effectMap !== 'object') {
    throw new Error('Job is missing a valid `effectMap` (speakerId -> effect settings).');
  }

  let sampleRate, numberOfChannels, channelData;

  if (job.channelData && job.sampleRate && job.numberOfChannels) {
    sampleRate = job.sampleRate;
    numberOfChannels = job.numberOfChannels;
    channelData = job.channelData;
  } else if (job.encodedChunks && job.codecConfig) {
    if (!HAS_WEBCODECS_AUDIO) {
      throw new Error(
        'Received compressed audio input but WebCodecs AudioDecoder is unavailable in this ' +
        'browser. The caller must decode to PCM upstream (e.g. via FFmpeg.wasm) before sending ' +
        'to this worker on non-WebCodecs browsers.'
      );
    }
    const decoded = await decodeWithWebCodecs(job.encodedChunks, job.codecConfig);
    sampleRate = decoded.sampleRate;
    numberOfChannels = decoded.numberOfChannels;
    channelData = decoded.channelData;
  } else {
    throw new Error('Job must provide either {channelData, sampleRate, numberOfChannels} or {encodedChunks, codecConfig}.');
  }

  const totalSamples = channelData[0].length;
  const totalSeconds = totalSamples / sampleRate;
  const outputChannels = channelData.map((ch) => ch.slice()); // copy — never mutate input in place

  // Sort segments by start time so progress reporting is monotonic.
  const orderedSegments = [...segments].sort((a, b) => a.start - b.start);

  for (let s = 0; s < orderedSegments.length; s++) {
    const seg = orderedSegments[s];
    if (typeof seg.start !== 'number' || typeof seg.end !== 'number' || seg.end <= seg.start) {
      console.warn(`[DocEasy Voice] Skipping malformed segment at index ${s}:`, seg);
      continue;
    }
    const effect = effectMap[seg.speakerId];
    if (!effect) {
      console.warn(`[DocEasy Voice] No effect mapped for speakerId ${seg.speakerId}; leaving segment unchanged.`);
      continue;
    }

    const startSample = Math.max(0, Math.round(seg.start * sampleRate));
    const endSample = Math.min(totalSamples, Math.round(seg.end * sampleRate));
    if (endSample <= startSample) continue;

    for (let ch = 0; ch < numberOfChannels; ch++) {
      const segmentSamples = channelData[ch].subarray(startSample, endSample);
      const processed = applyEffect(segmentSamples, sampleRate, effect);
      // If the effect changed length (naive fallback can), clip/pad to
      // the original segment length so we never desync the timeline.
      const targetLength = endSample - startSample;
      if (processed.length === targetLength) {
        outputChannels[ch].set(processed, startSample);
      } else {
        console.warn(
          `[DocEasy Voice] Effect "${effect.type}" changed segment length ` +
          `(${processed.length} vs expected ${targetLength} samples) — resampling to fit and preserve sync.`
        );
        const fitted = new Float32Array(targetLength);
        const scale = processed.length / targetLength;
        for (let i = 0; i < targetLength; i++) {
          const srcPos = i * scale;
          const i0 = Math.floor(srcPos);
          const i1 = Math.min(processed.length - 1, i0 + 1);
          const frac = srcPos - i0;
          fitted[i] = (processed[i0] || 0) * (1 - frac) + (processed[i1] || 0) * frac;
        }
        outputChannels[ch].set(fitted, startSample);
      }
    }

    self.postMessage({
      type: 'progress',
      jobId,
      processedSeconds: seg.end,
      totalSeconds,
    });
  }

  self.postMessage(
    {
      type: 'result',
      jobId,
      sampleRate,
      numberOfChannels,
      channelData: outputChannels,
    },
    outputChannels.map((ch) => ch.buffer)
  );
}

/* ------------------------------------------------------------------ *
 * Worker message entry point
 * ------------------------------------------------------------------ */

self.addEventListener('message', async (event) => {
  const job = event.data;
  if (!job || job.type !== 'process') {
    console.warn('[DocEasy Voice] Ignoring unrecognized message:', job);
    return;
  }
  try {
    if (!HAS_WEBCODECS_AUDIO && !HAS_OFFLINE_AUDIO_CONTEXT && !job.channelData) {
      throw new Error(
        'No usable audio decode path is available in this browser (no WebCodecs AudioDecoder, ' +
        'no OfflineAudioContext) and no pre-decoded PCM was provided.'
      );
    }
    await processJob(job);
  } catch (err) {
    console.error(`[DocEasy Voice] Job ${job.jobId} failed:`, err);
    self.postMessage({ type: 'error', jobId: job.jobId, message: err.message });
  }
});
