# Paper Flock 1.4.2 — Release-Hygiene Candidate

Paper Flock v1.4.2 preserves the v1.4 Achievement Journal release while
hardening the dependency, CI-evidence, packaging, and deployment path.

## Player features

- twenty permanent, retroactive achievements
- lifetime player statistics stored in save schema 12
- campaign, mastery, Daily Flock, and collection categories
- accessible unlock notifications and a mobile-safe Journal
- a recommended next meaningful goal
- local backup and restore

Gameplay and save behavior are unchanged from v1.4.

## Release-engineering changes

- all lockfile tarballs resolve through `https://registry.npmjs.org/`
- `.npmrc` fixes the CI registry to the public npm registry
- `tmp` is overridden to version `0.2.7`
- CodeQL runs in the release-gate workflow
- quality evidence derives CodeQL and provenance status from completed jobs
- release bundle names use v1.4.2
- deployment and tester documentation is aligned with the actual workflow

## Ethical engagement boundary

Paper Flock has no streaks, expiring rewards, energy system, loot boxes,
forced advertisements, push-notification pressure, paid progression, or
artificial waiting.

## Local verification

```bash
npm ci --no-audit --no-fund
npm audit --audit-level=high
npm test
npm run analyze:levels
npm run verify
npm run validate:production
npm run build
npm run audit:release
npm sbom --sbom-format=cyclonedx --package-lock-only > release-bundle/sbom.cdx.json
python3 tools/package-release.py
```

## Production boundary

The deployable artifact contains only the player runtime. Internal tests,
audits, evidence tools, research interfaces, and certification collectors are
not copied into `dist/`.

## Release status

v1.4.2 is a production candidate, not a production-approved release. Push the
complete source package to `main`, require every GitHub job to pass, then
complete the Android and iPhone Journal verification and final human sign-off.
