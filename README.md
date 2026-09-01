# Brandon Fitness v4 — Local-First Hypertrophy Coach

v4 is a rebuild of v3 around safer data storage, stable identities, resumable workouts, smarter progression, richer analytics, and a faster gym-floor UI.

## What is implemented

### Data integrity + storage
- Local calendar dates instead of UTC `toISOString()` dates.
- v3 -> v4 migration uses the original timestamp to repair workouts/check-ins that v3 may have stamped one calendar day ahead during evening hours.
- IndexedDB is the primary v4 data store.
- Stable IDs for mesocycles, sessions, exercise slots, exercises, sets, gyms, and check-ins.
- The v3/v2/v1 localStorage copy is left untouched during migration as a fallback.
- Autosaved active workout that survives rerenders/reloads.
- A working set only enters workout history after weight + reps are present and the set is marked Done.
- Atomic workout commit: workout, therapy response, session response, notes, and suspected aggravator are saved together.
- Edit and delete historical workouts.
- Missing symptom fields remain missing rather than being converted to zero.
- Active-workout discard flow.
- Sessions accidentally left open for more than 6 hours use a set-span-based duration estimate so efficiency analytics are not destroyed by an overnight timer.

### Coaching Engine v2
- Exact programmed slot + exact performed exercise comparisons.
- Push 1 DB Bench and Push 2 DB Bench no longer contaminate each other.
- Substituted exercises preserve the program slot but do not inherit incomparable machine loads.
- Week 1 explicitly resets about 5% below the prior non-deload anchor.
- Once the new mesocycle has an exposure, later weeks anchor to current-mesocycle performance.
- Uses rep range, RIR, representative working load, total reps, e1RM where appropriate, rep drop-off, recovery, muscle-level trend, and symptom associations.
- Compounds can use e1RM; high-rep isolation work uses load/rep performance rather than pretending its calculated 1RM is equally meaningful.
- Classifies baseline, improving, stable, fatigue, and regression states.
- Exact set targets with a plain-language explanation of why the recommendation was made.
- Adaptive volume: priority volume is earned when performance/recovery support it; lower-priority volume can be reduced when fatigue/recovery flags are present.
- Repeated symptom-aggravator associations surface as caution flags without claiming causation.
- Set-to-set coaching after completed sets.
- Fatigue Rescue can remove one uncompleted final set when rep drop-off collapses.
- Live session fatigue can suppress progression calls on later lower-priority exercises.
- Mesocycle planner can recommend and start an early Week 8 deload.

### Workout UI
- Start/resume workout workflow.
- Autosave indicator.
- Offline/online status.
- Previous-session prefill.
- Copy set.
- +/- weight and rep controls.
- RIR logging.
- Per-exercise rest defaults + live rest timer.
- Warm-up generator for compound lifts.
- Gym-specific setup notes.
- Previous exercise notes surfaced automatically.
- Skip exercise with reason.
- Smart substitutions mapped by exercise/muscle role.
- Superset-next mode with a shared transition timer.
- Time-constrained modes (45/55/60/75/90 minutes) that trim low-priority work before protected work.
- Normal, Short 45, Vacation Gym, and Deload templates.

### Analytics v2
- Exercise-slot + exercise-specific trends.
- Compound e1RM / isolation rep-load performance.
- Total reps and average RIR.
- Rep drop-off.
- Weekly direct muscle sets across all 8 weeks.
- Bodyweight.
- Back pain + sciatica with true missing-data gaps.
- Symptom associations by exercise.
- Workout duration, average inter-set rest, sets/hour, and longest within-exercise rest patterns.
- Planned-day adherence and skip reasons.
- Mesocycle comparison.
- Weekly review cards.
- Therapy response.
- PR detection for load, reps-at-load, and e1RM where appropriate.
- Training calendar with workout, therapy, caution, and flare markers.

### Program + planning
- Program Sandbox can adjust base sets and swap to mapped substitutions before saving.
- Direct weekly muscle-volume preview.
- Mesocycle review/planner.
- New mesocycles keep the chosen program structure but restart at Week 1.
- Gym profiles keep machine/setup notes separated by gym.

### Backups
- Automatic encrypted local IndexedDB snapshots (up to the latest 12 snapshots, normally one per 24 hours).
- Manual snapshot + restore-latest-snapshot.
- Plain JSON export.
- CSV workout export.
- Portable AES-GCM encrypted `.bf4` export using a passphrase-derived PBKDF2-SHA256 key.
- JSON and encrypted `.bf4` import.

## Cloud sync status

The v4 data model is sync-ready: records have stable IDs, portable state, and update timestamps. **True cross-device cloud sync is not connected in this static GitHub Pages build**, because that requires a real authenticated backend/provider and credentials. The app does not fake cloud synchronization or silently upload training/health-adjacent data anywhere.

Everything else above is implemented client-side and remains local-first/offline-capable.

## Updating GitHub Pages

Replace the repository-root v3 files with the v4 files in this folder:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.json`
- `service-worker.js`
- `icon.svg`
- `icon-192.png`
- `icon-512.png`
- `README.md`

Commit and let GitHub Pages deploy. The service worker cache is now `brandon-fitness-v4-1`, so the new deployment invalidates the v3 cache.

### First v4 launch

1. v4 checks IndexedDB for an existing v4 state.
2. If none exists, it looks for `brandonFitnessV3`, then v2/v1.
3. It migrates the old data into the v4 schema.
4. The old localStorage entry is not deleted.
5. An encrypted local snapshot is created according to the automatic-backup schedule.

It is still wise to export a v3 JSON backup before deploying v4.

## Validation performed

- `node --check app.js`
- `node --check service-worker.js`
- JSON manifest validation
- Static DOM ID/reference audit
- Deterministic model tests under `America/New_York` for:
  - v3 evening-date repair
  - v3 check-in date repair
  - Week 1 reset behavior
  - Week 2 current-mesocycle anchoring
  - exact slot isolation
  - time-constrained trimming

A full Chromium UI smoke test could not be run in the build environment because its managed browser policy blocks both localhost and `file://` pages. The model/storage-independent test suite and syntax/static checks passed.
