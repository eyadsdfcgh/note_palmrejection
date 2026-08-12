/**
 * persistence.js — localStorage Auto-Save & Restore for NotePalm
 *
 * Saves the canvas as a JPEG data URL to localStorage on every stroke end.
 * Debounced to avoid write pressure. Restores automatically on page load.
 */

import { debounce, showToast } from './utils.js';

const STORAGE_KEY = 'notePalm_canvas_v1';
const META_KEY = 'notePalm_meta_v1';

/** How long after a stroke ends before we write to storage (ms) */
const DEBOUNCE_DELAY = 600;

export class PersistenceManager {
  /**
   * @param {import('./canvas.js').DrawingEngine} engine
   */
  constructor(engine) {
    this.engine = engine;

    /** Debounced save — won't fire until DEBOUNCE_DELAY ms after last call */
    this._debouncedSave = debounce(this._doSave.bind(this), DEBOUNCE_DELAY);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Schedules a save. Call this after every stroke end.
   */
  scheduleAutoSave() {
    this._debouncedSave();
  }

  /**
   * Immediately save (bypasses debounce). Use before page unload.
   */
  saveNow() {
    this._doSave();
  }

  _doSave() {
    try {
      const dataUrl = this.engine.toDataUrl();
      localStorage.setItem(STORAGE_KEY, dataUrl);

      const meta = {
        savedAt: new Date().toISOString(),
        width: this.engine.canvas.width,
        height: this.engine.canvas.height,
      };
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch (err) {
      // Storage quota exceeded or unavailable
      console.warn('[NotePalm] Auto-save failed:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Restore
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Checks localStorage for a saved canvas and restores it.
   * Should be called AFTER the canvas has been resized.
   * @returns {Promise<boolean>} - true if something was restored
   */
  async restore() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return false;

      await this.engine.restoreFromDataUrl(saved);

      const meta = this._loadMeta();
      if (meta?.savedAt) {
        const relTime = this._relativeTime(new Date(meta.savedAt));
        showToast(`Restored: saved ${relTime}`, 'success');
      }

      return true;
    } catch (err) {
      console.warn('[NotePalm] Restore failed:', err.message);
      return false;
    }
  }

  /**
   * Clears the saved canvas from localStorage.
   */
  clearSaved() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(META_KEY);
    } catch (_) {}
  }

  /**
   * Returns true if there is saved data.
   * @returns {boolean}
   */
  hasSavedData() {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  _loadMeta() {
    try {
      const raw = localStorage.getItem(META_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Returns a human-friendly relative time string.
   * @param {Date} date
   * @returns {string}
   */
  _relativeTime(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  }
}
