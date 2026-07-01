# DysAssist — AI-Driven Adaptive Reading Assistance

> A Chrome extension that detects reading difficulty in real time and autonomously selects, applies, and refines reading interventions based on individual user behaviour — all processed locally on-device, with no data leaving the browser.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Repository Structure](#3-repository-structure)
4. [How It All Works](#4-how-it-all-works)
   - [Signal Collection](#41-signal-collection)
   - [Difficulty Scoring](#42-difficulty-scoring)
   - [Decision Agent & Graduated Interventions](#43-decision-agent--graduated-interventions)
   - [Notification UI & Feedback Loop](#44-notification-ui--feedback-loop)
   - [Per-Domain Learning](#45-per-domain-learning)
   - [Neural Scorer Upgrade](#46-neural-scorer-upgrade)
   - [AI Server (Gemini / Groq)](#47-ai-server-gemini--groq)
   - [User Profile Storage](#48-user-profile-storage)
5. [Prerequisites](#5-prerequisites)
6. [Running from Scratch](#6-running-from-scratch)
   - [Step 1 — Clone & Install](#step-1--clone--install)
   - [Step 2 — Configure the AI Server](#step-2--configure-the-ai-server)
   - [Step 3 — Start the AI Server](#step-3--start-the-ai-server)
   - [Step 4 — Load the Extension in Chrome](#step-4--load-the-extension-in-chrome)
   - [Step 5 — Onboarding](#step-5--onboarding)
7. [Running Tests](#7-running-tests)
8. [Content Scripts Load Order](#8-content-scripts-load-order)
9. [Message Passing Reference](#9-message-passing-reference)
10. [Profile Schema](#10-profile-schema)
11. [Intervention Tiers](#11-intervention-tiers)
12. [Environment Variables](#12-environment-variables)
13. [Team & Week-by-Week Build Log](#13-team--week-by-week-build-log)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Project Overview

DysAssist is a Chrome Manifest V3 extension. It works on **any website** without requiring the user to declare a diagnosis. The system:

- **Observes** reading behaviour through 6 passive signals (scroll regressions, hover dwell time, reading speed, copy/lookup events, vocabulary difficulty, paragraph completion rate)
- **Scores** reading difficulty in real time using a weighted formula that evolves into a personalised in-browser neural network over time
- **Decides** which intervention tier to apply or offer using a graduated decision agent
- **Learns** from every accept / dismiss / ignore event, automatically raising or lowering sensitivity per domain
- **Serves** AI-powered vocabulary definitions and text simplification through a local Express proxy (Gemini or Groq)

All behavioural data stays in `chrome.storage.local`. Nothing is ever sent to a remote server except optional AI requests proxied through the local server.

---

## 2. Architecture Diagram

```
┌─────────────────── Browser Tab ──────────────────────────────────────────┐
│                                                                           │
│  ┌─ Content Scripts (injected on every page, document_idle) ──────────┐  │
│  │                                                                      │  │
│  │  readability.js       — tags readable paragraphs with data-read-id  │  │
│  │  paragraphChunker.js  — splits long paragraphs into digestible      │  │
│  │                         chunks (Tier 2 intervention)                 │  │
│  │  readingRuler.js      — floating horizontal reading ruler            │  │
│  │  focusMode.js         — dims non-focused paragraphs                  │  │
│  │  ttsEngine.js         — text-to-speech with word highlighting        │  │
│  │  notificationUI.js    — smart intervention banner + undo toast       │  │
│  │  vocabularyTooltips.js— hover tooltips with AI definitions          │  │
│  │  simplifyText.js      — selection-to-simplified-text (AI)            │  │
│  │  signalCollector.js   — passive behavioural signal listeners         │  │
│  │  content.js           — orchestrator: reads profile, applies CSS,    │  │
│  │                         runs 30s scoring loop                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│            │ chrome.runtime.sendMessage                                    │
└────────────┼──────────────────────────────────────────────────────────────┘
             │
             ▼
┌─── background.js (Service Worker) ──────────────────────────────────────┐
│  Message handlers:                                                        │
│    GET_PROFILE / SAVE_PROFILE / RESET_PROFILE                            │
│    PROCESS_SESSION_FEATURES  — scorer + EWMA + decision agent            │
│    RECORD_INTERVENTION_FEEDBACK — feedback weighting + domain learning   │
│    GET_WEEKLY_SUMMARY        — 7-day stats for popup                     │
│    CALIBRATE_SCORER          — manual neural weight update               │
│    APPLY_READING_THEME_CSS   — chrome.scripting.insertCSS                │
│    DEFINE_WORD / SIMPLIFY_TEXT — proxy to AI server                      │
│                                                                           │
│  Core logic:                                                              │
│    computeDifficultyScore()  — 6-feature weighted scorer (rule-based)    │
│    runNeuralScorer()         — 2-layer MLP (activates after 5 feedback)  │
│    neuralScorerStep()        — online SGD update                          │
│    runDecisionAgent()        — graduated tier logic + history awareness  │
│    processFeedback()         — weight updates, counter tracking           │
│    autoClassifyDomain()      — sensitivity override from patterns         │
│    computeWeeklySummary()    — 7-day aggregate                            │
└───────────────────────┬─────────────────────────────────────────────────┘
                        │ fetch()
                        ▼
┌─── server/index.js (Local Express Server, port 8787) ───────────────────┐
│  POST /simplify   — rewrite text to grade 6-8 reading level              │
│  POST /define     — AI vocabulary definition with context                │
│  GET  /health     — server status + configured LLM mode                  │
│                                                                           │
│  LLM backends (switchable via .env):                                     │
│    • Gemini (USE_GEMINI=true + GEMINI_API_KEY)                           │
│    • Groq   (USE_GROQ=true   + GROQ_API_KEY)                             │
│    • Mock   (no keys needed — returns canned responses for development)  │
└─────────────────────────────────────────────────────────────────────────┘

Storage: chrome.storage.local
  "userProfile"         — profile, intervention history, domain stats
  "neuralScorerWeights" — MLP weights (separate key, survives reinstalls)
```

---

## 3. Repository Structure

```
my-project/
│
├── manifest.json              Chrome MV3 extension manifest
│
├── background.js              Service worker — scoring, decision, AI proxy calls
│
├── content.js                 Page orchestrator — CSS injection, module wiring,
│                              30-second scoring loop
│
├── signalCollector.js         Passive signal listeners (Week 3)
│                              Exposes window.DysAssistSignals
│
├── notificationUI.js          Intervention banner, accept/dismiss/undo (Week 4)
│                              Exposes window.DysAssistNotify
│
├── paragraphChunker.js        Tier 2: splits paragraphs into readable chunks
│                              Exposes window.DysAssistChunker
│
├── readingRuler.js            Tier 2: floating horizontal reading guide
│                              Exposes window.DysAssistRuler
│
├── focusMode.js               Tier 2: paragraph focus dimming
│                              Exposes window.DysAssistFocus
│
├── ttsEngine.js               Tier 3: text-to-speech engine
│                              Exposes window.DysAssistTTS
│
├── vocabularyTooltips.js      Tier 3: AI hover tooltips
│                              Exposes window.DysAssistVocab
│
├── simplifyText.js            Tier 3: AI text simplification
│                              Exposes window.DysAssistSimplify
│
├── readability.js             Tags all readable text elements with data-read-id
│
├── popup.html / popup.js      Extension popup — settings, profile, weekly summary
│
├── onboarding.html / .js      First-run onboarding flow
│
├── decision_log.md            Mathematical specification of scoring weights,
│                              EWMA alpha, and decision thresholds
│
├── server/
│   └── index.js              Express AI proxy server (Gemini / Groq / Mock)
│
├── tests/
│   ├── scoring-agent-test.js      21 tests — scorer, EWMA, decision agent
│   ├── feedback-weighting-test.js 20 tests — feedback weights, domain learning
│   ├── neural-scorer-test.js      14 tests — MLP equivalence, SGD, personalisation
│   └── server-smoke.js            Server smoke tests
│
├── .env.example               Template for all environment variables
└── package.json
```

---

## 4. How It All Works

### 4.1 Signal Collection

**File:** `signalCollector.js` → exposes `window.DysAssistSignals`

On page load, `content.js` calls `window.DysAssistSignals.init()` which attaches lightweight passive observers:

| Signal | How it's measured |
|--------|------------------|
| **Scroll regressions** | `scroll` events — counts times the user scrolls back up (re-reads) |
| **Hover dwell spikes** | `mouseover` on text — flags unusually long hovers (> 2 s) on single words |
| **Copy / lookup events** | `copy` and `selectionchange` — proxy for looking up unknown words |
| **Tab switch count** | `visibilitychange` — tracks distraction or confusion-driven tab switching |
| **Paragraph completion rate** | `IntersectionObserver` — measures what fraction of readable paragraphs the user actually reaches |
| **Reading speed (WPM)** | Time-on-page ÷ tagged word count (computed at `beforeunload`) |
| **Vocabulary difficulty index** | Word frequency lookup — fraction of words in the bottom 20% of common usage |

Every 30 seconds, `content.js` calls `window.DysAssistSignals.getFeatureVector()` and sends it to `background.js` via `PROCESS_SESSION_FEATURES`.

---

### 4.2 Difficulty Scoring

**File:** `background.js` → `computeDifficultyScore()` (rule-based) / `runNeuralScorer()` (MLP)

Each feature is **normalised to [0, 1]** and combined with fixed weights:

| Feature | Weight | "Easy" baseline | "Hard" baseline |
|---------|--------|-----------------|----------------|
| Reading Speed | **35%** | ≥ 200 WPM | ≤ 60 WPM |
| Scroll Regressions | **25%** | ≤ 1 / 100 words | ≥ 4 / 100 words |
| Hover Dwell Spikes | **15%** | 0 spikes | ≥ 3 spikes |
| Copy / Lookups | **10%** | 0 events | ≥ 3 events |
| Vocabulary Complexity | **10%** | ≤ 5% hard words | ≥ 30% hard words |
| Para Completion Rate | **5%** | 100% | 0% |

The session score is then **EWMA-smoothed** with the historical score (`α = 0.3`):

```
newScore = 0.3 × sessionScore + 0.7 × historicalScore
```

This prevents a single unusually easy or hard page from dramatically changing the user's running score.

After ≥ 5 user feedback events, the rule-based scorer is **automatically replaced** by the in-browser **Neural Scorer** (see §4.6).

---

### 4.3 Decision Agent & Graduated Interventions

**File:** `background.js` → `runDecisionAgent()`

The agent maps the current score to a **Tier** and decides what to silently apply vs. offer via banner:

| Score | Tier | Action |
|-------|------|--------|
| < 0.3 | — | No intervention |
| 0.3 – 0.5 | **Tier 1 — Typography** | Apply silently: Lexend font, letter spacing, line height, cream background tint |
| 0.5 – 0.7 | **Tier 2 — Structural** | Banner offer: paragraph chunking, reading ruler, focus mode |
| ≥ 0.7 | **Tier 3 — Full Assistance** | Banner offer: vocabulary tooltips, AI simplification, text-to-speech |

**History-aware logic:**
- Previously **accepted** tier → applied silently (no banner shown again)
- Previously **dismissed** tier → only re-offered when score rises ≥ 0.15 above the dismissal baseline
- **Declared dyslexic** users → Tier 1 applied proactively on every page load
- **Known difficult domains** (≥ 2 visits, avg score ≥ 0.5) → Tier 1 applied without waiting for scoring

**Per-domain sensitivity overrides** adjust all three thresholds up or down by ±0.15.

---

### 4.4 Notification UI & Feedback Loop

**File:** `notificationUI.js` → exposes `window.DysAssistNotify`

When the decision agent returns `plan.offer = "tier2"` or `"tier3"`:
- A non-intrusive banner slides in from the bottom-right
- A 30-second progress bar begins (soft-dismiss timer)
- Possible outcomes:

| User action | Recorded as | Effect |
|-------------|-------------|--------|
| Click "Yes, adjust" | `accepted` | Preferences saved, interventions applied, undo toast shown |
| Click "Not now" | `dismissed` | Weight reduced, `difficultyScoreAtTime` saved for re-offer gating |
| Quick close (< 5 s) | `dismissed (quickDismiss)` | Treated as possible false positive — weight penalty softened |
| Timer expires | `ignored` | Small weight penalty, no threshold change |

Every outcome is forwarded to `background.js` via `RECORD_INTERVENTION_FEEDBACK` for authoritative processing.

---

### 4.5 Per-Domain Learning

**File:** `background.js` → `autoClassifyDomain()`

After ≥ 3 visits to any domain, the system examines the intervention history for that domain:

| Pattern | Automatic action |
|---------|-----------------|
| Acceptance rate ≥ 60% **and** avg difficulty ≥ 0.55 | `sensitivityOverride = 0.8` → thresholds lowered by 0.15 (be more proactive, treat it like an academic site) |
| Dismissal rate ≥ 60% | `sensitivityOverride = 0.2` → thresholds raised by 0.15 (back off, treat it like a casual social site) |

The override is stored in `profile.domainSettings` and applied by the decision agent on every subsequent visit.

---

### 4.6 Neural Scorer Upgrade

**File:** `background.js` → `runNeuralScorer()` / `neuralScorerStep()`

A pure-JavaScript **2-layer MLP** (no external ML library):

```
6 features → [W1: 6×8, b1: 8] → ReLU → [W2: 8×1, b2: 1] → linear clip [0,1]
```

**Day 0:** Pre-seeded weights make the network output **exactly the same score** as the rule-based formula. Switching to the neural scorer is a no-op until personalisation begins.

**Personalisation:** Each accepted or dismissed event triggers one **online SGD step** (learning rate = 0.01):
- `accepted` → target = current score (confirms the model's difficulty estimate)
- `dismissed` → target = current score − 0.20 (model over-estimated difficulty)

After **5 feedback events**, `processSessionFeatures` automatically routes through the neural scorer instead of the rule-based formula.

Neural weights are stored in `chrome.storage.local["neuralScorerWeights"]` — a **separate key from the profile** so weights survive extension reinstallation.

---

### 4.7 AI Server (Gemini / Groq)

**File:** `server/index.js` — Express server running on `http://127.0.0.1:8787`

The extension's background script calls this server for two AI tasks:

| Endpoint | Used by | Does |
|----------|---------|------|
| `POST /simplify` | `simplifyText.js` | Rewrites selected text to grade 6–8 reading level |
| `POST /define` | `vocabularyTooltips.js` | Returns a brief, context-aware definition of a word |
| `GET /health` | Popup diagnostics | Returns server mode (gemini / groq / mock) |

The server supports three **switchable backends** via `.env`:

| Mode | Env flag | Requirements |
|------|----------|-------------|
| **Gemini** | `USE_GEMINI=true` | `GEMINI_API_KEY` |
| **Groq** | `USE_GROQ=true` | `GROQ_API_KEY` |
| **Mock** | both false | None — returns canned responses, no API calls |

The server includes rate limiting (30 requests / 60 s by default) and origin validation.

---

### 4.8 User Profile Storage

All state lives in `chrome.storage.local` under the key `"userProfile"`:

```jsonc
{
  "mode": "fully_passive" | "declared_dyslexic",
  "difficultyScore": 0.45,          // EWMA-smoothed running score
  "lastSessionScore": 0.52,         // raw score from last 30s window
  "lastFeatureVector": { ... },     // raw features — used for neural training
  "scoringModel": "rule_based" | "neural",
  "preferences": {
    "font": "lexend",
    "lineHeight": "1.7",
    "letterSpacing": "0.045em",
    "backgroundTint": "cream",
    "chunkingEnabled": false,
    "rulerEnabled": false,
    "focusEnabled": false,
    "vocabEnabled": false,
    "ttsEnabled": false,
    "applyImmediately": true
  },
  "interventionHistory": {
    "tier2": {
      "lastAction": "dismissed",
      "weight": 0.35,
      "difficultyScoreAtTime": 0.55,
      "acceptCount": 1,
      "dismissCount": 2,
      "ignoreCount": 0,
      "quickDismissCount": 1
    }
  },
  "domainSettings": [
    { "domain": "arxiv.org", "paused": false, "sensitivityOverride": 0.8 }
  ],
  "domainStats": {
    "arxiv.org": {
      "visits": 5,
      "avgDifficultyScore": 0.68,
      "avgReadingSpeedWpm": 112,
      "interventionsOffered": 4,
      "interventionsAccepted": 3,
      "lastVisited": 1751399821000
    }
  },
  "sessionHistory": [ ... ]   // last 200 sessions
}
```

Neural scorer weights are stored separately under `"neuralScorerWeights"`.

---

## 5. Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | ≥ 18 | Used for the AI proxy server and running tests |
| **npm** | ≥ 9 | Bundled with Node |
| **Chrome** | ≥ 114 | Must support Manifest V3 |
| **Gemini or Groq API key** | — | Optional — mock mode works without any key |

---

## 6. Running from Scratch

### Step 1 — Clone & Install

```bash
git clone <your-repo-url>
cd my-project
npm install
```

---

### Step 2 — Configure the AI Server

```bash
cp .env.example .env
```

Open `.env` and choose **one** of the following:

**Option A — Use Gemini (recommended)**
```env
USE_GEMINI=true
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-1.5-flash
```

**Option B — Use Groq**
```env
USE_GROQ=true
GROQ_API_KEY=your-groq-api-key-here
GROQ_MODEL=llama-3.3-70b-versatile
```

**Option C — Mock mode (no API key needed)**
Leave both `USE_GEMINI=false` and `USE_GROQ=false`. The server returns canned responses. Vocabulary tooltips and text simplification won't produce real AI output but the rest of the extension works fully.

> The `PORT`, `RATE_LIMIT_*`, and `ALLOWED_ORIGINS` settings can be left at their defaults.

---

### Step 3 — Start the AI Server

```bash
npm start
```

You should see:
```
DysAssist AI server listening on http://127.0.0.1:8787
Mode: gemini   (or groq / mock)
```

Verify it's healthy:
```bash
curl http://127.0.0.1:8787/health
# {"ok":true,"mode":"gemini","geminiConfigured":true,"groqConfigured":false}
```

> **Keep this terminal open** while you use the extension. The extension will work without the server, but vocabulary tooltips and AI simplification will silently fail.

---

### Step 4 — Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **"Load unpacked"**
4. Select the **`my-project/`** folder (the one containing `manifest.json`)
5. The DysAssist icon (🧠) should appear in your Chrome toolbar

> No build step is required. The extension runs directly from source files.

---

### Step 5 — Onboarding

On first install, a new tab opens with the **onboarding flow**:

1. **Choose your mode:**
   - *"I have dyslexia or a reading difficulty"* → declared dyslexic mode (Tier 1 applied proactively everywhere from day 1)
   - *"I just want smarter reading"* → fully passive mode (assistance only offered when the system detects difficulty)

2. **Set baseline preferences** (font, tint, etc.) — these can be changed later from the popup

3. Onboarding saves your profile to `chrome.storage.local` and the extension is active on all pages immediately.

---

## 7. Running Tests

All tests are plain Node.js (no test framework required):

```bash
# Full suite (syntax check + server smoke tests)
npm test

# Week 3 — Scorer & Decision Agent (21 tests)
node tests/scoring-agent-test.js

# Week 4 — Feedback Weighting & Domain Learning (20 tests)
node tests/feedback-weighting-test.js

# Week 4 — Neural Scorer / MLP (14 tests)
node tests/neural-scorer-test.js

# All unit tests at once
node tests/scoring-agent-test.js && \
node tests/feedback-weighting-test.js && \
node tests/neural-scorer-test.js
```

Expected output: **55 tests, 0 failures**

---

## 8. Content Scripts Load Order

Scripts are injected **in this exact order** on every page (`document_idle`):

```
1. readability.js        — must run first: tags elements with data-read-id
2. paragraphChunker.js   — depends on data-read-id
3. readingRuler.js
4. focusMode.js
5. ttsEngine.js
6. notificationUI.js     — must be before content.js (content.js calls DysAssistNotify)
7. vocabularyTooltips.js
8. simplifyText.js
9. signalCollector.js    — must be before content.js (content.js calls DysAssistSignals.init)
10. content.js           — orchestrator, runs last
```

Each module attaches itself to `window` (e.g. `window.DysAssistChunker`). `content.js` calls them via optional chaining (`window.DysAssistChunker?.chunkDocument()`), so a missing module never crashes the page.

---

## 9. Message Passing Reference

All communication between content scripts and the background service worker uses `chrome.runtime.sendMessage`:

| `message.type` | Direction | Payload | Response |
|---------------|-----------|---------|----------|
| `GET_PROFILE` | content → bg | — | `{ profile }` |
| `SAVE_PROFILE` | content → bg | `profile` | `{ ok }` |
| `RESET_PROFILE` | popup → bg | — | `{ ok }` |
| `PROCESS_SESSION_FEATURES` | content → bg | feature vector object | `{ ok, plan, currentDifficultyScore, scoringModel }` |
| `RECORD_INTERVENTION_FEEDBACK` | notificationUI → bg | `{ tier, action, domain, score, quickDismiss }` | `{ ok }` |
| `GET_WEEKLY_SUMMARY` | popup → bg | — | `{ ok, summary }` |
| `CALIBRATE_SCORER` | popup → bg | `{ features, targetScore }` | `{ ok, trainingExamples }` |
| `APPLY_READING_THEME_CSS` | content → bg | `{ css }` | `{ ok }` |
| `DEFINE_WORD` | vocabularyTooltips → bg | `{ word, context }` | `{ ok, result }` |
| `SIMPLIFY_TEXT` | simplifyText → bg | `{ text }` | `{ ok, result }` |
| `TTS_TEST` | popup → content | — | — |

---

## 10. Profile Schema

See §4.8 for the full annotated profile JSON. Key fields:

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `string` | `"fully_passive"` or `"declared_dyslexic"` |
| `difficultyScore` | `number [0–1]` | EWMA-smoothed running score |
| `preferences` | `object` | Active typographic and feature preferences |
| `interventionHistory` | `object` | Per-tier feedback history including weights |
| `domainSettings` | `array` | Per-domain pause state and sensitivity overrides |
| `domainStats` | `object` | Per-domain visit counts, speed, difficulty averages |
| `sessionHistory` | `array` | Last 200 session records (kept trimmed) |

---

## 11. Intervention Tiers

| Tier | Trigger score | Features | Delivery |
|------|--------------|----------|---------|
| **Tier 1 — Typography** | ≥ 0.30 | Lexend font, wider letter spacing, relaxed line height, cream background tint | Silent — applied immediately on page load |
| **Tier 2 — Structural** | ≥ 0.50 | Paragraph chunking, reading ruler, focus mode | Banner offer — applied on acceptance |
| **Tier 3 — Full Assistance** | ≥ 0.70 | Vocabulary tooltips, AI text simplification, text-to-speech | Banner offer — applied on acceptance |

Thresholds shift ±0.15 based on domain sensitivity overrides.

---

## 12. Environment Variables

All variables are read by `server/index.js` from a `.env` file in the project root.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8787` | Port the AI proxy server listens on |
| `USE_GEMINI` | `false` | Set `true` to enable Gemini backend |
| `GEMINI_API_KEY` | — | Your Gemini API key |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Gemini model name |
| `USE_GROQ` | `false` | Set `true` to enable Groq backend |
| `GROQ_API_KEY` | — | Your Groq API key |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq model name |
| `REQUEST_TIMEOUT_MS` | `12000` | AI request timeout in milliseconds |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | `30` | Max requests per window per origin |
| `ALLOWED_ORIGINS` | `chrome-extension://*,...` | Comma-separated allowed CORS origins |

---

## 13. Team & Week-by-Week Build Log

| Week | Saanvi | Honnashree | Manoj |
|------|--------|-----------|-------|
| **Week 1** | Extension scaffold, manifest, profile schema, onboarding | Popup UI shell | Server scaffold, /health endpoint |
| **Week 2** | Tier 1 typography (CSS injection, font, tint), per-domain settings | Tier 2 interventions (chunking, ruler, focus) | Tier 3 interventions (TTS, vocab tooltips, simplify) |
| **Week 3** | `signalCollector.js`, difficulty scorer, EWMA, decision agent, `background.js` scoring pipeline | `notificationUI.js` v1 (banner, soft-dismiss timer) | Real Gemini/Groq integration, vocabulary API, simplify API |
| **Week 4** | Feedback weighting, per-domain auto-classification, neural MLP scorer, weekly summary, 55 unit tests | Rich banner feedback (quickDismiss, accept/dismiss/ignore counters, undo) | Vocabulary caching, TTS settings |

---

## 14. Troubleshooting

**Extension not showing up in Chrome**
- Make sure you selected the folder containing `manifest.json`, not a subfolder
- Check `chrome://extensions` for any error badges — click "Errors" for details

**"Could not establish connection" errors in DevTools**
- The background service worker may have gone idle. Trigger it by interacting with the extension popup or reloading the tab.

**Vocabulary tooltips / text simplification not working**
- Confirm the AI server is running: `curl http://127.0.0.1:8787/health`
- If the server isn't running, start it with `npm start`
- Check your `.env` file has the correct API key and `USE_GEMINI=true` or `USE_GROQ=true`

**Banner never appears**
- The scoring loop runs every 30 seconds. Stay on the page for at least 30–60 seconds.
- The score must reach ≥ 0.50 for a Tier 2 banner. Try a dense article on a site you haven't visited before.
- Open DevTools Console on the page and look for `[DysAssist]` log lines.

**Neural scorer not activating**
- It activates only after 5 accepted/dismissed feedback events. Check `chrome.storage.local["neuralScorerWeights"].trainingExamples` in the DevTools Storage panel.

**Reset everything**
- Open the extension popup → Settings → Reset Profile
- Or run in DevTools Console on any page:
  ```javascript
  chrome.runtime.sendMessage({ type: "RESET_PROFILE" }, r => console.log(r))
  ```
