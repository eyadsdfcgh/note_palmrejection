/**
 * calculator.js — Floating Draggable Calculator for NotePalm
 *
 * A self-contained calculator widget:
 *  - Glassmorphism dark floating panel
 *  - Draggable via header (mouse & touch)
 *  - Basic operations: +, -, *, /, %, C, DEL, =
 *  - Expression display + result display
 *  - Keyboard support when focused
 *  - Safe expression evaluation (no eval on arbitrary code)
 */

export class Calculator {
  /**
   * @param {HTMLElement} panelEl - The #calculator element
   * @param {HTMLButtonElement} toggleBtn - The toolbar toggle button
   */
  constructor(panelEl, toggleBtn) {
    this.panel = panelEl;
    this.toggleBtn = toggleBtn;

    /** @type {string} Current input expression string */
    this._expression = '';

    /** @type {string} Previous result (for chaining) */
    this._lastResult = '';

    /** Whether the last action was "equals" */
    this._justEvaluated = false;

    /** Dragging state */
    this._dragging = false;
    this._dragOffsetX = 0;
    this._dragOffsetY = 0;

    this._buildUI();
    this._bindEvents();
    this._bindKeyboard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public
  // ─────────────────────────────────────────────────────────────────────────

  /** Toggle calculator visibility */
  toggle() {
    const isOpen = this.panel.classList.contains('open');
    if (isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  show() {
    this.panel.classList.add('open');
    this.toggleBtn.classList.add('active');
    // Trigger CSS visibility animation on next frame
    requestAnimationFrame(() => {
      this.panel.classList.add('visible');
    });
  }

  hide() {
    this.panel.classList.remove('visible');
    this.toggleBtn.classList.remove('active');
    setTimeout(() => {
      this.panel.classList.remove('open');
    }, 250);
  }

  get isOpen() {
    return this.panel.classList.contains('open');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UI Construction
  // ─────────────────────────────────────────────────────────────────────────

  _buildUI() {
    this.panel.innerHTML = `
      <div class="calc-header" id="calc-drag-handle">
        <span class="calc-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2"/>
            <line x1="8" y1="6" x2="16" y2="6"/>
            <line x1="8" y1="10" x2="16" y2="10"/>
            <line x1="8" y1="14" x2="12" y2="14"/>
          </svg>
          Calculator
        </span>
        <button class="calc-close" id="calc-close-btn" title="Close calculator">✕</button>
      </div>
      <div class="calc-display">
        <div class="calc-expression" id="calc-expression"></div>
        <div class="calc-result" id="calc-result">0</div>
      </div>
      <div class="calc-grid" id="calc-grid">
        ${this._renderButtons()}
      </div>
    `;

    this._expressionEl = this.panel.querySelector('#calc-expression');
    this._resultEl = this.panel.querySelector('#calc-result');
  }

  /**
   * Defines the calculator button layout and returns the HTML string.
   * @returns {string}
   */
  _renderButtons() {
    // [label, value, class]
    const buttons = [
      ['C',   'clear',  'clear'],
      ['DEL', 'del',    'del'],
      ['%',   '%',      'op'],
      ['÷',   '/',      'op'],
      ['7',   '7',      ''],
      ['8',   '8',      ''],
      ['9',   '9',      ''],
      ['×',   '*',      'op'],
      ['4',   '4',      ''],
      ['5',   '5',      ''],
      ['6',   '6',      ''],
      ['−',   '-',      'op'],
      ['1',   '1',      ''],
      ['2',   '2',      ''],
      ['3',   '3',      ''],
      ['+',   '+',      'op'],
      ['±',   'negate', 'action'],
      ['0',   '0',      ''],
      ['.',   '.',      ''],
      ['=',   '=',      'equals'],
    ];

    return buttons.map(([label, value, cls]) =>
      `<button class="calc-btn ${cls}" data-value="${value}" aria-label="${label}">${label}</button>`
    ).join('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Binding
  // ─────────────────────────────────────────────────────────────────────────

  _bindEvents() {
    // Close button
    this.panel.querySelector('#calc-close-btn').addEventListener('click', () => this.hide());

    // Button clicks
    const grid = this.panel.querySelector('#calc-grid');
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-value]');
      if (!btn) return;
      this._handleInput(btn.dataset.value);
    });

    // Drag support
    const handle = this.panel.querySelector('#calc-drag-handle');
    handle.addEventListener('mousedown', this._startDrag.bind(this));
    handle.addEventListener('touchstart', this._startDragTouch.bind(this), { passive: false });
  }

  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;

      const key = e.key;
      if (/^[0-9]$/.test(key)) { this._handleInput(key); return; }
      if (['+', '-', '*', '/', '%', '.'].includes(key)) { this._handleInput(key); return; }
      if (key === 'Enter' || key === '=') { this._handleInput('='); e.preventDefault(); return; }
      if (key === 'Backspace') { this._handleInput('del'); return; }
      if (key === 'Escape') { this.hide(); return; }
      if (key === 'c' || key === 'C') { this._handleInput('clear'); return; }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Drag Logic
  // ─────────────────────────────────────────────────────────────────────────

  _startDrag(e) {
    if (e.button !== 0) return;
    this._dragging = true;
    const rect = this.panel.getBoundingClientRect();
    this._dragOffsetX = e.clientX - rect.left;
    this._dragOffsetY = e.clientY - rect.top;

    const onMove = (me) => {
      if (!this._dragging) return;
      this._movePanelTo(me.clientX - this._dragOffsetX, me.clientY - this._dragOffsetY);
    };
    const onUp = () => {
      this._dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  }

  _startDragTouch(e) {
    const touch = e.touches[0];
    const rect = this.panel.getBoundingClientRect();
    this._dragOffsetX = touch.clientX - rect.left;
    this._dragOffsetY = touch.clientY - rect.top;
    this._dragging = true;

    const onMove = (te) => {
      if (!this._dragging) return;
      const t = te.touches[0];
      this._movePanelTo(t.clientX - this._dragOffsetX, t.clientY - this._dragOffsetY);
    };
    const onEnd = () => {
      this._dragging = false;
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    e.preventDefault();
  }

  /**
   * Move the calculator panel to an absolute position, clamped to viewport.
   * @param {number} x
   * @param {number} y
   */
  _movePanelTo(x, y) {
    const w = this.panel.offsetWidth;
    const h = this.panel.offsetHeight;
    const maxX = window.innerWidth - w - 8;
    const maxY = window.innerHeight - h - 8;

    const clampedX = Math.max(8, Math.min(x, maxX));
    const clampedY = Math.max(8, Math.min(y, maxY));

    this.panel.style.left = `${clampedX}px`;
    this.panel.style.top = `${clampedY}px`;
    this.panel.style.right = 'auto';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Calculator Logic
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Processes a button input value.
   * @param {string} value
   */
  _handleInput(value) {
    switch (value) {
      case 'clear':
        this._clear();
        break;
      case 'del':
        this._delete();
        break;
      case '=':
        this._evaluate();
        break;
      case 'negate':
        this._negate();
        break;
      case '%':
        this._percent();
        break;
      default:
        this._append(value);
    }
    this._render();
  }

  _clear() {
    this._expression = '';
    this._lastResult = '';
    this._justEvaluated = false;
  }

  _delete() {
    if (this._justEvaluated) {
      this._clear();
      return;
    }
    this._expression = this._expression.slice(0, -1);
  }

  /**
   * Appends a digit or operator to the expression.
   * @param {string} char
   */
  _append(char) {
    // If we just evaluated and user types an operator, chain from result
    if (this._justEvaluated) {
      if (/[\+\-\*\/]/.test(char)) {
        this._expression = this._lastResult + char;
      } else {
        this._expression = char;
      }
      this._justEvaluated = false;
      return;
    }

    // Prevent double operators
    const lastChar = this._expression.slice(-1);
    if (/[\+\-\*\/]/.test(char) && /[\+\-\*\/]/.test(lastChar)) {
      this._expression = this._expression.slice(0, -1) + char;
      return;
    }

    // Prevent leading dot
    if (char === '.' && this._expression === '') {
      this._expression = '0.';
      return;
    }

    // Prevent multiple dots in same number segment
    if (char === '.') {
      const parts = this._expression.split(/[\+\-\*\/]/);
      const lastPart = parts[parts.length - 1];
      if (lastPart.includes('.')) return;
    }

    this._expression += char;
  }

  _evaluate() {
    if (!this._expression) return;

    try {
      const result = this._safeEval(this._expression);
      if (result === null) {
        this._resultEl.textContent = 'Error';
        this._resultEl.classList.add('error');
        return;
      }

      // Format result
      const formatted = this._formatNumber(result);
      this._expressionEl.textContent = this._expression + ' =';
      this._lastResult = formatted;
      this._expression = formatted;
      this._justEvaluated = true;

      this._resultEl.classList.remove('error');
    } catch (_) {
      this._resultEl.textContent = 'Error';
      this._resultEl.classList.add('error');
    }
  }

  _negate() {
    if (!this._expression) return;
    if (this._expression.startsWith('-')) {
      this._expression = this._expression.slice(1);
    } else {
      this._expression = '-' + this._expression;
    }
    if (this._justEvaluated) {
      this._lastResult = this._expression;
    }
  }

  _percent() {
    if (!this._expression) return;
    try {
      const val = this._safeEval(this._expression);
      if (val !== null) {
        this._expression = String(val / 100);
        this._justEvaluated = false;
      }
    } catch (_) {}
  }

  /**
   * Safe math expression evaluator — only allows digits and math operators.
   * Uses Function constructor but strictly validates input first.
   * @param {string} expr
   * @returns {number|null}
   */
  _safeEval(expr) {
    // Whitelist: only allow digits, decimal points, and arithmetic operators
    if (!/^[\d\+\-\*\/\.\s\(\)]+$/.test(expr)) return null;

    try {
      // Wrap in Function to avoid eval's scope access, not a security boundary
      // but adds a layer of isolation
      // eslint-disable-next-line no-new-func
      const result = new Function(`'use strict'; return (${expr})`)();
      if (typeof result !== 'number' || !isFinite(result)) return null;
      return result;
    } catch (_) {
      return null;
    }
  }

  /**
   * Format a number nicely: max 10 significant digits, no trailing zeros.
   * @param {number} n
   * @returns {string}
   */
  _formatNumber(n) {
    if (Number.isInteger(n)) return String(n);
    // Round to avoid floating point artifacts (e.g., 0.1 + 0.2 = 0.30000000004)
    const str = parseFloat(n.toPrecision(10)).toString();
    return str;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  _render() {
    if (this._justEvaluated) {
      // Expression line already set in _evaluate
      this._resultEl.textContent = this._lastResult || '0';
    } else {
      this._expressionEl.textContent = '';
      // Show live evaluation hint
      if (this._expression) {
        try {
          const live = this._safeEval(this._expression);
          if (live !== null && String(live) !== this._expression) {
            this._resultEl.textContent = this._formatNumber(live);
          } else {
            this._resultEl.textContent = this._expression || '0';
          }
        } catch (_) {
          this._resultEl.textContent = this._expression || '0';
        }
      } else {
        this._resultEl.textContent = '0';
      }
      this._resultEl.classList.remove('error');
    }
  }
}
