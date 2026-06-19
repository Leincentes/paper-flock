import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  appendFrameSamples,
  appendTactileEvent,
  completeTactileSession,
  createTactileSession
} from "../src/tactile-test-core.js";
import {
  aggregateFieldCoverage,
  evaluateFieldReadiness,
  extractTactileSessions,
  mergeImportedTactileSessions,
  nextParticipantRecommendations,
  tactileSessionProtocolStatus
} from "../src/field-test-core.js";

function completeSession({
  code,
  segment,
  deviceTier = "mid-range",
  vibrate = true
}) {
  let session = createTactileSession({
    participantCode: code,
    segment,
    deviceTier,
    sessionId: `session-${code}`,
    startedAt: "2026-06-19T00:00:00.000Z",
    capabilities: {
      vibrate,
      audioContext: true,
      reducedMotion: false,
      deviceMemory: deviceTier === "low-end" ? 2 : 8,
      hardwareConcurrency: deviceTier === "low-end" ? 4 : 8
    }
  });

  const events = [
    {
      name: "prototype_open",
      occurredAt: "2026-06-19T00:00:01.000Z",
      elapsedMs: 1000,
      effectsMode: deviceTier === "low-end" ? "lite" : "full"
    },
    ...[12, 18, 24].map((latencyMs, index) => ({
      name: "tap_feedback_visible",
      occurredAt: `2026-06-19T00:00:0${index + 2}.000Z`,
      elapsedMs: 2000 + index * 1000,
      latencyMs,
      effectsMode: deviceTier === "low-end" ? "lite" : "full"
    })),
    {
      name: "blocked_tap",
      occurredAt: "2026-06-19T00:00:08.000Z",
      elapsedMs: 8000,
      effectsMode: deviceTier === "low-end" ? "lite" : "full"
    },
    {
      name: "sound_preference_changed",
      occurredAt: "2026-06-19T00:02:00.000Z",
      elapsedMs: 120000,
      enabled: true,
      effectsMode: deviceTier === "low-end" ? "lite" : "full"
    },
    ...[1, 2, 3].map((level) => ({
      name: "puzzle_complete",
      occurredAt: `2026-06-19T00:0${level + 2}:00.000Z`,
      elapsedMs: (level + 2) * 60000,
      mode: "campaign",
      level,
      effectsMode: deviceTier === "low-end" ? "lite" : "full"
    }))
  ];

  for (const event of events) {
    session = appendTactileEvent(session, event);
  }
  session = appendFrameSamples(
    session,
    Array.from({ length: 180 }, () => 16.67)
  );

  return completeTactileSession(session, {
    endedAt: "2026-06-19T00:10:00.000Z",
    responses: {
      tapResponse: "immediate",
      blockedPathUnderstanding: "correct",
      rotationUnderstanding: "by-level-3",
      movementRating: "5",
      soundFeeling: "pleasant",
      hapticFeeling: vibrate ? "pleasant" : "not-tested",
      effectsDistracting: "no",
      stutterObserved: "none",
      instructionRepetition: "appropriate",
      criticalDefect: false,
      criticalDefectDescription: ""
    }
  });
}

function completeFieldSample() {
  return [
    completeSession({ code: "TF-01", segment: "casual-puzzle", deviceTier: "low-end" }),
    completeSession({ code: "TF-02", segment: "casual-puzzle" }),
    completeSession({ code: "TF-03", segment: "casual-puzzle" }),
    completeSession({ code: "TF-04", segment: "casual-puzzle" }),
    completeSession({ code: "TF-05", segment: "experienced-puzzle" }),
    completeSession({ code: "TF-06", segment: "casual-non-puzzle" }),
    completeSession({ code: "TF-07", segment: "older-low-vision" }),
    completeSession({ code: "TF-08", segment: "motion-sound-sensitive" })
  ];
}

test("field import accepts single and combined tactile payloads", () => {
  const session = completeSession({
    code: "TF-01",
    segment: "casual-puzzle"
  });
  assert.equal(extractTactileSessions({ session }).length, 1);
  assert.equal(extractTactileSessions({ sessions: [session] }).length, 1);
  assert.equal(extractTactileSessions([session]).length, 1);
  assert.deepEqual(extractTactileSessions({ unrelated: true }), []);
});

test("field import merges valid sessions and rejects duplicates", () => {
  const first = completeSession({
    code: "TF-01",
    segment: "casual-puzzle"
  });
  const second = completeSession({
    code: "TF-02",
    segment: "experienced-puzzle"
  });
  const result = mergeImportedTactileSessions(
    [first],
    [first, second, { participantCode: "BROKEN" }]
  );

  assert.deepEqual(result.added, ["TF-02"]);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.sessions.length, 2);
});

test("protocol status requires useful timing, frames, survey, and feedback evidence", () => {
  const session = completeSession({
    code: "TF-01",
    segment: "casual-puzzle",
    deviceTier: "low-end"
  });
  const status = tactileSessionProtocolStatus(session);

  assert.equal(status.protocolComplete, true);
  assert.equal(status.checks.lowEndEffectsObserved, true);
  assert.ok(status.durationMs >= 120000);
});

test("complete field sample satisfies recruitment and protocol coverage", () => {
  const coverage = aggregateFieldCoverage(completeFieldSample());

  assert.equal(coverage.complete, true);
  assert.equal(coverage.counts.completedSessions, 8);
  assert.equal(coverage.counts.protocolCompleteSessions, 8);
  assert.equal(coverage.counts.casualPuzzleSessions, 4);
  assert.equal(coverage.counts.lowEndSessions, 1);
});

test("field readiness cannot pass without required perspectives", () => {
  const incomplete = Array.from({ length: 8 }, (_, index) =>
    completeSession({
      code: `ONLY-${index + 1}`,
      segment: "casual-puzzle"
    })
  );
  const evaluation = evaluateFieldReadiness(incomplete);

  assert.equal(evaluation.decision, "NOT ENOUGH EVIDENCE");
  assert.equal(evaluation.passed, false);
  assert.ok(
    evaluation.reasons.some((reason) =>
      reason.includes("experienced puzzle")
    )
  );
});

test("complete strong field sample reaches the tactile closed-alpha gate", () => {
  const evaluation = evaluateFieldReadiness(completeFieldSample());

  assert.equal(evaluation.decision, "READY FOR CLOSED ALPHA");
  assert.equal(evaluation.passed, true);
});

test("recruitment suggestions prioritize missing device and participant coverage", () => {
  const suggestions = nextParticipantRecommendations([
    completeSession({
      code: "TF-01",
      segment: "casual-puzzle"
    })
  ]);

  assert.ok(
    suggestions.some((item) => item.includes("low-end"))
  );
  assert.ok(
    suggestions.some((item) => item.includes("experienced"))
  );
});

test("field-test UI is loaded and exposes remote import controls", () => {
  const html = fs.readFileSync(
    new URL("../index.html", import.meta.url),
    "utf8"
  );
  const ui = fs.readFileSync(
    new URL("../src/tactile-test-ui.js", import.meta.url),
    "utf8"
  );

  assert.match(html, /src="\.\/src\/tactile-test-ui\.js"/);
  assert.match(ui, /fieldtest/);
  assert.match(ui, /import-tactile-json-input/);
  assert.match(ui, /copyFieldTestLink/);
  assert.match(ui, /evaluateFieldReadiness/);
});
