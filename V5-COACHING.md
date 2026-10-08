# Brandon Fitness v5: advanced coaching preview

Status: staged locally, not deployed. Based on GitHub revision 13bdb5e of bcollazo09/brandon-training-app. No account or paid resource has been created. Supabase configuration is intentionally blank until the user's free project is accessible and its schema has been tested.

## What the coach now decides

The engine selects an available load, a rep target for each working set, an effort target, a working-set count, a rest recommendation, an evidence summary, and an explicit confidence label. It can establish a baseline, hold, increase, reduce, reset for a new cycle, deload, protect against fatigue, or flag an exercise for review.

It runs locally and deterministically. It needs no subscription, model API, or internet connection to coach a workout. The numeric priors below are engineering policies that need calibration against the user's actual history. Passing software tests does not validate coaching efficacy.

## 1. Comparable history before arithmetic

Load comparisons require the same exercise, programmed slot, gym, equipment identity, weight basis, load convention, and setup cues. A dumbbell bench slot in Push 1 does not borrow the Push 2 baseline. A different cable station does not inherit a machine's stack weight.

The equipment editor distinguishes per-hand, total, stack, added weight, assistance, and bodyweight entries. The user must explicitly confirm whether old records came from the same equipment before records without equipment metadata become comparable. A different setup gets a new baseline while the old workouts remain preserved.

The engine reads finalized workout history, excludes active/draft and future-dated sessions, ignores warmups and invalid sets, and deduplicates session/set IDs. Imported and manually entered finalized workouts may have unknown set completion timestamps. One workout with eight sets still counts as one independent exposure.

Up to twelve comparable exposures support model fitting. The six most recent support current capacity, fatigue, and outcome feedback. Exposure influence decays over 42 days; older-cycle observations receive lower weight. Deload workouts cannot replace a harder-work anchor.

## 2. Reps, RIR, and personal load response

For comparable early working sets with logged RIR, reported capacity is estimated from reps plus reported reserve. Reserve contribution is capped at six to limit the influence of imprecise high-RIR reports. This is an estimate, not a measured maximum. RIR zero remains distinct from missing RIR.

A log-load response model estimates how many reps an available load change would cost. Initial slopes are 26 for isolation movements and 32 for compounds. These coefficients are provisional policies. They are not universal physiology.

Adjacent meaningful load changes in the same mesocycle contribute to calibration when their gap is at most 28 days and their load ratio falls in the modeled neighborhood. Implausible slopes are rejected. Sparse estimates are shrunk strongly toward the default using n/(n+6), because strength adaptation and effort accuracy can confound observational load changes.

Recent normalized capacity uses a weighted median plus a limited contribution from the latest observation. Median absolute deviation limits unusual records. An extraordinary new load requires entry/equipment review; it cannot become a huge automatic target.

Missing RIR increases uncertainty and removes progression permission when the latest effort is unknown. It is never converted to a logged zero or invented effort value.

## 3. Evaluate real equipment steps

The engine enumerates the supplied load list, or configured equal increments. It shows the predicted early-set reps and a conservative lower estimate for each nearby candidate.

A heavier candidate must clear the programmed rep floor with a buffer, preserve a reasonable later-set envelope, and pass recovery, recent-history, dose-completion, and forecast-error gates. It requires repeated upper-range evidence or sufficient reported spare capacity. The smallest supportable heavier step is chosen; reaching the top of a rep range alone is insufficient.

A large machine increment can correctly lead to holding the load and building reps. The engine never invents a fractional plate or microload absent from the configured equipment. If equipment has no same or easier available setting, it requests a fresh baseline rather than forcing a harder one.

Prediction bands widen for sparse history, missing RIR, extrapolation, variability, and systematic prior errors. Confidence is low/medium/high based on independent exposure count, effort coverage, usable calibration, and variability. These are evidence labels, not probability claims.

## 4. Each set has a different demand

Per-position fatigue estimates use normalized capacity loss from the first set to later comparable sets. Sparse estimates fall back to modest position penalties; real repeated data gradually replace them.

Trend and drop-off comparisons use matched set positions. Adding two terminal sets does not make unchanged first-three-set performance look like a strength regression. Recent incomplete doses do not earn extra sets or heavier loads.

Automatic volume additions require several complete, genuinely improving exposures with adequate effort coverage and no protection flags. An addition is capped at one set. The engine avoids increasing both load and sets automatically. A single rep outlier cannot earn volume.

Short rests associated with misses favor more rest before concluding that the movement needs a lasting load reduction. Repeated matched deterioration and one bad exposure are treated differently.

## 5. Recovery, phases, and uncertainty remain separate

The coach distinguishes a new-cycle reset, planned deload, stale history, repeated fatigue, global recovery flags, and recorded exercise symptom associations.

A new cycle starts below the prior non-deload anchor using an available load. A planned deload reduces working sets and increases RIR even without a usable load history. History older than two weeks cannot automatically trigger progression; longer gaps receive a re-entry target.

Recorded symptoms veto automatic progression and prompt exercise review. The engine does not diagnose a condition, infer a contraindication, or claim that reducing a load treats symptoms. Missing check-ins remain unknown recovery.

These protection rules also apply to assistance and bodyweight modes. Generic resistance-load arithmetic is disabled for those modes. Assistance can build reps at the same setting; a calibrated assistance-specific model remains future work. Bodyweight zero is valid and can be completed and saved.

## 6. Live workout adjustments

Live advice uses completed sets and the opening plan's effort/rest envelope. Missing effort cannot create spare capacity. A short-rest miss suggests more rest; a full-rest miss can suggest an available easier load. Large in-session drop-off can offer removal of an optional final set.

One unusually easy set cannot trigger another load escalation above the opening ceiling. Earlier exercise fatigue produces a separate conservative current target for later slots. The original issued forecast remains intact. Applying the updated target requires an explicit workout action, preserves a local draft snapshot, and changes only remaining sets.

Reopening or rerendering does not repeatedly add fatigue penalties. Short-session time limits retain consistent planned-set and set-array counts.

## 7. Learn from the recommendation actually issued

Each started exercise stores an immutable engine version, context key, exposure IDs, chosen load, per-set rep targets, RIR, prediction buffer, candidate table, confidence, reasons, and the unclipped forecast capacity.

A saved workout includes an outcome comparison against that snapshot. This distinguishes underestimation, overestimation, partial completion, missing RIR, changed first-set load, and unmodeled load convention. Later changes to display targets do not rewrite the original prediction.

Outcome scoring compares actual reps plus reported RIR against forecast capacity, not a rep target clipped at the programmed upper bound. Changed-load sets do not masquerade as adherence. Both residual spread and systematic absolute error widen future uncertainty; repeated overestimates block another ambitious jump.

## Tested example

Synthetic records, not recovered user data: four comparable cable sessions at 10 lb, three sets of 19 reps at 5 RIR, week-two target 2 RIR, programmed range 12-20, and available 2.5 lb increments.

The staged engine recommends 12.5 lb with rep goals 16, 15, 15 and medium evidence confidence. Its estimated first-set reps at the new load are 16.2; the conservative lower estimate is 13.2. No usable load-change observations exist in that example, so the UI explicitly labels the response prior as provisional.

The same model can hold when the next plate is too large, effort is unlogged, the dose is incomplete, or recovery is flagged. It explains those decisions in the workout card.

## Verification and limits

84 automated logic/migration tests passed: 79 independent coaching scenarios and five data-migration tests. Isolated browser checks passed startup, sound activation, timer completion, offline reload, draft recovery, cloud-conflict protection, equipment configuration, immutable forecast storage/reload, live advice, time-budget dose consistency, equipment-change snapshots, and bodyweight workout completion.

Eight preservation regressions passed: raw v4 retention, failed-backup import blocking, malformed legacy recovery, stale-tab overwrite prevention, serialized same-tab writes, credential-free recovery export, guarded account operations, and owner-change upload prevention.

All browser data was synthetic in fresh profiles. Actual iPhone history has not been exported or examined. Supabase SQL, live authentication, real cloud syncing, and deployment still require account access and live validation. Cloud version conflicts are preserved for explicit review; automatic record-level conflict merging is not implemented. Cloud snapshots are retained in the same project and are not independent disaster-recovery backups.

## Research used to constrain the policy

RIR estimates vary with conditions and can be less accurate farther from failure. This supports treating reserve as uncertain rather than blindly turning a high-RIR report into a large load jump. The coefficients, time gates, confidence labels, and volume rules above are implementation choices; these studies do not validate them.

- [Estimating Repetitions in Reserve in Four Commonly Used Resistance Exercises](https://pubmed.ncbi.nlm.nih.gov/33337690/).
- [Accuracy in Predicting Repetitions to Task Failure: Scoping Review and Exploratory Meta-analysis](https://pubmed.ncbi.nlm.nih.gov/34542869/).
