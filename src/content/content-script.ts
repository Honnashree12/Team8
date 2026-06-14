// ─── Content Script — Week 2 ─────────────────────────────────────────────────
// Tags readable paragraphs and applies baseline adaptations.
// Signal collection (IntersectionObserver, scroll regression) is Saanvi's Week 2 task.

const MIN_WORDS = 15;
let idx = 0;

function tagReadableParagraphs(): HTMLElement[] {
  const candidates = document.querySelectorAll<HTMLElement>(
    "p, .mw-parser-output p, [class*='article'] p, [class*='content'] p, [class*='body'] p"
  );
  const tagged: HTMLElement[] = [];
  candidates.forEach((el) => {
    if (el.dataset.readId) return;
    const wc = (el.innerText || "").trim().split(/\s+/).filter(Boolean).length;
    if (wc < MIN_WORDS) return;
    el.dataset.readId = `r-${idx++}`;
    el.dataset.wordCount = String(wc);
    tagged.push(el);
  });
  console.log(`[DysAssist] Tagged ${tagged.length} paragraphs`);
  return tagged;
}

async function getProfile(): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "GET_PROFILE" }, (resp) => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(resp?.profile ?? null);
      });
    } catch { resolve(null); }
  });
}

function applyAdaptations(profile: Record<string, unknown>) {
  document.getElementById("dysassist-baseline")?.remove();
  const prefs = profile.preferences as Record<string, string> | undefined;
  if (!prefs) return;

  const fontStack = prefs.font === "lexend" ? "'Lexend', sans-serif"
    : prefs.font === "opendyslexic" ? "'OpenDyslexic', sans-serif" : "inherit";

  const tintMap: Record<string, string> = {
    cream: "#fdf6e3", blue: "#e8f4fd", green: "#edfaf1", yellow: "#fefce8", none: "",
  };
  const tint = tintMap[prefs.backgroundTint ?? "none"] ?? "";
  const lineH = prefs.lineHeight === "loose" ? "2.1" : prefs.lineHeight === "relaxed" ? "1.8" : "1.6";
  const letterSp = prefs.letterSpacing === "wider" ? "0.09em" : prefs.letterSpacing === "wide" ? "0.05em" : "0.01em";

  if (prefs.font === "lexend" && !document.getElementById("dysassist-font")) {
    const link = document.createElement("link");
    link.id = "dysassist-font"; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600&display=swap";
    document.head.appendChild(link);
  }

  const style = document.createElement("style");
  style.id = "dysassist-baseline";
  style.textContent = `
    [data-read-id] {
      font-family: ${fontStack} !important;
      line-height: ${lineH} !important;
      letter-spacing: ${letterSp} !important;
      word-spacing: 0.12em !important;
      ${tint ? `background-color: ${tint} !important; padding: 2px 4px !important; border-radius: 3px !important;` : ""}
    }
  `;
  document.head.appendChild(style);
  console.log("[DysAssist] Adaptations applied");
}

async function init() {
  const profile = await getProfile();
  if (!profile) { console.log("[DysAssist] No profile"); return; }
  console.log("[DysAssist] Mode:", profile.mode);
  tagReadableParagraphs();
  if (profile.mode === "declared_dyslexic") applyAdaptations(profile);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else { init(); }

const observer = new MutationObserver(() => {
  const n = tagReadableParagraphs();
  if (n.length > 0) {
    getProfile().then((p) => { if (p?.mode === "declared_dyslexic") applyAdaptations(p); });
  }
});
observer.observe(document.body, { childList: true, subtree: true });

export {};
