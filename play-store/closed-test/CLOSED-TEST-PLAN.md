# Paper Flock v1.6.0 Play closed-test plan

## Purpose

Validate the production Android build with real players while keeping all
diagnostics local unless a tester explicitly exports a report.

## Cohort

- Recruit **15 people**, keeping at least **12 continuously opted in for
  14 consecutive days** when the Play Console account requires that gate.
- Include casual puzzle players, experienced puzzle players, and people who
  rarely play mobile games.
- Include at least four Android device classes: low-end, mid-range, current
  flagship, and a small-screen, foldable, tablet, or large-screen device.
- Assign anonymous tester codes such as `PF-A01`; do not store names in the
  product evidence sheet.

## Required activities

### Day 1

1. Install from the private Google Play testing link.
2. Complete the tutorial without coaching.
3. Play until at least Level 5.
4. Verify sound is on by default, then change it and confirm the preference
   survives relaunch.
5. Test background/resume and offline relaunch.
6. Export a progress backup and restore it.
7. Open Settings → Data → Export tester report.
8. Confirm the report contains no raw save, puzzle board, account identifier,
   contacts, advertising ID, or location.

### Gamelo Studio opening validation

1. On a fresh install, confirm the opening appears before the tutorial.
2. Confirm **Begin the Flight**, **Skip**, keyboard focus, and Android Back/Escape behavior.
3. Confirm an existing saved player is not interrupted after updating.
4. Replay the opening from Settings.
5. Enable **Show studio opening on launch**, relaunch once, then disable it.
6. With reduced motion enabled, confirm the crane and stars do not animate.

### Remix Flights validation

After completing campaign Level 5:

1. Open Remix Flights without coaching.
2. Explain what the selected route modifier will do before starting.
3. Complete at least one three-puzzle route.
4. Try at least one different route or modifier.
5. Select an unlocked fold trail and verify that it changes only the escape
   glow.
6. Generate a result card and confirm sharing happens only after an explicit
   player action.
7. Record whether the player voluntarily starts a second route.

### Days 2–14

- Return voluntarily on at least three separate days.
- Continue toward Level 11.
- At the first Level 11 deadlock, observe whether the recovery lesson is
  understood and whether Undo is used.
- Open the Achievement Journal and verify internal scrolling.
- Test one Play-delivered app update without clearing storage.
- When a defect occurs, export a tester report immediately after reproducing
  it.
- Use safe start only after recording the original failure:
  startup recovery → **Start without changing progress**.
- Confirm safe start does not overwrite the normal save.
- Exit safe start and verify the original progress returns.

## Tester-report handling

The tester report is generated on-device and is never sent automatically.

Collect only reports testers voluntarily share. Store them in an
owner-controlled, access-limited folder. Delete raw reports after the issue is
resolved and the aggregate result has been recorded.

## Success gates

- 0 critical startup, save-loss, or update defects
- 0 failed recovery-save restorations
- 0 cases where safe start overwrites the normal save
- ≥99% crash-free observed sessions
- ≥80% tutorial completion without assistance
- ≥85% Level 1 completion
- ≥60% of testers voluntarily start a second level
- At least 8 testers reach Level 11
- ≥75% of Level 11 participants understand the recovery lesson
- Existing progress survives the closed-test update
- Pre-launch report has no unresolved critical findings
- No privacy, permission, or misleading-listing complaints
- ≥65% of eligible testers complete one Remix route
- ≥45% voluntarily start a second Remix route
- ≥40% try all three modifiers across the cohort
- ≥50% can name a preferred modifier and explain why
- 0 reports that a modifier effect was hidden or unfair

## Evidence

Record only:

- anonymous participant code
- device class/model and Android/WebView version
- test date and build version
- task outcomes
- aggregate gameplay milestones
- voluntarily shared tester-report filename
- voluntary comments

Do not collect names, contacts, precise location, advertising identifiers, or
unrelated device data.
