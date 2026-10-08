# Workout preservation and free-tier rollout plan

Current state, October 7, 2026: the original Desktop source is backed up in brandon-fitness-desktop-v4-backup.zip; the current GitHub repository history is backed up in brandon-training-repo-backup.bundle. Those are source backups. They do not contain the workouts stored in either iPhone installation.

Supabase project Brandon Fitness v5 (wnlhutiwrzpprfmhhmtm) is configured in the Free BrandonFitnessApp organization. A separate /v5-preview/ deployment uses its own device database and cache; it cannot automatically access either original iPhone installation. The production v4 rollout adds only read-only raw recovery exports. Full v5 replacement remains staged pending verified phone exports. No phone storage has been accessed, deleted, or reset. Tests use synthetic data only; no paid options are enabled.

Before rollout:

1. Keep both iPhone app installations and their storage. Export each installation's JSON history if it opens. Label the files with the installation and export date. Verify session counts, latest workout dates, exercises, sets, and current draft before accepting the backup. Do not assume the first installation contains the second installation's newer records.
2. If an installation crashes, use recovery code on the existing app origin to export its raw IndexedDB and legacy localStorage from that installation before any repair. Opening a desktop copy or a new hosting origin does not read that phone's storage. The staged recovery screen preserves keyed raw records, encrypted snapshots, and the device encryption key, while excluding account access tokens.
3. Check the recovery/export files on the computer and retain an independent portable copy. Inspect the newest workout and total records; do not declare data recovered merely because the app opens.
4. Stage and validate the free Supabase schema with authenticated ownership isolation and stale-write protection. Use only a public project URL and publishable/anon key in v5-config.js. Never insert a service-role key into frontend files. Test two devices, offline writes, retry, sign-out, and conflict review using test data before connecting the real history.
5. Retain the original hosting origin for the first upgrade. This keeps the existing local database reachable. Close older v4 tabs before reopening v5: old code does not understand the v5 tab-write revision guard. Do not delete the app icons to refresh code.
6. The preview keeps a raw pre-v5 copy before migrating schema, requires a successful safety snapshot before import/restore, and aborts stale-tab writes instead of overwriting a newer workout. Equipment changes and accepted live target changes preserve draft snapshots. Storage reset is disabled during the rollout.
7. Connect verified history to the user's free backend, confirm upload and download on a second test device, and export a portable backup independent of Supabase. Cloud snapshots in the same database are useful versions, not protection against loss of the whole project.
8. Consider another free frontend host only after verified cloud sync. A new host uses another storage origin; history will need authenticated download or explicit import. GitHub Pages can serve the frontend while Supabase provides backend functionality, so moving hosting is optional.

Free-tier boundaries:

- Local coaching, IndexedDB, sound synthesis, and offline assets require no paid APIs or dependencies.
- Supabase Free has no managed automatic backups and may pause an inactive project. The app therefore needs local preservation, in-project version snapshots, and independent portable exports. [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups), [free-project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
- Existing GitHub hosting remains unchanged. No custom domain, paid hosting, paid SMTP service, or native app-store enrollment is required for this phase.

Remaining production prerequisite: obtain and verify backups from both iPhone Home Screen installations before promoting full v5 at the original app URL. Open each existing installation; use Settings → Export JSON backup when it opens, or its read-only recovery export if startup fails. Retain both files separately. Opening the isolated preview or a separate Safari tab cannot prove recovery from either installation.

The backend uses owner-only reads, an authenticated public invoker RPC with a private privileged implementation, and a transaction-scoped owner lock plus expected revision comparison. Only a public publishable key is shipped. The restore/import paths now validate a fixed local revision and immutable state fingerprint inside the serialized state-write transaction, preventing edits during asynchronous replacement from being discarded. Raw exports preserve durable data, encrypted snapshots, device key, and any recovery candidate while excluding auth tokens.
