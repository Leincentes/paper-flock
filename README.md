# Paper Flock 1.4.4 — Google Play closed-test candidate

Paper Flock v1.4.4 packages the complete local-first puzzle game for Google
Play while preserving the browser release.

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

## Android release

- permanent package ID: `com.gamelostudio.paperflock`
- target SDK 36; minimum SDK 24
- local WebView assets using `WebViewAssetLoader`
- no Internet or sensitive permissions
- native document picker for backup export and restore
- Play App Signing compatible AAB workflow
- store listing, privacy, Data safety, content-rating, graphics, and closed-test
  materials under `play-store/`

## Verify

```bash
npm ci --no-audit --no-fund
npm run verify:production
npm run build
npm run android:sync
npm run verify:play-store
```

The GitHub `Android App Bundle` workflow builds a debug AAB on pushes and a
signed release AAB when manually dispatched with the upload-key secrets.

## Release status

v1.4.4 is prepared for Play internal and closed testing. Registration,
identity verification, signing-key custody, Play Console form submission,
physical-device testing, and the required real-player closed-test evidence
remain owner-controlled external gates.
