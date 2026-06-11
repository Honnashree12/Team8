/**
 * DysAssist TTS Engine
 *
 * Text-to-speech via the Web SpeechSynthesis API with real-time word
 * highlight synchronisation.
 *
 * Public API (attached to window.DysAssistTTS):
 *   speak(element)        — speak all text inside an element, sync highlights
 *   speakWord(word)       — speak a single word
 *   speakSelection()      — speak current window selection
 *   pause() / resume()    — toggle pause
 *   stop()                — cancel speech and clear all highlights
 *   updateSettings(s)     — live-update rate/pitch/voice/enabled
 *   isPlaying()           — boolean
 *
 * Settings mapping:
 *   ttsEnabled     {boolean}
 *   ttsRate        {number}   0.5 – 2.0 (default 1.0)
 *   ttsPitch       {number}   0.5 – 2.0 (default 1.0)
 *   ttsVoiceURI    {string}   SpeechSynthesisVoice.voiceURI (default "")
 *   ttsHighlight   {boolean}  whether to highlight words (default true)
 */

window.DysAssistTTS = (() => {

  // ─── STATE ────────────────────────────────────────────────────────────────
  let cfg = {
    rate: 1.0,
    pitch: 1.0,
    voiceURI: "",
    highlight: true,
    enabled: false,
  };

  let synth        = window.speechSynthesis;
  let utterance    = null;
  let playing      = false;
  let paused       = false;

  // Word map: [{word, span, charStart, charEnd}]
  let wordMap      = [];
  let currentIdx   = -1;

  // Fallback timer
  let fallbackTimers = [];
  let boundaryFired  = false;
  let boundaryCheckTimer = null;

  // Floating TTS bar
  let barEl = null;

  // ─── STYLES INJECTION ─────────────────────────────────────────────────────
  function injectStyles() {
    const STYLE_ID = "da-tts-styles";
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      span.da-tts-active {
        background: rgba(0, 130, 240, 0.25) !important;
        border-radius: 3px;
        outline: 1.5px solid rgba(0, 130, 240, 0.5);
        transition: background 0.08s;
      }
      #da-tts-bar {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(80px);
        z-index: 2147483646;
        background: #161925;
        border: 1px solid rgba(0, 130, 240, 0.3);
        border-radius: 40px;
        padding: 8px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 280px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        font-family: 'Lexend', sans-serif;
        font-size: 12px;
        color: #94a3b8;
        opacity: 0;
        transition: opacity 0.3s, transform 0.3s;
        pointer-events: none;
      }
      #da-tts-bar.visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
        pointer-events: auto;
      }
      .da-tts-label {
        font-size: 11px;
        color: #0082f0;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }
      .da-tts-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
      }
      .da-tts-btn {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 50%;
        width: 28px; height: 28px;
        color: #ffffff;
        font-size: 11px;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.15s;
        flex-shrink: 0;
      }
      .da-tts-btn:hover { background: rgba(0, 130, 240, 0.15); }
      .da-tts-close {
        font-size: 10px;
        color: #64748b;
      }
      .da-tts-progress {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .da-tts-track {
        flex: 1;
        height: 3px;
        background: rgba(255,255,255,0.08);
        border-radius: 2px;
        overflow: hidden;
      }
      .da-tts-fill {
        height: 100%;
        width: 0%;
        background: #0082f0;
        border-radius: 2px;
        transition: width 0.2s;
      }
      .da-tts-word-count {
        font-size: 10px;
        color: #64748b;
        white-space: nowrap;
        min-width: 50px;
        text-align: right;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── VOICE LOADING ────────────────────────────────────────────────────────
  function getVoice() {
    const voices = synth.getVoices();
    if (!voices.length) return null;
    if (cfg.voiceURI) {
      return voices.find(v => v.voiceURI === cfg.voiceURI) || voices[0];
    }
    // Prefer a natural English voice
    return (
      voices.find(v => v.lang.startsWith("en") && v.localService) ||
      voices.find(v => v.lang.startsWith("en")) ||
      voices[0]
    );
  }

  // ─── DYNAMIC WORD WRAPPING ───────────────────────────────────────────────
  /**
   * Dynamically wraps plain text in da-word spans so they can be mapped for highlighting.
   */
  function wrapTextInSpans(root) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (["SCRIPT","STYLE","NOSCRIPT","CODE","PRE","TEXTAREA","INPUT","BUTTON","SELECT"].includes(tag))
            return NodeFilter.FILTER_REJECT;
          if (parent.closest("#da-tts-bar, .da-word"))
            return NodeFilter.FILTER_REJECT;
          return node.textContent.trim().length > 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);

    for (const node of nodes) {
      const parent = node.parentElement;
      if (!parent) continue;

      const words = node.textContent.split(/(\s+)/);
      const fragment = document.createDocumentFragment();

      for (const token of words) {
        if (/\s+/.test(token)) {
          fragment.appendChild(document.createTextNode(token));
          continue;
        }
        if (token.length === 0) continue;
        const span = document.createElement("span");
        span.className = "da-word";
        span.textContent = token;
        fragment.appendChild(span);
      }
      parent.replaceChild(fragment, node);
    }
  }

  // ─── BUILD WORD MAP FROM ELEMENT ─────────────────────────────────────────
  function buildWordMap(el) {
    const spans = [...el.querySelectorAll("span.da-word")];
    if (spans.length === 0) return { text: el.innerText || "", map: [] };

    const parts = [];
    const map   = [];
    let charPos = 0;

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent);
        charPos += node.textContent.length;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.classList.contains("da-word")) {
          const word = node.textContent;
          const start = charPos;
          parts.push(word);
          map.push({ word, span: node, charStart: start, charEnd: start + word.length });
          charPos += word.length;
        } else {
          for (const child of node.childNodes) walk(child);
        }
      }
    }

    for (const child of el.childNodes) walk(child);

    return { text: parts.join(""), map };
  }

  // ─── HIGHLIGHT WORD ───────────────────────────────────────────────────────
  function highlightWord(idx) {
    if (!cfg.highlight) return;

    // Clear previous
    if (currentIdx >= 0 && wordMap[currentIdx]) {
      wordMap[currentIdx].span?.classList.remove("da-tts-active");
    }
    currentIdx = idx;
    if (idx >= 0 && idx < wordMap.length) {
      wordMap[idx].span?.classList.add("da-tts-active");

      // Scroll into view if needed
      const span = wordMap[idx].span;
      if (span) {
        const rect = span.getBoundingClientRect();
        if (rect.bottom > window.innerHeight || rect.top < 0) {
          span.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
    }

    updateBarProgress(idx);
  }

  function clearHighlights() {
    wordMap.forEach(w => w.span?.classList.remove("da-tts-active"));
    currentIdx = -1;
  }

  // ─── BOUNDARY EVENT → WORD INDEX ─────────────────────────────────────────
  function charIndexToWordIdx(charIndex) {
    let lo = 0, hi = wordMap.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (wordMap[mid].charEnd <= charIndex) lo = mid + 1;
      else if (wordMap[mid].charStart > charIndex) hi = mid - 1;
      else return mid;
    }
    return wordMap.findIndex(w => w.charStart >= charIndex);
  }

  // ─── TIMER FALLBACK ───────────────────────────────────────────────────────
  function wordDurationMs(word) {
    const base = 380 / cfg.rate;
    const lengthBonus = Math.max(0, (word.length - 4)) * 30 / cfg.rate;
    return base + lengthBonus;
  }

  function startTimerFallback() {
    cancelFallbackTimers();
    let delay = 0;
    wordMap.forEach((entry, idx) => {
      const dur = wordDurationMs(entry.word);
      const t = setTimeout(() => {
        if (!playing) return;
        highlightWord(idx);
      }, delay);
      fallbackTimers.push(t);
      delay += dur;
    });
  }

  function cancelFallbackTimers() {
    fallbackTimers.forEach(clearTimeout);
    fallbackTimers = [];
  }

  // ─── SPEAK CORE ───────────────────────────────────────────────────────────
  function speakText(text, map, label) {
    stop(); // cancel any in-progress speech

    wordMap    = map;
    currentIdx = -1;
    boundaryFired = false;

    utterance = new SpeechSynthesisUtterance(text);
    utterance.rate  = cfg.rate;
    utterance.pitch = cfg.pitch;
    utterance.lang  = "en-US";

    const voice = getVoice();
    if (voice) utterance.voice = voice;

    utterance.addEventListener("boundary", (e) => {
      if (e.name !== "word") return;
      boundaryFired = true;
      clearTimeout(boundaryCheckTimer);
      cancelFallbackTimers();
      const idx = charIndexToWordIdx(e.charIndex);
      if (idx >= 0) highlightWord(idx);
    });

    utterance.addEventListener("start", () => {
      playing = true;
      paused  = false;
      updateBar();

      boundaryCheckTimer = setTimeout(() => {
        if (!boundaryFired && playing) {
          startTimerFallback();
        }
      }, 600);
    });

    utterance.addEventListener("end", () => {
      playing = false;
      paused  = false;
      clearHighlights();
      cancelFallbackTimers();
      updateBar();
      setTimeout(hideBar, 2000);
    });

    utterance.addEventListener("error", (e) => {
      if (e.error === "interrupted") return;
      console.warn("[DysAssist TTS] error:", e.error);
      playing = false;
      updateBar();
    });

    utterance.addEventListener("pause", () => { paused = true; updateBar(); });
    utterance.addEventListener("resume", () => { paused = false; updateBar(); });

    showBar(label || "Reading…");
    synth.speak(utterance);
  }

  // ─── PUBLIC: SPEAK ELEMENT ───────────────────────────────────────────────
  function speak(el) {
    if (!el) return;
    const existingSpans = el.querySelectorAll("span.da-word");
    if (existingSpans.length === 0) {
      wrapTextInSpans(el);
    }
    const { text, map } = buildWordMap(el);
    if (!text.trim()) return;
    const label = `${map.length} words`;
    speakText(text, map, label);
  }

  // ─── PUBLIC: SPEAK SELECTION ─────────────────────────────────────────────
  function speakSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer.parentElement?.closest(
      "p, li, article, section, [data-da-chunk]"
    );

    if (container) {
      speak(container);
    } else {
      const text = sel.toString().trim();
      if (text) speakText(text, [], "Selection");
    }
  }

  // ─── PUBLIC: SPEAK SINGLE WORD ───────────────────────────────────────────
  function speakWord(word) {
    const u = new SpeechSynthesisUtterance(word);
    u.rate  = Math.min(cfg.rate, 0.9);
    u.pitch = cfg.pitch;
    const voice = getVoice();
    if (voice) u.voice = voice;
    synth.cancel();
    synth.speak(u);
  }

  // ─── PUBLIC: PAUSE / RESUME / STOP ───────────────────────────────────────
  function pause() {
    if (synth.speaking && !paused) synth.pause();
  }

  function resume() {
    if (paused) synth.resume();
  }

  function stop() {
    synth.cancel();
    playing = false;
    paused  = false;
    clearHighlights();
    cancelFallbackTimers();
    clearTimeout(boundaryCheckTimer);
    updateBar();
  }

  // ─── FLOATING TTS BAR ────────────────────────────────────────────────────
  function buildBar() {
    if (barEl) return;
    barEl = document.createElement("div");
    barEl.id = "da-tts-bar";
    barEl.innerHTML = `
      <div class="da-tts-label" id="da-tts-label">DysAssist TTS</div>
      <div class="da-tts-controls">
        <button class="da-tts-btn" id="da-tts-play" title="Play / Pause">▶</button>
        <div class="da-tts-progress">
          <div class="da-tts-track">
            <div class="da-tts-fill" id="da-tts-fill"></div>
          </div>
          <span class="da-tts-word-count" id="da-tts-word-count"></span>
        </div>
        <button class="da-tts-btn" id="da-tts-stop" title="Stop">■</button>
        <button class="da-tts-btn da-tts-close" id="da-tts-close" title="Close">✕</button>
      </div>
    `;
    document.body.appendChild(barEl);

    document.getElementById("da-tts-play").addEventListener("click", () => {
      if (!playing) {
        if (paused) resume();
      } else {
        paused ? resume() : pause();
      }
      updateBar();
    });

    document.getElementById("da-tts-stop").addEventListener("click", stop);
    document.getElementById("da-tts-close").addEventListener("click", () => {
      stop();
      hideBar();
    });
  }

  function showBar(label) {
    buildBar();
    document.getElementById("da-tts-label").textContent = label || "Reading…";
    barEl.classList.add("visible");
  }

  function hideBar() {
    barEl?.classList.remove("visible");
  }

  function updateBar() {
    if (!barEl) return;
    const playBtn = document.getElementById("da-tts-play");
    if (!playBtn) return;
    if (!playing) {
      playBtn.textContent = "▶";
      return;
    }
    playBtn.textContent = paused ? "▶" : "⏸";
  }

  function updateBarProgress(idx) {
    const fill  = document.getElementById("da-tts-fill");
    const count = document.getElementById("da-tts-word-count");
    if (!fill || wordMap.length === 0) return;
    const pct = ((idx + 1) / wordMap.length) * 100;
    fill.style.width = pct + "%";
    if (count) count.textContent = `${idx + 1} / ${wordMap.length}`;
  }

  // ─── KEYBOARD SHORTCUT: Alt+S speaks focused paragraph ───────────────────
  document.addEventListener("keydown", (e) => {
    if (!cfg.enabled) return;
    if (e.altKey && e.key === "s") {
      e.preventDefault();
      const focusedPara = document.querySelector(".da-focus-active") ||
                          document.querySelector("p:hover") ||
                          null;
      if (focusedPara) speak(focusedPara);
      return;
    }
    if (e.altKey && e.key === "x") {
      e.preventDefault();
      stop();
    }
  });

  // ─── PARAGRAPH PLAY BUTTONS ───────────────────────────────────────────────
  let paraPlayBtn = null;
  let paraPlayTarget = null;

  function initParaButtons() {
    if (paraPlayBtn) return;
    paraPlayBtn = document.createElement("button");
    paraPlayBtn.id = "da-para-play";
    paraPlayBtn.textContent = "🔊";
    paraPlayBtn.title = "Read this paragraph (Alt+S)";
    paraPlayBtn.style.cssText = `
      position: absolute;
      z-index: 2147483644;
      background: #161925;
      border: 1px solid rgba(0, 130, 240, 0.4);
      border-radius: 50%;
      width: 26px; height: 26px;
      font-size: 12px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
      line-height: 1;
      padding: 0;
      color: #0082f0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(paraPlayBtn);

    paraPlayBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (paraPlayTarget) speak(paraPlayTarget);
    });

    document.addEventListener("mouseover", (e) => {
      if (!cfg.enabled) return;
      const para = e.target.closest("p, li, blockquote, [data-da-chunk]");
      if (!para) return;
      if (para.closest("#da-tts-bar")) return;
      const text = (para.innerText || "").trim();
      if (text.split(/\s+/).length < 8) return;

      paraPlayTarget = para;

      const rect = para.getBoundingClientRect();
      paraPlayBtn.style.top  = (rect.top  + window.scrollY - 4) + "px";
      paraPlayBtn.style.left = (rect.left + window.scrollX - 32) + "px";
      paraPlayBtn.style.opacity = "1";
      paraPlayBtn.style.pointerEvents = "auto";
    });

    document.addEventListener("mouseleave", (e) => {
      if (e.target === paraPlayTarget || e.target === paraPlayBtn) return;
      if (paraPlayBtn) {
        paraPlayBtn.style.opacity = "0";
        paraPlayBtn.style.pointerEvents = "none";
      }
    }, true);
  }

  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  function updateSettings(s) {
    if (s.ttsRate      !== undefined) cfg.rate      = s.ttsRate;
    if (s.ttsPitch     !== undefined) cfg.pitch     = s.ttsPitch;
    if (s.ttsVoiceURI  !== undefined) cfg.voiceURI  = s.ttsVoiceURI;
    if (s.ttsHighlight !== undefined) cfg.highlight = s.ttsHighlight;
    if (s.ttsEnabled   !== undefined) cfg.enabled   = s.ttsEnabled;

    if (cfg.enabled) {
      initParaButtons();
    } else {
      stop();
    }
  }

  function isPlaying() { return playing; }

  // Initialize
  synth.addEventListener?.("voiceschanged", () => {});
  injectStyles();

  return {
    speak,
    speakWord,
    speakSelection,
    pause,
    resume,
    stop,
    updateSettings,
    isPlaying,
    getVoices: () => synth.getVoices(),
  };
})();
