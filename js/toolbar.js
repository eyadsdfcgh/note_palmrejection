/**
 * toolbar.js — Toolbar UI Bindings for NotePalm
 *
 * Wires up all toolbar controls:
 *  - Pen / Eraser toggle
 *  - Color swatches + native color picker
 *  - Stroke width slider
 *  - Palm rejection toggle + sensitivity modal
 *  - Undo / Redo buttons
 *  - Clear canvas button
 *  - Export (PNG / PDF) dropdown
 *  - Calculator toggle
 *  - History badge update
 */

import { showToast } from './utils.js';

/** Preset color palette */
const PRESET_COLORS = [
  '#e2e8f0', // white-ish
  '#6366f1', // indigo (default)
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#f472b6', // pink
  '#fb923c', // orange
  '#facc15', // yellow
  '#4ade80', // green
  '#000000', // black
];

export class Toolbar {
  /**
   * @param {object} modules
   * @param {import('./canvas.js').DrawingEngine} modules.engine
   * @param {import('./palmRejection.js').PalmRejectionFilter} modules.palmFilter
   * @param {import('./calculator.js').Calculator} modules.calculator
   */
  constructor({ engine, palmFilter, calculator }) {
    this.engine = engine;
    this.palmFilter = palmFilter;
    this.calculator = calculator;

    this._currentColor = PRESET_COLORS[1]; // indigo default
    this._exportDropdownOpen = false;

    this._bindAll();
    this._renderColorSwatches();
    this._updateStrokeSlider(4);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Initial setup
  // ─────────────────────────────────────────────────────────────────────────

  _bindAll() {
    this._bindPenEraser();
    this._bindStrokeSlider();
    this._bindColorPicker();
    this._bindUndoRedo();
    this._bindClear();
    this._bindExport();
    this._bindCalculator();
    this._bindPalmRejection();
    this._bindKeyboardShortcuts();
    this._bindHistoryUpdate();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pen / Eraser
  // ─────────────────────────────────────────────────────────────────────────

  _bindPenEraser() {
    const penBtn = document.getElementById('btn-pen');
    const eraserBtn = document.getElementById('btn-eraser');

    const setMode = (mode) => {
      this.engine.setMode(mode);
      if (mode === 'pen') {
        penBtn.classList.add('active');
        eraserBtn.classList.remove('active');
        eraserBtn.classList.remove('danger');
      } else {
        eraserBtn.classList.add('active');
        eraserBtn.classList.add('danger');
        penBtn.classList.remove('active');
      }
    };

    penBtn.addEventListener('click', () => setMode('pen'));
    eraserBtn.addEventListener('click', () => setMode('eraser'));

    // Start in pen mode
    setMode('pen');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stroke slider
  // ─────────────────────────────────────────────────────────────────────────

  _bindStrokeSlider() {
    const slider = document.getElementById('stroke-slider');
    const dot = document.getElementById('stroke-dot');

    slider.addEventListener('input', () => {
      const val = parseInt(slider.value);
      this.engine.setStrokeWidth(val);
      this._updateStrokeSlider(val);

      // Update dot preview
      const dotSize = Math.max(3, Math.min(val, 24));
      dot.style.width = `${dotSize}px`;
      dot.style.height = `${dotSize}px`;
    });
  }

  /**
   * Update the gradient fill of the range input to match current value.
   * @param {number} val
   */
  _updateStrokeSlider(val) {
    const slider = document.getElementById('stroke-slider');
    const min = parseInt(slider.min);
    const max = parseInt(slider.max);
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.setProperty('--pct', `${pct}%`);

    // Update dot
    const dot = document.getElementById('stroke-dot');
    if (dot) {
      const dotSize = Math.max(3, Math.min(val, 24));
      dot.style.width = `${dotSize}px`;
      dot.style.height = `${dotSize}px`;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Color
  // ─────────────────────────────────────────────────────────────────────────

  _renderColorSwatches() {
    const container = document.getElementById('color-swatches');
    if (!container) return;

    PRESET_COLORS.forEach((color, index) => {
      const swatch = document.createElement('button');
      swatch.className = `color-swatch${index === 1 ? ' selected' : ''}`;
      swatch.style.background = color;
      swatch.dataset.color = color;
      swatch.setAttribute('aria-label', `Color: ${color}`);
      swatch.title = color;

      swatch.addEventListener('click', () => this._selectColor(color, swatch));
      container.appendChild(swatch);
    });
  }

  /**
   * @param {string} color
   * @param {HTMLElement|null} swatchEl - null if selected from native picker
   */
  _selectColor(color, swatchEl = null) {
    this._currentColor = color;
    this.engine.setColor(color);

    // Update color picker preview
    const preview = document.getElementById('color-preview');
    if (preview) preview.style.background = color;

    // Update swatch selection
    document.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('selected'));
    if (swatchEl) swatchEl.classList.add('selected');

    // Switch to pen mode if eraser was active
    if (this.engine.mode === 'eraser') {
      document.getElementById('btn-pen')?.click();
    }
  }

  _bindColorPicker() {
    const input = document.getElementById('color-picker-input');
    const preview = document.getElementById('color-preview');

    // Set initial color
    input.value = this._currentColor;
    if (preview) preview.style.background = this._currentColor;

    input.addEventListener('input', () => {
      this._selectColor(input.value, null);
    });

    input.addEventListener('change', () => {
      this._selectColor(input.value, null);
      showToast(`Custom color: ${input.value}`, 'info');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Undo / Redo
  // ─────────────────────────────────────────────────────────────────────────

  _bindUndoRedo() {
    document.getElementById('btn-undo')?.addEventListener('click', () => {
      this.engine.undo();
    });

    document.getElementById('btn-redo')?.addEventListener('click', () => {
      this.engine.redo();
    });
  }

  _bindHistoryUpdate() {
    this.engine.onHistoryChange = (undoCount, redoCount) => {
      const badge = document.getElementById('history-badge');
      if (badge) {
        badge.textContent = `↩ ${undoCount}  ↪ ${redoCount}`;
      }

      // Dim undo/redo buttons when unavailable
      const undoBtn = document.getElementById('btn-undo');
      const redoBtn = document.getElementById('btn-redo');
      if (undoBtn) undoBtn.style.opacity = undoCount > 0 ? '1' : '0.4';
      if (redoBtn) redoBtn.style.opacity = redoCount > 0 ? '1' : '0.4';
    };

    // Initialize
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.style.opacity = '0.4';
    if (redoBtn) redoBtn.style.opacity = '0.4';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Clear
  // ─────────────────────────────────────────────────────────────────────────

  _bindClear() {
    document.getElementById('btn-clear')?.addEventListener('click', () => {
      // Simple confirmation via toast approach (avoid blocking confirm() on tablets)
      if (this._clearConfirmPending) {
        this.engine.clear();
        this._clearConfirmPending = false;
        const btn = document.getElementById('btn-clear');
        btn.style.transform = '';
        clearTimeout(this._clearConfirmTimer);
        return;
      }

      // First click — ask for confirmation
      showToast('Click Clear again to confirm', 'info');
      this._clearConfirmPending = true;

      const btn = document.getElementById('btn-clear');
      btn.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.5)';

      this._clearConfirmTimer = setTimeout(() => {
        this._clearConfirmPending = false;
        if (btn) btn.style.boxShadow = '';
      }, 3000);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Export
  // ─────────────────────────────────────────────────────────────────────────

  _bindExport() {
    const exportBtn = document.getElementById('btn-export');
    const dropdown = document.getElementById('export-dropdown');

    exportBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._exportDropdownOpen = !this._exportDropdownOpen;
      dropdown?.classList.toggle('open', this._exportDropdownOpen);
      exportBtn.classList.toggle('active', this._exportDropdownOpen);
    });

    // Close on outside click
    document.addEventListener('click', () => {
      if (this._exportDropdownOpen) {
        this._exportDropdownOpen = false;
        dropdown?.classList.remove('open');
        exportBtn?.classList.remove('active');
      }
    });

    document.getElementById('export-png')?.addEventListener('click', () => {
      this.engine.exportPNG();
      this._exportDropdownOpen = false;
      dropdown?.classList.remove('open');
      exportBtn?.classList.remove('active');
    });

    document.getElementById('export-pdf')?.addEventListener('click', () => {
      this.engine.exportPDF();
      this._exportDropdownOpen = false;
      dropdown?.classList.remove('open');
      exportBtn?.classList.remove('active');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Calculator
  // ─────────────────────────────────────────────────────────────────────────

  _bindCalculator() {
    document.getElementById('btn-calculator')?.addEventListener('click', () => {
      this.calculator.toggle();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Palm Rejection
  // ─────────────────────────────────────────────────────────────────────────

  _bindPalmRejection() {
    const toggle = document.getElementById('palm-toggle');
    const palmLabel = document.getElementById('palm-label');
    const settingsBtn = document.getElementById('btn-palm-settings');
    const modal = document.getElementById('palm-modal');
    const modalClose = document.getElementById('palm-modal-close');
    const sensitivitySlider = document.getElementById('palm-sensitivity');
    const sensitivityValue = document.getElementById('palm-sensitivity-value');
    const thresholdDisplay = document.getElementById('palm-threshold-display');

    // Toggle on/off
    toggle?.addEventListener('change', () => {
      const enabled = toggle.checked;
      this.palmFilter.setEnabled(enabled);
      if (palmLabel) {
        palmLabel.textContent = enabled ? 'Palm Rejection' : 'Palm Rejection';
        palmLabel.style.color = enabled ? '#a5b4fc' : 'var(--text-muted)';
      }
      showToast(`Palm rejection ${enabled ? 'ON' : 'OFF'}`, 'info');
    });

    // Settings modal
    settingsBtn?.addEventListener('click', () => {
      modal?.classList.add('open');
    });

    modalClose?.addEventListener('click', () => {
      modal?.classList.remove('open');
    });

    // Close on overlay click
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    // Sensitivity slider
    sensitivitySlider?.addEventListener('input', () => {
      const val = parseInt(sensitivitySlider.value);
      this.palmFilter.setSensitivity(val);
      if (sensitivityValue) sensitivityValue.textContent = val;
      if (thresholdDisplay) {
        thresholdDisplay.textContent = `${this.palmFilter.getThreshold()}px`;
      }
      // Update slider background gradient
      const pct = ((val - 1) / 9) * 100;
      sensitivitySlider.style.background =
        `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${pct}%, var(--bg-elevated) ${pct}%)`;
    });

    // Initialize values
    if (toggle) toggle.checked = true;
    if (sensitivitySlider) sensitivitySlider.value = '5';
    if (sensitivityValue) sensitivityValue.textContent = '5';
    if (thresholdDisplay) thresholdDisplay.textContent = `${this.palmFilter.getThreshold()}px`;
    if (palmLabel) palmLabel.style.color = '#a5b4fc';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard Shortcuts
  // ─────────────────────────────────────────────────────────────────────────

  _bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ignore when calculator is focused
      if (e.target.closest('#calculator')) return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.engine.undo();
      } else if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.engine.redo();
      } else if (e.key === 'p' || e.key === 'P') {
        document.getElementById('btn-pen')?.click();
      } else if (e.key === 'e' || e.key === 'E') {
        document.getElementById('btn-eraser')?.click();
      } else if (ctrl && e.key === 'k') {
        e.preventDefault();
        this.calculator.toggle();
      }
    });
  }
}
