// signalCollector.ts
// Runs on every webpage. Watches what the user does while reading.
// This week: just logs to console. Next week: feeds into the scorer.
const CONFIG = {
    SCROLL_SAMPLE_MS: 100,
    REGRESSION_THRESHOLD_PERCENT: 15,
    REGRESSION_TIME_WINDOW_MS: 3000,
    MIN_SESSION_MS: 30000,
    LOG_INTERVAL_MS: 10000,
};
// All raw data collected this session (lives in memory only)
const signals = {
    scrollPositions: [],
    regressionCount: 0,
    paragraphDwellTimes: new Map(),
    wordHoverDurations: [],
    copyCount: 0,
    lookupCount: 0,
    totalWordsSeen: 0,
    sessionStart: Date.now(),
};
let lastScrollY = window.scrollY;
// SCROLL TRACKING — detects when user scrolls back up to re-read
setInterval(() => {
    const now = Date.now();
    const currentY = window.scrollY;
    const viewportH = window.innerHeight;
    signals.scrollPositions.push({ y: currentY, timestamp: now });
    // Keep only last 30 seconds
    signals.scrollPositions = signals.scrollPositions.filter(p => p.timestamp > now - 30000);
    // Check for regression (scrolled down, now scrolling back up)
    const recent = signals.scrollPositions.filter(p => p.timestamp > now - CONFIG.REGRESSION_TIME_WINDOW_MS);
    if (recent.length >= 2) {
        const threshold = (CONFIG.REGRESSION_THRESHOLD_PERCENT / 100) * viewportH;
        const firstPosition = recent[0];
        if (firstPosition) {
            const wentDown = currentY > firstPosition.y;
            const nowGoingUp = currentY < lastScrollY - threshold;
            if (!wentDown && nowGoingUp) {
                signals.regressionCount++;
                console.log(`[SignalCollector] 🔄 Regression! Total: ${signals.regressionCount}`);
            }
        }
    }
    lastScrollY = currentY;
}, CONFIG.SCROLL_SAMPLE_MS);
// PARAGRAPH OBSERVER — measures how long each paragraph is on screen
const paragraphs = document.querySelectorAll('p');
const enterTimes = new Map();
paragraphs.forEach((el, i) => {
    const words = (el.textContent ?? '').split(/\s+/).filter(Boolean).length;
    if (words < 10)
        return; // skip tiny paragraphs
    const id = `para-${i}`;
    el.dataset.saanviId = id;
    signals.totalWordsSeen += words;
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                enterTimes.set(id, Date.now());
                console.log(`[SignalCollector] 👁 Entered: ${id} (${words} words)`);
            }
            else {
                const entered = enterTimes.get(id);
                if (entered) {
                    const dwell = Date.now() - entered;
                    signals.paragraphDwellTimes.set(id, dwell);
                    console.log(`[SignalCollector] 📖 Left: ${id} — visible for ${(dwell / 1000).toFixed(1)}s`);
                }
            }
        });
    }, { threshold: 0.5 });
    observer.observe(el);
});
// COPY TRACKING — user copies text (maybe pasting to translator)
document.addEventListener('copy', () => {
    signals.copyCount++;
    const selected = window.getSelection()?.toString() ?? '';
    console.log(`[SignalCollector] 📋 Copy #${signals.copyCount}: "${selected.slice(0, 40)}..."`);
});
// LOOKUP TRACKING — user right-clicks on selected text (word lookup)
document.addEventListener('contextmenu', () => {
    const selected = window.getSelection()?.toString().trim() ?? '';
    if (selected.length > 0) {
        signals.lookupCount++;
        console.log(`[SignalCollector] 🔎 Lookup #${signals.lookupCount}: "${selected}"`);
    }
});
// TAB SWITCH TRACKING — quick return = frustration signal
let tabLeft = null;
let quickReturns = 0;
window.addEventListener('blur', () => { tabLeft = Date.now(); });
window.addEventListener('focus', () => {
    if (tabLeft) {
        const away = Date.now() - tabLeft;
        if (away < 10000) {
            quickReturns++;
            console.log(`[SignalCollector] 🔁 Quick tab return (${(away / 1000).toFixed(1)}s away)`);
        }
        tabLeft = null;
    }
});
// FEATURE SNAPSHOT — log a summary every 10 seconds
setInterval(() => {
    const duration = (Date.now() - signals.sessionStart) / 1000;
    if (duration < 30)
        return;
    const wpm = signals.totalWordsSeen / (duration / 60);
    const regrPer100 = signals.totalWordsSeen > 0
        ? (signals.regressionCount / signals.totalWordsSeen) * 100
        : 0;
    console.log('%c[SignalCollector] 📊 Snapshot', 'background:#534AB7;color:white;padding:2px 6px', {
        readingSpeedWPM: Math.round(wpm),
        regressionsPer100Words: regrPer100.toFixed(2),
        copies: signals.copyCount,
        lookups: signals.lookupCount,
        sessionSeconds: Math.round(duration),
    });
}, CONFIG.LOG_INTERVAL_MS);
console.log('%c[SignalCollector] 🚀 Running on ' + location.hostname, 'background:#1D9E75;color:white;padding:2px 8px;font-weight:bold');
export {};
//# sourceMappingURL=signalCollector.js.map