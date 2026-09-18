const MIME = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

const EXT = {
  jpeg: "jpg",
  png: "png",
  webp: "webp"
};

async function loadBitmap(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to <img>
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawToCanvas(source, scale = 1) {
  const canvas = document.createElement("canvas");
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error("Encoding failed"))),
      mime,
      quality
    );
  });
}

async function compressToTarget(sourceBitmap, mime, targetBytes) {
  if (mime === "image/png") {
    const baseCanvas = drawToCanvas(sourceBitmap, 1);
    return await canvasToBlob(baseCanvas, mime);
  }

  let scale = 1;
  const maxDownscalePasses = 3;

  for (let pass = 0; pass <= maxDownscalePasses; pass++) {
    const canvas = drawToCanvas(sourceBitmap, scale);

    const minBlob = await canvasToBlob(canvas, mime, 0.05);
    if (minBlob.size > targetBytes) {
      if (pass < maxDownscalePasses) {
        scale *= 0.75;
        continue;
      }
      return minBlob;
    }

    let low = 0.05;
    let high = 0.95;
    let bestBlob = minBlob;

    for (let i = 0; i < 5; i++) {
      const quality = (low + high) / 2;
      const blob = await canvasToBlob(canvas, mime, quality);

      if (blob.size <= targetBytes) {
        bestBlob = blob;
        low = quality;
      } else {
        high = quality;
      }
    }

    return bestBlob;
  }
}

function renameFile(originalName, extension) {
  const base = originalName.replace(/\.[^.]+$/, "");
  return `${base}-compressed.${extension}`;
}

export default {
  async process(file, options, onProgress) {
    onProgress?.({ phase: "decode", percent: 15 });
    const bitmap = await loadBitmap(file);

    const format = options.format || "jpeg";
    const mime = MIME[format];
    if (!mime) throw new Error("Unsupported format");

    let blob;
    if (options.mode === "target") {
      const targetBytes = Math.max(1, Number(options.targetKB) * 1024);
      onProgress?.({ phase: "compress", percent: 50 });
      blob = await compressToTarget(bitmap, mime, targetBytes);
    } else {
      const quality = Math.min(1, Math.max(0.05, Number(options.quality || 80) / 100));
      onProgress?.({ phase: "compress", percent: 50 });
      const canvas = drawToCanvas(bitmap, 1);
      blob = await canvasToBlob(canvas, mime, quality);
    }

    if (bitmap.close) bitmap.close();

    onProgress?.({ phase: "done", percent: 100 });
    const savedPercent = Math.round((1 - blob.size / file.size) * 100);

    return {
      blob,
      filename: renameFile(file.name, EXT[format]),
      meta: {
        originalSize: file.size,
        compressedSize: blob.size,
        savedPercent
      }
    };
  }
};