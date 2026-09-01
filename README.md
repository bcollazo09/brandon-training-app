# Brandon Fitness v3 — Mesocycle Intelligence Update

## What changed

- Migrates existing v2 data automatically (`brandonFitnessV2` -> `brandonFitnessV3`).
- Recommendations now use **week phase + rep range + logged RIR + recent performance + e1RM trend + recovery flags**.
- Coaching targets are **day-specific**, so the high-rep Push 2 DB bench session cannot incorrectly drive the low-rep Push 1 prescription (same for repeated exercises such as cable pullovers).
- Week 8 fully overrides progression: ~half sets, ~85–90% load, 4–5 RIR.
- Set counts actually change across the mesocycle:
  - Week 1 reduced base volume
  - Weeks 2–4 base volume
  - Weeks 5–7 +1 set on priority exercises when recovery is not flagged
  - Week 8 about half sets
- Rep targets shift within each exercise's range by mesocycle phase.
- Analytics use **estimated 1RM (Epley)**, so lower-load/higher-rep progress is no longer displayed as stagnant.
- Shows exercise e1RM trend, volume load, rep totals, weekly direct sets, bodyweight, pain/sciatica, and mesocycle insights.
- Adds plateau/regression detection instead of automatically telling you to add weight.
- Adds back therapy boxes for:
  - McGill Modified Curl-Up
  - Side Plank
  - Pallof Press
- Default therapy days: Pull 1 + Legs.
- Adds one-tap post-workout back/leg response: Better / Same / Worse. If Worse, you can identify the suspected exercise.
- Tracks therapy response separately, while explicitly treating it as an association rather than proof of causation.
- Mesocycle archive stores exercise e1RM start/end changes and seeds the next cycle from prior non-deload data.
- JSON backup + CSV workout export.

## Update GitHub Pages

Replace the files in the repository root with the seven files from this ZIP:

- index.html
- styles.css
- app.js
- manifest.json
- service-worker.js
- icon.svg
- README.md

Commit the change. After GitHub Pages deploys, open the site in Safari and refresh. The new service worker uses a new cache name. Existing v2 local data should migrate automatically on that device.

## Important

Before updating, export a v2 JSON backup from the current app. The migration is designed to preserve v2 workouts/check-ins, but a backup is still the safest path.
