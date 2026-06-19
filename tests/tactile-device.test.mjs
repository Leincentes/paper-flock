import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateTactileSessions,
  appendFrameSamples,
  appendTactileEvent,
  completeTactileSession,
  createTactileSession,
  evaluateTactileReadiness,
  isValidTactileParticipantCode,
  normalizeTactileParticipantCode,
  summarizeTactileSession,
  tactileSessionsToCsv
} from "../src/tactile-test-core.js";

function completedSession(index, overrides = {}) {
  let session = createTactileSession({
    participantCode: `TF-${String(index).padStart(2, "0")}`,
    segment: "casual-puzzle",
    deviceTier: overrides.deviceTier ?? (index === 1 ? "low-end" : "mid-range"),
    sessionId: `tactile-${index}`,
    startedAt: "2026-06-19T00:00:00.000Z",
    capabilities: {
      vibrate: true,
      audioContext: true
    }
  });

  const events = [
    ...Array.from({ length: 6 }, (_, tapIndex) => ({
      name: "tap_feedback_visible",
      latencyMs: 10 + tapIndex,
      occurredAt: `2026-06-19T00:00:${10 + tapIndex}.000Z`,
      elapsedMs: 10000 + tapIndex * 1000,
      effectsMode: "full"
    })),
    {
      name: "blocked_tap",
      occurredAt: "2026-06-19T00:00:20.000Z",
      elapsedMs: 20000,
      mode: "campaign",
      level: 2,
      effectsMode: "full"
    },
    {
      name: "puzzle_complete",
      occurredAt: "2026-06-19T00:01:00.000Z",
      elapsedMs: 60000,
      mode: "campaign",
      level: 1,
      effectsMode: "full"
    },
    {
      name: "puzzle_start",
      occurredAt: "2026-06-19T00:02:00.000Z",
      elapsedMs: 120000,
      mode: "campaign",
      level: 3,
      effectsMode: "full"
    },
    {
      name: "sound_preference_changed",
      enabled: true,
      occurredAt: "2026-06-19T00:02:20.000Z",
      elapsedMs: 140000,
      effectsMode: "full"
    }
  ];

  for (const event of events) {
    session = appendTactileEvent(session, event);
  }
  session = appendFrameSamples(
    session,
    Array.from({ length: 240 }, () => 16.67)
  );

  return completeTactileSession(session, {
    endedAt: "2026-06-19T00:08:00.000Z",
    responses: {
      tapResponse: "immediate",
      blockedPathUnderstanding: "correct",
      rotationUnderstanding: "by-level-3",
      movementRating: "5",
      soundFeeling: "pleasant",
      hapticFeeling: "pleasant",
      effectsDistracting: "no",
      stutterObserved: "none",
      instructionRepetition: "appropriate",
      criticalDefect: false,
      criticalDefectDescription: "",
      ...(overrides.responses ?? {})
    }
  });
}

test("tactile participant codes stay anonymous and validated", () => {
  assert.equal(normalizeTactileParticipantCode(" tf 01 "), "TF-01");
  assert.equal(isValidTactileParticipantCode("TF-01"), true);
  assert.equal(isValidTactileParticipantCode("A"), false);
  assert.equal(isValidTactileParticipantCode("person@example.com"), false);
});

test("tactile summary calculates interaction and frame metrics", () => {
  const session = completedSession(1);
  const summary = summarizeTactileSession(session);

  assert.equal(summary.tapSamples, 6);
  assert.equal(summary.tapLatencyMedianMs, 12);
  assert.equal(summary.tapLatencyP95Ms, 15);
  assert.equal(summary.blockedTaps, 1);
  assert.equal(summary.reachedLevel3, true);
  assert.equal(summary.repeatedMeasuredStutter, false);
  assert.equal(summary.soundEnabled, true);
});

test("strong eight-session evidence can produce closed alpha readiness", () => {
  const sessions = Array.from(
    { length: 8 },
    (_, index) => completedSession(index + 1)
  );
  const aggregate = aggregateTactileSessions(sessions);
  const evaluation = evaluateTactileReadiness(aggregate);

  assert.equal(aggregate.completedSessions, 8);
  assert.equal(aggregate.perceivedImmediateRate, 1);
  assert.equal(aggregate.lowEndSessions, 1);
  assert.equal(evaluation.decision, "READY FOR CLOSED ALPHA");
  assert.equal(evaluation.passed, true);
});

test("fewer than six sessions remain insufficient evidence", () => {
  const sessions = Array.from(
    { length: 5 },
    (_, index) => completedSession(index + 1)
  );
  const evaluation = evaluateTactileReadiness(
    aggregateTactileSessions(sessions)
  );
  assert.equal(evaluation.decision, "NOT ENOUGH EVIDENCE");
});

test("poor blocked-path comprehension triggers redesign", () => {
  const sessions = Array.from({ length: 8 }, (_, index) =>
    completedSession(index + 1, {
      responses: {
        blockedPathUnderstanding: "incorrect"
      }
    })
  );
  const evaluation = evaluateTactileReadiness(
    aggregateTactileSessions(sessions)
  );
  assert.equal(
    evaluation.decision,
    "REDESIGN BLOCKED-PATH FEEDBACK"
  );
});

test("uncomfortable sound or haptics trigger feedback redesign", () => {
  const sessions = Array.from({ length: 8 }, (_, index) =>
    completedSession(index + 1, {
      responses: {
        soundFeeling: "annoying",
        hapticFeeling: "annoying"
      }
    })
  );
  const evaluation = evaluateTactileReadiness(
    aggregateTactileSessions(sessions)
  );
  assert.equal(evaluation.decision, "REDESIGN SOUND OR HAPTICS");
});

test("low-end repeated stutter triggers effects reduction", () => {
  const sessions = Array.from({ length: 8 }, (_, index) =>
    completedSession(index + 1, {
      deviceTier: index === 0 ? "low-end" : "mid-range",
      responses: {
        stutterObserved: index === 0 ? "repeated" : "none"
      }
    })
  );
  const evaluation = evaluateTactileReadiness(
    aggregateTactileSessions(sessions)
  );
  assert.equal(evaluation.decision, "REDUCE VISUAL EFFECTS");
});

test("tactile CSV escapes free-text fields safely", () => {
  const session = completedSession(1, {
    responses: {
      mostSatisfying: 'The "paper flick", then the fold',
      additionalComments: "First line\nSecond line"
    }
  });
  const csv = tactileSessionsToCsv([session]);

  assert.match(csv, /"The ""paper flick"", then the fold"/);
  assert.match(csv, /"First line\nSecond line"/);
});
