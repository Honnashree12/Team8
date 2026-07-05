# DysAssist — Evaluation Plan & Report Template (Week 6)

_Owner: Saanvi (joint demo/report). Status: **protocol + instrumentation ready;
awaiting participant runs.**_

> ⚠️ **Honesty note for the team:** the tables below are a **template**. The
> numbers are placeholders (`—`). Do **not** present them as results until real
> sessions are run. Everything needed to collect the data is built and working;
> only the human sessions remain.

---

## 1. Research question

Does DysAssist's adaptive assistance improve reading **speed**,
**comprehension**, and **perceived load** versus reading unaided — for both
self-reported dyslexic readers and general readers?

## 2. Participants

- **8–10 participants**, mix of **self-reported dyslexic** (n≈4–5) and
  **general** (n≈4–5).
- Within-subjects: each participant does **aided** and **unaided** conditions.
- **Counterbalance** condition order (ABBA) and use **different articles** of
  matched difficulty per condition to avoid re-reading effects.

## 3. Materials

- 4 articles, ~500–700 words each, matched on the difficulty scorer
  (`vocabularyDifficultyIndex` within ±0.05; run them through
  `tools/calibrate.js`-style scoring first).
- **3 comprehension questions per article** (see §7 bank).

## 4. Metrics

| Metric | Instrument | How captured |
|---|---|---|
| **Reading speed (WPM)** | DysAssist signal collector | `readingSpeedWPM` in `dysAdaptive.featureHistory`; or stopwatch |
| **Comprehension** | 3 Qs/article | % correct |
| **Cognitive load** | **NASA-TLX** (6 subscales, 0–100) | post-article form |
| **Usability** | **SUS** (10 items) | end-of-session, aided only |
| **False-positive rate** | telemetry | `adaptive.falsePositiveLog` (dismissed <5s) |
| **Acceptance rate** | telemetry | `learn.accepts / (accepts + dismisses)` |

## 5. Procedure (per participant, ~30 min)

1. Consent + 2-min onboarding (pick mode; no other config).
2. Warm-up article (discarded) to acclimate.
3. **Condition A** (aided or unaided per counterbalance): read → NASA-TLX → 3 Qs.
4. **Condition B** (the other): read → NASA-TLX → 3 Qs.
5. SUS (aided experience) + short debrief.
6. Export telemetry: DevTools → `chrome.storage.local.get(['userProfile','dysAdaptive'])`.

## 6. Results template (fill after runs)

### 6.1 Primary outcomes (mean ± SD)

| Metric | Unaided | Aided | Δ | Direction wanted |
|---|---|---|---|---|
| Reading speed (WPM) | — | — | — | ↑ |
| Comprehension (%) | — | — | — | ↑ |
| NASA-TLX (0–100) | — | — | — | ↓ |

### 6.2 By group

| Group | Speed Δ | Comp Δ | TLX Δ |
|---|---|---|---|
| Self-reported dyslexic | — | — | — |
| General | — | — | — |

### 6.3 Usability & adaptivity

- SUS score (0–100): **—** (≥68 = above average)
- Interventions auto-applied / participant: **—**
- Acceptance rate: **—%**
- False-positive rate (dismissed <5s): **—%**

### 6.4 Analysis
- Paired t-test (or Wilcoxon if non-normal) aided vs. unaided, per metric.
- Report effect sizes (Cohen's d). Note n is small → descriptive + trend, not
  strong claims.

## 7. Comprehension question bank (fill per article)
For each article, 3 questions: 1 literal recall, 1 inference, 1 vocabulary-in-context.

## 8. Threats to validity
- Small n → underpowered; report as pilot.
- Self-reported (not diagnosed) dyslexia.
- Novelty effect of the aided condition.
- Article difficulty matching is approximate.

---

## Appendix — what's already instrumented

Everything the study measures is captured automatically:
- Reading speed, regressions, lookups, completion → `dysAdaptive.featureHistory`
- Difficulty score over time → `dysAdaptive.scoreHistory`
- Which interventions fired, accepted, dismissed → `userProfile.adaptive`
- False positives → `userProfile.adaptive.falsePositiveLog`

So a session needs only: run the extension, read the articles, fill NASA-TLX/SUS,
export the two storage keys.
