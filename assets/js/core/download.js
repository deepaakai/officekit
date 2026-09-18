export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadAllAsZip(results, zipName = "officekit-compressed.zip") {
  let JSZipModule = window.JSZip;
  if (!JSZipModule) {
    try {
      // Direct CDN import so you don't even have to download JSZip manually
      const module = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
      JSZipModule = module.default || module;
    } catch {
      throw new Error("Failed to load ZIP utility.");
    }
  }

  const zip = new JSZipModule();
  results.forEach(item => {
    zip.file(item.filename, item.blob);
  });

  const content = await zip.generateAsync({
    type: "blob",
    compression: "STORE"
  });

  downloadBlob(content, zipName);
}