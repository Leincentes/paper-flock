# Paper Flock v1.4.2 — Known Issues

## Resolved in v1.4.2

- **PF-STARTUP-MASTERY-DOM:** v1.4.1 could enter startup recovery because
  `game-player-ui.js` updated `#mastery-goal`, but the production HTML omitted
  that element. v1.4.2 restores the element, adds a defensive guard, and adds
  a DOM-contract regression test. Existing schema-12 saves remain compatible.

# Paper Flock v1.4.2 — Known Issues and Release Gates

The player-visible register is `known-issues.json` and
`known-issues.html`.

Open release gates:

- GitHub-hosted Chromium, WebKit, Lighthouse, CodeQL, deployment, SBOM, and
  provenance results have not yet been produced for this source package.
- Android Journal migration, focus, scrolling, persistence, backup/restore,
  update, and offline checks remain required.
- The equivalent iPhone checks remain required.
- Final human production approval remains false until those results are
  reviewed.

Known product limitations:

- progress is local to the current browser and origin
- iPhone installation uses Safari **Add to Home Screen**
- detailed move, hint, restart, deadlock, undo, and launch totals begin with
  v1.4 because older saves did not store those counters
