/**
 * DysAssist Signal Collector
 *
 * Week 2/3 — Saanvi
 *
 * Exposes a global window.DysAssistSignals object which:
 * 1. Attaches event listeners for scroll, mousemove, copy, contextmenu, blur, focus.
 * 2. Tracks paragraph visibility & dwell times using IntersectionObserver.
 * 3. Normalizes and computes derived features for the current page session.
 */

window.DysAssistSignals = (() => {
  // --- CONFIGURATION ---
  const CONFIG = {
    SCROLL_SAMPLE_MS: 100,
    REGRESSION_THRESHOLD_PERCENT: 15,
    REGRESSION_TIME_WINDOW_MS: 3000,
    HOVER_MIN_MS: 200,
    MIN_WORD_COUNT: 10,
    PARA_DWELL_READ_MS: 3000, // Dwell time indicating paragraph is read vs skimmed
  };

  // --- RAW SIGNAL STORAGE ---
  const rawSignals = {
    scrollPositions: [],     // Array of { y, timestamp }
    regressionCount: 0,
    paragraphDwellTimes: new Map(), // paraId -> ms spent reading
    paragraphEnterTimes: new Map(), // paraId -> when it entered viewport
    paragraphWordCounts: new Map(), // paraId -> word count
    wordHoverDurations: [],
    currentHoverWord: '',
    currentHoverStart: null,
    copyCount: 0,
    lookupCount: 0,
    quickTabReturns: 0,
    totalWordsTagged: 0,
    sessionStart: Date.now(),
  };

  let lastScrollY = window.scrollY;
  let tabLeftAt = null;
  let isInitialized = false;

  // --- VOCABULARY DIFFICULTY HEURISTIC ---
  const COMMON_WORDS = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'is', 'are', 'was', 'were', 'been', 'has', 'had',
  ]);

  function getDifficultyIndex(text) {
    const words = text
      .toLowerCase()
      .split(/[^a-z']+/)
      .filter((w) => w.length > 0);

    if (words.length === 0) return 0;

    let difficultCount = 0;
    for (const word of words) {
      const isLong = word.length >= 7;
      const isUncommon = !COMMON_WORDS.has(word);
      if (isLong && isUncommon) difficultCount++;
    }

    return Math.min(1, difficultCount / words.length);
  }

  // --- SIGNAL 1: Scroll Regression Detector ---
  function startScrollTracking() {
    setInterval(() => {
      const now = Date.now();
      const currentY = window.scrollY;
      const viewportH = window.innerHeight;

      rawSignals.scrollPositions.push({ y: currentY, timestamp: now });
      // Keep only last 30s of scroll positions
      rawSignals.scrollPositions = rawSignals.scrollPositions.filter(
        p => p.timestamp > now - 30000
      );

      const recent = rawSignals.scrollPositions.filter(
        p => p.timestamp > now - CONFIG.REGRESSION_TIME_WINDOW_MS
      );

      if (recent.length >= 2) {
        const firstRecent = recent[0];
        const threshold = (CONFIG.REGRESSION_THRESHOLD_PERCENT / 100) * viewportH;
        const wasGoingDown = currentY > firstRecent.y;
        const nowGoingUp = currentY < lastScrollY - threshold;

        if (!wasGoingDown && nowGoingUp) {
          rawSignals.regressionCount++;
          console.log(`%c[Signals] 🔄 Scroll Regression #${rawSignals.regressionCount}`, 'color:#E8593C;font-weight:bold');
        }
      }

      lastScrollY = currentY;
    }, CONFIG.SCROLL_SAMPLE_MS);
  }

  // --- SIGNAL 2: Paragraph Dwell Time Observer ---
  function observeParagraphs() {
    // Find readable elements in the page
    const paragraphs = document.querySelectorAll('p, [data-read-id]');
    let tagged = 0;

    paragraphs.forEach((el, index) => {
      const text = (el.innerText || el.textContent || '').trim();
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      if (wordCount < CONFIG.MIN_WORD_COUNT) return;

      const id = el.dataset.readId || `sig-p-${index}`;
      el.dataset.readId = id;
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
              const dwell = Date.now() - enterTime;
              const existing = rawSignals.paragraphDwellTimes.get(id) ?? 0;
              rawSignals.paragraphDwellTimes.set(id, existing + dwell);
              rawSignals.paragraphEnterTimes.delete(id);
            }
          }
        });
      }, { threshold: 0.3 });

      observer.observe(el);
    });

    console.log(`[Signals] 🏷 Paragraph Observer active on ${tagged} paragraphs`);
  }

  // --- SIGNAL 3: Word Hover Dwell & Dwell Spikes ---
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

      rawSignals.currentHoverWord = word;
      rawSignals.currentHoverStart = Date.now();
    });
  }

  function getWordAtPoint(x, y) {
    try {
      if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(x, y);
        if (!range) return null;
        if (range.expand) {
          range.expand('word');
        }
        const word = range.toString().trim().replace(/[^a-zA-Z'-]/g, '');
        return word.length > 1 ? word : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  // A dwell spike is when duration > 2.5x the median of all recorded hover durations (min 5 events)
  function checkDwellSpike(duration, word) {
    if (rawSignals.wordHoverDurations.length < 5) return;
    const sorted = [...rawSignals.wordHoverDurations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    if (duration > median * 2.5) {
      console.log(`%c[Signals] 🔍 Dwell spike on "${word}": ${duration}ms (median ${median}ms)`, 'color:#8B5CF6;font-weight:bold');
    }
  }

  // --- SIGNAL 4: Copy and Lookup events ---
  function startCopyAndLookupTracking() {
    document.addEventListener('copy', () => {
      rawSignals.copyCount++;
      const selected = window.getSelection()?.toString().trim() ?? '';
      console.log(`%c[Signals] 📋 Copy operation detected: "${selected.slice(0, 30)}"`, 'color:#0F6E56;font-weight:bold');
    });

    document.addEventListener('contextmenu', () => {
      const selected = window.getSelection()?.toString().trim() ?? '';
      if (selected.length > 0) {
        rawSignals.lookupCount++;
        console.log(`%c[Signals] 🔎 Context menu query: "${selected.slice(0, 30)}"`, 'color:#185FA5;font-weight:bold');
      }
    });
  }

  // --- SIGNAL 5: Tab Switch tracking ---
  function startTabTracking() {
    window.addEventListener('blur', () => {
      tabLeftAt = Date.now();
    });

    window.addEventListener('focus', () => {
      if (tabLeftAt !== null) {
        const awayMs = Date.now() - tabLeftAt;
        if (awayMs < 10000) { // returned within 10s
          rawSignals.quickTabReturns++;
          console.log(`%c[Signals] 🔁 Quick tab return after ${(awayMs / 1000).toFixed(1)}s`, 'color:#BA7517;font-weight:bold');
        }
        tabLeftAt = null;
      }
    });
  }

  // --- PUBLIC API ---
  function init() {
    if (isInitialized) return;
    isInitialized = true;
    console.log('[Signals] 🚀 Initializing signal collection...');

    rawSignals.sessionStart = Date.now();
    startScrollTracking();
    observeParagraphs();
    startHoverTracking();
    startCopyAndLookupTracking();
    startTabTracking();
  }

  function getFeatureVector() {
    const now = Date.now();
    const sessionSeconds = Math.max(1, Math.round((now - rawSignals.sessionStart) / 1000));

    // Force updates to any currently visible paragraph's dwell time
    for (const [id, enterTime] of rawSignals.paragraphEnterTimes.entries()) {
      const dwell = now - enterTime;
      const existing = rawSignals.paragraphDwellTimes.get(id) ?? 0;
      rawSignals.paragraphDwellTimes.set(id, existing + dwell);
      rawSignals.paragraphEnterTimes.set(id, now); // reset start to now
    }

    // 1. Reading Speed (WPM)
    // We sum the words of paragraphs that the user has actually viewed (dwell > 0)
    let wordsViewed = 0;
    let totalDwellMs = 0;
    for (const [id, dwell] of rawSignals.paragraphDwellTimes.entries()) {
      if (dwell > 0) {
        const wc = rawSignals.paragraphWordCounts.get(id) ?? 0;
        wordsViewed += wc;
        totalDwellMs += dwell;
      }
    }

    const minutesDwell = totalDwellMs / 60000;
    const readingSpeedWpm = minutesDwell > 0.05 // at least 3 seconds total dwell to calculate speed
      ? Math.round(wordsViewed / minutesDwell)
      : 0;

    // 2. Regression Rate (regressions per 100 words viewed)
    const normalizedRegressionWords = Math.max(10, wordsViewed);
    const regressionRate = parseFloat(
      ((rawSignals.regressionCount / normalizedRegressionWords) * 100).toFixed(2)
    );

    // 3. Copy + Lookup frequency (total count)
    const copyLookupFrequency = rawSignals.copyCount + rawSignals.lookupCount;

    // 4. Hover dwell spike count
    // Find spikes (hover duration > 2.5 * median, minimum 200ms)
    let hoverDwellSpikes = 0;
    if (rawSignals.wordHoverDurations.length >= 5) {
      const sorted = [...rawSignals.wordHoverDurations].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      hoverDwellSpikes = rawSignals.wordHoverDurations.filter(d => d > median * 2.5).length;
    }

    // 5. Paragraph Completion Rate
    // Proportion of viewed paragraphs read vs skimmed (read = dwell > 3s)
    const totalViewed = rawSignals.paragraphDwellTimes.size;
    let completed = 0;
    for (const dwell of rawSignals.paragraphDwellTimes.values()) {
      if (dwell >= CONFIG.PARA_DWELL_READ_MS) {
        completed++;
      }
    }
    const paragraphCompletionRate = totalViewed > 0
      ? parseFloat((completed / totalViewed).toFixed(2))
      : 1.0; // default to 1.0 if none viewed

    // 6. Vocabulary Difficulty Index
    const pageText = document.body.innerText || '';
    const vocabularyDifficultyIndex = parseFloat(getDifficultyIndex(pageText).toFixed(3));

    return {
      readingSpeedWpm,
      regressionRate,
      copyLookupFrequency,
      hoverDwellSpikes,
      paragraphCompletionRate,
      vocabularyDifficultyIndex,
      computedAt: now,
    };
  }

  return {
    init,
    getFeatureVector,
  };
})();
