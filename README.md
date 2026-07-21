# Brandon Fitness v2

This update adds:

- Historical workout entry for Weeks 1–3 and earlier Week 4 sessions
- Current mesocycle tracking and archiving
- Automatic next-session goals based on prior performance
- Rule-based recovery recommendations
- Quick daily check-in with only four fields
- Workout history
- Exercise progress graphs
- Migration from the Version 1 local-storage data
- Export/import backup
- Improved update behavior through the service worker

## Update your GitHub repository

Upload and replace these files in the repository root:

- index.html
- styles.css
- app.js
- manifest.json
- service-worker.js
- icon.svg
- README.md

After GitHub Pages deploys the update, open the app in Safari and refresh once. If the Home Screen version still shows the old app, close it fully and reopen it.

## Enter the prior three weeks

Open **History** and tap **Add past workout**. Select the date, week, workout day, and enter one weight plus comma-separated reps/RIR values for each exercise.

Example:
- Weight: `150`
- Reps: `12,11,10`
- RIR: `2,2,1`

Workout data remains local to the device. Export backups regularly.
