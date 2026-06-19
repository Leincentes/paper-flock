# Paper Flock v1.4.4 — Operations Runbook

## Release

1. Export a player backup.
2. Run the complete local verification sequence in `README.md`.
3. Push the reviewed source package to `main`.
4. Require static, dependency, browser, Lighthouse, CodeQL, deployment, SBOM,
   and provenance checks to pass.
5. Download and retain the release bundle and quality-evidence artifacts.
6. Complete Android and iPhone Journal verification.
7. Record final human approval before announcing production availability.

## Update

1. Confirm the live version and last known-good commit.
2. Deploy through the release workflow only.
3. Wait for the post-deployment HTTPS audit.
4. Finish any active puzzle, apply **Update ready**, and confirm exact resume.
5. Test one online launch and one offline launch.

## Rollback

1. Pause new invitations and record the defect.
2. Revert to the last known-good commit.
3. Push the revert and require the deployment audit to pass.
4. Apply the update on Android and iPhone.
5. Confirm progress, Journal state, and offline launch remain intact.

## Critical defect

Progress loss, repeated blank screens, inaccessible core controls, broken
offline installation, or a crash blocking play is critical. Preserve an
affected backup, reproduce without deleting player data, fix and test the
problem, and complete a physical-device rollback rehearsal before closing it.

## Evidence handling

Keep CI artifacts, device checklists, and tester observations separate.
AI-simulated reactions are hypotheses only and must never be recorded as
real-user evidence.
