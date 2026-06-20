# Paper Flock 1.6.0 — Mobile quality and Google Play candidate

Paper Flock v1.6.0 packages the complete local-first puzzle game for web and
Google Play with a dedicated phone, short-screen, and compact-landscape UI.

## Player features

- 40 handcrafted campaign levels
- 20 permanent, retroactive achievements
- lifetime player statistics stored in save schema 12
- accessible Achievement Journal
- optional Daily Flock
- local backup and restore
- sound enabled by default for new players
- a one-time, non-penalizing Level 11 recovery lesson
- offline play with no account, ads, energy, or paid progression

## Remix Flights

- two optional branching flights with four three-puzzle routes
- twelve curated, solver-verified remix boards
- Linked Folds, Locked Fold, and Tailwind modifiers
- every modifier is explained before play and visibly marked on the board
- four unlockable cosmetic fold trails plus the original quiet trail
- local shareable completion cards with no account, leaderboard, or upload
- separate recoverable Remix progress included in normal backup and reset
- Remix unlocks after completing campaign Level 5

## Mobile interface

- board-first gameplay layout for narrow phones
- Undo, Hint, Restart, and More in one 48-pixel action bar
- secondary features grouped inside the More drawer
- minimum 44-pixel touch targets for mobile actions
- internally scrolling Settings, Journal, tutorial, Daily Flock, and level map
- compact landscape layout with a large board and two-by-two control rail
- automatic drawer dismissal before opening another gameplay surface
- installed web-app orientation support

## Android release

- permanent package ID: `com.gamelostudio.paperflock`
- target SDK 36; minimum SDK 24
- local WebView assets using `WebViewAssetLoader`
- no Internet or sensitive permissions
- native document picker for backup export and restore
- Play App Signing compatible AAB workflow
- store listing, privacy, Data Safety, content-rating, graphics, and closed-test
  materials under `play-store/`

## Verify

```bash
npm ci --no-audit --no-fund
npm run verify:production
npm run audit:mobile-ui
npm run verify:android
```

The GitHub `Android App Bundle` workflow builds a debug AAB on pushes and a
signed release AAB when manually dispatched with the upload-key secrets.

## Release status

v1.6.0 is prepared for CI browser qualification, Play internal testing, and
physical-device review. Signing-key custody, Play Console submission,
physical Android/iPhone testing, and real-player closed-test evidence remain
owner-controlled external gates.
