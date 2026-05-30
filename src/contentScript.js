import { Readability } from '../node_modules/@mozilla/readability/Readability.js';

const STYLE_ELEMENT_ID = 'reading-assistant-typography';
const READABILITY_MARKER = 'reading-assistant-readability';
const DEFAULT_FONT = 'Lexend, OpenDyslexic, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const DEFAULT_TINT = '#fff8e6';

function createTypographyCSS() {
  return `
    html, body, article, main, section, p, span, div, h1, h2, h3, h4, h5, h6 {
      font-family: ${DEFAULT_FONT} !important;
      line-height: 1.7 !important;
      letter-spacing: 0.12em !important;
      word-spacing: 0.18em !important;
      font-variation-settings: 'wght' 400 !important;
    }

    body {
      background-color: ${DEFAULT_TINT} !important;
      color: #111 !important;
    }

    p, li {
      max-width: 100ch !important;
    }

    [data-${READABILITY_MARKER}] {
      outline: 2px dashed rgba(85, 51, 26, 0.24) !important;
    }
  `;
}

function injectInlineStyle(css) {
  let style = document.getElementById(STYLE_ELEMENT_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ELEMENT_ID;
    document.head?.appendChild(style);
  }
  style.textContent = css;
}

function sendTypographyRequest(css) {
  if (!chrome?.runtime?.sendMessage) {
    return;
  }

  chrome.runtime.sendMessage(
    { type: 'applyTypography', cssCode: css },
    (response) => {
      if (!response?.success) {
        console.warn('[ReadingAssistant] background CSS injection failed', response?.error);
      }
    }
  );
}

function annotateReadableNodes(articleContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(articleContent, 'text/html');
  const articleParagraphs = Array.from(doc.querySelectorAll('p'))
    .map((p) => p.textContent?.trim())
    .filter((text) => text && text.length > 20);

  if (!articleParagraphs.length) {
    return;
  }

  const candidates = Array.from(document.querySelectorAll('p')).filter((p) => {
    const text = p.textContent?.trim();
    return text && text.length > 50;
  });

  candidates.slice(0, articleParagraphs.length).forEach((node, index) => {
    node.dataset[READABILITY_MARKER] = `true-${index}`;
  });
}

function extractMainArticle() {
  try {
    const cloned = document.cloneNode(true);
    const reader = new Readability(cloned);
    const article = reader.parse();
    if (!article) {
      console.warn('[ReadingAssistant] Readability did not find a main article');
      return null;
    }
    console.log('[ReadingAssistant] Readability found article:', article.title);
    return article;
  } catch (error) {
    console.warn('[ReadingAssistant] Readability parse failed', error);
    return null;
  }
}

function applyTypography() {
  const css = createTypographyCSS();
  injectInlineStyle(css);
  sendTypographyRequest(css);
}

function observePageChanges() {
  const observer = new MutationObserver(() => {
    applyTypography();
  });
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });
  return observer;
}

function initialize() {
  const article = extractMainArticle();
  if (article?.content) {
    annotateReadableNodes(article.content);
  }

  applyTypography();
  observePageChanges();
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initialize();
} else {
  window.addEventListener('DOMContentLoaded', initialize, { once: true });
}
