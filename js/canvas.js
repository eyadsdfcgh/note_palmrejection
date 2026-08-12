/**
 * canvas.js — Core Drawing Engine for NotePalm
 *
 * Handles:
 *  - Freehand pen drawing with pressure simulation
 *  - Eraser mode
 *  - Undo / Redo stack (ImageData snapshots)
 *  - Clear canvas
 *  - Export as PNG
 *  - Export as PDF (via jsPDF)
 *  - Auto-resize on window resize
 *  - localStorage persistence hooks
 */

import { getCanvasPoint, showToast } from './utils.js';

/** Maximum number of undo steps to keep in memory */
const MAX_HISTORY = 40;

export class DrawingEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    /** @type {ImageData[]} */
    this._undoStack = [];

    /** @type {ImageData[]} */
    this._redoStack = [];

    /** Whether the user is currently drawing */
    this._isDrawing = false;

    /** Last pointer position (canvas coords) */
    this._lastPoint = null;

    /** Bezier curve smoothing — stores previous two points */
    this._prevPoint = null;

    // Tool state
    this.color = '#6366f1';
    this.strokeWidth = 4;
    this.mode = 'pen'; // 'pen' | 'eraser'
    this.opacity = 1.0;

    // Event callbacks (set by main.js)
    this.onStrokeEnd = null;
    this.onHistoryChange = null;

    this._setupContext();
  }

  /** Configure canvas context defaults */
  _setupContext() {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }

  /**
   * Resize the canvas to fill its container while respecting devicePixelRatio.
   * Restores canvas content after resize.
   */
  resize() {
    const container = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;

    // Save current drawing
    const snapshot = this._undoStack.length > 0
      ? this._undoStack[this._undoStack.length - 1]
      : null;

    // Set physical pixel dimensions
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;

    // CSS dimensions remain at container size
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    // Scale context for DPR
    this.ctx.scale(dpr, dpr);

    this._setupContext();

    // Restore last drawing if available
    if (snapshot) {
      this.ctx.putImageData(snapshot, 0, 0);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Drawing lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Called when the stylus/pointer makes first contact.
   * @param {PointerEvent} event
   */
  startDraw(event) {
    this._isDrawing = true;

    // Save state BEFORE this stroke (for undo)
    this._saveSnapshot();

    this._lastPoint = getCanvasPoint(event, this.canvas);
    this._prevPoint = null;

    // Begin a new path
    this.ctx.beginPath();
    this._applyToolStyle(event.pressure);
    this.ctx.moveTo(this._lastPoint.x, this._lastPoint.y);

    // Draw a dot for single tap/click
    this.ctx.arc(
      this._lastPoint.x,
      this._lastPoint.y,
      this._getEffectiveWidth(event.pressure) / 2,
      0, Math.PI * 2
    );
    this.ctx.fill();
  }

  /**
   * Called on pointer move while pressed — draws smooth bezier segments.
   * @param {PointerEvent} event
   */
  draw(event) {
    if (!this._isDrawing) return;

    const current = getCanvasPoint(event, this.canvas);

    this.ctx.beginPath();
    this._applyToolStyle(event.pressure);

    if (this._prevPoint) {
      // Quadratic bezier: prev→last→current
      const midX = (this._lastPoint.x + current.x) / 2;
      const midY = (this._lastPoint.y + current.y) / 2;
      this.ctx.moveTo(this._prevPoint.x, this._prevPoint.y);
      this.ctx.quadraticCurveTo(this._lastPoint.x, this._lastPoint.y, midX, midY);
    } else {
      this.ctx.moveTo(this._lastPoint.x, this._lastPoint.y);
      this.ctx.lineTo(current.x, current.y);
    }

    this.ctx.stroke();

    this._prevPoint = this._lastPoint;
    this._lastPoint = current;
  }

  /**
   * Called when the stylus lifts off. Ends stroke and triggers save.
   */
  endDraw() {
    if (!this._isDrawing) return;
    this._isDrawing = false;
    this._lastPoint = null;
    this._prevPoint = null;
    this._redoStack = []; // any new stroke clears redo history
    this._notifyHistoryChange();

    if (typeof this.onStrokeEnd === 'function') {
      this.onStrokeEnd();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tool Styles
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Apply drawing context style based on mode and pressure.
   * @param {number} pressure - 0.0 to 1.0 from PointerEvent
   */
  _applyToolStyle(pressure = 0.5) {
    const ctx = this.ctx;
    const effectiveWidth = this._getEffectiveWidth(pressure);

    if (this.mode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = this.strokeWidth * 3; // eraser is wider
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.color;
      ctx.fillStyle = this.color;
      ctx.lineWidth = effectiveWidth;
      ctx.globalAlpha = this.opacity;
    }
  }

  /**
   * Calculate effective stroke width considering pressure.
   * @param {number} pressure
   * @returns {number}
   */
  _getEffectiveWidth(pressure) {
    // Pressure ranges from 0 to 1; stylus on desktop = 0.5 default
    const normalizedPressure = pressure > 0 ? pressure : 0.5;
    // Scale width between 60%–130% of set width based on pressure
    const scale = 0.6 + normalizedPressure * 0.7;
    return Math.max(1, this.strokeWidth * scale);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tool control
  // ─────────────────────────────────────────────────────────────────────────

  /** @param {string} hexColor */
  setColor(hexColor) {
    this.color = hexColor;
  }

  /** @param {number} width */
  setStrokeWidth(width) {
    this.strokeWidth = width;
  }

  /** @param {'pen'|'eraser'} mode */
  setMode(mode) {
    this.mode = mode;
    this.canvas.className = `mode-${mode}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Undo / Redo
  // ─────────────────────────────────────────────────────────────────────────

  /** Save the current canvas state before a new stroke */
  _saveSnapshot() {
    const snapshot = this.ctx.getImageData(
      0, 0,
      this.canvas.width,
      this.canvas.height
    );

    this._undoStack.push(snapshot);

    // Cap history size
    if (this._undoStack.length > MAX_HISTORY) {
      this._undoStack.shift();
    }
  }

  undo() {
    if (this._undoStack.length === 0) {
      showToast('Nothing to undo', 'info');
      return;
    }

    // Save current state to redo stack
    const current = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this._redoStack.push(current);

    const previous = this._undoStack.pop();
    this.ctx.putImageData(previous, 0, 0);
    this._notifyHistoryChange();

    if (typeof this.onStrokeEnd === 'function') {
      this.onStrokeEnd();
    }
  }

  redo() {
    if (this._redoStack.length === 0) {
      showToast('Nothing to redo', 'info');
      return;
    }

    const current = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this._undoStack.push(current);

    const next = this._redoStack.pop();
    this.ctx.putImageData(next, 0, 0);
    this._notifyHistoryChange();

    if (typeof this.onStrokeEnd === 'function') {
      this.onStrokeEnd();
    }
  }

  /** Notify listeners that undo/redo stacks changed */
  _notifyHistoryChange() {
    if (typeof this.onHistoryChange === 'function') {
      this.onHistoryChange(this._undoStack.length, this._redoStack.length);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Clear
  // ─────────────────────────────────────────────────────────────────────────

  clear() {
    this._saveSnapshot();
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._redoStack = [];
    this._notifyHistoryChange();

    if (typeof this.onStrokeEnd === 'function') {
      this.onStrokeEnd();
    }

    showToast('Canvas cleared', 'info');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Export
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Export canvas as PNG file download.
   */
  exportPNG() {
    // Composite: draw white background + canvas onto a temp canvas
    const temp = document.createElement('canvas');
    temp.width = this.canvas.width;
    temp.height = this.canvas.height;
    const tCtx = temp.getContext('2d');

    // White background
    tCtx.fillStyle = '#0d0f14';
    tCtx.fillRect(0, 0, temp.width, temp.height);
    tCtx.drawImage(this.canvas, 0, 0);

    const dataUrl = temp.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `notepalm-${Date.now()}.png`;
    link.click();
    showToast('Exported as PNG ✓', 'success');
  }

  /**
   * Export canvas as PDF using jsPDF (loaded via CDN).
   */
  exportPDF() {
    // jsPDF is loaded globally via CDN script tag
    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
      showToast('PDF library not loaded yet', 'error');
      return;
    }

    const jsPDFCtor = window.jspdf?.jsPDF || window.jsPDF;

    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    const orientation = w > h ? 'landscape' : 'portrait';
    const pdf = new jsPDFCtor({ orientation, unit: 'px', format: [w, h] });

    // White background
    const temp = document.createElement('canvas');
    temp.width = this.canvas.width;
    temp.height = this.canvas.height;
    const tCtx = temp.getContext('2d');
    tCtx.fillStyle = '#ffffff';
    tCtx.fillRect(0, 0, temp.width, temp.height);
    tCtx.drawImage(this.canvas, 0, 0);

    const imgData = temp.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
    pdf.save(`notepalm-${Date.now()}.pdf`);
    showToast('Exported as PDF ✓', 'success');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Restore from saved data URL
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Restores a previously saved canvas from a data URL.
   * @param {string} dataUrl
   * @returns {Promise<void>}
   */
  restoreFromDataUrl(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.globalAlpha = 1;
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        resolve();
      };
      img.onerror = resolve;
      img.src = dataUrl;
    });
  }

  /**
   * Returns the current canvas content as a compressed JPEG data URL.
   * @returns {string}
   */
  toDataUrl() {
    return this.canvas.toDataURL('image/jpeg', 0.85);
  }

  get canUndo() { return this._undoStack.length > 0; }
  get canRedo() { return this._redoStack.length > 0; }
  get undoCount() { return this._undoStack.length; }
  get redoCount() { return this._redoStack.length; }
}
