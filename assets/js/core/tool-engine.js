import { TOOLS } from "../config/tools.js";
import { validateFiles, formatBytes } from "./file-handler.js";
import { downloadBlob, downloadAllAsZip } from "./download.js";

const MODULES = {
  "image-compressor": () => import("../modules/image-compressor.js")
};

export async function mountTool(root) {
  if (!root) return;
  const toolId = root.dataset.tool;
  const config = TOOLS[toolId];

  if (!config || !MODULES[config.module]) {
    root.innerHTML = `<div class="error-message">Tool configuration missing.</div>`;
    return;
  }

  try {
    const module = await MODULES[config.module]();
    renderTool(root, config, module.default);
  } catch (error) {
    console.error(error);
    root.innerHTML = `<div class="error-message">Failed to load this tool.</div>`;
  }
}

function renderTool(root, config, processor) {
  root.innerHTML = `
    <div class="tool-box">
      <div class="drop-zone" data-drop-zone>
        <input type="file" data-file-input accept="${config.accepts.join(",")}" ${config.multiple ? "multiple" : ""}>
        <div class="drop-content">
          <div class="upload-icon">↑</div>
          <h3>Drop your images here</h3>
          <p>or tap to choose files</p>
          <p>JPG, PNG, WebP · Max ${config.maxSizeMB} MB/file</p>
        </div>
      </div>

      <div class="file-list" data-file-list></div>

      <div class="options" data-options hidden>
        <div class="option-group">
          <span class="option-label">Compression mode</span>
          <div class="radio-group">
            <div class="radio-option">
              <input id="mode-quality" type="radio" name="compression-mode" value="quality" checked>
              <label for="mode-quality">By Quality</label>
            </div>
            <div class="radio-option">
              <input id="mode-target" type="radio" name="compression-mode" value="target">
              <label for="mode-target">Target KB</label>
            </div>
          </div>
        </div>

        <div class="option-group" data-quality-option>
          <span class="option-label">Image quality</span>
          <div class="range-row">
            <input type="range" min="10" max="100" step="1" value="80" data-quality>
            <span class="value-badge" data-quality-value>80%</span>
          </div>
          <span class="option-note">Lower quality usually creates a smaller file.</span>
        </div>

        <div class="option-group" data-target-option hidden>
          <span class="option-label">Target file size (KB)</span>
          <input class="number-input" type="number" min="5" max="5000" value="100" data-target-kb>
          <span class="option-note">Target mode works best with JPG/WebP.</span>
        </div>

        <div class="option-group">
          <span class="option-label">Output format</span>
          <select class="select-input" data-format>
            <option value="jpeg">JPG</option>
            <option value="webp">WebP</option>
            <option value="png">PNG</option>
          </select>
        </div>
      </div>

      <div class="action-row" data-actions hidden>
        <button class="process-button" type="button" data-process>Compress Images</button>
        <button class="secondary-button" type="button" data-clear>Clear</button>
      </div>

      <div class="progress-wrapper" data-progress-wrapper hidden>
        <div class="progress-info">
          <span data-progress-text>Preparing...</span>
          <span data-progress-percent>0%</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar" data-progress-bar></div>
        </div>
      </div>

      <div class="result-list" data-results></div>
      <div class="error-message" data-error hidden></div>
    </div>
  `;

  const fileInput = root.querySelector("[data-file-input]");
  const dropZone = root.querySelector("[data-drop-zone]");
  const fileList = root.querySelector("[data-file-list]");
  const optionsBox = root.querySelector("[data-options]");
  const actions = root.querySelector("[data-actions]");
  const processButton = root.querySelector("[data-process]");
  const clearButton = root.querySelector("[data-clear]");
  const results = root.querySelector("[data-results]");
  const errorBox = root.querySelector("[data-error]");
  const progressWrapper = root.querySelector("[data-progress-wrapper]");
  const progressBar = root.querySelector("[data-progress-bar]");
  const progressText = root.querySelector("[data-progress-text]");
  const progressPercent = root.querySelector("[data-progress-percent]");
  const quality = root.querySelector("[data-quality]");
  const qualityValue = root.querySelector("[data-quality-value]");
  const targetKB = root.querySelector("[data-target-kb]");
  const format = root.querySelector("[data-format]");
  const qualityOption = root.querySelector("[data-quality-option]");
  const targetOption = root.querySelector("[data-target-option]");

  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const effectiveMax = isMobile ? 10 : config.maxFiles || 20;
  let selectedFiles = [];

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  function renderFiles() {
    fileList.innerHTML = "";
    selectedFiles.forEach((file, index) => {
      const item = document.createElement("div");
      item.className = "file-item";

      const thumb = document.createElement("div");
      thumb.className = "file-thumb";
      const img = document.createElement("img");
      const url = URL.createObjectURL(file);
      img.src = url;
      img.onload = () => URL.revokeObjectURL(url);
      thumb.appendChild(img);

      const info = document.createElement("div");
      info.className = "file-info";
      info.innerHTML = `
        <div class="file-name">${escapeHtml(file.name)}</div>
        <div class="file-size">${formatBytes(file.size)}</div>
      `;

      const remove = document.createElement("button");
      remove.className = "remove-file";
      remove.type = "button";
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        selectedFiles.splice(index, 1);
        renderFiles();
      });

      item.appendChild(thumb);
      item.appendChild(info);
      item.appendChild(remove);
      fileList.appendChild(item);
    });

    const hasFiles = selectedFiles.length > 0;
    optionsBox.hidden = !hasFiles;
    actions.hidden = !hasFiles;
    processButton.disabled = !hasFiles;
  }

  function addFiles(files) {
    clearError();
    try {
      const result = validateFiles(files, config);
      const map = new Map();
      [...selectedFiles, ...result.valid].forEach(file => {
        map.set(`${file.name}|${file.size}|${file.lastModified}`, file);
      });
      const unique = Array.from(map.values());
      const toAdd = unique.slice(0, effectiveMax);
      const skipped = unique.length - toAdd.length;

      if (skipped > 0) {
        showError(`Added ${toAdd.length - selectedFiles.length}. ${skipped} skipped (Max limit: ${effectiveMax}).`);
      }

      const totalSize = toAdd.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > 150 * 1024 * 1024) {
        showError("Total batch exceeds 150 MB. Processing might be slow on mobile.");
      }

      selectedFiles = toAdd;
      renderFiles();
    } catch (err) {
      showError(err.message);
    }
  }

  fileInput.addEventListener("change", e => {
    addFiles(Array.from(e.target.files));
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach(name => {
    dropZone.addEventListener(name, e => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach(name => {
    dropZone.addEventListener(name, e => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });

  dropZone.addEventListener("drop", e => {
    addFiles(Array.from(e.dataTransfer.files));
  });

  quality.addEventListener("input", () => {
    qualityValue.textContent = `${quality.value}%`;
  });

  root.querySelectorAll('input[name="compression-mode"]').forEach(radio => {
    radio.addEventListener("change", () => {
      const isTarget = radio.value === "target" && radio.checked;
      qualityOption.hidden = isTarget;
      targetOption.hidden = !isTarget;
    });
  });

  clearButton.addEventListener("click", () => {
    selectedFiles = [];
    results.innerHTML = "";
    clearError();
    progressWrapper.hidden = true;
    renderFiles();
  });

  processButton.addEventListener("click", async () => {
    if (selectedFiles.length === 0) return;
    clearError();
    results.innerHTML = "";
    processButton.disabled = true;
    clearButton.disabled = true;
    progressWrapper.hidden = false;

    const mode = root.querySelector('input[name="compression-mode"]:checked').value;
    const targetVal = Number(targetKB.value);

    if (mode === "target" && (!Number.isFinite(targetVal) || targetVal <= 0)) {
      showError("Please enter a valid target size in KB.");
      processButton.disabled = false;
      clearButton.disabled = false;
      progressWrapper.hidden = true;
      return;
    }

    const options = {
      mode,
      quality: Number(quality.value),
      targetKB: targetVal,
      format: format.value
    };

    const outputResults = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        updateProgress(progressBar, progressText, progressPercent, 0, `Processing ${i + 1} of ${selectedFiles.length}`);

        const res = await processor.process(file, options, p => {
          const base = (i / selectedFiles.length) * 100;
          const portion = p.percent / selectedFiles.length;
          updateProgress(progressBar, progressText, progressPercent, Math.round(base + portion), `Processing ${i + 1} of ${selectedFiles.length}`);
        });

        outputResults.push(res);
      }

      renderResults(results, outputResults);
      updateProgress(progressBar, progressText, progressPercent, 100, "Complete");
    } catch (err) {
      console.error(err);
      showError(err.message || "Failed to process images.");
    } finally {
      processButton.disabled = false;
      clearButton.disabled = false;
    }
  });

  renderFiles();
}

function updateProgress(bar, text, percentLabel, percent, message) {
  const safe = Math.min(100, Math.max(0, percent));
  bar.style.width = `${safe}%`;
  percentLabel.textContent = `${Math.round(safe)}%`;
  text.textContent = message;
}

function renderResults(container, items) {
  container.innerHTML = "";

  if (items.length > 1) {
    const zipDiv = document.createElement("div");
    zipDiv.style.marginBottom = "14px";
    zipDiv.innerHTML = `<button class="primary-button" type="button" style="width: 100%;">Download All (.ZIP)</button>`;
    zipDiv.querySelector("button").addEventListener("click", () => downloadAllAsZip(items));
    container.appendChild(zipDiv);
  }

  items.forEach(res => {
    const item = document.createElement("div");
    item.className = "result-item";
    const saved = res.meta.savedPercent;
    const sizeLabel = saved >= 0 ? `${saved}% smaller` : `${Math.abs(saved)}% larger`;

    item.innerHTML = `
      <div class="result-info">
        <div class="result-name">${escapeHtml(res.filename)}</div>
        <div class="result-stats">
          ${formatBytes(res.meta.originalSize)} → ${formatBytes(res.meta.compressedSize)} · ${sizeLabel}
        </div>
      </div>
      <button class="download-button" type="button">Download</button>
    `;

    item.querySelector("button").addEventListener("click", () => {
      downloadBlob(res.blob, res.filename);
    });

    container.appendChild(item);
  });
}

function escapeHtml(val) {
  return String(val)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}