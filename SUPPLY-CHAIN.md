# Paper Flock v1.6.0 — Software Supply Chain

## Locked public-registry build

`package-lock.json` records the exact development tree. Every resolved tarball
uses `https://registry.npmjs.org/`; `.npmrc` fixes the same registry for local
and CI installs. The supply-chain audit rejects internal registry URLs.

CI uses:

```bash
npm ci --no-audit --no-fund
npm audit --audit-level=high
```

The `tmp` transitive dependency is overridden and locked to `0.2.7`, removing
the previously observed high-severity advisory. Moderate development-tool
findings remain visible but do not pass the configured high-severity failure
threshold. The player runtime has no third-party production dependency.

## Automated protection

- Dependency Review blocks high-severity pull-request dependency changes.
- Dependabot monitors npm and GitHub Actions.
- CodeQL scans JavaScript and workflow files.
- the static build uses a strict player-runtime allowlist
- the SBOM and release archive are checked for internal registry leakage

## Release inventory

The workflow generates:

- `asset-manifest.json`
- `release.json`
- `sbom.cdx.json`
- `release-checksums.txt`
- `paper-flock-v1.6.0-release.zip`
- `paper-flock-v1.6.0-quality-evidence.json`

## Evidence integrity

CodeQL is a job in the release-gate workflow. The evidence job reads the
completed CodeQL job result rather than passing a literal success value.
Provenance status is taken from the actual `actions/attest` step outcome.

For a public repository, verify the downloaded archive with GitHub CLI:

```bash
gh attestation verify paper-flock-v1.6.0-release.zip -R OWNER/REPOSITORY
```

Also compare the archive against `release-checksums.txt`.
