# Isolated Brandon Fitness v5 preview

Publish this directory as v5-preview/ below the existing repository root. Device state uses brandonFitnessV5Preview; legacy recovery keys and the device encryption key use the preview namespace too. Production IndexedDB and localStorage method access are blocked in this page. The service worker deletes only caches beginning bf-v5-isolated-preview-. Manifest identity and scope resolve within v5-preview/. PNG icons reference the existing parent-directory icons.

Rebuild from the current root v5 source with build-isolated-preview.cjs so fixes and v5-config.js propagate. Cloud settings are copied from the root; signing in uses the selected cloud account. Never automatically import production device state into this preview.
