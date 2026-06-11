/**
 * DysAssist FocusMode
 *
 * Highlights the currently active paragraph and dims/blurs everything else.
 * Settings:
 *   focusEnabled        {boolean}
 *   focusBlur           {number}   px of blur on inactive content (0 = grey only)
 *   focusDimOpacity     {number}   0–1 opacity of the dim veil (default 0.55)
 *   focusStyle          {string}   "dim" | "blur" | "both"
 *   focusTransition     {number}   ms for the crossfade (default 220)
 */

window.DysAssistFocus = (() => {

  // ─── STATE ────────────────────────────────────────────────────────────────
  let active        = false;
  let activePara    = null;
  let allParas      = [];
  let styleEl       = null;
  let focusSource   = null;

  // Scroll-idle tracking
  let scrollIdleTimer = null;
  const SCROLL_IDLE_MS = 120;

  // Keyboard para index
  let kbIndex = -1;

  // Config
  let cfg = {
    blur:        4,
    dimOpacity:  0.55,
    style:       "both",
    transition:  220,
  };

  const PARA_SELECTOR = [
    "article p", "article li",
    ".post-content p", ".post-content li",
    ".article-body p", ".article-body li",
    ".entry-content p", ".entry-content li",
    "main p", "main li",
    "[role='main'] p", "[role='main'] li",
    "section p", "section li",
    "p",
  ].join(", ");

  const MIN_WORDS = 8;

  function collectParas() {
    const nodes = [...document.querySelectorAll(PARA_SELECTOR)];
    allParas = nodes.filter(n => {
      const words = (n.innerText || "").trim().split(/\s+/).length;
      return words >= MIN_WORDS && !n.closest("#dysassist-reader-view, #dysassist-page-tint, #da-ruler, #da-focus-nav-hint, #da-focus-veil");
    });
    return allParas;
  }

  function injectBaseStyles() {
    if (styleEl) return;
    styleEl = document.createElement("style");
    styleEl.id = "da-focus-styles";
    document.head.appendChild(styleEl);
    refreshStyles();
  }

  function refreshStyles() {
    if (!styleEl) return;

    const t = cfg.transition;
    const blur = cfg.style !== "dim" ? cfg.blur : 0;
    const dim  = cfg.style !== "blur" ? cfg.dimOpacity : 0;

    styleEl.textContent = `
      #da-focus-veil {
        position: fixed;
        inset: 0;
        z-index: 2147483600;
        background: rgba(0, 0, 0, ${dim});
        pointer-events: none;
        transition: opacity ${t}ms ease, background ${t}ms ease;
        opacity: 0;
      }
      #da-focus-veil.da-veil-active {
        opacity: 1;
      }

      .da-focus-para {
        position: relative;
        z-index: 2147483601;
        transition:
          opacity  ${t}ms ease,
          filter   ${t}ms ease,
          transform ${t}ms ease;
        will-change: opacity, filter;
      }

      .da-focus-para.da-focus-inactive {
        opacity:  ${Math.max(0.08, 1 - dim * 1.1)};
        filter:   blur(${blur}px) grayscale(20%);
        transform: scale(0.998);
        pointer-events: none;
      }

      .da-focus-para.da-focus-active {
        opacity:   1 !important;
        filter:    none !important;
        transform: scale(1) !important;
        pointer-events: auto !important;
        z-index:   2147483602;
      }

      .da-focus-para.da-focus-active::before {
        content: '';
        position: absolute;
        left: -14px;
        top: 0;
        bottom: 0;
        width: 3px;
        border-radius: 2px;
        background: rgba(0, 130, 240, 0.7); /* DysAssist Brand Blue */
        transition: opacity ${t}ms ease;
      }

      #da-focus-nav-hint {
        position: fixed;
        bottom: 68px;
        right: 24px;
        z-index: 2147483647;
        background: #101423;
        border: 1px solid rgba(0,130,240,0.35);
        border-radius: 20px;
        padding: 6px 14px;
        font-size: 11px;
        color: #8888aa;
        font-family: 'Lexend', sans-serif;
        letter-spacing: 0.04em;
        pointer-events: none;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 0.25s, transform 0.25s;
      }
      #da-focus-nav-hint.visible {
        opacity: 1;
        transform: translateY(0);
      }
      #da-focus-nav-hint kbd {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 4px;
        padding: 1px 5px;
        font-family: inherit;
        font-size: 10px;
        color: #0082f0;
      }
    `;
  }

  let veilEl = null;

  function buildVeil() {
    if (veilEl) return;
    veilEl = document.createElement("div");
    veilEl.id = "da-focus-veil";
    document.body.appendChild(veilEl);
  }

  function showVeil() { veilEl?.classList.add("da-veil-active"); }
  function hideVeil() { veilEl?.classList.remove("da-veil-active"); }

  let hintEl      = null;
  let hintTimer   = null;

  function showNavHint() {
    if (!hintEl) {
      hintEl = document.createElement("div");
      hintEl.id = "da-focus-nav-hint";
      hintEl.innerHTML =
        `<kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>Esc</kbd> exit focus`;
      document.body.appendChild(hintEl);
    }
    hintEl.classList.add("visible");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hintEl?.classList.remove("visible"), 2200);
  }

  function focusPara(el, source) {
    if (!el || el === activePara) return;

    focusSource = source;
    activePara  = el;
    kbIndex = allParas.indexOf(el);

    allParas.forEach(p => {
      p.classList.remove("da-focus-active", "da-focus-inactive");
      if (p !== el) p.classList.add("da-focus-inactive");
    });
    el.classList.add("da-focus-active");
    el.classList.remove("da-focus-inactive");

    showVeil();
  }

  function clearFocus() {
    activePara = null;
    allParas.forEach(p => {
      p.classList.remove("da-focus-active", "da-focus-inactive");
    });
    hideVeil();
  }

  function onMouseMove(e) {
    let el = e.target;
    while (el && el !== document.body) {
      if (el.classList?.contains("da-focus-para")) {
        focusPara(el, "hover");
        return;
      }
      el = el.parentElement;
    }
  }

  function onKeyDown(e) {
    if (!active) return;

    if (e.key === "Escape") {
      clearFocus();
      return;
    }

    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      navigateKb(1);
      return;
    }

    if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      navigateKb(-1);
      return;
    }

    if (e.key === "Tab") {
      const delta = e.shiftKey ? -1 : 1;
      if (activePara) {
        e.preventDefault();
        navigateKb(delta);
      }
    }
  }

  function navigateKb(delta) {
    if (allParas.length === 0) collectParas();
    if (allParas.length === 0) return;

    if (kbIndex < 0) {
      kbIndex = findFirstVisibleIndex();
    } else {
      kbIndex = Math.max(0, Math.min(allParas.length - 1, kbIndex + delta));
    }

    const target = allParas[kbIndex];
    if (!target) return;

    focusPara(target, "keyboard");
    showNavHint();

    const rect   = target.getBoundingClientRect();
    const ideal  = window.innerHeight * 0.35;
    const offset = rect.top + window.scrollY - ideal;
    window.scrollTo({ top: offset, behavior: "smooth" });
  }

  function findFirstVisibleIndex() {
    for (let i = 0; i < allParas.length; i++) {
      const r = allParas[i].getBoundingClientRect();
      if (r.top >= 0 && r.bottom <= window.innerHeight) return i;
    }
    return 0;
  }

  const FOCAL_BAND = 0.40;

  function onScroll() {
    if (focusSource === "hover") return;
    clearTimeout(scrollIdleTimer);
    scrollIdleTimer = setTimeout(calcScrollFocus, SCROLL_IDLE_MS);
  }

  function calcScrollFocus() {
    if (!active) return;
    if (allParas.length === 0) collectParas();

    const focalY = window.innerHeight * FOCAL_BAND;
    let best     = null;
    let bestDist = Infinity;

    for (const p of allParas) {
      const r    = p.getBoundingClientRect();
      const midY = r.top + r.height / 2;

      if (r.bottom < 0 || r.top > window.innerHeight) continue;

      const dist = Math.abs(midY - focalY);
      if (dist < bestDist) {
        bestDist = dist;
        best     = p;
      }
    }

    if (best) focusPara(best, "scroll");
  }

  function enable(settings = {}) {
    applySettings(settings);
    if (active) { refreshStyles(); return; }

    injectBaseStyles();
    buildVeil();

    collectParas();
    allParas.forEach(p => p.classList.add("da-focus-para"));

    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("keydown",   onKeyDown);
    window.addEventListener("scroll",      onScroll, { passive: true });

    _mutObs = new MutationObserver(_onMutation);
    _mutObs.observe(document.body, { childList: true, subtree: true });

    active = true;
    calcScrollFocus();
  }

  function disable() {
    if (!active) return;
    active = false;

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("keydown",   onKeyDown);
    window.removeEventListener("scroll",      onScroll);

    _mutObs?.disconnect();
    _mutObs = null;

    clearFocus();
    allParas.forEach(p => p.classList.remove("da-focus-para", "da-focus-active", "da-focus-inactive"));
    allParas = [];
    activePara  = null;
    kbIndex     = -1;
    focusSource = null;

    veilEl?.remove();  veilEl  = null;
    hintEl?.remove();  hintEl  = null;
    styleEl?.remove(); styleEl = null;
  }

  let _mutObs      = null;
  let _mutDebounce = null;

  function _onMutation(mutations) {
    const meaningful = mutations.some(m =>
      [...m.addedNodes].some(n =>
        n.nodeType === 1 &&
        !n.id?.startsWith("da-") &&
        !n.id?.startsWith("dysassist-") &&
        (n.matches?.(PARA_SELECTOR) || n.querySelector?.(PARA_SELECTOR))
      )
    );
    if (!meaningful) return;

    clearTimeout(_mutDebounce);
    _mutDebounce = setTimeout(() => {
      const prev = activePara;
      collectParas();
      allParas.forEach(p => {
        p.classList.add("da-focus-para");
        if (p !== prev) p.classList.add("da-focus-inactive");
      });
      if (prev && allParas.includes(prev)) {
        prev.classList.add("da-focus-active");
        prev.classList.remove("da-focus-inactive");
      }
    }, 400);
  }

  function applySettings(s = {}) {
    if (s.focusBlur        !== undefined) cfg.blur       = Number(s.focusBlur) ?? 4;
    if (s.focusDimOpacity  !== undefined) cfg.dimOpacity = Number(s.focusDimOpacity) ?? 0.55;
    if (s.focusStyle       !== undefined) cfg.style      = s.focusStyle || "both";
    if (s.focusTransition  !== undefined) cfg.transition = Number(s.focusTransition) ?? 220;
  }

  function updateSettings(s) {
    applySettings(s);
    if (active) refreshStyles();
  }

  function isActive() { return active; }

  return { enable, disable, updateSettings, isActive };
})();
