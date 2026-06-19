# Paper Flock 1.2 — Production Settings and Clean Player Release

Paper Flock 1.2 adds a complete player-facing Settings experience and a strict
production build boundary.

## Production Settings

### Game

- Sound effects
- Haptic feedback
- Automatic, Full, Lite, and Minimal visual effects
- Unlocked paper-theme selection
- Replay How to play

### Accessibility

- Standard, Large, and Extra large text
- Automatic or always-high contrast
- Automatic or reduced motion
- Link to the accessibility statement

### App and data

- Online/offline and installed-app status
- Install app when the browser supports installation
- Install a waiting app update
- Export a player progress backup
- Restore a player progress backup
- Reset player progress, tutorial completion, and preferences

### About

- Version
- Publisher
- Public support contact
- Privacy, terms, support, release notes, known issues, and credits

## Clean production boundary

The source repository retains unit tests, browser tests, audits, certification
domains, and release-evidence tooling for developers and GitHub Actions.

The deployed `dist/` directory and `paper-flock-v1.2-release.zip` contain only
the player runtime. They do not contain:

- prototype or beta operations panels
- research-session functionality
- visual or tactile test modes
- mobile or accessibility certification collectors
- installation audit screens
- production-evidence import controls
- performance diagnostic collectors
- diagnostic query switches

`tools/build-release.mjs` uses an explicit player-module allowlist and fails the
build when an internal filename or marker is detected.

## Validate

```bash
npm test
npm run verify
npm run validate:production
npm run build
npm run audit:release
```

## Deploy

Push the complete source project to `main`. GitHub Actions builds and deploys
only `dist/`.

Do not configure GitHub Pages to publish the repository root directly. The
production workflow must remain the deployment source.
