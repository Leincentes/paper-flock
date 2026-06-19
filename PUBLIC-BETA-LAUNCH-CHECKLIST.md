# Paper Flock v1.4.4 — Controlled Beta Launch Checklist

## Before push

- Confirm `package.json` and `package-lock.json` both report 1.4.4.
- Confirm every lockfile URL uses the public npm registry.
- Run `npm audit --audit-level=high`.
- Run unit, syntax, package, hardening, supply-chain, build, and release audits.
- Generate the CycloneDX SBOM and deterministic archive.
- Confirm no internal registry hostname appears in source or release artifacts.

## GitHub qualification

- Static quality passes.
- Chromium and WebKit tests pass.
- Lighthouse budgets pass.
- CodeQL JavaScript and workflow matrices pass.
- Dependency Review has no blocking finding.
- GitHub Pages deploys `dist/`, not the repository root.
- The post-deployment HTTPS audit passes.
- The v1.4.4 SBOM and archive attestation are created.
- Quality evidence reports actual job outcomes.

## Physical-device qualification

Use `V1.4-JOURNAL-VERIFICATION-GUIDE.md` on at least one Android phone and one
iPhone. Verify migration, focus trap and restoration, internal scrolling,
exact-once statistics, achievement persistence, next-goal navigation, update,
backup/restore, and offline launch.

## Real-user validation

Run a controlled beta with real participants. Keep AI-simulated observations
labeled as hypotheses. Do not claim retention, enjoyment, accessibility, or
willingness-to-pay evidence without actual participant behavior.

## Approval rule

Do not mark v1.4.4 production-approved until CI evidence, both physical-device
reports, critical-defect review, rollback readiness, privacy/support review,
and final human sign-off are complete.
