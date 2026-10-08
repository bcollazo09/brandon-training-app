# Workout preservation and free-tier rollout

V5 is configured for deployment at the original GitHub Pages address, https://bcollazo09.github.io/brandon-training-app/ . The Free Supabase project Brandon Fitness v5 (wnlhutiwrzpprfmhhmtm) provides authenticated sync. Only a public publishable key is shipped; no paid options are enabled.

## Verified preservation

The supplied v4 JSON and CSV agree. Exact migration, import, encrypted-snapshot decryption, normal/raw export and offline reload were tested in fresh mobile browser profiles. The original completed records and active draft were preserved. The user confirmed both iPhone installations have the same history. Private workout backups and test accounts are excluded from this repository. These tests cannot open either physical iPhone installation.

Root v5 retains IndexedDB brandonFitnessV4 version 1, the app/state key, original v4 raw snapshot, legacy localStorage and the device encryption key. Replacement operations validate local revision and state fingerprints inside serialized writes. Late edits stop replacement or remain in the replacement document. Failed commits retain durable state and an exportable recovery candidate. Reset remains disabled.

## Open the updated app

1. Keep both existing Home Screen icons and the exported backups. Close old running app windows, then reopen each existing installation after deployment. Do not delete icons or clear Safari data.
2. Confirm the latest completed workouts and unfinished workout are present. Root v5 migrates the existing device database automatically; a normal upgrade does not require import. If it appears empty, preserve that installation and use Settings → Export saved device data before replacing anything.
3. Use Settings to create an app account, confirm email, and sign in. Email confirmation currently returns to the isolated preview. Return to the existing Home Screen installation and sign in there to sync its history. Use the same account on other devices.
4. Cloud differences stop automatic replacement. Review/export both versions before choosing a restore. Cloud restore blocks while a workout is active; finish or explicitly discard that draft first.
5. Keep a portable JSON or encrypted export outside Supabase. In-project snapshots are versions in the same backend, not offsite backups.

## Separate preview and recovery

/v5-preview/ uses its own database, keys, cache and service-worker scope. It cannot automatically read original iPhone history. Use an exported copy if testing import. /recovery.html reads the current browser's original storage without modifying it. A Safari tab or desktop browser cannot inspect another Home Screen installation's storage. Raw recovery containers preserve original records, snapshots and device keys; extract the state or decrypt a snapshot before importing. Keep raw exports private and intact.

## Backend and limits

Owner-only reads, an authenticated public invoker RPC with a private owner-bound implementation, transaction owner locking and expected-revision comparison protect cloud saves. Anonymous/direct writes, cross-account access, concurrent stale saves and snapshot restoration were tested with synthetic accounts, then the accounts and their credentials were removed.

The app works locally offline; iPhone may suspend timers/audio while locked. Coaching coefficients are heuristics tested with synthetic scenarios. No paid AI API, hosting, custom domain, SMTP service or app-store enrollment is required. Supabase Free can pause inactive projects and does not include managed automatic database backups; retain independent exports. See [backup documentation](https://supabase.com/docs/guides/platform/backups) and [free-project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
