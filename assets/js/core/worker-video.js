/**
 * [DocEasy Enhancer] worker-video.js — v2
 *
 * Adds a second operating mode to the existing decode→filter→encode
 * pipeline: a persistent "passthrough encode session" used by
 * video-voice-changer.html's mp4-muxer pipeline. In this mode the main
 * thread supplies already-decoded VideoFrames (captured from a hidden
 * <video> element via requestVideoFrameCallback — see
 * video-voice-changer.html), and this worker's only job is to encode
 * them and stream EncodedVideoChunks back for muxing.
 *
 * ── Why this exists / honest trade-off ───────────────────────────────
 * There is still no pure-JS demuxer wired into this project for the
 * *original* video container, so a true zero-re-encode bitstream copy
 * (what FFmpeg's `-c:v copy` did) is not possible here. The
 * mobile-safe, FFmpeg-free replacement decodes the source via the
 * browser's own native <video> element (which every browser already
 * demuxes/decodes without SharedArrayBuffer) and re-encodes each
 * presented frame through VideoEncoder. That means: (a) this is a real
 * re-encode, with the generation-loss that implies, and (b) capture
 * runs at roughly real-time relative to the video's own duration/
 * playback rate, not the fast "copy" speed of the old approach. This
 * is documented here and surfaced to the user in video-voice-changer.html
 * rather than silently presented as lossless or fast.
 *
 * ── New message protocol (passthrough mode) ──────────────────────────
 *   in:  { type: 'start-passthrough-encode', jobId, encoderConfig }
 *   in:  { type: 'encode-frame', jobId, frame: VideoFrame }  (frame transferred)
 *   in:  { type: 'finish-passthrough-encode', jobId }
 *
 *   out: { type: 'chunk', jobId, chunk: {data, timestamp, duration, type}, metadata }
 *   out: { type: 'frame-ack', jobId, queueSize }   — for main-thread backpressure
 *   out: { type: 'encode-done', jobId }
 *   out: { type: 'session-error', jobId, message }
 *
 * The original 'process' mode (decode→filter→encode, used by the
 * Enhancer tool) is unchanged and still supported below.
 */

'use strict';

const HAS_WEBCODECS_VIDEO =
  typeof VideoDecoder !== 'undefined' && typeof VideoEncoder !== 'undefined';
const HAS_OFFSCREEN_CANVAS = typeof OffscreenCanvas !== 'undefined';

if (!HAS_WEBCODECS_VIDEO) {
  console.warn('[DocEasy Enhancer] WebCodecs VideoDecoder/VideoEncoder not available in this worker context.');
}
if (!HAS_OFFSCREEN_CANVAS) {
  console.warn('[DocEasy Enhancer] OffscreenCanvas not available in this worker context — frame filtering cannot run here.');
}

const ENCODER_QUEUE_BACKPRESSURE_LIMIT = 8;

/* ------------------------------------------------------------------ *
 * Pixel-level filter primitives (unchanged from v1 — used only by the
 * 'process' mode below, not by passthrough encoding)
 * ------------------------------------------------------------------ */

function applyBrightness(data, amount) {
  if (!amount) return;
  const offset = (amount / 100) * 255;
  for (let i = 0; i < data.length; i += 4) {
    data[i] += offset; data[i + 1] += offset; data[i + 2] += offset;
  }
}
function applyContrast(data, amount) {
  if (!amount) return;
  const factor = (259 * (amount + 255)) / (255 * (259 - amount));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = factor * (data[i] - 128) + 128;
    data[i + 1] = factor * (data[i + 1] - 128) + 128;
    data[i + 2] = factor * (data[i + 2] - 128) + 128;
  }
}
function applySaturation(data, amount) {
  if (!amount) return;
  const factor = 1 + amount / 100;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    data[i] = gray + (r - gray) * factor;
    data[i + 1] = gray + (g - gray) * factor;
    data[i + 2] = gray + (b - gray) * factor;
  }
}
function boxBlurPass(src, width, height, radius) {
  const out = new Uint8ClampedArray(src.length);
  const size = radius * 2 + 1;
  const temp = new Uint8ClampedArray(src.length);
  for (let y = 0; y < height; y++) {
    for (let ch = 0; ch < 4; ch++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.min(width - 1, Math.max(0, k));
        sum += src[(y * width + xx) * 4 + ch];
      }
      for (let x = 0; x < width; x++) {
        temp[(y * width + x) * 4 + ch] = sum / size;
        const addX = Math.min(width - 1, x + radius + 1);
        const subX = Math.max(0, x - radius);
        sum += src[(y * width + addX) * 4 + ch] - src[(y * width + subX) * 4 + ch];
      }
    }
  }
  for (let x = 0; x < width; x++) {
    for (let ch = 0; ch < 4; ch++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.min(height - 1, Math.max(0, k));
        sum += temp[(yy * width + x) * 4 + ch];
      }
      for (let y = 0; y < height; y++) {
        out[(y * width + x) * 4 + ch] = sum / size;
        const addY = Math.min(height - 1, y + radius + 1);
        const subY = Math.max(0, y - radius);
        sum += temp[(addY * width + x) * 4 + ch] - temp[(subY * width + x) * 4 + ch];
      }
    }
  }
  return out;
}
function boxBlur(imageData, radius, passes = 3) {
  if (radius <= 0) return imageData;
  const { width, height, data } = imageData;
  let src = data;
  for (let pass = 0; pass < passes; pass++) src = boxBlurPass(src, width, height, radius);
  imageData.data.set(src);
  return imageData;
}
function applySharpen(imageData, amount) {
  if (!amount) return;
  const strength = amount / 100;
  const { width, height, data } = imageData;
  const blurredData = boxBlurPass(data, width, height, 1);
  for (let i = 0; i < data.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      data[i + ch] = data[i + ch] + strength * (data[i + ch] - blurredData[i + ch]);
    }
  }
}
function applyFilters(imageData, filters) {
  if (!filters) return imageData;
  const data = imageData.data;
  applyBrightness(data, filters.brightness || 0);
  applyContrast(data, filters.contrast || 0);
  applySaturation(data, filters.saturation || 0);
  if (filters.blur) boxBlur(imageData, Math.max(1, Math.round((filters.blur / 100) * 8)), 3);
  if (filters.sharpness) applySharpen(imageData, filters.sharpness);
  return imageData;
}

let sharedCanvas = null;
let sharedCtx = null;

function filterFrame(frame, filters) {
  if (!HAS_OFFSCREEN_CANVAS) throw new Error('OffscreenCanvas is unavailable — cannot filter video frames in this worker.');
  const width = frame.displayWidth;
  const height = frame.displayHeight;
  if (!sharedCanvas || sharedCanvas.width !== width || sharedCanvas.height !== height) {
    sharedCanvas = new OffscreenCanvas(width, height);
    sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
    if (!sharedCtx) throw new Error('Failed to acquire 2D context on OffscreenCanvas.');
  }
  sharedCtx.drawImage(frame, 0, 0, width, height);
  const imageData = sharedCtx.getImageData(0, 0, width, height);
  applyFilters(imageData, filters);
  sharedCtx.putImageData(imageData, 0, 0);
  return new VideoFrame(sharedCanvas, { timestamp: frame.timestamp, duration: frame.duration ?? undefined });
}

/* ------------------------------------------------------------------ *
 * MODE A: original decode -> filter -> encode job (Enhancer tool)
 * ------------------------------------------------------------------ */

async function processJob(job) {
  const { jobId, encodedChunks, decoderConfig, encoderConfig, filters } = job;
  if (!HAS_WEBCODECS_VIDEO) throw new Error('WebCodecs VideoDecoder/VideoEncoder is unavailable in this browser.');
  if (!Array.isArray(encodedChunks) || encodedChunks.length === 0) throw new Error('Job provided no encodedChunks to process.');
  if (!decoderConfig) throw new Error('Job is missing decoderConfig.');
  if (!encoderConfig) throw new Error('Job is missing encoderConfig.');

  const decodeSupport = await VideoDecoder.isConfigSupported(decoderConfig);
  if (!decodeSupport.supported) throw new Error(`VideoDecoder does not support: ${JSON.stringify(decoderConfig)}`);
  const encodeSupport = await VideoEncoder.isConfigSupported(encoderConfig);
  if (!encodeSupport.supported) throw new Error(`VideoEncoder does not support: ${JSON.stringify(encoderConfig)}`);

  let framesProcessed = 0;
  const totalFrames = encodedChunks.length;
  let pendingError = null;

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      const buf = new ArrayBuffer(chunk.byteLength);
      chunk.copyTo(buf);
      self.postMessage({
        type: 'chunk', jobId,
        chunk: { data: buf, timestamp: chunk.timestamp, duration: chunk.duration ?? 0, type: chunk.type },
        metadata: metadata || null,
      }, [buf]);
    },
    error: (err) => { pendingError = err; },
  });
  encoder.configure(encoderConfig);

  const decoder = new VideoDecoder({
    output: (frame) => {
      let filtered = null;
      try { filtered = filterFrame(frame, filters); }
      catch (err) { frame.close(); pendingError = err; return; }
      frame.close();
      try { encoder.encode(filtered); } finally { filtered.close(); }
      framesProcessed++;
      self.postMessage({ type: 'progress', jobId, framesProcessed, totalFrames });
    },
    error: (err) => { pendingError = err; },
  });
  decoder.configure(decoderConfig);

  for (const chunkDesc of encodedChunks) {
    if (pendingError) break;
    while (encoder.encodeQueueSize > ENCODER_QUEUE_BACKPRESSURE_LIMIT && !pendingError) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    decoder.decode(new EncodedVideoChunk({
      type: chunkDesc.type, timestamp: chunkDesc.timestamp, duration: chunkDesc.duration, data: chunkDesc.data,
    }));
  }

  if (!pendingError) { await decoder.flush(); await encoder.flush(); }
  decoder.close(); encoder.close();

  if (pendingError) throw new Error(`Video codec error mid-stream: ${pendingError.message || pendingError}`);
  if (framesProcessed === 0) throw new Error('Zero frames were decoded — input chunks may be corrupt or empty.');
  self.postMessage({ type: 'done', jobId, framesProcessed });
}

/* ------------------------------------------------------------------ *
 * MODE B: passthrough encode session (used by video-voice-changer.html
 * for its mp4-muxer pipeline — no decoder involved, frames arrive
 * already-decoded from the main thread's <video>+canvas capture loop)
 * ------------------------------------------------------------------ */

/** jobId -> { encoder, framesEncoded, pendingError } */
const passthroughSessions = new Map();

async function startPassthroughEncode(job) {
  const { jobId, encoderConfig } = job;
  if (!HAS_WEBCODECS_VIDEO) throw new Error('WebCodecs VideoEncoder is unavailable in this browser.');
  if (!encoderConfig) throw new Error('start-passthrough-encode requires encoderConfig.');
  if (passthroughSessions.has(jobId)) throw new Error(`A passthrough session for jobId ${jobId} is already running.`);

  const support = await VideoEncoder.isConfigSupported(encoderConfig);
  if (!support.supported) {
    throw new Error(`VideoEncoder does not support the requested encoderConfig for muxing: ${JSON.stringify(encoderConfig)}`);
  }

  const session = { encoder: null, framesEncoded: 0, pendingError: null };
  session.encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      const buf = new ArrayBuffer(chunk.byteLength);
      chunk.copyTo(buf);
      self.postMessage({
        type: 'chunk', jobId,
        chunk: { data: buf, timestamp: chunk.timestamp, duration: chunk.duration ?? 0, type: chunk.type },
        metadata: metadata || null,
      }, [buf]);
    },
    error: (err) => { session.pendingError = err; },
  });
  session.encoder.configure(encoderConfig);
  passthroughSessions.set(jobId, session);
}

async function encodeFrame(job) {
  const { jobId, frame } = job;
  const session = passthroughSessions.get(jobId);
  if (!session) {
    frame.close();
    throw new Error(`encode-frame received for unknown/uninitialized session jobId ${jobId}. Call start-passthrough-encode first.`);
  }
  if (session.pendingError) {
    frame.close();
    throw new Error(`Passthrough encoder for jobId ${jobId} already failed: ${session.pendingError.message || session.pendingError}`);
  }

  try {
    session.encoder.encode(frame);
    session.framesEncoded++;
  } finally {
    frame.close();
  }

  // Let the caller throttle capture rate based on queue depth.
  self.postMessage({ type: 'frame-ack', jobId, queueSize: session.encoder.encodeQueueSize });
}

async function finishPassthroughEncode(job) {
  const { jobId } = job;
  const session = passthroughSessions.get(jobId);
  if (!session) throw new Error(`finish-passthrough-encode called for unknown session jobId ${jobId}.`);

  await session.encoder.flush();
  session.encoder.close();
  passthroughSessions.delete(jobId);

  if (session.pendingError) {
    throw new Error(`Video encoder reported an error during passthrough session: ${session.pendingError.message || session.pendingError}`);
  }
  if (session.framesEncoded === 0) {
    throw new Error('Passthrough encode session finished with zero frames encoded — capture likely failed silently upstream.');
  }
  self.postMessage({ type: 'encode-done', jobId, framesEncoded: session.framesEncoded });
}

/* ------------------------------------------------------------------ *
 * Worker message entry point
 * ------------------------------------------------------------------ */

self.addEventListener('message', async (event) => {
  const job = event.data;
  if (!job || !job.type) { console.warn('[DocEasy Enhancer] Ignoring unrecognized message:', job); return; }

  try {
    switch (job.type) {
      case 'process':
        await processJob(job);
        break;
      case 'start-passthrough-encode':
        await startPassthroughEncode(job);
        break;
      case 'encode-frame':
        await encodeFrame(job);
        break;
      case 'finish-passthrough-encode':
        await finishPassthroughEncode(job);
        break;
      default:
        console.warn(`[DocEasy Enhancer] Unknown message type "${job.type}" — ignoring.`);
    }
  } catch (err) {
    console.error(`[DocEasy Enhancer] Job ${job.jobId} failed (${job.type}):`, err);
    self.postMessage({ type: job.type === 'process' ? 'error' : 'session-error', jobId: job.jobId, message: err.message });
  }
});
