# DysAssist — Difficulty Model & Decision Agent: Decision Log

_Owner: Saanvi · adaptive intelligence layer (Weeks 3–5)_

This log documents **why** the difficulty model and decision agent are built the
way they are: the feature weights, the tier thresholds, the calibration, and the
learning rules. The runtime is `adaptiveEngine.js` (+ wiring in `background.js`);
the typed spec is `src/model/difficultyModel.ts` and `src/agent/decisionAgent.ts`.

---

## 1. Why rule-based, not ML

The scorer is an **interpretable weighted sum**, not a trained model.

- **Works from page 1** with zero training data — critical for a browser
  extension that must help immediately.
- **Every score is explainable** (`explainScore()` returns the per-signal
  contribution), so we can tell the user *why* we intervened and debug false
  positives.
- **No privacy cost** — nothing leaves the device; no model to host.

A TF.js MLP upgrade was scoped for Week 4 (see §7). We **deliberately kept the
rule-based scorer** because Week-3 calibration already separates difficulty
bands cleanly (§4) and interpretability is worth more than a marginal accuracy
gain for this product.

---

## 2. The feature vector

Derived every 30s from raw reading signals (`signalCollector.js`):

| Feature | Meaning | Raw source |
|---|---|---|
| `readingSpeedWPM` | words actually read / reading time | IntersectionObserver dwell on paragraphs |
| `regressionRate` | scroll-backs per 100 words | scroll-direction detector |
| `copyLookupFrequency` | copies + right-click lookups per active minute | `copy` / `contextmenu` events |
| `paragraphCompletionRate` | fraction of paragraphs dwelled long enough to be "read" | dwell vs. words-needed |
| `vocabularyDifficultyIndex` | fraction of content words not in the high-frequency set | `wordFrequencyData.js` |

Each is **normalized to a 0–1 "struggle" value** before weighting
(`normalizeFeatures`). Notable choices:
- `readingSpeedWPM = 0` (page opened, nothing read yet) maps to **0 struggle**,
  not maximum — this prevents over-triggering on freshly-loaded pages.
- WPM struggle ramps linearly from **220 wpm (fluent → 0)** to **90 wpm
  (struggling → 1)**.
- `regressionRate` saturates at **5 regressions / 100 words**; `copyLookupFrequency` at **4 / min**.

---

## 3. Feature weights (sum = 1.0)

| Signal | Weight | Rationale |
|---|---:|---|
| `vocabularyDifficultyIndex` | **0.30** | Strongest *prior*: hard words predict struggle before behavior even shows it. |
| `regressionRate` | **0.25** | Re-reading is the clearest behavioral struggle signal. |
| `slowReading` (from WPM) | **0.20** | Slow reading corroborates, but varies by intent (skim vs. study). |
| `copyLookupFrequency` | **0.15** | Direct vocabulary help-seeking, but sparse/noisy. |
| `lowCompletion` | **0.10** | Abandoned paragraphs — weak alone (could be disinterest), so weighted least. |

`score = Σ (weightᵢ × normalizedᵢ)`, clamped to [0, 1].

---

## 4. Thresholds & calibration (0.3 / 0.5 / 0.7)

Interventions are applied **progressively** by tier:

| Tier | Score ≥ | Interventions added | Intrusiveness |
|---|---|---|---|
| 1 | **0.30** | dyslexia font, wide letter spacing, relaxed line height, cream tint | low (typography) |
| 2 | **0.50** | reading ruler, paragraph chunking | medium (structural) |
| 3 | **0.70** | focus mode, vocabulary tooltips, read-aloud (TTS), simplify-hardest-paragraph | high (AI / audio) |

**Calibration** (`tools/calibrate.js`, `npm run calibrate`) scores six synthetic
pages spanning the difficulty range and confirms they land in the intended tier
at these cut-points. Latest run — **6/6 correct**:

```
page                                    score   tier  expected
Children's blog (very easy)             0.017   0     0   ✓
Casual recipe page (easy)               0.085   0     0   ✓
General news article (mild struggle)    0.334   1     1   ✓
Long-form opinion essay (moderate)      0.515   2     2   ✓
Academic abstract (hard)                0.745   3     3   ✓
Dense legal / medical text (very hard)  0.839   3     3   ✓
```

The bands are well-separated (nearest score to a boundary is 0.334 vs. the 0.30
line), so small measurement noise won't flip tiers.

---

## 5. EWMA smoothing across sessions

A single hard or easy page shouldn't whipsaw the profile, so the persisted
`difficultyScore` is an **exponentially-weighted moving average**:

```
difficultyScore ← α · newScore + (1 − α) · difficultyScore     (α = 0.3)
```

α = 0.3 keeps ~70% of the prior each snapshot: responsive within a session,
stable across sessions.

---

## 6. Decision agent + per-domain learning

`decideInterventions(score, ctx)` turns a score into a plan. Beyond the raw
score it uses:

- **Per-domain aggressiveness** — `effectiveScore = score × sensitivity`:
  academic **×1.25**, news ×1.05, general ×1.0, social **×0.7**. Academic pages
  reach heavier interventions sooner; social feeds stay light.
- **Onboarding mode** — `declared_dyslexic ×1.1`, `fully_passive ×0.6`.
- **Caution offset** — raised by dismissals (§7) so repeated "no" makes us wait
  for a higher score.
- **`alreadyApplied` / `suppressed`** — never re-propose an active intervention,
  and never re-apply one the user dismissed on that domain.

Cold-start (`applyColdStart`): once a profile is *established*
(`declared_dyslexic`, or ≥3 scored sessions), baseline interventions are applied
**the moment a page loads** — no 30-second wait.

---

## 7. Feedback loop (Week 4)

Each auto-applied intervention shows a **Keep / Undo** toast. The response feeds
`applyFeedback`:

| Event | Effect |
|---|---|
| **Accept** | domain sensitivity ×1.06 (cap 1.6); caution offset −0.01 (more eager) |
| **Dismiss (>5s)** | domain sensitivity ×0.90; caution offset +0.03; intervention suppressed on that domain |
| **Dismiss (<5s)** | ×0.82 / +0.06 — **logged as a likely false positive** (telemetry) |
| **Ignore (timeout)** | no change |

Sensitivity is clamped to **[0.4, 1.6]** and the offset to **[−0.15, 0.4]** so
learning can't run away.

### False-positive telemetry (Week 5)
A dismissal within **5 seconds** is recorded in `adaptive.falsePositiveLog`
(intervention, domain, score, dwell). This is the primary signal for tuning
weights/thresholds after real use.

---

## 8. Storage & migration (Week 5)

- **Profile** (`userProfile`): small, stable — score, prefs, learned state,
  auto-applied/suppressed sets. Rewritten only when a pref flips or the score %
  changes, to avoid re-rendering the page every 30s.
- **Telemetry** (`dysAdaptive`): rolling `featureHistory` (cap 60) +
  `scoreHistory` (cap 120).
- **IndexedDB migration**: if telemetry exceeds **1 MB**, older history is
  archived to IndexedDB (`dysassist` DB, `archive` store) and only a recent tail
  is kept in `chrome.storage.local` (`maybeMigrateTelemetry`).

---

## 9. Open items / future work

- Upgrade to a small TF.js MLP once we have labeled real-use data (kept
  rule-based for now — see §1).
- Learn per-domain **weights**, not just sensitivity.
- Use `hoverDurations` (collected but not yet weighted) as a word-level
  difficulty signal.
