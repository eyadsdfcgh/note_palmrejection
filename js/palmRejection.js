/**
 * palmRejection.js — Advanced Palm Rejection Filter for NotePalm
 *
 * Strategy:
 *  1. Intercept ALL pointer & touch events on the canvas.
 *  2. Always allow pointerType === 'pen' or 'mouse'.
 *  3. For pointerType === 'touch', inspect the contact area:
 *       - event.width / event.height / event.radiusX / event.radiusY
 *       - If contact area exceeds threshold → it's a hand/palm → block it.
 *       - Small contact → likely a finger tip drawing (user choice) → allow.
 *  4. When enabled, apply `touch-action: none` to prevent browser gestures.
 *  5. Sensitivity slider adjusts the contact size threshold.
 */

/** @typedef {{ x: number, y: number, pointerId: number }} ActiveTouch */

export class PalmRejectionFilter {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [options]
   * @param {boolean} [options.enabled=true] - Whether palm rejection starts enabled
   * @param {number} [options.threshold=12] - Contact size px threshold (higher = stricter)
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.enabled = options.enabled !== undefined ? options.enabled : true;

    /**
     * Contact size threshold in px. Touch contacts with width OR height above
     * this value are treated as palm/hand and blocked.
     * Range: 5 (very strict) → 30 (lenient, blocks only obvious palms).
     * Default: 12
     */
    this.threshold = options.threshold !== undefined ? options.threshold : 12;

    /**
     * Set of currently active (blocked) palm pointer IDs.
     * Used to ensure we also block pointermove/pointerup for a blocked down event.
     * @type {Set<number>}
     */
    this._blockedPointers = new Set();

    /**
     * Callback invoked when a drawing pointer event should be processed.
     * @type {((event: PointerEvent, phase: 'start'|'move'|'end') => void) | null}
     */
    this.onAllowedEvent = null;

    this._boundHandleDown = this._handleDown.bind(this);
    this._boundHandleMove = this._handleMove.bind(this);
    this._boundHandleUp = this._handleUp.bind(this);
    this._boundHandleCancel = this._handleCancel.bind(this);

    this._attach();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Enable or disable palm rejection.
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Adjust sensitivity.
   * @param {number} value - 1 (very strict, tiny threshold) to 10 (lenient, large threshold)
   */
  setSensitivity(value) {
    // Map sensitivity 1–10 to threshold 5–40
    // Higher sensitivity value = lower threshold = stricter filtering
    // Slider value 10 = most sensitive = threshold 5 (blocks even small contacts)
    // Slider value 1  = least sensitive = threshold 40 (only blocks very large areas)
    this.threshold = Math.round(5 + ((10 - value) / 9) * 35);
  }

  /**
   * Returns current threshold in pixels for display.
   * @returns {number}
   */
  getThreshold() {
    return this.threshold;
  }

  destroy() {
    this._detach();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Binding
  // ─────────────────────────────────────────────────────────────────────────

  _attach() {
    const canvas = this.canvas;

    // Pointer events — primary drawing interface
    canvas.addEventListener('pointerdown', this._boundHandleDown, { passive: false });
    canvas.addEventListener('pointermove', this._boundHandleMove, { passive: false });
    canvas.addEventListener('pointerup', this._boundHandleUp, { passive: false });
    canvas.addEventListener('pointercancel', this._boundHandleCancel, { passive: false });

    // CSS touch-action: none removes browser default gesture handling
    canvas.style.touchAction = 'none';
  }

  _detach() {
    const canvas = this.canvas;
    canvas.removeEventListener('pointerdown', this._boundHandleDown);
    canvas.removeEventListener('pointermove', this._boundHandleMove);
    canvas.removeEventListener('pointerup', this._boundHandleUp);
    canvas.removeEventListener('pointercancel', this._boundHandleCancel);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {PointerEvent} event
   */
  _handleDown(event) {
    event.preventDefault();

    if (this._isPalmContact(event)) {
      // Track this pointer as blocked so we ignore its future events too
      this._blockedPointers.add(event.pointerId);
      return;
    }

    // Capture the pointer so we get move/up even if the user leaves the canvas
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch (_) {
      // Not all browsers support this
    }

    this._dispatch(event, 'start');
  }

  /**
   * @param {PointerEvent} event
   */
  _handleMove(event) {
    event.preventDefault();
    if (this._blockedPointers.has(event.pointerId)) return;
    this._dispatch(event, 'move');
  }

  /**
   * @param {PointerEvent} event
   */
  _handleUp(event) {
    event.preventDefault();

    const wasBlocked = this._blockedPointers.has(event.pointerId);
    this._blockedPointers.delete(event.pointerId);

    if (wasBlocked) return;
    this._dispatch(event, 'end');
  }

  /**
   * @param {PointerEvent} event
   */
  _handleCancel(event) {
    this._blockedPointers.delete(event.pointerId);
    if (!this._isPalmContact(event)) {
      this._dispatch(event, 'end');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Palm Detection Logic
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Determines whether a pointer event should be treated as an accidental
   * palm/hand contact and therefore blocked.
   *
   * Rules (when palm rejection is enabled):
   *  - pointerType === 'pen'   → ALWAYS ALLOW (stylus)
   *  - pointerType === 'mouse' → ALWAYS ALLOW (desktop mouse)
   *  - pointerType === 'touch' → inspect contact area:
   *      Use width, height, radiusX, radiusY (whichever is available).
   *      If contact area exceeds threshold → BLOCK.
   *
   * @param {PointerEvent} event
   * @returns {boolean} true if this is a palm that should be ignored
   */
  _isPalmContact(event) {
    // If palm rejection is disabled, allow everything
    if (!this.enabled) return false;

    // Pen or mouse — always allow drawing
    if (event.pointerType === 'pen' || event.pointerType === 'mouse') {
      return false;
    }

    // Touch input — check contact dimensions
    if (event.pointerType === 'touch') {
      const w = event.width || (event.radiusX ? event.radiusX * 2 : 0);
      const h = event.height || (event.radiusY ? event.radiusY * 2 : 0);

      // If we have contact size data, use it
      if (w > 0 || h > 0) {
        const maxDim = Math.max(w, h);
        if (maxDim > this.threshold) {
          return true; // Large contact area → palm
        }
      }
      // If no size data (some browsers don't provide it), check tangentialPressure
      // and tiltX/tiltY as secondary heuristics
      // If tilt is extreme, it might be a palm laying down
      if (event.tiltX !== undefined && event.tiltY !== undefined) {
        const absX = Math.abs(event.tiltX);
        const absY = Math.abs(event.tiltY);
        if (absX > 60 || absY > 60) {
          return true; // Very tilted → likely palm
        }
      }
    }

    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Dispatch
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Forward the event to the registered drawing handler.
   * @param {PointerEvent} event
   * @param {'start'|'move'|'end'} phase
   */
  _dispatch(event, phase) {
    if (typeof this.onAllowedEvent === 'function') {
      this.onAllowedEvent(event, phase);
    }
  }
}
