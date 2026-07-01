# Decision Log — DysAssist Reading Scorer & Decision Agent (Week 3)

This document records the exact design choices, mathematical formulas, and parameters used for the real-time rule-based difficulty scorer and the agentic decision loop.

## 1. Feature Extraction & Normalization

The content script tracks raw behavioral signals and computes derived features. To calculate a coherent difficulty score, each feature is normalized to a $[0, 1]$ sub-score where $0$ represents fluent reading and $1$ represents high friction.

### Feature 1: Reading Speed (WPM)
- **Concept**: Fluent adult reading speed is typically $200\text{--}250$ WPM. Dyslexic or struggling readers often read below $120$ WPM.
- **Formula**:
  $$s_{\text{wpm}} = \max\left(0, \min\left(1, \frac{200 - \text{WPM}}{140}\right)\right)$$
- **Logic**: Reading at $\ge 200$ WPM yields $0$ difficulty. Reading at $\le 60$ WPM yields $1$ difficulty. Linear interpolation in between.

### Feature 2: Scroll Regression Rate
- **Concept**: Users scroll backward when they lose focus or fail to decode a sentence. Regressions are measured per 100 words read.
- **Formula**:
  $$s_{\text{reg}} = \max\left(0, \min\left(1, \frac{\text{regressions} - 1.0}{3.0}\right)\right)$$
- **Logic**: $\le 1$ regression/100 words is normal ($0$ score). $\ge 4$ regressions/100 words indicates extreme backtracking ($1$ score).

### Feature 3: Hover Dwell Spikes
- **Concept**: Prolonged fixation/hover on a single word relative to the median hover duration indicates vocabulary decoding struggles. Measured as spikes per 100 words.
- **Formula**:
  $$s_{\text{hover}} = \max\left(0, \min\left(1, \frac{\text{spikes}}{3}\right)\right)$$
- **Logic**: $0$ spikes yields $0$ score. $\ge 3$ spikes yields $1$ score.

### Feature 4: Copy & Lookup Frequency
- **Concept**: High rates of text copy operations, dictionary lookups, or right-clicks for search represent vocabulary comprehension blocks. Measured as total count in the current session.
- **Formula**:
  $$s_{\text{lookup}} = \max\left(0, \min\left(1, \frac{\text{events}}{3}\right)\right)$$
- **Logic**: $0$ events yields $0$ score. $\ge 3$ events yields $1$ score.

### Feature 5: Paragraph Completion Rate
- **Concept**: A low paragraph completion rate (skipping/leaving paragraphs visible for $< 3$ seconds) suggests visual crowding, frustration, or severe distraction.
- **Formula**:
  $$s_{\text{comp}} = 1 - \text{completion\_rate}$$
- **Logic**: $100\%$ completion yields $0$ score. $0\%$ completion yields $1$ score.

### Feature 6: Vocabulary Difficulty Index
- **Concept**: The ratio of long ($\ge 7$ chars) and uncommon (not in top-100 basic words list) words on the page.
- **Formula**:
  $$s_{\text{vocab}} = \max\left(0, \min\left(1, \frac{\text{index} - 0.05}{0.25}\right)\right)$$
- **Logic**: $\le 0.05$ hard words yields $0$ score. $\ge 0.30$ hard words yields $1$ score.

---

## 2. Difficulty Score Weights (Scorer v1)

The overall session difficulty score $S_{\text{session}}$ is a weighted linear combination of the feature sub-scores:

| Feature | Code Variable | Weight | Rationale |
| :--- | :--- | :--- | :--- |
| **Reading Speed** | `s_wpm` | **0.35** | Primary behavioral indicator of reading throughput. |
| **Scroll Regressions** | `s_reg` | **0.25** | High correlation with tracking confusion and losing place. |
| **Hover Spikes** | `s_hover` | **0.15** | Direct physical trace of single-word decoding blocks. |
| **Copy & Lookups** | `s_lookup` | **0.10** | Explicit user action querying unfamiliar words. |
| **Vocab Complexity** | `s_vocab` | **0.10** | Content-based baseline complexity of the text. |
| **Para Completion** | `s_comp` | **0.05** | General attentional alignment and task persistence. |

**Formula**:
$$S_{\text{session}} = 0.35 \cdot s_{\text{wpm}} + 0.25 \cdot s_{\text{reg}} + 0.15 \cdot s_{\text{hover}} + 0.10 \cdot s_{\text{lookup}} + 0.10 \cdot s_{\text{vocab}} + 0.05 \cdot s_{\text{comp}}$$

---

## 3. Score Smoothing (EWMA)

To prevent abrupt changes or single-page outliers from causing erratic intervention toggles, we apply an Exponentially Weighted Moving Average (EWMA) over historical scores:

$$S_{\text{new}} = \alpha \cdot S_{\text{session}} + (1 - \alpha) \cdot S_{\text{historical}}$$

- **Smoothing Factor ($\alpha$)**: **0.3**
- **Rationale**: Gives $30\%$ weight to the current page session features and $70\%$ weight to prior reading history, ensuring smooth transitions while remaining responsive to changes in content style (e.g. moving from casual news to scientific articles).

---

## 4. Graduated Decision Logic

| Difficulty Score ($S$) | Classification | Action | Interventions Included |
| :---: | :---: | :--- | :--- |
| **$< 0.3$** | Reading Fine | No Action | Continue passive observation. |
| **$0.3\text{--}0.5$** | Mild Friction | Silent Typography | Auto-inject custom font (Lexend), spacing (+4px letter, +6px word), and line height (1.7x). No notification. |
| **$0.5\text{--}0.7$** | Struggling | Offer Structural | Banner prompt: offer paragraph breaking (chunking), reading ruler, and focus mode. |
| **$\ge 0.7$** | Crisis | Offer Full Remediation | Banner prompt: offer Plain-Language simplification (AI), text-to-speech, and vocab tooltips. |

### History-Aware Adjustments
- **Previous Acceptance**: If a user previously accepted Tier 2 or Tier 3 interventions, those are auto-applied on future pages immediately.
- **Previous Dismissal**: If a user dismissed a tier, the threshold for that tier is temporarily raised by $+0.15$ above the score at which it was dismissed.
- **Per-Domain Settings**: Domain sensitivity overrides (Low/High) shift the thresholds by $+0.15$ (less sensitive) or $-0.15$ (more sensitive).
