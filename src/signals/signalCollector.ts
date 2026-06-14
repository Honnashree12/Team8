// =============================================================================
// signalCollector.ts — Week 2
// Watches what the user does while reading. Exports rawSignals so
// featurePipeline.ts can read them every 30 seconds.
// =============================================================================

const CONFIG = {
  SCROLL_SAMPLE_MS: 100,
  REGRESSION_THRESHOLD_PERCENT: 15,
  REGRESSION_TIME_WINDOW_MS: 3000,
  MIN_WORD_COUNT: 10,
  HOVER_MIN_MS: 200,
};

// All raw data collected while the user reads (memory only, never stored)
export const rawSignals = {
  scrollPositions:     [] as Array<{ y: number; timestamp: number }>,
  regressionCount:     0,
  paragraphDwellTimes: new Map<string, number>(),  // paraId → ms read
  paragraphEnterTimes: new Map<string, number>(),  // paraId → when it entered
  paragraphWordCounts: new Map<string, number>(),  // paraId → word count
  wordHoverDurations:  [] as number[],
  currentHoverWord:    '',
  currentHoverStart:   null as number | null,
  copyCount:           0,
  lookupCount:         0,
  quickTabReturns:     0,
  totalWordsTagged:    0,
  sessionStart:        Date.now(),
};

let lastScrollY = window.scrollY;
let tabLeftAt: number | null = null;

// --- SIGNAL 1: Scroll regression detector ---
function startScrollTracking() {
  setInterval(() => {
    const now       = Date.now();
    const currentY  = window.scrollY;
    const viewportH = window.innerHeight;

    rawSignals.scrollPositions.push({ y: currentY, timestamp: now });
    rawSignals.scrollPositions = rawSignals.scrollPositions.filter(
      p => p.timestamp > now - 30_000
    );

    const recent = rawSignals.scrollPositions.filter(
      p => p.timestamp > now - CONFIG.REGRESSION_TIME_WINDOW_MS
    );

    if (recent.length >= 2) {
      const threshold   = (CONFIG.REGRESSION_THRESHOLD_PERCENT / 100) * viewportH;
      const earliestY   = recent[0]?.y ?? currentY;
      const wasGoingDown = currentY > earliestY;
      const nowGoingUp   = currentY < lastScrollY - threshold;

  if (recent.length >= 2) {
    const firstRecent = recent[0];
    if (!firstRecent) return;

    const threshold = (CONFIG.REGRESSION_THRESHOLD_PERCENT / 100) * viewportH;
    const wentDown = currentY > firstRecent.y;
    const nowGoingUp = currentY < lastScrollY - threshold;

    if (!wentDown && nowGoingUp) {
      signals.regressionCount++;
      console.log(`[SignalCollector] 🔄 Regression! Total: ${signals.regressionCount}`);
      if (!wasGoingDown && nowGoingUp) {
        rawSignals.regressionCount++;
        console.log(`%c[Signals] 🔄 Regression #${rawSignals.regressionCount}`, 'color:#E8593C;font-weight:bold');
      }
    }

    lastScrollY = currentY;
  }, CONFIG.SCROLL_SAMPLE_MS);
}

// --- SIGNAL 2: Paragraph dwell time ---
function observeParagraphs() {
  const paragraphs = document.querySelectorAll('p, article p, .article-body p, main p');
  let tagged = 0;

  paragraphs.forEach((el, index) => {
    const text      = el.textContent?.trim() ?? '';
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < CONFIG.MIN_WORD_COUNT) return;

    const id = `saanvi-p-${index}`;
    (el as HTMLElement).dataset['saanviId'] = id;
    rawSignals.paragraphWordCounts.set(id, wordCount);
    rawSignals.totalWordsTagged += wordCount;
    tagged++;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          rawSignals.paragraphEnterTimes.set(id, Date.now());
        } else {
          const enterTime = rawSignals.paragraphEnterTimes.get(id);
          if (enterTime) {
            const dwell   = Date.now() - enterTime;
            const existing = rawSignals.paragraphDwellTimes.get(id) ?? 0;
            rawSignals.paragraphDwellTimes.set(id, existing + dwell);
            rawSignals.paragraphEnterTimes.delete(id);
          }
        }
      });
    }, { threshold: 0.5 });

    observer.observe(el);
  });

console.log('%c[SignalCollector] 🚀 Running on ' + location.hostname,
  'background:#1D9E75;color:white;padding:2px 8px;font-weight:bold');
  console.log(`[Signals] 🏷 Tagged ${tagged} paragraphs`);
}

// --- SIGNAL 3: Word hover dwell ---
function startHoverTracking() {
  document.addEventListener('mousemove', (e) => {
    const word = getWordAtPoint(e.clientX, e.clientY);
    if (!word || word === rawSignals.currentHoverWord) return;

    if (rawSignals.currentHoverStart !== null && rawSignals.currentHoverWord) {
      const duration = Date.now() - rawSignals.currentHoverStart;
      if (duration > CONFIG.HOVER_MIN_MS) {
        rawSignals.wordHoverDurations.push(duration);
        checkDwellSpike(duration, rawSignals.currentHoverWord);
      }
    }

    rawSignals.currentHoverWord  = word;
    rawSignals.currentHoverStart = Date.now();
  });
}

function getWordAtPoint(x: number, y: number): string | null {
  try {
    const range = document.caretRangeFromPoint(x, y);
    if (!range) return null;
    range.expand('word');
    const word = range.toString().trim().replace(/[^a-zA-Z'-]/g, '');
    return word.length > 1 ? word : null;
  } catch { return null; }
}

function checkDwellSpike(duration: number, word: string) {
  if (rawSignals.wordHoverDurations.length < 5) return;
  const sorted = [...rawSignals.wordHoverDurations].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  if (duration > median * 2.5) {
    console.log(`%c[Signals] 🔍 Dwell spike on "${word}": ${duration}ms (median ${median}ms)`, 'color:#8B5CF6;font-weight:bold');
  }
}

// --- SIGNAL 4: Copy and lookup events ---
function startCopyAndLookupTracking() {
  document.addEventListener('copy', () => {
    rawSignals.copyCount++;
    const selected = window.getSelection()?.toString().trim() ?? '';
    console.log(`%c[Signals] 📋 Copy #${rawSignals.copyCount}: "${selected.slice(0, 30)}"`, 'color:#0F6E56;font-weight:bold');
  });

  document.addEventListener('contextmenu', () => {
    const selected = window.getSelection()?.toString().trim() ?? '';
    if (selected.length > 0) {
      rawSignals.lookupCount++;
      console.log(`%c[Signals] 🔎 Lookup #${rawSignals.lookupCount}: "${selected}"`, 'color:#185FA5;font-weight:bold');
    }
  });
}

// --- SIGNAL 5: Quick tab switches ---
function startTabTracking() {
  window.addEventListener('blur', () => { tabLeftAt = Date.now(); });
  window.addEventListener('focus', () => {
    if (tabLeftAt !== null) {
      const awayMs = Date.now() - tabLeftAt;
      if (awayMs < 10_000) {
        rawSignals.quickTabReturns++;
        console.log(`%c[Signals] 🔁 Quick tab return (${(awayMs/1000).toFixed(1)}s)`, 'color:#BA7517;font-weight:bold');
      }
      tabLeftAt = null;
    }
  });
}

// --- INIT: call this from contentScript.js ---
export function initSignalCollector() {
  console.log(`%c[Signals] 🚀 Started on ${location.hostname}`, 'background:#1D9E75;color:white;padding:2px 8px;font-weight:bold');
  startScrollTracking();
  observeParagraphs();
  startHoverTracking();
  startCopyAndLookupTracking();
  startTabTracking();
}
