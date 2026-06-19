# Paper Flock v1.4.4 — Google Play preparation

- Added a local-content Android app project targeting SDK 36.
- Added signed Android App Bundle automation for Google Play.
- Added native backup import and export through the Android document picker.
- Added a one-time, non-penalizing Level 11 recovery lesson.
- Added Play Store listing copy, privacy and Data safety drafts, graphics,
  screenshot alt text, content-rating answers, and closed-test materials.
- Preserved save schema 12 and all v1.4.3 player progress.
- Sound remains enabled by default for new players.

# Paper Flock v1.4.4 — Sound-default and simulation candidate

- Enables sound by default for new players and after a confirmed progress reset.
- Preserves an existing player's explicit sound-off choice during upgrade.
- Adds regression coverage for default and persisted sound behavior.
- Adds a mechanics-based simulated-player study using the real campaign boards.
- Preserves save schema 12, achievements, level rules, and existing progress.

# Paper Flock v1.4.2 — Startup crash hotfix

- Restores the missing `#mastery-goal` HUD element required by the player runtime.
- Guards mastery-goal updates so a missing node cannot abort startup.
- Adds startup DOM-contract regression tests.
- Preserves save schema 12 and all v1.4.1 player data.

# Paper Flock Release Notes

The machine-readable history is in `release-notes.json`; the public page is `release-notes.html`.
