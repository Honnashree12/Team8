# DysAssist — Adaptive Reading Assistance Extension

DysAssist is an AI-driven, privacy-first Chrome extension that detects reading difficulties and provides highly customizable, dyslexia-friendly typography adjustments, reading aids, text-to-speech synchronization, and AI-powered text simplification and vocabulary support.

---

## Features

| Feature | Description |
|---------|-------------|
| **Reading Font & Typography** | Injects high-readability fonts like **Lexend** and **OpenDyslexic** with customizable letter spacing and line heights. |
| **Color Overlay Tint** | Applies soft colored tints (Cream, Sky Blue, Mint Green, Warm Yellow) with adjustable opacity to reduce glare and visual fatigue. |
| **Distraction-Free Reader** | Isolates the main article content (using custom Readability.js candidate extraction), stripping away ads, banners, and sidebar distractions. |
| **Paragraph Chunking** | Splits long, exhausting paragraphs into shorter, visually distinct blocks (adjustable sentences per block) with guide indicators. |
| **Reading Ruler** | A soft highlight band that follows the mouse cursor or snaps to the nearest text line to guide eye tracking. |
| **Focus Mode** | Automatically isolates and highlights the active text block (by hover, scroll, or arrow keys) while dimming and/or blurring non-focused content. |
| **Text-to-Speech (TTS)** | Reads page content aloud with real-time word-by-word visual highlighting, speed/pitch controls, and standard voice selectors. |
| **Vocabulary Tooltips** | Detects and highlights difficult words, showing syllable counts, part-of-speech hints, and contextual definitions retrieved from local AI API or Free Dictionary API fallbacks. |
| **AI Simplify Overlay** | Select any text on a page to show a floating **✨ Simplify** button. Clicking it rewrites the selection in dyslexia-friendly plain language (via Groq/Gemini APIs). |

---

## File Structure

```
Team8/
├── manifest.json         Chrome MV3 Extension Manifest
├── background.js          Service worker (handles message routing & backend calls)
├── content.js             Main orchestrator content script (binds DOM observers)
├── paragraphChunker.js    Splits long paragraphs into short sentence blocks
├── readingRuler.js        Controls the line-highlight reading ruler
├── focusMode.js           Dims and blurs non-focused paragraphs
├── ttsEngine.js           Handles text-to-speech with word-level highlighting
├── vocabularyTooltips.js  Extracts hard words and shows definition tooltips
├── simplifyText.js        Selection popover with float button for AI text rewriting
├── popup.html             Extension control panel dashboard interface
├── popup.js               Popup controller script binding UI controls
├── onboarding.html        Onboarding / Settings configuration tab
├── onboarding.js          Onboarding logic
├── server/
│   └── index.js           Local Node.js Gemini / Groq proxy server
├── tests/
│   └── server-smoke.js    Automated test script for proxy endpoints
└── package.json           Node.js dependencies and run scripts
```

---

## Installation & Setup

### Step 1: Install Node.js Dependencies
From the root of the project directory (`Team8/`), run:
```bash
npm install
```

### Step 2: Configure Environment Variables
Create a `.env` file in the root of the `Team8` directory:
```bash
cp .env.example .env
```
Fill in your API keys. Depending on your choice of LLM provider:
* **For Groq (Recommended for Speed)**:
  - Add your API key: `GROQ_API_KEY=gsk_xxx...`
  - Set `USE_GROQ=true` and `USE_GEMINI=false`
* **For Google Gemini**:
  - Add your API key: `GEMINI_API_KEY=AIzaSy...`
  - Set `USE_GEMINI=true` and `USE_GROQ=false`

### Step 3: Run the Proxy Server
Start the local server (listens on `http://127.0.0.1:8787`):
```bash
npm start
```

### Step 4: Load Extension into Chrome
1. Open Google Chrome and go to `chrome://extensions`.
2. Toggle on **Developer mode** in the upper right.
3. Click **Load unpacked** in the top left.
4. Select the `Team8/` root folder.
5. The **DysAssist** icon will now appear in your toolbar!

---

## Testing

Ensure the extension and local proxy are working correctly by running the automated test suite:
```bash
npm test
```
This runs syntax validation checks on core scripts and launches smoke tests against the backend endpoints (`/health`, `/simplify`, `/define`).

---

## How to Use AI Features

### 1. Simplify Text Selection
- Select any complex sentence or paragraph on a webpage.
- A **✨ Simplify** button will float near your cursor.
- Click it to view the plain-English rewritten version inside a non-intrusive modal dialog. You can copy the text or close the modal.

### 2. Hover Word Definitions
- With **Vocabulary Tooltips** enabled in the popup, difficult words will be underlined with a blue line.
- Hover your mouse over any underlined word to display a tooltip showing:
  - Syllable structure.
  - Part of speech.
  - An AI-powered contextual definition.
  - A speech icon to speak the word individually.
