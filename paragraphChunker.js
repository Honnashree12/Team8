/**
 * DysAssist ParagraphChunker
 * Splits long paragraphs into shorter, digestible blocks.
 *
 * Uses a built-in sentence boundary detector.
 * Settings:
 *   chunkingEnabled     {boolean}
 *   chunkMaxSentences   {number}  default 3 — sentences per block
 */

window.DysAssistChunker = (() => {

  const STYLE_ID = "da-chunker-styles";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-da-chunk] {
        position: relative;
        animation: da-chunk-fadein 0.25s ease forwards;
      }
      span.da-chunk-dot {
        display: inline-block;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: rgba(0, 130, 240, 0.35); /* DysAssist Brand Blue */
        margin-right: 6px;
        vertical-align: middle;
        position: relative;
        top: -1px;
        flex-shrink: 0;
      }
      @keyframes da-chunk-fadein {
        from { opacity: 0.6; transform: translateY(2px); }
        to   { opacity: 1;   transform: translateY(0);   }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── SENTENCE BOUNDARY DETECTOR ──────────────────────────────────────────
  const ABBREVS = new Set([
    "mr","mrs","ms","dr","prof","sr","jr","vs","etc","inc","ltd","corp",
    "dept","est","approx","avg","e.g","i.e","fig","no","vol","rev","jan",
    "feb","mar","apr","jun","jul","aug","sep","oct","nov","dec","st","ave",
    "blvd","rd","co","govt","univ","assn","bros","ph.d","m.d","b.sc","a.m",
    "p.m","u.s","u.k","a.i","a.k.a","i.q","t.v","u.s.a"
  ]);

  function splitSentences(text) {
    let safe = text.replace(/\b([A-Za-z]{1,5})\./g, (match, word) => {
      return ABBREVS.has(word.toLowerCase()) ? word + "\x01" : match;
    });

    safe = safe.replace(/(\d+)\.(\d+)/g, "$1\x02$2");
    safe = safe.replace(/\.{2,}/g, (m) => "\x03".repeat(m.length));
    safe = safe.replace(/\b([A-Z])\.\s+([A-Z])/g, "$1\x01 $2");

    const parts = [];
    const re = /([^.!?]*[.!?]["'\)\]]*)\s+(?=[A-Z\d"])/g;
    let last = 0;
    let match;

    while ((match = re.exec(safe)) !== null) {
      parts.push(match[1]);
      last = re.lastIndex;
    }

    const tail = safe.slice(last).trim();
    if (tail) parts.push(tail);

    if (parts.length === 0) return [text];

    return parts.map(s =>
      s.replace(/\x01/g, ".").replace(/\x02/g, ".").replace(/\x03/g, ".")
    );
  }

  // ─── CHUNK PARAGRAPHS ────────────────────────────────────────────────────
  const CHUNK_ATTR = "data-da-chunked";
  const MIN_WORDS_TO_CHUNK = 60;
  let chunkMaxSentences = 3;

  function chunkDocument(prefs = {}, root = document.body) {
    if (prefs.chunkMaxSentences !== undefined) {
      chunkMaxSentences = Number(prefs.chunkMaxSentences) || 3;
    }
    
    injectStyles();

    const paragraphs = root.querySelectorAll(
      "p, li, blockquote, .article-body p, .post-content p, article p"
    );

    for (const p of paragraphs) {
      if (p.dataset.daChunked) continue;
      if (p.closest("[data-da-chunked]")) continue;
      // Skip custom DysAssist reader view components to prevent double application inside the overlay
      if (p.closest("#dysassist-reader-view")) continue;

      const text = p.innerText?.trim() || "";
      const wordCount = text.split(/\s+/).length;
      if (wordCount < MIN_WORDS_TO_CHUNK) continue;

      const hasBlockChildren = [...p.children].some(c =>
        ["P","DIV","SECTION","ARTICLE","ASIDE","UL","OL","TABLE"].includes(c.tagName)
      );
      if (hasBlockChildren) continue;

      splitParagraph(p);
    }
  }

  function splitParagraph(p) {
    const sentences = splitSentences(p.innerText.trim());
    if (sentences.length <= chunkMaxSentences) return;

    const chunks = [];
    for (let i = 0; i < sentences.length; i += chunkMaxSentences) {
      chunks.push(sentences.slice(i, i + chunkMaxSentences).join(" "));
    }

    if (chunks.length < 2) return;

    const fragment = document.createDocumentFragment();
    const parentStyles = getComputedStyle(p);

    chunks.forEach((chunk, idx) => {
      const newP = document.createElement("p");
      newP.className = p.className;
      newP.textContent = chunk.trim();
      newP.dataset.daChunk = `${idx + 1}/${chunks.length}`;
      newP.dataset.daChunked = "1";

      newP.style.cssText = `
        margin-bottom: ${parentStyles.marginBottom || "1em"};
        font-size: inherit;
        color: inherit;
      `;

      if (idx > 0) {
        newP.style.marginTop = "0.5em";
      }

      const indicator = document.createElement("span");
      indicator.className = "da-chunk-dot";
      indicator.setAttribute("aria-hidden", "true");
      indicator.title = `Chunk ${idx + 1} of ${chunks.length}`;
      newP.prepend(indicator);

      fragment.appendChild(newP);
    });

    p.dataset.daChunked = "original";
    p.replaceWith(fragment);
  }

  function reset() {
    document.querySelectorAll(".da-chunk-dot").forEach(d => d.remove());
    document.getElementById(STYLE_ID)?.remove();
  }

  function updateSettings(s) {
    chunkMaxSentences = s.chunkMaxSentences ?? 3;
  }

  return { chunkDocument, reset, updateSettings, splitSentences };
})();
