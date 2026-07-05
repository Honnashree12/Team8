/**
 * DysAssist Simplify Text Selection
 * 
 * Provides a floating "✨ Simplify" button when text of 20–2000 characters is selected.
 * Clicking the button requests the AI-simplified text from the background worker.
 */

window.DysAssistSimplify = (() => {

  const STYLE_ID = "da-simplify-styles";
  const BTN_ID = "da-simplify-btn";
  const BOX_ID = "da-simplified-box";

  let isEnabled = false;
  let activeBtn = null;
  let activeBox = null;
  let autoHideTimeout = null;

  // Adaptive tier-3: auto-suggested "hardest paragraph" state.
  const SUGGEST_ID = "da-simplify-suggest";
  let suggestedEl = null;
  let suggestChip = null;
  let suggestedText = "";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BTN_ID} {
        position: fixed;
        z-index: 2147483646;
        background: #161925;
        color: #e2e8f0;
        border: 1px solid rgba(0, 130, 240, 0.4);
        border-radius: 6px;
        padding: 6px 14px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        font-family: 'Lexend', sans-serif;
        letter-spacing: 0.03em;
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        transition: background 0.15s, border-color 0.15s, transform 0.1s;
      }
      #${BTN_ID}:hover {
        background: #1c2030;
        border-color: rgba(0, 130, 240, 0.8);
        transform: translateY(-1px);
      }
      #${BTN_ID}:active {
        transform: translateY(0);
      }

      #${BOX_ID} {
        position: fixed;
        z-index: 2147483646;
        background: #161925;
        color: #e2e8f0;
        border: 1px solid rgba(0, 130, 240, 0.4);
        border-radius: 12px;
        padding: 18px 20px;
        font-family: 'Lexend', sans-serif;
        font-size: 14px;
        line-height: 1.7;
        box-shadow: 0 12px 40px rgba(0,0,0,0.55);
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      #${BOX_ID}.visible {
        opacity: 1;
        transform: translateY(0);
      }
      
      .da-simplify-title {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #0082f0;
        margin-bottom: 8px;
        font-weight: 700;
      }
      
      .da-simplify-body {
        margin-bottom: 14px;
        color: #cbd5e1;
        max-height: 200px;
        overflow-y: auto;
      }

      .da-simplify-footer {
        display: flex;
        gap: 8px;
      }

      .da-simplify-btn-action {
        background: rgba(0, 130, 240, 0.15);
        color: #0082f0;
        border: 1px solid rgba(0, 130, 240, 0.3);
        border-radius: 6px;
        padding: 5px 12px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.15s, border-color 0.15s;
      }
      .da-simplify-btn-action:hover {
        background: rgba(0, 130, 240, 0.25);
        border-color: rgba(0, 130, 240, 0.5);
      }

      .da-simplify-btn-close {
        background: rgba(255, 255, 255, 0.05);
        color: #94a3b8;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 5px 12px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.15s, border-color 0.15s;
      }
      .da-simplify-btn-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #f1f5f9;
        border-color: rgba(255, 255, 255, 0.15);
      }
    `;
    document.head.appendChild(style);
  }

  function handleMouseUp() {
    if (!isEnabled) return;

    // Timeout delay so we don't grab text while selection is in progress
    setTimeout(() => {
      const selected = window.getSelection()?.toString().trim();
      if (!selected || selected.length < 20 || selected.length > 2000) return;

      removeButton();

      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      injectStyles();

      const btn = document.createElement("button");
      btn.id = BTN_ID;
      btn.textContent = "✨ Simplify";
      btn.style.top = `${rect.bottom + 8}px`;
      btn.style.left = `${rect.left}px`;

      document.body.appendChild(btn);
      activeBtn = btn;

      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        btn.textContent = "⏳ Simplifying…";
        btn.disabled = true;

        chrome.runtime.sendMessage(
          { type: "SIMPLIFY_TEXT", payload: { text: selected } },
          (res) => {
            removeButton();
            if (res?.ok && res.result) {
              showSimplifiedOverlay(selected, res.result, rect);
            } else {
              const errMsg = res?.error || "Unknown server error.";
              showSimplifiedOverlay(
                selected,
                `⚠️ Simplification failed: ${errMsg}\n\nPlease make sure the local server is running.`,
                rect
              );
            }
          }
        );
      });

      // Dismiss button if user clicks elsewhere
      autoHideTimeout = setTimeout(() => {
        removeButton();
      }, 5000);
    }, 10);
  }

  function removeButton() {
    clearTimeout(autoHideTimeout);
    if (activeBtn) {
      activeBtn.remove();
      activeBtn = null;
    }
  }

  function showSimplifiedOverlay(original, simplified, rect) {
    removeOverlay();

    const box = document.createElement("div");
    box.id = BOX_ID;
    
    const maxWidth = 340;
    const maxHeight = 320;
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    let left = Math.max(margin, Math.min(rect.left, vw - maxWidth - margin));
    let top = rect.bottom + margin;
    
    if (top + maxHeight > vh) {
      const topAbove = rect.top - maxHeight - margin;
      if (topAbove >= margin) {
        top = topAbove;
      } else {
        top = Math.max(margin, Math.min(vh - maxHeight - margin, (vh - maxHeight) / 2));
      }
    }
    
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${maxWidth}px`;
    
    box.innerHTML = `
      <div class="da-simplify-title">✨ Simplified Text</div>
      <div class="da-simplify-body">${simplified.replace(/\n/g, "<br>")}</div>
      <div class="da-simplify-footer">
        <button class="da-simplify-btn-action" id="da-copy-simplify">Copy</button>
        <button class="da-simplify-btn-close" id="da-close-simplify">Close</button>
      </div>
    `;

    document.body.appendChild(box);
    activeBox = box;

    // Trigger transition
    requestAnimationFrame(() => {
      box.classList.add("visible");
    });

    box.querySelector("#da-copy-simplify").addEventListener("click", () => {
      navigator.clipboard.writeText(simplified);
      const copyBtn = box.querySelector("#da-copy-simplify");
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
    });

    box.querySelector("#da-close-simplify").addEventListener("click", () => {
      removeOverlay();
    });

    // Auto-hide box after 60 seconds
    autoHideTimeout = setTimeout(() => {
      removeOverlay();
    }, 60000);
  }

  function removeOverlay() {
    clearTimeout(autoHideTimeout);
    if (activeBox) {
      activeBox.remove();
      activeBox = null;
    }
  }

  // --- Adaptive tier-3: auto-suggest simplifying the hardest paragraph ------

  function findHardestParagraph() {
    const wf = window.DysAssistWordFreq;
    if (!wf) return null;
    const candidates = document.querySelectorAll("p, article li");
    let best = null;
    let bestScore = 0;
    candidates.forEach((el) => {
      if (el.closest("#" + BOX_ID + ", #dysassist-reader-view, #dysassist-adaptive-toast")) return;
      if (el.querySelector("#" + SUGGEST_ID)) return;
      const text = (el.innerText || "").trim();
      const words = text.split(/\s+/).filter(Boolean).length;
      if (words < 25 || text.length > 2000) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 120 || rect.height < 10) return; // skip hidden / tiny
      const score = wf.getDifficultyIndex(text);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });
    // Only bother if the paragraph is genuinely hard.
    if (best && bestScore >= 0.25) return { el: best, score: bestScore, text: (best.innerText || "").trim() };
    return null;
  }

  function styleImportant(el, styles) {
    Object.keys(styles).forEach((k) => el.style.setProperty(k, styles[k], "important"));
  }

  function runSuggestSimplify() {
    if (!suggestedEl || !suggestChip) return;
    const rect = suggestedEl.getBoundingClientRect();
    suggestChip.textContent = "⏳ Simplifying…";
    suggestChip.style.setProperty("pointer-events", "none", "important");
    chrome.runtime.sendMessage(
      { type: "SIMPLIFY_TEXT", payload: { text: suggestedText } },
      (res) => {
        if (res && res.ok && res.result) {
          showSimplifiedOverlay(suggestedText, res.result, rect);
        } else {
          const errMsg = (res && res.error) || "Unknown server error.";
          showSimplifiedOverlay(
            suggestedText,
            `⚠️ Simplification failed: ${errMsg}\n\nPlease make sure the local server is running.`,
            rect
          );
        }
        if (suggestChip) {
          suggestChip.textContent = "✨ Simplify this paragraph";
          suggestChip.style.setProperty("pointer-events", "auto", "important");
        }
      }
    );
  }

  function suggestHardest() {
    // Keep an existing, still-attached suggestion in place.
    if (suggestedEl && document.contains(suggestedEl)) return;
    clearSuggestion();

    const found = findHardestParagraph();
    if (!found) return;

    injectStyles();
    suggestedEl = found.el;
    suggestedText = found.text;
    suggestedEl.setAttribute("data-da-hard", "true");
    styleImportant(suggestedEl, {
      background: "rgba(0,130,240,0.06)",
      "box-shadow": "inset 3px 0 0 #0082f0",
      "border-radius": "4px",
      "padding-left": "12px",
      transition: "background .2s ease"
    });

    const chip = document.createElement("span");
    chip.id = SUGGEST_ID;
    chip.setAttribute("role", "button");
    chip.setAttribute("tabindex", "0");
    chip.setAttribute("aria-label", "Simplify this paragraph");
    chip.textContent = "✨ Simplify this paragraph";
    // Inline !important beats the reading-theme stylesheet, so the chip keeps
    // its own look regardless of the page theme.
    styleImportant(chip, {
      display: "inline-block",
      "margin-left": "8px",
      "margin-top": "4px",
      background: "#0082f0",
      color: "#ffffff",
      "font-family": "'Lexend', system-ui, sans-serif",
      "font-size": "12px",
      "font-weight": "600",
      "line-height": "1.4",
      "letter-spacing": "normal",
      padding: "3px 10px",
      "border-radius": "999px",
      cursor: "pointer",
      "box-shadow": "0 2px 8px rgba(0,130,240,.35)",
      "vertical-align": "middle",
      "user-select": "none",
      "white-space": "nowrap"
    });
    suggestedEl.appendChild(document.createTextNode(" "));
    suggestedEl.appendChild(chip);
    suggestChip = chip;

    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      runSuggestSimplify();
    });
    chip.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        runSuggestSimplify();
      }
    });
  }

  function clearSuggestion() {
    if (suggestChip) {
      suggestChip.remove();
      suggestChip = null;
    }
    if (suggestedEl) {
      suggestedEl.removeAttribute("data-da-hard");
      ["background", "box-shadow", "border-radius", "padding-left", "transition"].forEach((p) =>
        suggestedEl.style.removeProperty(p)
      );
      suggestedEl = null;
    }
    suggestedText = "";
  }

  function enable() {
    if (isEnabled) return;
    isEnabled = true;
    document.addEventListener("mouseup", handleMouseUp);
  }

  function disable() {
    if (!isEnabled) return;
    isEnabled = false;
    document.removeEventListener("mouseup", handleMouseUp);
    removeButton();
    removeOverlay();
  }

  function reset() {
    disable();
    clearSuggestion();
    document.getElementById(STYLE_ID)?.remove();
  }

  return { enable, disable, reset, suggestHardest, clearSuggestion };
})();
