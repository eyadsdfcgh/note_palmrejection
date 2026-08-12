/**
 * main.js — Application Entry Point for NotePalm
 *
 * Initializes all modules and wires them together:
 *  1. DrawingEngine — canvas drawing
 *  2. PalmRejectionFilter — blocks accidental palm touches
 *  3. PersistenceManager — localStorage auto-save/restore
 *  4. Calculator — floating widget
 *  5. Toolbar — all toolbar controls
 */

import { DrawingEngine } from './canvas.js';
import { PalmRejectionFilter } from './palmRejection.js';
import { PersistenceManager } from './persistence.js';
import { Calculator } from './calculator.js';
import { Toolbar } from './toolbar.js';
import { showToast } from './utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById('drawing-canvas');

  // ── 1. Drawing Engine ────────────────────────────────────────────────────
  const engine = new DrawingEngine(canvas);

  // Resize canvas to fill container now, and on window resize
  engine.resize();
  window.addEventListener('resize', () => {
    // Debounce to avoid excessive snapshots during resize drag
    clearTimeout(window._resizeTimer);
    window._resizeTimer = setTimeout(() => engine.resize(), 150);
  });

  // ── 2. Palm Rejection Filter ─────────────────────────────────────────────
  const palmFilter = new PalmRejectionFilter(canvas, {
    enabled: true,
    threshold: 12,
  });

  // Wire palm filter → drawing engine
  palmFilter.onAllowedEvent = (event, phase) => {
    switch (phase) {
      case 'start': engine.startDraw(event); break;
      case 'move':  engine.draw(event);      break;
      case 'end':   engine.endDraw();        break;
    }
  };

  // ── 3. Persistence ───────────────────────────────────────────────────────
  const persistence = new PersistenceManager(engine);

  // After each stroke, schedule auto-save
  engine.onStrokeEnd = () => {
    persistence.scheduleAutoSave();
  };

  // Save immediately before page unloads
  window.addEventListener('beforeunload', () => {
    persistence.saveNow();
  });

  // ── 4. Calculator ────────────────────────────────────────────────────────
  const calcPanel = document.getElementById('calculator');
  const calcToggleBtn = document.getElementById('btn-calculator');
  const calculator = new Calculator(calcPanel, calcToggleBtn);

  // ── 5. Toolbar ───────────────────────────────────────────────────────────
  new Toolbar({ engine, palmFilter, calculator });

  // ── 6. Restore saved canvas ──────────────────────────────────────────────
  // Wait one frame so the canvas is properly laid out before restoring
  requestAnimationFrame(async () => {
    const restored = await persistence.restore();
    if (!restored) {
      // Draw a welcome hint on a fresh canvas
      _drawWelcomeHint(engine);
    }
  });

  // ── 7. Keyboard shortcut hint ────────────────────────────────────────────
  setTimeout(() => {
    showToast('Tip: P = Pen · E = Eraser · Ctrl+Z = Undo · Ctrl+K = Calculator', 'info');
  }, 1500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Welcome hint drawn on blank canvas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw a subtle welcome message directly onto the canvas using canvas text,
 * so it's part of the drawing and can be erased.
 * @param {DrawingEngine} engine
 */
function _drawWelcomeHint(engine) {
  const ctx = engine.ctx;
  const dpr = window.devicePixelRatio || 1;
  const w = engine.canvas.width / dpr;
  const h = engine.canvas.height / dpr;

  ctx.save();
  ctx.scale(1 / dpr, 1 / dpr); // undo DPR scale for text positioning

  const cx = (w / 2) * dpr;
  const cy = (h / 2) * dpr;

  // Faint center icon
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#6366f1';
  ctx.font = `bold ${120 * dpr}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✏', cx, cy - 30 * dpr);

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#e2e8f0';
  ctx.font = `${22 * dpr}px Inter, sans-serif`;
  ctx.fillText('Start drawing — your notes are saved automatically', cx, cy + 80 * dpr);

  ctx.globalAlpha = 0.07;
  ctx.font = `${14 * dpr}px Inter, sans-serif`;
  ctx.fillText('P = Pen   E = Eraser   Ctrl+Z = Undo   Ctrl+K = Calculator', cx, cy + 110 * dpr);

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Start app when DOM is ready
// ─────────────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
