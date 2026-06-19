# Paper Flock v0.16 — Operations Runbook

## Update

1. Export a creator backup.
2. Run all automated tests and package verification.
3. Deploy to the existing HTTPS origin.
4. Verify the post-deployment audit.
5. Finish an active puzzle before applying **Update ready**.
6. Confirm exact resume and offline launch.

## Rollback

1. Identify the last known-good Git commit.
2. Revert the faulty deployment commit.
3. Push the revert to `main`.
4. Wait for the Pages workflow and deployment audit.
5. Open the game online and apply **Update ready**.
6. Confirm local progress remains.

## Critical defect

A critical defect includes progress loss, repeated blank screen, unplayable
offline installation, inaccessible core controls, or a crash blocking play.

1. Pause new beta invitations.
2. Publish the issue in `known-issues.json`.
3. Ask affected testers for feedback JSON, diagnostics, and a backup.
4. Reproduce without deleting their local data.
5. Fix, test, deploy, and complete a rollback rehearsal.
6. Mark the issue resolved only after physical-device verification.

## Feedback handling

- Import JSON reports into the creator dashboard.
- Review critical and major reports first.
- Do not publish free-text reports without checking for accidental personal
  information.
- Delete reports that are no longer needed.


## Accessibility regression

Treat loss of keyboard access, invisible focus, a modal focus escape,
unreadable forced-color content, or inaccessible core gameplay as a major or
critical defect depending on whether play is blocked. Pause broad invitations
when core play is blocked.
