# Paper Flock v1.6.0 — GitHub Pages Deployment

## Workflow

The release workflow is `.github/workflows/static.yml`, named
**Test, qualify, deploy, and audit Paper Flock**.

It installs the locked public-registry dependency tree, blocks high or critical
advisories, runs unit and package audits, builds `dist/`, runs Chromium,
WebKit, and Lighthouse, performs CodeQL analysis, deploys the qualified
artifact, audits the live HTTPS site, generates the SBOM and provenance, and
creates importable quality evidence from actual job results.

## First deployment

1. Create or open the GitHub repository.
2. Put the contents of this source package at the repository root.
3. Use `main` as the default branch.
4. In **Settings → Pages**, select **GitHub Actions** as the source.
5. Push the v1.6.0 commit to `main`.
6. Require all jobs in the release workflow to pass.
7. Download and retain the v1.6.0 release bundle and quality-evidence artifacts.
8. Open the URL emitted by the deployment job.
9. Complete the physical Android and iPhone verification before final approval.

Normal player URL:

```text
https://YOUR-NAME.github.io/YOUR-REPOSITORY/
```

Internal query-mode test interfaces are intentionally absent from the
production artifact.

## Update

1. Export a player backup from the current production build.
2. Push the reviewed source change.
3. Confirm dependency, static, browser, CodeQL, deployment, SBOM, and
   provenance jobs are green.
4. Apply the in-app update only after the deployment audit succeeds.
5. Confirm exact resume and offline launch.

## Rollback

1. Identify the last known-good commit.
2. Revert the faulty deployment commit.
3. Push the revert to `main`.
4. Require the Pages deployment and post-deployment audit to pass.
5. Open Paper Flock online, apply the update, and verify saved progress.
