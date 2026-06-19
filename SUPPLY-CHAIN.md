# Paper Flock v0.20 — Software Supply Chain

## Locked builds

`package-lock.json` records the exact development dependency tree. CI uses
`npm ci`, which fails when `package.json` and the lockfile disagree.

## Dependency protection

- `npm audit --audit-level=high` blocks high and critical advisories.
- Dependency Review examines package changes in pull requests.
- Dependabot checks npm and GitHub Actions weekly.
- CodeQL scans JavaScript and workflow files.

## Release inventory

The release workflow generates:

- `asset-manifest.json` for runtime files
- `release.json` for build metadata
- `sbom.cdx.json` for npm dependencies
- `release-checksums.txt`
- `paper-flock-v0.20-release.zip`

## Provenance

For public repositories, GitHub Actions uses `actions/attest@v4` to create
signed provenance for the release ZIP and its CycloneDX SBOM.

Verify a downloaded release with GitHub CLI:

```bash
gh attestation verify paper-flock-v0.20-release.zip \
  -R OWNER/REPOSITORY
```

The local checksum remains useful even when GitHub attestation is unavailable.
