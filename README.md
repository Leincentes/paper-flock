# Paper Flock v0.11 — Self-Guided Real-Device Field Test

v0.11 executes the next evidence step without pretending that automated or
simulated sessions are real customers.

It fixes the v0.10 packaging defect that prevented the tactile test module from
loading, restores the Effects control, and adds a self-guided field-test flow
that participants can complete on their own phones.

## Run locally

```bash
python3 serve.py
```

Normal game:

```text
http://127.0.0.1:8080/
```

Self-guided field test:

```text
http://127.0.0.1:8080/?fieldtest=1
```

Moderated device test:

```text
http://127.0.0.1:8080/?tactiletest=1
```

## Self-guided participant flow

1. Enter an anonymous code such as `TF-01`.
2. Select the broad player and device category.
3. Read and accept the consent statement.
4. Play naturally with Sound off and Effects Auto.
5. Follow the small prompts to test sound, haptics, and lighter effects.
6. Continue until the final-question prompt appears, or end earlier.
7. Complete the survey.
8. Download the anonymous JSON result.
9. Send that JSON file to the creator.

Nothing is uploaded automatically.

## Combining remote sessions

On the creator's copy:

1. Open **Prototype testing tools**.
2. Choose **Import participant JSON**.
3. Select one or more files returned by participants.
4. Duplicate participant codes and session IDs are skipped.
5. Review the field-coverage line.
6. Export the combined field JSON and CSV.

The dashboard identifies the next participant perspective still needed.

## Required sample

Complete at least eight protocol-complete sessions; ten are preferred:

- 4 casual puzzle players
- 1 experienced puzzle player
- 1 casual non-puzzle player
- 1 older, low-vision, motion-sensitive, sound-sensitive, or haptic-sensitive participant
- 1 low-end or older Android phone

The sample also requires:

- at least 3 sound-tested sessions
- at least 3 haptic-tested compatible devices
- at least 3 blocked-path observations
- at least 3 sessions reaching the rotation-learning point

## Analyze an export

```bash
node tools/analyze-field-test.mjs \
  paper-flock-v0.11-field-sessions.json
```

Print CSV too:

```bash
node tools/analyze-field-test.mjs \
  paper-flock-v0.11-field-sessions.json --csv
```

## Automated validation

```bash
npm test
```

The suite verifies game rules, campaign and Daily solvability, tactile metrics,
field imports, duplicate handling, protocol quality, recruitment coverage, and
the closed-alpha evidence gate.

## Evidence rule

A closed-alpha decision is possible only after the real sample and protocol
coverage are complete. Synthetic records test calculations only.
