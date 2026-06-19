# Paper Flock v1.4.4 — Known Issues and Release Gates

## Sound behavior

- New players and confirmed progress resets start with sound enabled.
- Existing explicit sound preferences are preserved during upgrade.
- Browser audio begins only after player interaction and can be disabled in Settings.

## Resolved in v1.4.2

- **PF-STARTUP-MASTERY-DOM:** v1.4.1 could enter startup recovery because
  `game-player-ui.js` updated `#mastery-goal`, but the production HTML omitted
  that element. v1.4.2 restores the element, adds a defensive guard, and adds
  a DOM-contract regression test. Existing schema-12 saves remain compatible.

The player-visible register is `known-issues.json` and `known-issues.html`.

Open release gates:

- GitHub-hosted Chromium, WebKit, Lighthouse, CodeQL, deployment, SBOM, and
  provenance results must match the v1.4.4 source package.
- Android and iPhone sound, Journal, save, update, and offline checks remain
  required for this candidate.
- Real-player closed-alpha evidence is still required; simulation is not
  customer validation.

Known product limitations:

- progress is local to the current browser and origin
- iPhone installation uses Safari **Add to Home Screen**
- detailed move, hint, restart, deadlock, undo, and launch totals begin with
  v1.4 because older saves did not store those counters


## v1.4.4 external qualification

- A signed production AAB requires the publisher-owned upload keystore and
  cannot be generated without those secrets.
- The generated store screenshots are compliant preliminary assets based on
  the verified game UI; replace them with physical-device captures before
  production if the Android rendering differs.
- The optional preview video still requires real Android gameplay capture and
  YouTube upload.
- Play Console account registration, identity verification, closed testing,
  and production access are owner-controlled external actions.
