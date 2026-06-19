export const TACTILE_CRITERIA = Object.freeze({
  perceivedImmediateRate: 0.90,
  blockedPathCorrectRate: 0.85,
  rotationByLevel3Rate: 0.80,
  movementRating4PlusRate: 0.75,
  soundPleasantNeutralRate: 0.70,
  hapticsPleasantNeutralRate: 0.70,
  effectsDistractingRateMaximum: 0.15,
  lowEndRepeatedStutterMaximum: 0,
  criticalDefectsMaximum: 0
});

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,15}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function finiteNumbers(values) {
  return values.filter((value) => Number.isFinite(value));
}

function percentile(values, fraction) {
  const sorted = finiteNumbers(values).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return null;
  }
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1)
  );
  return sorted[index];
}

export function normalizeTactileParticipantCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

export function isValidTactileParticipantCode(value) {
  return CODE_PATTERN.test(normalizeTactileParticipantCode(value));
}

export function createTactileSession({
  participantCode,
  segment,
  deviceTier,
  sessionId,
  startedAt,
  capabilities = {}
}) {
  const code = normalizeTactileParticipantCode(participantCode);
  if (!isValidTactileParticipantCode(code)) {
    throw new Error(
      "Participant code must be 2–16 characters using letters, numbers, hyphens, or underscores."
    );
  }
  if (!sessionId) {
    throw new Error("A session ID is required.");
  }

  return {
    schemaVersion: 1,
    buildVersion: "0.11",
    participantCode: code,
    segment: String(segment || "not-specified"),
    deviceTier: String(deviceTier || "unknown"),
    sessionId: String(sessionId),
    status: "active",
    startedAt: String(startedAt),
    endedAt: null,
    capabilities: clone(capabilities),
    events: [],
    frameSamplesMs: [],
    responses: {},
    summary: null
  };
}

export function appendTactileEvent(session, event) {
  return {
    ...session,
    events: [...(session.events ?? []), clone(event)]
  };
}

export function appendFrameSamples(session, samples = []) {
  return {
    ...session,
    frameSamplesMs: [
      ...(session.frameSamplesMs ?? []),
      ...finiteNumbers(samples)
    ].slice(-12000)
  };
}

function count(events, name) {
  return events.filter((event) => event.name === name).length;
}

function exists(events, name) {
  return events.some((event) => event.name === name);
}

export function summarizeTactileSession(session) {
  const events = [...(session.events ?? [])].sort((a, b) =>
    String(a.occurredAt).localeCompare(String(b.occurredAt))
  );
  const feedbackLatencies = events
    .filter((event) => event.name === "tap_feedback_visible")
    .map((event) => Number(event.latencyMs))
    .filter(Number.isFinite);
  const escapeLatencies = events
    .filter((event) => event.name === "bird_escape")
    .map((event) => Number(event.feedbackLatencyMs))
    .filter(Number.isFinite);
  const frames = finiteNumbers(session.frameSamplesMs ?? []);
  const longFrames = frames.filter((value) => value > 50);
  const severeFrames = frames.filter((value) => value > 100);
  const levelsCompleted = [
    ...new Set(
      events
        .filter(
          (event) =>
            event.name === "puzzle_complete" &&
            event.mode === "campaign" &&
            Number.isInteger(event.level)
        )
        .map((event) => event.level)
    )
  ].sort((a, b) => a - b);

  return {
    eventCount: events.length,
    tapSamples: feedbackLatencies.length,
    tapLatencyMedianMs: percentile(feedbackLatencies, 0.50),
    tapLatencyP95Ms: percentile(feedbackLatencies, 0.95),
    escapeFeedbackMedianMs: percentile(escapeLatencies, 0.50),
    blockedTaps: count(events, "blocked_tap"),
    movePreviews: count(events, "move_preview_shown"),
    hintsUsed: count(events, "safe_hint_used"),
    undoCount: count(events, "undo"),
    restartCount: count(events, "level_restart"),
    deadlockCount: count(events, "level_deadlock"),
    completedLevels: levelsCompleted,
    highestCampaignLevelCompleted:
      levelsCompleted.length > 0 ? Math.max(...levelsCompleted) : 0,
    reachedLevel3:
      levelsCompleted.some((level) => level >= 3) ||
      events.some(
        (event) =>
          event.mode === "campaign" &&
          Number(event.level) >= 3
      ),
    soundEnabled:
      events.some(
        (event) =>
          event.name === "sound_preference_changed" &&
          event.enabled === true
      ) ||
      events.some(
        (event) =>
          event.name === "prototype_open" &&
          event.soundEnabled === true
      ),
    effectsModes: [
      ...new Set(
        events
          .map((event) => event.effectsMode)
          .filter((value) => typeof value === "string")
      )
    ],
    frameSampleCount: frames.length,
    frameMedianMs: percentile(frames, 0.50),
    frameP95Ms: percentile(frames, 0.95),
    longFrameCount: longFrames.length,
    severeFrameCount: severeFrames.length,
    longFrameRate: frames.length === 0 ? null : longFrames.length / frames.length,
    repeatedMeasuredStutter:
      severeFrames.length >= 3 ||
      (frames.length >= 120 &&
        longFrames.length / frames.length >= 0.05),
    hapticCapability: Boolean(session.capabilities?.vibrate),
    audioCapability: Boolean(session.capabilities?.audioContext)
  };
}

export function completeTactileSession(session, {
  endedAt,
  responses = {}
}) {
  return {
    ...session,
    status: "complete",
    endedAt: String(endedAt),
    responses: clone(responses),
    summary: summarizeTactileSession(session)
  };
}

function completedSessions(sessions) {
  return sessions.filter((session) => session.status === "complete");
}

function rate(sessions, predicate) {
  if (sessions.length === 0) {
    return null;
  }
  return sessions.filter(predicate).length / sessions.length;
}

export function aggregateTactileSessions(sessions = []) {
  const completed = completedSessions(sessions);
  const blockedEligible = completed.filter(
    (session) =>
      Number(session.summary?.blockedTaps) > 0 ||
      session.responses?.blockedPathUnderstanding !== "not-encountered"
  );
  const rotationEligible = completed.filter(
    (session) =>
      Boolean(session.summary?.reachedLevel3) ||
      session.responses?.rotationUnderstanding !== "not-reached"
  );
  const soundEligible = completed.filter(
    (session) => session.responses?.soundFeeling !== "not-tested"
  );
  const hapticEligible = completed.filter(
    (session) => session.responses?.hapticFeeling !== "not-tested"
  );
  const lowEndSessions = completed.filter(
    (session) => session.deviceTier === "low-end"
  );

  const allTapLatencies = completed.flatMap((session) =>
    (session.events ?? [])
      .filter((event) => event.name === "tap_feedback_visible")
      .map((event) => Number(event.latencyMs))
      .filter(Number.isFinite)
  );

  return {
    totalSessions: sessions.length,
    completedSessions: completed.length,
    blockedEligibleSessions: blockedEligible.length,
    rotationEligibleSessions: rotationEligible.length,
    soundTestedSessions: soundEligible.length,
    hapticsTestedSessions: hapticEligible.length,
    lowEndSessions: lowEndSessions.length,
    perceivedImmediateRate: rate(
      completed,
      (session) => session.responses?.tapResponse === "immediate"
    ),
    blockedPathCorrectRate: rate(
      blockedEligible,
      (session) =>
        session.responses?.blockedPathUnderstanding === "correct"
    ),
    rotationByLevel3Rate: rate(
      rotationEligible,
      (session) =>
        session.responses?.rotationUnderstanding === "by-level-3"
    ),
    movementRating4PlusRate: rate(
      completed,
      (session) => Number(session.responses?.movementRating) >= 4
    ),
    soundPleasantNeutralRate: rate(
      soundEligible,
      (session) =>
        ["pleasant", "neutral"].includes(
          session.responses?.soundFeeling
        )
    ),
    hapticsPleasantNeutralRate: rate(
      hapticEligible,
      (session) =>
        ["pleasant", "neutral"].includes(
          session.responses?.hapticFeeling
        )
    ),
    effectsDistractingRate: rate(
      completed,
      (session) => session.responses?.effectsDistracting === "yes"
    ),
    repeatedStutterRate: rate(
      completed,
      (session) =>
        session.responses?.stutterObserved === "repeated" ||
        session.summary?.repeatedMeasuredStutter === true
    ),
    lowEndRepeatedStutterCount: lowEndSessions.filter(
      (session) =>
        session.responses?.stutterObserved === "repeated" ||
        session.summary?.repeatedMeasuredStutter === true
    ).length,
    criticalDefects: completed.filter(
      (session) => Boolean(session.responses?.criticalDefect)
    ).length,
    tapLatencyMedianMs: percentile(allTapLatencies, 0.50),
    tapLatencyP95Ms: percentile(allTapLatencies, 0.95)
  };
}

function meetsMinimum(value, minimum) {
  return value !== null && value >= minimum;
}

export function evaluateTactileReadiness(
  aggregate,
  criteria = TACTILE_CRITERIA
) {
  if (aggregate.completedSessions < 6) {
    return {
      decision: "NOT ENOUGH EVIDENCE",
      passed: false,
      reasons: [
        "At least six completed qualified sessions are required; eight to ten are preferred."
      ]
    };
  }

  if (
    aggregate.blockedEligibleSessions >= 3 &&
    (aggregate.blockedPathCorrectRate ?? 0) < 0.50
  ) {
    return {
      decision: "REDESIGN BLOCKED-PATH FEEDBACK",
      passed: false,
      reasons: [
        "Fewer than half of eligible participants correctly explained the blocked path."
      ]
    };
  }

  const soundPoor =
    aggregate.soundTestedSessions >= 3 &&
    (aggregate.soundPleasantNeutralRate ?? 0) < 0.60;
  const hapticsPoor =
    aggregate.hapticsTestedSessions >= 3 &&
    (aggregate.hapticsPleasantNeutralRate ?? 0) < 0.60;

  if (soundPoor || hapticsPoor) {
    return {
      decision: "REDESIGN SOUND OR HAPTICS",
      passed: false,
      reasons: [
        "Enabled sound or haptics missed the minimum comfort threshold."
      ]
    };
  }

  if (
    aggregate.lowEndRepeatedStutterCount >
      criteria.lowEndRepeatedStutterMaximum ||
    (aggregate.effectsDistractingRate ?? 0) >= 0.30
  ) {
    return {
      decision: "REDUCE VISUAL EFFECTS",
      passed: false,
      reasons: [
        "Low-end stutter or distracting effects exceeded the safe threshold."
      ]
    };
  }

  const checks = {
    perceivedImmediateRate: meetsMinimum(
      aggregate.perceivedImmediateRate,
      criteria.perceivedImmediateRate
    ),
    blockedPathCorrectRate:
      aggregate.blockedEligibleSessions === 0
        ? false
        : meetsMinimum(
            aggregate.blockedPathCorrectRate,
            criteria.blockedPathCorrectRate
          ),
    rotationByLevel3Rate:
      aggregate.rotationEligibleSessions === 0
        ? false
        : meetsMinimum(
            aggregate.rotationByLevel3Rate,
            criteria.rotationByLevel3Rate
          ),
    movementRating4PlusRate: meetsMinimum(
      aggregate.movementRating4PlusRate,
      criteria.movementRating4PlusRate
    ),
    soundPleasantNeutralRate:
      aggregate.soundTestedSessions === 0
        ? false
        : meetsMinimum(
            aggregate.soundPleasantNeutralRate,
            criteria.soundPleasantNeutralRate
          ),
    hapticsPleasantNeutralRate:
      aggregate.hapticsTestedSessions === 0
        ? false
        : meetsMinimum(
            aggregate.hapticsPleasantNeutralRate,
            criteria.hapticsPleasantNeutralRate
          ),
    effectsWithinLimit:
      aggregate.effectsDistractingRate !== null &&
      aggregate.effectsDistractingRate <
        criteria.effectsDistractingRateMaximum,
    lowEndStutterWithinLimit:
      aggregate.lowEndSessions > 0 &&
      aggregate.lowEndRepeatedStutterCount <=
        criteria.lowEndRepeatedStutterMaximum,
    noCriticalDefects:
      aggregate.criticalDefects <= criteria.criticalDefectsMaximum
  };

  const passCount = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;

  if (
    aggregate.completedSessions >= 8 &&
    passCount === totalChecks
  ) {
    return {
      decision: "READY FOR CLOSED ALPHA",
      passed: true,
      reasons: ["All defined tactile and performance criteria were met."],
      checks
    };
  }

  return {
    decision: "READY FOR ANOTHER CORE-FEEL ROUND",
    passed: false,
    reasons: [`${passCount} of ${totalChecks} acceptance checks passed.`],
    checks
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

export function tactileSessionsToCsv(sessions = []) {
  const headers = [
    "participant_code",
    "segment",
    "device_tier",
    "status",
    "started_at",
    "ended_at",
    "tap_response",
    "blocked_path_understanding",
    "rotation_understanding",
    "movement_rating",
    "sound_feeling",
    "haptic_feeling",
    "effects_distracting",
    "stutter_observed",
    "instruction_repetition",
    "most_satisfying",
    "least_clear",
    "critical_defect",
    "critical_defect_description",
    "tap_latency_median_ms",
    "tap_latency_p95_ms",
    "frame_p95_ms",
    "long_frame_rate",
    "repeated_measured_stutter",
    "blocked_taps",
    "highest_level_completed",
    "effects_modes",
    "additional_comments"
  ];

  const rows = sessions.map((session) => {
    const summary =
      session.summary ?? summarizeTactileSession(session);
    const responses = session.responses ?? {};
    return [
      session.participantCode,
      session.segment,
      session.deviceTier,
      session.status,
      session.startedAt,
      session.endedAt,
      responses.tapResponse,
      responses.blockedPathUnderstanding,
      responses.rotationUnderstanding,
      responses.movementRating,
      responses.soundFeeling,
      responses.hapticFeeling,
      responses.effectsDistracting,
      responses.stutterObserved,
      responses.instructionRepetition,
      responses.mostSatisfying,
      responses.leastClear,
      responses.criticalDefect,
      responses.criticalDefectDescription,
      summary.tapLatencyMedianMs,
      summary.tapLatencyP95Ms,
      summary.frameP95Ms,
      summary.longFrameRate,
      summary.repeatedMeasuredStutter,
      summary.blockedTaps,
      summary.highestCampaignLevelCompleted,
      (summary.effectsModes ?? []).join("|"),
      responses.additionalComments
    ].map(csvEscape);
  });

  return [
    headers.join(","),
    ...rows.map((row) => row.join(","))
  ].join("\n");
}
