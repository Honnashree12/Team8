/**
 * DysAssist ReadingRuler
 * A smooth horizontal highlight bar that follows the user's vertical
 * mouse/reading position to guide eye tracking line by line.
 *
 * Settings:
 *   rulerEnabled   {boolean}
 *   rulerHeight    {number}   px — height of the ruler band (default 36)
 *   rulerOpacity   {number}   0–1 (default 0.12)
 *   rulerColor     {string}   hex color (default "#0082f0" — blue)
 *   rulerMode      {string}   "follow" | "line" (follow = mouse, line = snap to text line)
 */

window.DysAssistRuler = (() => {

  let rulerEl = null;
  let dimmerTopEl = null;
  let dimmerBottomEl = null;
  let active = false;
  let rafId = null;
  const STYLE_ID = "da-ruler-styles";

  // Current settings
  let cfg = {
    height: 36,
    opacity: 0.12,
    color: "#0082f0",
    mode: "follow",
  };

  // Smoothed Y position (lerp for buttery movement)
  let targetY = window.innerHeight / 2;
  let currentY = window.innerHeight / 2;
  const LERP = 0.18;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #da-ruler {
        mix-blend-mode: multiply;
      }
      @media (prefers-color-scheme: dark) {
        #da-ruler {
          mix-blend-mode: screen;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildRuler() {
    if (rulerEl) return;

    rulerEl = document.createElement("div");
    rulerEl.id = "da-ruler";
    rulerEl.style.cssText = `
      position: fixed;
      left: 0;
      width: 100%;
      pointer-events: none;
      z-index: 2147483635;
      border-radius: 2px;
      transition: background 0.3s, height 0.3s, opacity 0.3s;
      will-change: transform;
    `;

    dimmerTopEl = document.createElement("div");
    dimmerTopEl.id = "da-ruler-dim-top";
    dimmerTopEl.style.cssText = `
      position: fixed;
      left: 0; top: 0; width: 100%;
      pointer-events: none;
      z-index: 2147483634;
      background: rgba(0,0,0,0);
      transition: height 0.05s linear, background 0.3s;
      will-change: height;
    `;

    dimmerBottomEl = document.createElement("div");
    dimmerBottomEl.id = "da-ruler-dim-bottom";
    dimmerBottomEl.style.cssText = `
      position: fixed;
      left: 0; bottom: 0; width: 100%;
      pointer-events: none;
      z-index: 2147483634;
      background: rgba(0,0,0,0);
      transition: height 0.05s linear, background 0.3s;
      will-change: height;
    `;

    document.body.appendChild(dimmerTopEl);
    document.body.appendChild(dimmerBottomEl);
    document.body.appendChild(rulerEl);
  }

  function onMouseMove(e) {
    if (cfg.mode === "line") {
      targetY = snapToTextLine(e.clientX, e.clientY);
    } else {
      targetY = e.clientY;
    }
  }

  function snapToTextLine(x, y) {
    try {
      const el = document.elementFromPoint(x, y);
      if (!el) return y;

      const cs = getComputedStyle(el);
      const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 || 24;

      const rect = el.getBoundingClientRect();
      const relY = y - rect.top;
      const lineIdx = Math.floor(relY / lineH);
      const snappedY = rect.top + lineIdx * lineH + lineH / 2;

      return Math.max(0, Math.min(window.innerHeight, snappedY));
    } catch (_) {
      return y;
    }
  }

  function animate() {
    if (!active) return;

    currentY += (targetY - currentY) * LERP;

    const half = cfg.height / 2;
    const top = currentY - half;

    if (rulerEl) {
      rulerEl.style.transform = `translateY(${top}px)`;
      rulerEl.style.height = cfg.height + "px";
      rulerEl.style.top = "0";
      rulerEl.style.background = hexToRgba(cfg.color, cfg.opacity);
    }

    const dimOpacity = Math.min(0.06, cfg.opacity * 0.35);
    if (dimmerTopEl) {
      dimmerTopEl.style.height = Math.max(0, top) + "px";
      dimmerTopEl.style.background = `rgba(0,0,0,${dimOpacity})`;
    }
    if (dimmerBottomEl) {
      dimmerBottomEl.style.height = Math.max(0, window.innerHeight - top - cfg.height) + "px";
      dimmerBottomEl.style.background = `rgba(0,0,0,${dimOpacity})`;
    }

    rafId = requestAnimationFrame(animate);
  }

  function enable(settings = {}) {
    applySettings(settings);
    injectStyles();

    if (active) {
      applyStylesNow();
      return;
    }

    buildRuler();
    applyStylesNow();

    document.addEventListener("mousemove", onMouseMove, { passive: true });
    active = true;
    rafId = requestAnimationFrame(animate);
  }

  function disable() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(rafId);

    document.removeEventListener("mousemove", onMouseMove);

    rulerEl?.remove();       rulerEl = null;
    dimmerTopEl?.remove();   dimmerTopEl = null;
    dimmerBottomEl?.remove(); dimmerBottomEl = null;
    document.getElementById(STYLE_ID)?.remove();
  }

  function applySettings(s = {}) {
    if (s.rulerHeight    !== undefined) cfg.height  = Number(s.rulerHeight) || 36;
    if (s.rulerOpacity   !== undefined) cfg.opacity = Number(s.rulerOpacity) || 0.12;
    if (s.rulerColor     !== undefined) cfg.color   = s.rulerColor || "#0082f0";
    if (s.rulerMode      !== undefined) cfg.mode    = s.rulerMode || "follow";
  }

  function applyStylesNow() {
    if (!rulerEl) return;
    rulerEl.style.height = cfg.height + "px";
    rulerEl.style.background = hexToRgba(cfg.color, cfg.opacity);
  }

  function updateSettings(s) {
    applySettings(s);
    if (active) applyStylesNow();
  }

  function isActive() { return active; }

  function hexToRgba(hex, opacity) {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }

  return { enable, disable, updateSettings, isActive };
})();
