/**
 * [DocEasy Core] chunk-manager.js
 *
 * Streams a large local File in fixed-size time/byte windows, stores each
 * processed chunk on disk-backed storage (OPFS, falling back to IndexedDB),
 * tracks progress/cancel/resume state, and merges finished chunks into a
 * final downloadable file — all without holding the whole video in RAM.
 *
 * This file has NO dependency on WebCodecs/FFmpeg. It only knows about
 * bytes and chunk indices. worker-video.js / worker-audio.js /
 * speaker-detector.js decide what to DO with each chunk's bytes; this file
 * decides WHERE those bytes live and HOW to get them back in order.
 */

'use strict';

const DOCEASY_DB_NAME = 'doceasy-chunk-store';
const DOCEASY_DB_VERSION = 1;
const DOCEASY_STORE_NAME = 'chunks';
const DOCEASY_STATE_KEY_PREFIX = 'doceasy-job-state:';

/**
 * Detects which storage backend is actually usable in this context.
 * @returns {Promise<'opfs'|'indexeddb'|'none'>}
 */
async function detectStorageBackend() {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.getDirectory) {
      const root = await navigator.storage.getDirectory();
      const testHandle = await root.getFileHandle('__doceasy_opfs_test__', { create: true });
      await root.removeEntry('__doceasy_opfs_test__');
      if (testHandle) return 'opfs';
    }
  } catch (err) {
    console.warn('[DocEasy Core] OPFS unavailable, will try IndexedDB fallback:', err);
  }
  try {
    if (typeof indexedDB !== 'undefined') return 'indexeddb';
  } catch (err) {
    console.warn('[DocEasy Core] IndexedDB unavailable:', err);
  }
  return 'none';
}

/* ------------------------------------------------------------------ *
 * Backend: OPFS
 * ------------------------------------------------------------------ */

class OPFSChunkStore {
  constructor(jobId) {
    this.jobId = jobId;
    this.dirName = `doceasy-job-${jobId}`;
    this._dirHandle = null;
  }

  async _getDir() {
    if (this._dirHandle) return this._dirHandle;
    const root = await navigator.storage.getDirectory();
    this._dirHandle = await root.getDirectoryHandle(this.dirName, { create: true });
    return this._dirHandle;
  }

  async writeChunk(index, data) {
    const dir = await this._getDir();
    const fileHandle = await dir.getFileHandle(`chunk_${String(index).padStart(8, '0')}`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data instanceof Blob ? data : new Blob([data]));
    await writable.close();
  }

  async readChunk(index) {
    const dir = await this._getDir();
    const fileHandle = await dir.getFileHandle(`chunk_${String(index).padStart(8, '0')}`);
    return fileHandle.getFile();
  }

  async listChunkIndices() {
    const dir = await this._getDir();
    const indices = [];
    for await (const name of dir.keys()) {
      const match = /^chunk_(\d+)$/.exec(name);
      if (match) indices.push(parseInt(match[1], 10));
    }
    indices.sort((a, b) => a - b);
    return indices;
  }

  async deleteAll() {
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(this.dirName, { recursive: true });
    } catch (err) {
      console.warn('[DocEasy Core] OPFS cleanup skipped (may already be gone):', err);
    }
    this._dirHandle = null;
  }
}

/* ------------------------------------------------------------------ *
 * Backend: IndexedDB (fallback)
 * ------------------------------------------------------------------ */

class IndexedDBChunkStore {
  constructor(jobId) {
    this.jobId = jobId;
    this._dbPromise = null;
  }

  _openDB() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DOCEASY_DB_NAME, DOCEASY_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DOCEASY_STORE_NAME)) {
          db.createObjectStore(DOCEASY_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this._dbPromise;
  }

  _key(index) {
    return `${this.jobId}:chunk:${index}`;
  }

  async writeChunk(index, data) {
    const db = await this._openDB();
    const blob = data instanceof Blob ? data : new Blob([data]);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DOCEASY_STORE_NAME, 'readwrite');
      tx.objectStore(DOCEASY_STORE_NAME).put(blob, this._key(index));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async readChunk(index) {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DOCEASY_STORE_NAME, 'readonly');
      const req = tx.objectStore(DOCEASY_STORE_NAME).get(this._key(index));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async listChunkIndices() {
    const db = await this._openDB();
    const prefix = `${this.jobId}:chunk:`;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DOCEASY_STORE_NAME, 'readonly');
      const req = tx.objectStore(DOCEASY_STORE_NAME).getAllKeys();
      req.onsuccess = () => {
        const indices = req.result
          .filter((k) => typeof k === 'string' && k.startsWith(prefix))
          .map((k) => parseInt(k.slice(prefix.length), 10))
          .sort((a, b) => a - b);
        resolve(indices);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteAll() {
    const db = await this._openDB();
    const indices = await this.listChunkIndices();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DOCEASY_STORE_NAME, 'readwrite');
      const store = tx.objectStore(DOCEASY_STORE_NAME);
      indices.forEach((i) => store.delete(this._key(i)));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

/* ------------------------------------------------------------------ *
 * Resume state
 * ------------------------------------------------------------------ */

function saveJobState(jobId, state) {
  try {
    localStorage.setItem(
      DOCEASY_STATE_KEY_PREFIX + jobId,
      JSON.stringify({ ...state, updatedAt: Date.now() })
    );
  } catch (err) {
    console.warn('[DocEasy Core] Could not persist resume state:', err);
  }
}

function loadJobState(jobId) {
  try {
    const raw = localStorage.getItem(DOCEASY_STATE_KEY_PREFIX + jobId);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('[DocEasy Core] Could not read resume state:', err);
    return null;
  }
}

function clearJobState(jobId) {
  try {
    localStorage.removeItem(DOCEASY_STATE_KEY_PREFIX + jobId);
  } catch (err) {
    // non-fatal
  }
}

/* ------------------------------------------------------------------ *
 * FileChunkReader
 * ------------------------------------------------------------------ */

class FileChunkReader {
  constructor(file, chunkBytes = 8 * 1024 * 1024) {
    this.file = file;
    this.chunkBytes = chunkBytes;
    this.totalBytes = file.size;
    this.totalChunks = Math.ceil(file.size / chunkBytes);
    this._cancelled = false;
  }

  cancel() {
    this._cancelled = true;
  }

  async readAll(onChunk, onProgress) {
    let offset = 0;
    let index = 0;
    while (offset < this.totalBytes) {
      if (this._cancelled) {
        console.log('[DocEasy Core] Read cancelled by user at byte', offset);
        return { cancelled: true, chunksRead: index };
      }
      const end = Math.min(offset + this.chunkBytes, this.totalBytes);
      const slice = this.file.slice(offset, end);
      await onChunk(slice, index, this.totalChunks);
      offset = end;
      index += 1;
      if (onProgress) onProgress(offset, this.totalBytes);
    }
    return { cancelled: false, chunksRead: index };
  }
}

/* ------------------------------------------------------------------ *
 * ChunkManager
 * ------------------------------------------------------------------ */

class ChunkManager {
  constructor(jobId) {
    this.jobId = jobId;
    this.backend = null;
    this.store = null;
    this._cancelled = false;
  }

  async init() {
    this.backend = await detectStorageBackend();
    if (this.backend === 'opfs') {
      this.store = new OPFSChunkStore(this.jobId);
    } else if (this.backend === 'indexeddb') {
      this.store = new IndexedDBChunkStore(this.jobId);
      console.warn('[DocEasy Core] Using IndexedDB fallback — expect slower I/O on large files.');
    } else {
      throw new Error(
        'No persistent storage backend available (OPFS and IndexedDB both blocked). ' +
        'This browser/context cannot process large files without risking a crash.'
      );
    }
    console.log(`[DocEasy Core] ChunkManager initialized for job ${this.jobId} using ${this.backend}`);
    return this.backend;
  }

  cancel() {
    this._cancelled = true;
  }

  isCancelled() {
    return this._cancelled;
  }

  checkpoint(extra = {}) {
    saveJobState(this.jobId, { jobId: this.jobId, backend: this.backend, ...extra });
  }

  static getResumableState(jobId) {
    return loadJobState(jobId);
  }

  async clearResumableState() {
    clearJobState(this.jobId);
  }

  async writeChunk(index, data) {
    if (this._cancelled) throw new Error('Job was cancelled');
    return this.store.writeChunk(index, data);
  }

  async readChunk(index) {
    return this.store.readChunk(index);
  }

  async listChunkIndices() {
    return this.store.listChunkIndices();
  }

  async mergeChunks(mimeType, onProgress) {
    const indices = await this.listChunkIndices();
    if (indices.length === 0) {
      throw new Error('No chunks found to merge — nothing was written for this job.');
    }
    const parts = [];
    for (let i = 0; i < indices.length; i++) {
      if (this._cancelled) throw new Error('Job was cancelled during merge');
      const blob = await this.store.readChunk(indices[i]);
      parts.push(blob);
      if (onProgress) onProgress(i + 1, indices.length);
    }
    console.log(`[DocEasy Core] Merged ${indices.length} chunks for job ${this.jobId}`);
    return new Blob(parts, { type: mimeType });
  }

  async cleanup() {
    await this.store.deleteAll();
    await this.clearResumableState();
    console.log(`[DocEasy Core] Cleaned up job ${this.jobId}`);
  }
}

/**
 * Builds a stable job id from file identity.
 */
function makeJobId(file) {
  const raw = `${file.name}:${file.size}:${file.lastModified}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `job_${Math.abs(hash)}`;
}

if (typeof self !== 'undefined') {
  self.DocEasyChunkManager = {
    ChunkManager,
    FileChunkReader,
    detectStorageBackend,
    makeJobId,
  };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChunkManager, FileChunkReader, detectStorageBackend, makeJobId };
                                }
