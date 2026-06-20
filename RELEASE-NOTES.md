## Paper Flock v1.6.0

- Added a skippable Gamelo Studio opening for new players, with replay and show-on-launch controls in Settings.

# Paper Flock v1.6.0 — Remix Flights

## Player-facing changes

- Added Remix Flights as an optional replay mode after completing Level 5.
- Added two branching flights with four routes and twelve curated, solver-verified puzzles.
- Added Linked Folds, Locked Fold, and Tailwind modifiers with visible markers and explanations.
- Added five fold-trail cosmetics, with four earned by completing routes.
- Added local PNG result cards that players may share explicitly.
- Kept Remix free of streaks, timers, expiring rewards, random rewards, and paid skips.
- Preserved the forty-level campaign, Daily Flock, achievements, sound preferences, mobile UI, and save schema 12.

## Qualification status

v1.6.0 is a closed-test candidate. Hosted browser tests, Android lint/AAB, Play pre-launch testing, and physical-device validation remain required.


## Previous release documentation

# Paper Flock v1.6.0 — Closed-test quality candidate

- Added a rolling privacy-safe diagnostic log stored only on the current device.
- Added explicit tester-report export; nothing is uploaded automatically.
- Added safe-start mode and recovery-save restoration without deleting progress.
- Added guarded backup restore with rollback on invalid or interrupted writes.
- Added Android WebView renderer recovery reporting.
- Retained the v1.4.5 mobile-first layout, sound defaults, achievements, and save schema 12.

# Paper Flock v1.4.5 — Mobile interface quality update

- Rebuilt the phone gameplay layout around a board-first, named-grid structure.
- Keeps Undo, Hint, Restart, and More in one stable 48-pixel action bar.
- Groups secondary navigation and information inside a clearer More drawer.
- Automatically closes More before opening the level map, Daily Flock,
  Settings, Journal, or another level.
- Raises mobile controls and secondary actions to at least 44 CSS pixels.
- Contains the level map, Settings, Journal, tutorial, and Daily Flock inside
  the visible mobile viewport with internal scrolling.
- Adds a compact landscape layout with a large board and a two-by-two control
  rail instead of stretched buttons.
- Allows installed web-app orientation changes while keeping the Android
  wrapper responsive.
- Adds static and browser regression coverage for phone, short-screen, and
  compact-landscape layouts.
- Preserves save schema 12, sound-on defaults for new players, achievements,
  progression, and existing player preferences.

# Paper Flock v1.4.4 — Google Play preparation

- Added a local-content Android app project targeting SDK 36.
- Added signed Android App Bundle automation for Google Play.
- Added native backup import and export through the Android document picker.
- Added a one-time, non-penalizing Level 11 recovery lesson.
- Added Play Store listing copy, privacy and Data Safety drafts, graphics,
  screenshot alt text, content-rating answers, and closed-test materials.
- Preserved save schema 12 and all v1.4.3 player progress.
- Sound remains enabled by default for new players.

# Paper Flock v1.4.3 — Sound-default and simulation candidate

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

The machine-readable history is in `release-notes.json`; the public page is
`release-notes.html`.
