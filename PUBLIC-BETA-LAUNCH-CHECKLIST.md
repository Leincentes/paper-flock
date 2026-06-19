# Paper Flock v0.16 — Public Beta Launch Checklist

## Before deployment

- Configure `supportEmail` or `supportUrl` in `app-config.json`.
- Review `privacy.html`.
- Review `known-issues.json`.
- Confirm the current version in `release-notes.json`.
- Run `npm run verify`.
- Back up creator-side research and certification data.

## After deployment

- Confirm all GitHub Actions jobs are green.
- Open Privacy, Support, Release notes, and Known issues from the game footer.
- Submit one test feedback report and import it on the creator device.
- Install and launch on Android Chrome.
- Install and launch on iPhone/iPad Safari.
- Test offline launch and exact resume.
- Complete backup-and-restore and rollback drills.
- Export the production-readiness report.

## Controlled public beta

Invite a limited group first. Tell testers:

- this is a beta
- progress is local
- nothing uploads automatically
- feedback downloads as a file
- they should not enter personal details in free text

## Production candidate

Do not call the build production-ready until the dashboard reports:

```text
PRODUCTION CANDIDATE READY FOR FINAL REVIEW
```

Then perform a final human review of privacy, support, field evidence, critical
defects, rollback readiness, and public messaging.


## Accessibility and security hardening

- Run `npm run audit:hardening`.
- Complete keyboard-only navigation.
- Complete VoiceOver verification.
- Complete TalkBack verification.
- Test large and extra-large text.
- Test increased contrast or forced colors.
- Confirm modal focus trapping and restoration.
- Review the deployed Content Security Policy and no-referrer metadata.


## Accessibility evidence files

- Export AC-KEYBOARD.
- Export AC-VOICEOVER.
- Export AC-TALKBACK.
- Export AC-TEXT.
- Export AC-CONTRAST.
- Import all five reports.
- Export combined accessibility JSON and CSV.
