/**
 * DysAssist VocabularyTooltips
 *
 * Scores words in paragraphs by difficulty, targets the top-N hardest,
 * and wraps them in a `.da-vocab-top` span with a rich hover tooltip.
 * The tooltip shows:
 *   - Syllable breakdown
 *   - Part-of-speech hint (heuristic)
 *   - Contextual definition fetched from DysAssist API (with caching)
 *   - A "🔊 Speak" button that calls DysAssistTTS
 *
 * Settings:
 *   vocabEnabled     {boolean}
 *   vocabTopN        {number}  words to mark per paragraph (default 5)
 */

window.DysAssistVocab = (() => {

  const STYLE_ID = "da-vocab-styles";

  // ─── STYLES INJECTION ─────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      span.da-vocab-top {
        border-bottom: 2px solid rgba(0, 130, 240, 0.55) !important;
        cursor: help;
        border-radius: 2px;
        transition: background 0.15s;
        display: inline;
      }
      span.da-vocab-top:hover {
        background: rgba(0, 130, 240, 0.12);
      }

      #da-vocab-tip {
        position: fixed;
        z-index: 2147483647;
        background: #161925; /* DysAssist dark dashboard bg */
        color: #e2e8f0;
        border: 1px solid rgba(0, 130, 240, 0.4);
        border-radius: 12px;
        padding: 13px 16px;
        max-width: 300px;
        font-family: 'Lexend', sans-serif;
        font-size: 13px;
        line-height: 1.6;
        box-shadow: 0 8px 32px rgba(0,0,0,0.45);
        pointer-events: auto;
        opacity: 0;
        transform: translateY(5px);
        transition: opacity 0.18s, transform 0.18s;
      }
      #da-vocab-tip.visible {
        opacity: 1;
        transform: translateY(0);
      }
      .da-vocab-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 5px;
      }
      .da-vocab-word {
        font-size: 15px;
        font-weight: 600;
        color: #ffffff;
        letter-spacing: 0.02em;
      }
      .da-vocab-pos {
        font-size: 10px;
        padding: 2px 7px;
        border-radius: 10px;
        background: rgba(0, 130, 240, 0.15);
        color: #0082f0;
        border: 1px solid rgba(0, 130, 240, 0.25);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .da-vocab-speak {
        margin-left: auto;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 14px;
        padding: 2px 4px;
        border-radius: 4px;
        transition: background 0.15s;
        color: #0082f0;
      }
      .da-vocab-speak:hover { background: rgba(255,255,255,0.08); }
      .da-vocab-syllables {
        font-size: 11px;
        color: #0082f0;
        letter-spacing: 0.12em;
        margin-bottom: 8px;
      }
      .da-vocab-syllables span { color: #64748b; letter-spacing: 0; margin-left: 4px; }
      .da-vocab-def {
        font-size: 12px;
        color: #cbd5e1;
        line-height: 1.6;
      }
      .da-vocab-loading {
        color: #64748b;
        font-style: italic;
        animation: da-vocab-pulse 1s ease-in-out infinite;
      }
      @keyframes da-vocab-pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── SHARED COMMON-WORD SET (mirrors readflow) ──────────────────────
  const COMMON_WORDS = new Set([
    "the","be","to","of","and","a","in","that","have","it","for","not","on","with",
    "he","as","you","do","at","this","but","his","by","from","they","we","say","her",
    "she","or","an","will","my","one","all","would","there","their","what","so","up",
    "out","if","about","who","get","which","go","me","when","make","can","like","time",
    "no","just","him","know","take","people","into","year","your","good","some","could",
    "them","see","other","than","then","now","look","only","come","its","over","think",
    "also","back","after","use","two","how","our","work","first","well","way","even",
    "new","want","because","any","these","give","day","most","us","great","between",
    "need","large","often","hand","high","place","hold","turn","help","start","city",
    "play","small","number","off","always","move","night","live","point","world","near",
    "build","self","earth","head","stand","own","page","should","country","found","answer",
    "school","grow","study","still","learn","plant","cover","food","four","state","keep",
    "eye","never","last","let","thought","tree","cross","farm","hard","might","story",
    "run","while","press","close","real","life","few","north","open","seem","together",
    "next","white","children","begin","got","walk","example","ease","paper","group",
    "music","those","both","mark","book","letter","until","mile","river","car","feet",
    "care","second","enough","girl","young","ready","above","ever","red","list","though",
    "feel","talk","bird","soon","body","dog","family","door","product","black","short",
    "wind","question","happen","complete","ship","area","half","rock","order","fire","south",
    "problem","piece","told","knew","pass","since","top","whole","space","heard","best",
    "hour","better","during","five","remember","step","early","west","ground","interest",
    "reach","fast","sing","listen","six","table","travel","less","morning","ten","simple",
    "several","toward","war","lay","against","slow","center","love","person","money",
    "serve","appear","road","map","rain","rule","pull","cold","notice","voice","unit",
    "power","town","fine","drive","contain","front","teach","week","final","gave","green",
    "quick","develop","ocean","warm","free","minute","strong","special","mind","behind",
    "clear","tail","produce","fact","street","inch","nothing","course","stay","wheel",
    "full","force","blue","object","decide","surface","deep","moon","island","foot",
    "system","busy","test","record","boat","common","gold","possible","plane","age","dry",
    "wonder","laugh","ran","check","game","shape","miss","brought","heat","snow","tire",
    "bring","yes","fill","east","paint","language","among","grand","ball","yet","wave",
    "drop","heart","present","heavy","dance","engine","position","arm","wide","sail",
    "material","size","vary","settle","speak","weight","general","ice","matter","circle",
    "pair","include","divide","syllable","felt","perhaps","pick","sudden","count","square",
    "reason","length","represent","art","subject","region","energy","hunt","bed","brother",
    "egg","ride","cell","believe","fraction","forest","sit","race","window","store","summer",
    "train","sleep","prove","lone","leg","exercise","wall","catch","mount","wish","sky",
    "board","joy","winter","sat","written","wild","instrument","kept","glass","grass","cow",
    "job","edge","sign","visit","past","soft","fun","bright","gas","weather","month",
    "million","bear","finish","happy","hope","flower","gone","jump","baby","eight","village",
    "meet","root","buy","raise","solve","metal","whether","push","seven","third","shall",
    "held","hair","describe","cook","floor","either","result","burn","hill","safe","cat",
    "century","consider","type","law","bit","coast","copy","phrase","silent","tall","sand",
    "soil","roll","temperature","finger","industry","value","fight","lie","beat","natural",
    "view","sense","ear","else","quite","broke","case","middle","son","lake","moment",
    "scale","loud","spring","observe","child","straight","nation","milk","speed","method",
    "organ","pay","section","dress","cloud","surprise","quiet","stone","tiny","climb",
    "cool","design","poor","lot","experiment","bottom","key","iron","single","stick","flat",
    "twenty","skin","smile","hole","trade","melody","trip","office","receive","row","mouth",
    "exact","symbol","die","least","trouble","shout","except","wrote","seed","tone","join",
    "suggest","clean","break","lady","yard","rise","bad","blow","oil","blood","touch","grew",
    "mix","team","wire","cost","lost","brown","wear","garden","equal","sent","choose","fell",
    "fair","bank","collect","save","control","gentle","woman","captain","practice","separate",
    "doctor","please","protect","ring","character","insect","caught","period","indicate",
    "radio","atom","human","history","effect","electric","expect","crop","modern","element",
    "student","corner","party","supply","bone","rail","imagine","provide","agree","capital",
    "continue","current","particular"
  ]);

  // ─── SYLLABLE COUNTER ─────────────────────────────────────────────────────
  function countSyllables(word) {
    const w = word.toLowerCase().replace(/[^a-z]/g, "");
    if (w.length <= 2) return 1;
    let s = w.replace(/e$/, "");
    const matches = s.match(/[aeiouy]+/g);
    return Math.max(1, matches ? matches.length : 1);
  }

  // ─── PART-OF-SPEECH HINT (suffix heuristic) ──────────────────────────────
  function posHint(word) {
    const w = word.toLowerCase();
    if (/tion$|sion$|ment$|ness$|ity$|ism$|age$|ance$|ence$/.test(w)) return "noun";
    if (/ize$|ise$|ify$|ate$|en$/.test(w)) return "verb";
    if (/ous$|ful$|less$|ive$|ic$|al$|ible$|able$/.test(w)) return "adjective";
    if (/ly$/.test(w)) return "adverb";
    return null;
  }

  // ─── DIFFICULTY SCORE ─────────────────────────────────────────────────────
  function difficultyScore(word) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    if (clean.length < 4) return 0;
    if (COMMON_WORDS.has(clean)) return 0;
    const syllables = countSyllables(clean);
    return clean.length * 0.6 + syllables * 2.5;
  }

  // ─── STATE ────────────────────────────────────────────────────────────────
  let topN = 5;
  let enabled = false;
  let definitionCache = {};
  let vocabTipEl = null;
  let vocabHideTimer = null;

  const PARA_SELECTOR = "p, li, blockquote, td, article p, .post-content p, main p";

  // ─── PROCESS PARAGRAPHS ───────────────────────────────────────────────────
  function processParagraphs(root = document.body) {
    if (!enabled) return;

    injectStyles();

    const paras = [...root.querySelectorAll(PARA_SELECTOR)].filter(p => {
      const words = (p.innerText || "").trim().split(/\s+/).length;
      return words >= 10 && !p.dataset.daVocabDone &&
             !p.closest("#dysassist-reader-view, #da-vocab-tip");
    });

    for (const para of paras) {
      processParagraph(para);
    }
  }

  function processParagraph(para) {
    // Score all unique candidate words in paragraph
    const tokens = (para.innerText || "")
      .split(/\s+/)
      .map(w => w.replace(/[^a-zA-Z]/g, ""))
      .filter(w => w.length >= 4);

    if (tokens.length === 0) return;

    const scored = tokens.map(word => ({
      word,
      score: difficultyScore(word)
    })).filter(s => s.score > 0);

    const seen = new Set();
    const unique = scored.filter(s => {
      const key = s.word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length === 0) {
      para.dataset.daVocabDone = "1";
      return;
    }

    unique.sort((a, b) => b.score - a.score);
    const top = unique.slice(0, topN);
    const targetWords = top.map(t => t.word);

    wrapVocabularyWords(para, targetWords);
    para.dataset.daVocabDone = "1";
  }

  // ─── TEXT NODE REPLACEMENT WRAPPER ────────────────────────────────────────
  function wrapVocabularyWords(para, targetWords) {
    if (targetWords.length === 0) return;

    // Escape special regex chars in target words
    const escaped = targetWords.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");

    const walker = document.createTreeWalker(
      para,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (["SCRIPT","STYLE","NOSCRIPT","CODE","PRE","TEXTAREA","INPUT","BUTTON","SELECT"].includes(tag))
            return NodeFilter.FILTER_REJECT;
          if (parent.closest("#da-vocab-tip, .da-vocab-top"))
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);

    for (const node of nodes) {
      const text = node.textContent;
      if (!regex.test(text)) continue;

      regex.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let lastIdx = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const matchText = match[0];
        const matchIdx = match.index;

        if (matchIdx > lastIdx) {
          fragment.appendChild(document.createTextNode(text.slice(lastIdx, matchIdx)));
        }

        const span = document.createElement("span");
        span.className = "da-vocab-top";
        span.dataset.word = matchText;
        span.textContent = matchText;

        // Context is the text content of the parent paragraph
        const paraText = para.innerText || "";

        span.addEventListener("mouseenter", (e) => onVocabHover(e, matchText, paraText));
        span.addEventListener("mouseleave", onVocabLeave);

        fragment.appendChild(span);
        lastIdx = regex.lastIndex;
      }

      if (lastIdx < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIdx)));
      }

      node.parentElement.replaceChild(fragment, node);
    }
  }

  // ─── TOOLTIP LOGIC ────────────────────────────────────────────────────────
  function ensureVocabTip() {
    if (!vocabTipEl) {
      vocabTipEl = document.createElement("div");
      vocabTipEl.id = "da-vocab-tip";
      document.body.appendChild(vocabTipEl);

      // Keep tooltip open on hover inside the tooltip itself
      vocabTipEl.addEventListener("mouseenter", () => clearTimeout(vocabHideTimer));
      vocabTipEl.addEventListener("mouseleave", onVocabLeave);
    }
    return vocabTipEl;
  }

  function onVocabHover(e, word, contextText) {
    clearTimeout(vocabHideTimer);
    const tip = ensureVocabTip();
    const syllables = countSyllables(word);
    const pos = posHint(word);
    const posTag = pos ? `<span class="da-vocab-pos">${pos}</span>` : "";
    const sylDots = Array(syllables).fill("•").join(" ");

    tip.innerHTML = `
      <div class="da-vocab-header">
        <span class="da-vocab-word">${word}</span>
        ${posTag}
        <button class="da-vocab-speak" title="Speak this word" data-word="${word}">🔊</button>
      </div>
      <div class="da-vocab-syllables">${sylDots} <span>(${syllables} syl.)</span></div>
      <div class="da-vocab-def da-vocab-loading">Looking up definition…</div>
    `;

    positionVocabTip(tip, e.clientX, e.clientY);
    tip.classList.add("visible");

    // Speak button wireup
    tip.querySelector(".da-vocab-speak").addEventListener("click", (ev) => {
      ev.stopPropagation();
      window.DysAssistTTS?.speakWord(word);
    });

    const cacheKey = word.toLowerCase();
    if (definitionCache[cacheKey]) {
      const defEl = tip.querySelector(".da-vocab-def");
      if (defEl) {
        defEl.textContent = definitionCache[cacheKey];
        defEl.classList.remove("da-vocab-loading");
      }
    } else {
      chrome.runtime.sendMessage(
        { type: "DEFINE_WORD", payload: { word, context: contextText.trim().slice(0, 1000) } },
        (res) => {
          if (!vocabTipEl) return;
          const defEl = vocabTipEl.querySelector(".da-vocab-def");
          if (!defEl) return;
          defEl.classList.remove("da-vocab-loading");
          if (res?.ok && res.result) {
            definitionCache[cacheKey] = res.result;
            defEl.textContent = res.result;
          } else {
            defEl.textContent = "Definition unavailable. Please make sure the local server is running.";
            defEl.style.opacity = "0.6";
          }
        }
      );
    }
  }

  function positionVocabTip(tip, x, y) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const tw = 300, th = 130, margin = 14;
    let left = x + margin;
    let top  = y - th / 2;
    if (left + tw > vw) left = x - tw - margin;
    if (top < margin) top = margin;
    if (top + th > vh - margin) top = vh - th - margin;
    tip.style.left = left + "px";
    tip.style.top  = top  + "px";
  }

  function onVocabLeave() {
    vocabHideTimer = setTimeout(() => {
      vocabTipEl?.classList.remove("visible");
    }, 350);
  }

  // ─── DISABLE / RESET ──────────────────────────────────────────────────────
  function reset() {
    document.querySelectorAll(".da-vocab-top").forEach(span => {
      try {
        const textNode = document.createTextNode(span.textContent);
        span.replaceWith(textNode);
      } catch (err) {}
    });

    document.querySelectorAll("[data-da-vocab-done]").forEach(el => {
      delete el.dataset.daVocabDone;
    });

    vocabTipEl?.remove();
    vocabTipEl = null;

    document.getElementById(STYLE_ID)?.remove();
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────────────
  function updateSettings(s) {
    if (s.vocabTopN !== undefined) topN = s.vocabTopN;
    enabled = !!s.vocabEnabled;
  }

  function enable() {
    processParagraphs();
  }

  return { enable, reset, updateSettings };
})();
