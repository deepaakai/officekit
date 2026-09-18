export function validateFiles(files, config) {
  const valid = [];
  const errors = [];

  if (!files || files.length === 0) {
    throw new Error("Please select at least one image.");
  }

  for (const file of files) {
    if (config.accepts && !config.accepts.includes(file.type)) {
      errors.push(`${file.name}: unsupported file type.`);
      continue;
    }

    if (config.maxSizeMB && file.size > config.maxSizeMB * 1024 * 1024) {
      errors.push(`${file.name}: file exceeds ${config.maxSizeMB} MB.`);
      continue;
    }

    valid.push(file);
  }

  if (valid.length === 0) {
    throw new Error(errors.join(" "));
  }

  return { valid, errors };
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}