# DysAssist — Adaptive Reading Assistance

DysAssist is a **privacy-first Chrome extension (Manifest V3)** that watches how you
read, detects when a page is hard for you, and **automatically turns on the right
reading aids** — dyslexia-friendly typography, a reading ruler, paragraph
chunking, focus mode, vocabulary tooltips, text-to-speech, and AI text
simplification. It learns from whether you keep or dismiss each suggestion, and
adapts differently per website. Everything runs on your device; the only network
call is an optional local LLM proxy for definitions and simplification.

---

## Table of contents

1. [The idea in one picture](#the-idea-in-one-picture)
2. [How it works: the adaptive pipeline](#how-it-works-the-adaptive-pipeline)
3. [Feature reference](#feature-reference)
4. [Onboarding modes](#onboarding-modes)
5. [The difficulty model](#the-difficulty-model)
6. [The decision agent](#the-decision-agent)
7. [Feedback learning & personalization](#feedback-learning--personalization)
8. [Storage model](#storage-model)
9. [Architecture & file structure](#architecture--file-structure)
10. [Message-passing API](#message-passing-api)
11. [Installation & setup](#installation--setup)
12. [The local server (LLM proxy)](#the-local-server-llm-proxy)
13. [Testing & calibration](#testing--calibration)
14. [Live demo quickstart](#live-demo-quickstart)
15. [Privacy](#privacy)
16. [Roadmap / deferred work](#roadmap--deferred-work)

---

## The idea in one picture

```
                        ┌─────────────────────────────────────────────┐
   You read a page ───► │  signalCollector.js  (content script)        │
                        │  scroll · dwell · hover · copy · lookup       │
                        └───────────────┬─────────────────────────────┘
                                        │  every 30s: a FeatureVector
                                        ▼
                        ┌─────────────────────────────────────────────┐
                        │  background.js  (service worker)              │
                        │  adaptiveEngine.js:                           │
                        │   scoreFeatures → EWMA → decideInterventions  │
                        └───────────────┬─────────────────────────────┘
                                        │  writes preferences to chrome.storage
                                        ▼
                        ┌─────────────────────────────────────────────┐
                        │  content.js reacts to storage change and     │
                        │  applies the interventions (font, ruler …)   │
                        └───────────────┬─────────────────────────────┘
                                        │  "Keep / Undo" toast
                                        ▼
                        ┌─────────────────────────────────────────────┐
                        │  Your feedback → applyFeedback → learns      │
                        │  (per-domain sensitivity, caution, FP log)   │
                        └─────────────────────────────────────────────┘
```

There are **two layers**:

- **Effectors** — the actual reading aids (typography, ruler, chunking, focus,
  TTS, tooltips, simplify). Each is a self-contained content script exposing a
  `window.DysAssist*` API and driven by a preference flag.
- **The brain** — the adaptive engine that decides *which* effectors to enable,
  *when*, and *how aggressively*, then learns from your responses.

---

## How it works: the adaptive pipeline

### 1. Signal collection — `signalCollector.js`
Runs on every page (top frame only). It passively records:

| Signal | How it's captured |
|---|---|
| Paragraph dwell time | `IntersectionObserver` on each `<p>` / list item |
| Reading speed | words on paragraphs dwelled long enough to be "read" ÷ reading time |
| Scroll regressions | scroll-direction detector (scrolling back up to re-read) |
| Copy events | `copy` listener (often precedes pasting into a translator) |
| Word lookups | `contextmenu` on a short text selection |
| Hover dwell | `mouseover`/`mouseout` on inline text elements |
| Active time | only counts while the tab is focused & visible |

### 2. Feature derivation — every 30 seconds
Raw events are converted into a **`FeatureVector`**:

```ts
{
  readingSpeedWPM,            // e.g. 130
  regressionRate,            // re-reads per 100 words
  copyLookupFrequency,       // copies + lookups per active minute
  paragraphCompletionRate,   // 0..1, fraction of paragraphs finished
  vocabularyDifficultyIndex, // 0..1, share of words not in the frequency list
  sessionDurationSeconds,
  timestamp,
  domain
}
```

`vocabularyDifficultyIndex` uses `wordFrequencyData.js` — a bundled
high-frequency English word set. Any content word (>2 letters) not in the set
counts as "difficult."

### 3. Scoring — `adaptiveEngine.js`
Each feature is normalized to a 0–1 "struggle" value, then combined by an
**interpretable weighted sum** into a single `difficultyScore` (0–1). See
[The difficulty model](#the-difficulty-model). The score is **EWMA-smoothed**
across the session/history so a single hard page doesn't whipsaw the profile.

### 4. Decision — the agent
`decideInterventions(score, context)` maps the smoothed score to an
**intervention plan** using the 0.3 / 0.5 / 0.7 tier thresholds, adjusted by
per-domain sensitivity and your onboarding mode.

### 5. Application — `content.js`
The agent writes the chosen preference flags to `chrome.storage`. `content.js`
already listens for storage changes and applies the corresponding effectors, so
the page visibly adapts.

### 6. Feedback — the toast
Each newly auto-applied intervention shows a **"DysAssist adapted this page —
Keep / Undo"** toast. Your answer feeds `applyFeedback`, which updates the
learned state. A dismissal within 5 seconds is logged as a likely **false
positive**.

---

## Feature reference

All effectors can be toggled manually in the popup **or** enabled automatically
by the adaptive engine. Each maps to one or more preference flags.

| Feature | Module (`window.*`) | Preference flag(s) | What it does |
|---|---|---|---|
| **Reading font & typography** | `content.js` (CSS inject) | `font`, `letterSpacing`, `lineHeight` | Injects **Lexend** or **OpenDyslexic** with adjustable spacing/line height. |
| **Background tint** | `content.js` | `backgroundTint`, `overlayOpacity` | Cream / Sky Blue / Mint / Warm Yellow overlay to cut glare. |
| **Distraction-free reader** | `content.js` + `readability.js` | `readingModeEnabled` | Extracts the main article (custom Readability candidate scoring), strips ads/sidebars. |
| **Paragraph chunking** | `DysAssistChunker` | `chunkingEnabled`, `chunkMaxSentences` | Splits long paragraphs into short sentence blocks. |
| **Reading ruler** | `DysAssistRuler` | `rulerEnabled`, `rulerHeight`, `rulerOpacity`, `rulerColor`, `rulerMode` | A highlight band that follows the cursor or snaps to the nearest line. |
| **Focus mode** | `DysAssistFocus` | `focusEnabled`, `focusStyle`, `focusBlur`, `focusDimOpacity`, `focusTransition` | Highlights the active block, dims/blurs the rest (hover, scroll, arrow keys). |
| **Text-to-speech** | `DysAssistTTS` | `ttsEnabled`, `ttsRate`, `ttsPitch`, `ttsVoiceURI`, `ttsHighlight` | Reads text aloud with word-by-word highlighting and voice controls. |
| **Vocabulary tooltips** | `DysAssistVocab` | `vocabEnabled`, `vocabTopN` | Underlines hard words; hover for syllables, part of speech, and a definition. |
| **AI simplify (manual)** | `DysAssistSimplify` | `applyImmediately` | Select any text → floating **✨ Simplify** button → plain-English rewrite. |
| **AI simplify (adaptive)** | `DysAssistSimplify` | `simplifySuggestEnabled` | **Tier 3**: auto-highlights the hardest paragraph with a one-click "✨ Simplify this paragraph" chip. |

Definitions and simplifications are produced by the [local server](#the-local-server-llm-proxy).
Definitions fall back to the free Dictionary API, then a mock, if no LLM is configured.

---

## Onboarding modes

On first install, an onboarding tab asks how much help you want. Your choice sets
the initial difficulty prior and how aggressive the engine is:

| Mode | Meaning | Initial score prior | Aggressiveness |
|---|---|---|---|
| 🧠 **Declared dyslexic** | Full assistance immediately | high (~0.8) | ×1.1 (and cold-start applies a baseline on page load) |
| 📚 **Occasional** | Smart help when reading gets hard | mid (~0.4) | ×1.0 (neutral — the adaptivity is most visible here) |
| 👀 **Fully passive** | Hands-off, only step in when clearly struggling | low (~0.1) | ×0.6 (dampened) |

Declared-dyslexic users also pick a starting font and tint during onboarding.

---

## The difficulty model

A **rule-based, interpretable weighted sum** — not an ML model — chosen so it
works from the very first page, every score is explainable, and nothing needs to
leave the device. Full rationale in [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md).

**Feature weights** (sum to 1.0):

| Signal | Weight | Why |
|---|---:|---|
| `vocabularyDifficultyIndex` | 0.30 | Hard words predict struggle before behavior even shows it. |
| `regressionRate` | 0.25 | Re-reading is the clearest behavioral struggle signal. |
| `slowReading` (from WPM) | 0.20 | Slow reading corroborates (but varies by intent). |
| `copyLookupFrequency` | 0.15 | Direct help-seeking, but sparse/noisy. |
| `lowCompletion` | 0.10 | Abandoned paragraphs — weak alone, so weighted least. |

**Normalization highlights:** WPM struggle ramps from 220 wpm (fluent → 0) to
90 wpm (struggling → 1); a freshly-opened page (WPM 0, nothing read yet) maps to
**0 struggle**, not maximum, to avoid over-triggering.

**EWMA smoothing:** `score ← 0.3·new + 0.7·previous` — responsive within a
session, stable across sessions.

---

## The decision agent

`decideInterventions(score, context)` applies interventions **progressively** by
tier — least intrusive first:

| Tier | Effective score ≥ | Interventions added |
|---|---|---|
| **1** | 0.30 | dyslexia font · wide letter spacing · relaxed line height · cream tint |
| **2** | 0.50 | reading ruler · paragraph chunking |
| **3** | 0.70 | focus mode · vocabulary tooltips · read-aloud (TTS) · simplify-hardest-paragraph |

`effectiveScore = score × sensitivity`, where sensitivity depends on the
**domain class** and your mode:

- **Academic** (`arxiv.org`, `*.edu`, Wikipedia, PubMed…) → ×1.25 (intervene sooner)
- **News** → ×1.05 · **General** → ×1.0 · **Social** (Twitter/X, Reddit, YouTube…) → ×0.7 (stay light)

Other guards:
- **`alreadyApplied`** — never re-propose an active intervention.
- **`suppressed`** — never re-apply one you dismissed on that domain.
- **Caution offset** — dismissals raise the thresholds; accepts lower them.
- **Cold-start** — for an *established* profile (declared dyslexic, or ≥3 scored
  sessions), a baseline is applied the moment a page loads, without waiting 30s.

---

## Feedback learning & personalization

Every auto-applied intervention is confirmable. The response updates
`profile.adaptive.learn`:

| Your action | Effect |
|---|---|
| **Keep** | domain sensitivity ×1.06 (cap 1.6); caution −0.01 (more eager) |
| **Undo (>5s)** | domain sensitivity ×0.90; caution +0.03; intervention suppressed on that domain |
| **Undo (<5s)** | ×0.82 / +0.06 — **logged as a likely false positive** (telemetry) |
| **Ignore (timeout)** | no change; interventions stay |

Sensitivity is clamped to [0.4, 1.6] and the caution offset to [−0.15, 0.4] so
learning can't run away. False positives accumulate in
`profile.adaptive.falsePositiveLog` — the primary signal for future tuning.

---

## Storage model

Two keys in `chrome.storage.local`, split to keep the page from re-rendering
every 30 seconds:

- **`userProfile`** — small & stable: mode, `difficultyScore` (EWMA), all
  `preferences`, and `adaptive` (`learn`, `autoApplied`, `suppressed`,
  `falsePositiveLog`). Rewritten only when a preference flips or the score %
  changes.
- **`dysAdaptive`** — rolling telemetry: `featureHistory` (cap 60) +
  `scoreHistory` (cap 120).

**IndexedDB migration:** if telemetry exceeds **1 MB**, older history is archived
to IndexedDB (`dysassist` DB, `archive` store) and only a recent tail stays in
`chrome.storage.local`.

---

## Architecture & file structure

Content scripts are **plain `.js` loaded directly by the manifest** — there is no
bundler for the runtime. The `src/*.ts` files are the **typed reference/spec**
(shared team contracts), not compiled into the extension.

```
team8final/
├── manifest.json              MV3 manifest (content scripts + service worker)
│
│  ── Adaptive brain (Saanvi) ──
├── signalCollector.js         Reading-signal collector → FeatureVector every 30s + Keep/Undo toast
├── wordFrequencyData.js       Bundled high-frequency word set (auto-generated) → window.DysAssistWordFreq
├── adaptiveEngine.js          Scorer · EWMA · decision agent · feedback learning (UMD: SW + Node)
├── background.js              Service worker: ingest → score → decide → apply → learn; cold-start; IndexedDB
│
│  ── Intervention effectors ──
├── content.js                 Orchestrator: reads prefs, injects theme CSS, drives every effector
├── readability.js             Main-article extraction (window.DysAssistReadability)
├── paragraphChunker.js        window.DysAssistChunker
├── readingRuler.js            window.DysAssistRuler
├── focusMode.js               window.DysAssistFocus
├── ttsEngine.js               window.DysAssistTTS
├── vocabularyTooltips.js      window.DysAssistVocab
├── simplifyText.js            window.DysAssistSimplify (manual select + adaptive suggestHardest)
│
│  ── UI ──
├── popup.html / popup.js      Control panel (shows difficulty score, toggles every feature)
├── onboarding.html / .js      First-run mode + preference setup (React bundle)
├── assets/                    Fonts (Lexend, OpenDyslexic) + popup/onboarding CSS
├── chunks/                    Onboarding/popup React bundle
├── icons/                     Toolbar icons
│
│  ── Backend ──
├── server/index.js            Local Express proxy: /health /simplify /define (Groq / Gemini / mock)
│
│  ── Typed reference (not shipped) ──
├── src/shared/types.ts        UserProfile, FeatureVector, adaptive contracts
├── src/shared/globals.d.ts    Ambient `chrome` for typechecking
├── src/model/difficultyModel.ts   Typed scorer + EWMA
├── src/agent/decisionAgent.ts     Typed decision agent + feedback
├── src/signals/signalCollector.ts Typed feature-derivation spec
├── src/data/wordFrequency.ts      Source word list (generates wordFrequencyData.js)
│
│  ── Docs, tools, tests ──
├── docs/DECISION_LOG.md       Feature weights, thresholds, calibration, learning rules
├── docs/EVALUATION.md         Week-6 study protocol + report template (awaiting participants)
├── docs/DEMO.md               3-minute live demo runbook
├── tools/calibrate.js         Threshold calibration on synthetic pages (npm run calibrate)
├── tests/server-smoke.js      Backend endpoint smoke tests
├── tests/adaptive-smoke.js    Scorer / agent / feedback unit tests
└── package.json               Scripts + dependencies
```

**Content-script load order** (from `manifest.json`) matters:
`wordFrequencyData.js` → effector modules → `signalCollector.js` → `content.js`.

---

## Message-passing API

Content scripts talk to the service worker via `chrome.runtime.sendMessage`:

| Message `type` | Payload | Handler does |
|---|---|---|
| `GET_PROFILE` | — | returns `userProfile` |
| `SAVE_PROFILE` | full profile | persists it |
| `RESET_PROFILE` | — | clears `userProfile` + `dysAdaptive` |
| `APPLY_READING_THEME_CSS` | `{ css }` | injects theme CSS via `chrome.scripting` |
| `DEFINE_WORD` | `{ word, context }` | proxies to `/define` |
| `SIMPLIFY_TEXT` | `{ text }` | proxies to `/simplify` |
| `FEATURE_SNAPSHOT` | `FeatureVector` | **score → EWMA → decide → apply**; responds with the plan (drives the toast) |
| `INTERVENTION_FEEDBACK` | `{ decision, interventions, domain, dwellMs, scoreAtTime }` | updates learned state; logs false positives |
| `REVERT_INTERVENTIONS` | `{ interventions }` | turns the dismissed interventions back off |

---

## Installation & setup

### 1. Install dependencies
```bash
npm install
```

### 2. (Optional) Configure the LLM proxy
Only needed for **vocabulary definitions** and **AI simplification**.
```bash
cp .env.example .env
```
Then either:
- **Groq (fast):** `GROQ_API_KEY=gsk_...`, `USE_GROQ=true`, `USE_GEMINI=false`
- **Gemini:** `GEMINI_API_KEY=AIza...`, `USE_GEMINI=true`, `USE_GROQ=false`
- **No key:** leave both `false` — the server returns mock rewrites/definitions
  (definitions also fall back to the free Dictionary API).

### 3. Start the server
```bash
npm start        # http://127.0.0.1:8787
```

### 4. Load the extension
1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. **Load unpacked** → select this project folder.
4. Complete onboarding. Done.

---

## The local server (LLM proxy)

`server/index.js` is a small Express app on port `8787`:

| Endpoint | Purpose |
|---|---|
| `GET /health` | reports mode (`groq` / `gemini` / `mock`) and whether keys are configured |
| `POST /simplify` | rewrites text to grade 6–8 plain language |
| `POST /define` | defines a term for a dyslexic reader (LLM → free Dictionary API → mock) |

It includes CORS restricted to the extension origin, per-IP rate limiting, and
request timeouts. Nothing is stored server-side.

---

## Testing & calibration

```bash
npm test           # syntax checks + server smoke + adaptive unit tests + calibration
npm run calibrate  # threshold calibration table only
```

- **`tests/adaptive-smoke.js`** — asserts the scorer ranks hard > easy, EWMA
  behaves, domain classification is correct, the agent tiers correctly, and
  feedback (accept / dismiss / false-positive) updates state as intended.
- **`tools/calibrate.js`** — scores six synthetic pages spanning the difficulty
  range and confirms the 0.3/0.5/0.7 cut-points assign each to the intended tier
  (currently **6/6**), and prints the top contributing signals for the hardest
  page (interpretability demo).

The server smoke test forces mock mode, so `npm test` passes regardless of your
local `.env`.

---

## Live demo quickstart

See [`docs/DEMO.md`](docs/DEMO.md) for the full script. Fastest path:

1. Load the extension, complete onboarding as **Occasional**.
2. Open any article, open DevTools console.
3. Trigger the whole pipeline instantly (skip the 30s wait):
   ```js
   DysAssistSignals.simulate({
     readingSpeedWPM: 100, regressionRate: 4.5, copyLookupFrequency: 3,
     paragraphCompletionRate: 0.5, vocabularyDifficultyIndex: 0.5
   })
   ```
   The page adapts, the hardest paragraph gets a **Simplify** chip, and the
   **Keep / Undo** toast appears. Click **Undo** within 5s to demo false-positive
   logging; inspect the brain with:
   ```js
   chrome.storage.local.get(['userProfile','dysAdaptive'], console.log)
   ```

---

## Privacy

- All reading signals, scores, and learned state stay in `chrome.storage.local`
  on your device.
- The only network calls are to **your own local server** (`127.0.0.1:8787`),
  and only when you use definitions or simplification. If no LLM key is set, even
  those are handled locally (mock) except the optional free Dictionary fallback.
- No analytics, no accounts, no remote profile.

---

## Roadmap / deferred work

- **TF.js MLP scorer** (optionally, once real labeled usage exists) — deliberately
  deferred; the rule-based scorer is interpretable and works from page one.
- **Per-domain learned weights**, not just sensitivity.
- **Word-level difficulty** from `hoverDurations` (collected, not yet weighted).
- **User evaluation study** (8–10 participants; reading speed, comprehension,
  NASA-TLX, SUS) — protocol and instrumentation are ready in
  [`docs/EVALUATION.md`](docs/EVALUATION.md); participant runs pending. The
  numbers in that file are placeholders, not results.
