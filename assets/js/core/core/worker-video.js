/**
 * [DocEasy Enhancer] worker-video.js
 *
 * Web Worker: decodes a window of video (one chunk-manager 10-30s
 * segment, not the whole file — memory bounds depend on the caller only
 * ever handing this worker one window's EncodedVideoChunks at a time),
 * applies per-frame visual filters, and re-encodes the result. Encoded
 * output chunks are posted back one at a time as they're produced, never
 * buffered as a full array, so a 2-hour file never requires holding more
 * than a handful of frames in memory regardless of total video length.
 *
 * ── Decode/encode strategy ──────────────────────────────────────────
 * WebCodecs `VideoDecoder`/`VideoEncoder` are required — there is no
 * pure-JS video codec fallback worth shipping (a JS H.264/VP9 decoder
 * would be enormous and slow). If WebCodecs is unavailable, this worker
 * reports a clear error; the caller (tools/video-enhancer.html) is
 * responsible for falling back to FFmpeg.wasm at the file level in that
 * case, per the project's documented graceful-degradation rule.
 *
 * ── Filter implementation strategy (documented trade-off) ────────────
 * All pixel adjustments are implemented as manual, deterministic math on
 * raw ImageData (Uint8ClampedArray), NOT via CSS `ctx.filter` shorthand
 * (e.g. `filter: brightness(1.2)`). Trade-off:
 *   - `ctx.filter` is GPU-accelerated and less code, but its exact output
 *     (rounding, color space handling) varies subtly between browser
 *     rendering engines, meaning a live preview on one device could look
 *     slightly different from the final encoded file processed on
 *     another device/browser. That mismatch is worse than the perf cost
 *     here, so this file uses explicit per-pixel math instead —
 *     slower per frame, but bit-for-bit consistent everywhere.
 *   - Cost: brightness/contrast/saturation are O(pixels) single-pass and
 *     cheap. Blur/sharpen/cartoon require convolution passes and are the
 *     most expensive; blur is implemented as 3 stacked box blurs
 *     (approximates a Gaussian at a fraction of the cost of a true
 *     large-radius Gaussian kernel).
 *
 * ── Memory management ────────────────────────────────────────────────
 *   - Every VideoFrame from the decoder is drawn to an OffscreenCanvas,
 *     filtered, turned into a new VideoFrame, and the ORIGINAL frame is
 *     `.close()`d immediately — never held past the frame it produced.
 *   - Encoder backpressure: before decoding further chunks, we check
 *     `encoder.encodeQueueSize` and yield (await a microtask/timeout)
 *     if the queue is deep, so encode can't fall arbitrarily far behind
 *     decode and balloon memory with pending frames.
 *   - Output EncodedVideoChunks are posted individually as they arrive,
 *     with their underlying buffer transferred (zero-copy), rather than
 *     collected into one big array before returning.
 *
 * ── Message protocol ─────────────────────────────────────────────────
 * postMessage in:
 *   {
 *     type: 'process',
 *     jobId: string,
 *     encodedChunks: Array<{ data: ArrayBuffer, timestamp: number,
 *                             duration: number, type: string }>,
 *     decoderConfig: VideoDecoderConfig,
 *     encoderConfig: VideoEncoderConfig,   // codec, width, height, bitrate...
 *     filters: {                          // all optional, defaults = no-op
 *       brightness?: number,   // -100..100
 *       contrast?: number,     // -100..100
 *       saturation?: number,   // -100..100
 *       sharpness?: number,    // 0..100
 *       blur?: number,         // 0..100
 *       preset?: 'vintage' | 'cartoon' | 'none'
 *     }
 *   }
 *
 * postMessage out (progress):
 *   { type: 'progress', jobId, framesProcessed, totalFrames }
 *
 * postMessage out (chunk, one per encoded output chunk, streamed):
 *   { type: 'chunk', jobId, chunk: { data: ArrayBuffer, timestamp, duration, type } }
 *   — chunk.data's ArrayBuffer is transferred, not copied.
 *
 * postMessage out (done): { type: 'done', jobId, framesProcessed }
 *
 * postMessage out (error): { type: 'error', jobId, message }
 *
 * No step fails silently: any unrecoverable problem posts an 'error'
 * message with a specific reason rather than returning partial/garbage output.
 */

'use strict';

/* ------------------------------------------------------------------ *
 * Capability detection
 * ------------------------------------------------------------------ */

const HAS_WEBCODECS_VIDEO =
  typeof VideoDecoder !== 'undefined' && typeof VideoEncoder !== 'undefined';
const HAS_OFFSCREEN_CANVAS = typeof OffscreenCanvas !== 'undefined';

if (!HAS_WEBCODECS_VIDEO) {
  console.warn('[DocEasy Enhancer] WebCodecs VideoDecoder/VideoEncoder not available in this worker context.');
}
if (!HAS_OFFSCREEN_CANVAS) {
  console.warn('[DocEasy Enhancer] OffscreenCanvas not available in this worker context — frame filtering cannot run here.');
}

const ENCODER_QUEUE_BACKPRESSURE_LIMIT = 8; // frames pending encode before we pause decode

/* ------------------------------------------------------------------ *
 * Pixel-level filter primitives (operate in place on Uint8ClampedArray
 * RGBA data from ImageData.data)
 * ------------------------------------------------------------------ */

/** @param {Uint8ClampedArray} data @param {number} amount -100..100 */
function applyBrightness(data, amount) {
  if (!amount) return;
  const offset = (amount / 100) * 255;
  for (let i = 0; i < data.length; i += 4) {
    data[i] += offset;
    data[i + 1] += offset;
    data[i + 2] += offset;
  }
}

/** @param {Uint8ClampedArray} data @param {number} amount -100..100 */
function applyContrast(data, amount) {
  if (!amount) return;
  const factor = (259 * (amount + 255)) / (255 * (259 - amount));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = factor * (data[i] - 128) + 128;
    data[i + 1] = factor * (data[i + 1] - 128) + 128;
    data[i + 2] = factor * (data[i + 2] - 128) + 128;
  }
}

/** @param {Uint8ClampedArray} data @param {number} amount -100..100 */
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

/**
 * Separable box blur, applied `passes` times to approximate a Gaussian
 * blur at much lower cost than a large true Gaussian kernel.
 * @param {ImageData} imageData
 * @param {number} radius pixel radius, derived from a 0..100 UI value
 * @param {number} [passes=3]
 */
function boxBlur(imageData, radius, passes = 3) {
  if (radius <= 0) return imageData;
  const { width, height, data } = imageData;
  let src = data;
  for (let pass = 0; pass < passes; pass++) {
    src = boxBlurPass(src, width, height, radius);
  }
  imageData.data.set(src);
  return imageData;
}

function boxBlurPass(src, width, height, radius) {
  const out = new Uint8ClampedArray(src.length);
  const size = radius * 2 + 1;
  // Horizontal pass
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
  // Vertical pass
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

/**
 * Unsharp mask sharpening: output = original + amount * (original - blurred).
 * @param {ImageData} imageData mutated in place
 * @param {number} amount 0..100
 */
function applySharpen(imageData, amount) {
  if (!amount) return;
  const strength = amount / 100;
  const { width, height, data } = imageData;
  const blurredData = boxBlurPass(data, width, height, 1);
  for (let i = 0; i < data.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const orig = data[i + ch];
      const blurred = blurredData[i + ch];
      data[i + ch] = orig + strength * (orig - blurred);
    }
  }
}

/**
 * Vintage preset: teal-orange split tone (shadows pushed teal, highlights
 * pushed orange) plus a radial vignette darkening toward the edges.
 * @param {ImageData} imageData mutated in place
 */
function applyVintagePreset(imageData) {
  const { width, height, data } = imageData;
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.hypot(cx, cy);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // Shadows -> teal (boost G/B, reduce R); highlights -> orange (boost R, reduce B).
      const shadowPull = (1 - luma) * 0.15;
      const highlightPull = luma * 0.15;
      data[i] = r - r * shadowPull * 255 / 255 + r * highlightPull;
      data[i + 1] = g + g * shadowPull * 0.5;
      data[i + 2] = b + b * shadowPull - b * highlightPull;

      const dist = Math.hypot(x - cx, y - cy) / maxDist;
      const vignette = 1 - Math.pow(dist, 2.2) * 0.5;
      data[i] *= vignette;
      data[i + 1] *= vignette;
      data[i + 2] *= vignette;
    }
  }
}

/**
 * Cartoon preset: Sobel edge detection darkened into black outlines,
 * composited over a posterized (color-quantized) version of the frame.
 * @param {ImageData} imageData mutated in place
 */
function applyCartoonPreset(imageData) {
  const { width, height, data } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const edges = new Uint8Array(width * height);
  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sx = 0, sy = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const v = gray[(y + dy) * width + (x + dx)];
          sx += v * gx[k];
          sy += v * gy[k];
          k++;
        }
      }
      const mag = Math.hypot(sx, sy);
      edges[y * width + x] = mag > 80 ? 1 : 0;
    }
  }

  const levels = 4; // posterize step count
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (edges[p]) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    } else {
      data[i] = Math.round((data[i] / 255) * (levels - 1)) * (255 / (levels - 1));
      data[i + 1] = Math.round((data[i + 1] / 255) * (levels - 1)) * (255 / (levels - 1));
      data[i + 2] = Math.round((data[i + 2] / 255) * (levels - 1)) * (255 / (levels - 1));
    }
  }
}

/**
 * Applies the full filter set to one ImageData in the documented order:
 * color adjustments -> blur/sharpen -> preset overlay last (presets are
 * stylistic and expected to dominate the look).
 * @param {ImageData} imageData mutated in place
 * @param {object} filters see message protocol in file header
 */
function applyFilters(imageData, filters) {
  if (!filters) return imageData;
  const data = imageData.data;

  applyBrightness(data, filters.brightness || 0);
  applyContrast(data, filters.contrast || 0);
  applySaturation(data, filters.saturation || 0);

  if (filters.blur) {
    const radius = Math.max(1, Math.round((filters.blur / 100) * 8));
    boxBlur(imageData, radius, 3);
  }
  if (filters.sharpness) {
    applySharpen(imageData, filters.sharpness);
  }

  if (filters.preset === 'vintage') applyVintagePreset(imageData);
  else if (filters.preset === 'cartoon') applyCartoonPreset(imageData);
  else if (filters.preset && filters.preset !== 'none') {
    console.warn(`[DocEasy Enhancer] Unknown preset "${filters.preset}" — skipping preset step (color adjustments still applied).`);
  }

  return imageData;
}

/* ------------------------------------------------------------------ *
 * Frame processing: VideoFrame -> filtered VideoFrame
 * ------------------------------------------------------------------ */

let sharedCanvas = null;
let sharedCtx = null;

/**
 * @param {VideoFrame} frame caller retains ownership of closing the
 *   ORIGINAL frame; this function does not close it.
 * @param {object} filters
 * @returns {VideoFrame} a new frame the caller must eventually close
 */
function filterFrame(frame, filters) {
  if (!HAS_OFFSCREEN_CANVAS) {
    throw new Error('OffscreenCanvas is unavailable — cannot filter video frames in this worker.');
  }
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

  return new VideoFrame(sharedCanvas, {
    timestamp: frame.timestamp,
    duration: frame.duration ?? undefined,
  });
}

/* ------------------------------------------------------------------ *
 * Main per-job processing
 * ------------------------------------------------------------------ */

/**
 * @param {object} job see message protocol in file header
 */
async function processJob(job) {
  const { jobId, encodedChunks, decoderConfig, encoderConfig, filters } = job;

  if (!HAS_WEBCODECS_VIDEO) {
    throw new Error('WebCodecs VideoDecoder/VideoEncoder is unavailable in this browser — cannot process video here.');
  }
  if (!Array.isArray(encodedChunks) || encodedChunks.length === 0) {
    throw new Error('Job provided no encodedChunks to process.');
  }
  if (!decoderConfig) throw new Error('Job is missing decoderConfig.');
  if (!encoderConfig) throw new Error('Job is missing encoderConfig.');

  const decodeSupport = await VideoDecoder.isConfigSupported(decoderConfig);
  if (!decodeSupport.supported) {
    throw new Error(`VideoDecoder does not support the given decoderConfig: ${JSON.stringify(decoderConfig)}`);
  }
  const encodeSupport = await VideoEncoder.isConfigSupported(encoderConfig);
  if (!encodeSupport.supported) {
    throw new Error(`VideoEncoder does not support the given encoderConfig: ${JSON.stringify(encoderConfig)}`);
  }

  let framesProcessed = 0;
  const totalFrames = encodedChunks.length;
  let pendingError = null;

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      const buf = new ArrayBuffer(chunk.byteLength);
      chunk.copyTo(buf);
      self.postMessage(
        {
          type: 'chunk',
          jobId,
          chunk: {
            data: buf,
            timestamp: chunk.timestamp,
            duration: chunk.duration ?? 0,
            type: chunk.type,
          },
          metadata: metadata || null,
        },
        [buf]
      );
    },
    error: (err) => {
      pendingError = err;
    },
  });
  encoder.configure(encoderConfig);

  const decoder = new VideoDecoder({
    output: (frame) => {
      let filtered = null;
      try {
        filtered = filterFrame(frame, filters);
      } catch (err) {
        frame.close();
        pendingError = err;
        return;
      }
      frame.close(); // original frame released the moment we're done with it

      try {
        encoder.encode(filtered);
      } finally {
        filtered.close(); // encoder copies what it needs; we don't hold this frame
      }

      framesProcessed++;
      self.postMessage({ type: 'progress', jobId, framesProcessed, totalFrames });
    },
    error: (err) => {
      pendingError = err;
    },
  });
  decoder.configure(decoderConfig);

  for (const chunkDesc of encodedChunks) {
    if (pendingError) break;

    // Backpressure: don't let the encoder queue balloon in memory while
    // decode races ahead of it.
    while (encoder.encodeQueueSize > ENCODER_QUEUE_BACKPRESSURE_LIMIT && !pendingError) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    decoder.decode(new EncodedVideoChunk({
      type: chunkDesc.type,
      timestamp: chunkDesc.timestamp,
      duration: chunkDesc.duration,
      data: chunkDesc.data,
    }));
  }

  if (!pendingError) {
    await decoder.flush();
    await encoder.flush();
  }

  decoder.close();
  encoder.close();

  if (pendingError) {
    throw new Error(`Video codec error mid-stream: ${pendingError.message || pendingError}`);
  }
  if (framesProcessed === 0) {
    throw new Error('Zero frames were decoded — input chunks may be corrupt or empty.');
  }

  self.postMessage({ type: 'done', jobId, framesProcessed });
}

/* ------------------------------------------------------------------ *
 * Worker message entry point
 * ------------------------------------------------------------------ */

self.addEventListener('message', async (event) => {
  const job = event.data;
  if (!job || job.type !== 'process') {
    console.warn('[DocEasy Enhancer] Ignoring unrecognized message:', job);
    return;
  }
  try {
    await processJob(job);
  } catch (err) {
    console.error(`[DocEasy Enhancer] Job ${job.jobId} failed:`, err);
    self.postMessage({ type: 'error', jobId: job.jobId, message: err.message });
  }
});
