# DysAssist — Adaptive Engine Demo Runbook

A 3-minute script to show the adaptive loop live. The engine normally derives a
FeatureVector every 30s; for the demo we trigger it instantly from the console.

## 0. One-time setup
1. `npm start` (optional — only needed for vocabulary tooltips / AI simplify;
   set a real `GROQ_API_KEY` in `.env` for those).
2. Load the unpacked extension: `chrome://extensions` → Developer mode →
   **Load unpacked** → select this folder.
3. Complete onboarding (pick a mode). "Occasional reader" is a good demo default —
   it starts neutral so the adaptivity is visible.

## 1. Show the signals are real (30s)
- Open any article (e.g. a Wikipedia or news page).
- DevTools console → run:
  ```js
  DysAssistSignals.snapshot()
  ```
- Point out the live FeatureVector: `readingSpeedWPM`, `regressionRate`,
  `vocabularyDifficultyIndex`, `paragraphCompletionRate`, `domain`.

## 2. Trigger the decision agent on a "hard" page (60s)
- Simulate struggling-reader behavior and let the engine decide:
  ```js
  DysAssistSignals.simulate({
    readingSpeedWPM: 100,
    regressionRate: 4.5,
    copyLookupFrequency: 3,
    paragraphCompletionRate: 0.5,
    vocabularyDifficultyIndex: 0.5
  })
  ```
- The page visibly adapts (font, spacing, tint, ruler, chunking, focus…) and a
  **"DysAssist adapted this page — Keep / Undo"** toast appears with the
  difficulty %.
- At **tier 3**, the engine also highlights the **hardest paragraph** (blue left
  bar) and drops a **"✨ Simplify this paragraph"** chip on it. Click it → the AI
  plain-English rewrite appears in an overlay (needs `npm start` + a real
  `GROQ_API_KEY`, otherwise the server returns the mock rewrite).

## 3. Show the feedback loop (45s)
- Click **Undo** → interventions revert; the engine records a dismissal
  (and a **false positive** if you click within 5s). It won't re-apply those on
  this domain.
- Reload and `simulate(...)` again → notice it's now more cautious here.
- Or click **Keep** → the engine becomes *more* eager on this domain next time.

## 4. Show the persisted brain (30s)
- Console:
  ```js
  chrome.storage.local.get(['userProfile','dysAdaptive'], console.log)
  ```
- Point out: `userProfile.difficultyScore` (EWMA-smoothed),
  `userProfile.adaptive.learn` (learned sensitivity + caution),
  `userProfile.adaptive.falsePositiveLog`, and `dysAdaptive.scoreHistory`.

## 5. Show per-domain behavior (optional)
- Same score, different site: academic domains (`arxiv.org`, `*.edu`) intervene
  sooner; social (`twitter.com`, `reddit.com`) stays light. This is the
  `DOMAIN_SENSITIVITY` map in `adaptiveEngine.js`.

## Talking points / the model
- `node tools/calibrate.js` — shows the 0.3/0.5/0.7 thresholds cleanly separate
  6 synthetic pages (6/6). Great slide.
- `docs/DECISION_LOG.md` — feature weights + rationale + interpretability story
  (why rule-based, not ML).
- `node tests/adaptive-smoke.js` — unit tests for scorer/agent/feedback.

## If something doesn't fire
- Master switch must be ON (popup) — `applyImmediately !== false`.
- The engine only auto-applies mid-session escalations with a toast; **cold-start**
  (established profile) applies a silent baseline on page load.
- Reset everything: popup → Reset, or
  `chrome.storage.local.remove(['userProfile','dysAdaptive'])`.
