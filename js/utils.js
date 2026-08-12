/**
 * utils.js — Shared utility functions for NotePalm
 */

/**
 * Clamps a value between a minimum and maximum.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Creates a debounced version of a function.
 * @param {Function} fn
 * @param {number} delay - milliseconds
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Generates a hex color string from HSL components.
 * @param {number} h - Hue 0–360
 * @param {number} s - Saturation 0–100
 * @param {number} l - Lightness 0–100
 * @returns {string} hex color
 */
export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Gets the canvas-relative coordinates from a pointer event,
 * accounting for devicePixelRatio scaling.
 * @param {PointerEvent} event
 * @param {HTMLCanvasElement} canvas
 * @returns {{ x: number, y: number }}
 */
export function getCanvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

/**
 * Downloads a data URL as a file.
 * @param {string} dataUrl
 * @param {string} filename
 */
export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Shows a brief toast notification in the UI.
 * @param {string} message
 * @param {'info'|'success'|'error'} type
 */
export function showToast(message, type = 'info') {
  // Remove existing toast if any
  const existing = document.getElementById('np-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'np-toast';
  toast.className = `np-toast np-toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger entrance animation
  requestAnimationFrame(() => {
    toast.classList.add('np-toast--visible');
  });

  setTimeout(() => {
    toast.classList.remove('np-toast--visible');
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}
