const PARTICIPANT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,15}$/;

export const VISUAL_CRITERIA = Object.freeze({
  puzzleRecognitionRate: 0.80,
  paperBirdRecallRate: 0.70,
  visualAppeal4PlusRate: 0.70,
  directionUnderstoodRate: 0.85,
  featherMeaningRate: 0.75,
  featherFairNeutralRate: 0.80,
  voluntaryReplayRate: 0.35,
  themeSelectionRate: 0.75,
  featherPressureRateMaximum: 0.20,
  criticalDefectsMaximum: 0
});

export function normalizeVisualParticipantCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

export function isValidVisualParticipantCode(value) {
  return PARTICIPANT_CODE_PATTERN.test(
    normalizeVisualParticipantCode(value)
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createVisualSession({
  participantCode,
  segment,
  sessionId,
  startedAt,
  deviceProfile = {}
}) {
  const code = normalizeVisualParticipantCode(participantCode);
  if (!isValidVisualParticipantCode(code)) {
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
    sessionId: String(sessionId),
    status: "prepared",
    phase: "ready",
    consentedAt: String(startedAt),
    startedAt: String(startedAt),
    exposureStartedAt: null,
    exposureEndedAt: null,
    playStartedAt: null,
    endedAt: null,
    deviceProfile: clone(deviceProfile),
    recall: {},
    events: [],
    responses: {},
    summary: null
  };
}

export function appendVisualEvent(session, event) {
  return {
    ...session,
    events: [...(session.events ?? []), clone(event)]
  };
}

export function startVisualExposure(session, timestamp) {
  return {
    ...session,
    status: "active",
    phase: "exposure",
    exposureStartedAt: String(timestamp)
  };
}

export function completeVisualExposure(session, timestamp) {
  return {
    ...session,
    phase: "recall",
    exposureEndedAt: String(timestamp)
  };
}

export function submitVisualRecall(session, recall, timestamp) {
  return {
    ...session,
    phase: "play",
    playStartedAt: String(timestamp),
    recall: clone(recall)
  };
}

function eventCount(events, name) {
  return events.filter((event) => event.name === name).length;
}

function eventExists(events, name) {
  return events.some((event) => event.name === name);
}

function completedCampaignLevels(events) {
  return [
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
}

export function summarizeVisualSession(session) {
  const events = [...(session.events ?? [])].sort((a, b) =>
    String(a.occurredAt).localeCompare(String(b.occurredAt))
  );
  const levels = completedCampaignLevels(events);
  const firstEscape = events.find((event) => event.name === "bird_escape");
  const lastElapsed = events.reduce(
    (maximum, event) =>
      Math.max(maximum, Number.isFinite(event.elapsedMs) ? event.elapsedMs : 0),
    0
  );
  const replay = events.some(
    (event) =>
      event.name === "replay_started" ||
      (event.name === "puzzle_start" &&
        ["completion_replay", "map_replay"].includes(event.reason))
  );
  const themesSelected = events
    .filter((event) => event.name === "theme_selected")
    .map((event) => event.themeId)
    .filter(Boolean);

  return {
    eventCount: events.length,
    playDurationMs: lastElapsed,
    firstEscapeMs: firstEscape?.elapsedMs ?? null,
    completedLevels: levels,
    highestCampaignLevelCompleted:
      levels.length > 0 ? Math.max(...levels) : 0,
    completedFirstFive: [1, 2, 3, 4, 5].every((level) =>
      levels.includes(level)
    ),
    blockedTaps: eventCount(events, "blocked_tap"),
    hintsUsed: eventCount(events, "safe_hint_used"),
    undoCount: eventCount(events, "undo"),
    restartCount: eventCount(events, "level_restart"),
    deadlockCount: eventCount(events, "level_deadlock"),
    levelMapOpened: eventExists(events, "level_map_opened"),
    levelSelectedFromMap: eventExists(events, "map_level_selected"),
    voluntaryReplay: replay,
    themeSelectionCount: themesSelected.length,
    selectedThemes: [...new Set(themesSelected)],
    dailyInvitationOpened: eventExists(events, "daily_invitation_opened"),
    dailyStarted: eventExists(events, "daily_started"),
    feathersEarned: events
      .filter((event) => event.name === "puzzle_complete")
      .map((event) => event.feathersEarned)
      .filter(Number.isInteger),
    maximumFeathersEarned: Math.max(
      0,
      ...events
        .filter((event) => event.name === "puzzle_complete")
        .map((event) => event.feathersEarned)
        .filter(Number.isInteger)
    )
  };
}

export function completeVisualSession(session, {
  endedAt,
  responses
}) {
  return {
    ...session,
    status: "complete",
    phase: "complete",
    endedAt: String(endedAt),
    responses: clone(responses),
    summary: summarizeVisualSession(session)
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

export function aggregateVisualSessions(sessions = []) {
  const completed = completedSessions(sessions);

  const puzzleRecognitionRate = rate(
    completed,
    (session) => session.recall?.productType === "puzzle-game"
  );
  const paperBirdRecallRate = rate(
    completed,
    (session) =>
      ["origami-birds", "paper-birds"].includes(
        session.recall?.pieceIdentity
      )
  );
  const visualAppeal4PlusRate = rate(
    completed,
    (session) => Number(session.responses?.visualAppeal) >= 4
  );
  const directionUnderstoodRate = rate(
    completed,
    (session) => session.responses?.directionUnderstanding === "clear"
  );
  const featherMeaningRate = rate(
    completed,
    (session) => session.responses?.featherMeaning === "mastery"
  );
  const featherFairNeutralRate = rate(
    completed,
    (session) =>
      ["motivating", "neutral", "ignored"].includes(
        session.responses?.featherFeeling
      )
  );
  const featherPressureRate = rate(
    completed,
    (session) => session.responses?.featherFeeling === "pressured"
  );
  const voluntaryReplayRate = rate(
    completed,
    (session) => Boolean(session.summary?.voluntaryReplay)
  );

  const themeEligible = completed.filter(
    (session) =>
      Number(session.summary?.highestCampaignLevelCompleted) >= 5
  );
  const themeSelectionRate = rate(
    themeEligible,
    (session) => Number(session.summary?.themeSelectionCount) > 0
  );

  const criticalDefects = completed.filter((session) =>
    Boolean(session.responses?.criticalDefect)
  ).length;

  return {
    totalSessions: sessions.length,
    completedSessions: completed.length,
    themeEligibleSessions: themeEligible.length,
    puzzleRecognitionRate,
    paperBirdRecallRate,
    visualAppeal4PlusRate,
    directionUnderstoodRate,
    featherMeaningRate,
    featherFairNeutralRate,
    featherPressureRate,
    voluntaryReplayRate,
    themeSelectionRate,
    criticalDefects
  };
}

function meets(value, target) {
  return value !== null && value >= target;
}

export function evaluateVisualReadiness(
  aggregate,
  criteria = VISUAL_CRITERIA
) {
  if (aggregate.completedSessions < 6) {
    return {
      decision: "NOT ENOUGH EVIDENCE",
      passed: false,
      reasons: [
        "At least six completed qualified sessions are required; ten are preferred."
      ]
    };
  }

  const visualIdentitySeverelyWeak =
    (aggregate.puzzleRecognitionRate ?? 0) < 0.50 ||
    (aggregate.paperBirdRecallRate ?? 0) < 0.40 ||
    (aggregate.visualAppeal4PlusRate ?? 0) < 0.50;

  const feathersHarmful =
    (aggregate.featherPressureRate ?? 0) >= 0.30 ||
    (aggregate.featherMeaningRate ?? 0) < 0.50;

  if (visualIdentitySeverelyWeak) {
    return {
      decision: "REDESIGN VISUAL IDENTITY",
      passed: false,
      reasons: [
        "The visual identity failed a major recognition or appeal threshold."
      ]
    };
  }

  if (feathersHarmful) {
    return {
      decision: "REMOVE OR REDESIGN FEATHERS",
      passed: false,
      reasons: [
        "Feather comprehension or perceived pressure failed the safety threshold."
      ]
    };
  }

  const checks = {
    puzzleRecognitionRate: meets(
      aggregate.puzzleRecognitionRate,
      criteria.puzzleRecognitionRate
    ),
    paperBirdRecallRate: meets(
      aggregate.paperBirdRecallRate,
      criteria.paperBirdRecallRate
    ),
    visualAppeal4PlusRate: meets(
      aggregate.visualAppeal4PlusRate,
      criteria.visualAppeal4PlusRate
    ),
    directionUnderstoodRate: meets(
      aggregate.directionUnderstoodRate,
      criteria.directionUnderstoodRate
    ),
    featherMeaningRate: meets(
      aggregate.featherMeaningRate,
      criteria.featherMeaningRate
    ),
    featherFairNeutralRate: meets(
      aggregate.featherFairNeutralRate,
      criteria.featherFairNeutralRate
    ),
    voluntaryReplayRate: meets(
      aggregate.voluntaryReplayRate,
      criteria.voluntaryReplayRate
    ),
    themeSelectionRate:
      aggregate.themeEligibleSessions === 0
        ? false
        : meets(
            aggregate.themeSelectionRate,
            criteria.themeSelectionRate
          ),
    pressureWithinLimit:
      aggregate.featherPressureRate !== null &&
      aggregate.featherPressureRate < criteria.featherPressureRateMaximum,
    noCriticalDefects:
      aggregate.criticalDefects <= criteria.criticalDefectsMaximum
  };

  const requiredPasses = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;

  if (
    aggregate.completedSessions >= 10 &&
    requiredPasses === totalChecks
  ) {
    return {
      decision: "READY FOR CLOSED ALPHA",
      passed: true,
      reasons: ["All defined visual and mastery criteria were met."],
      checks
    };
  }

  return {
    decision: "READY FOR ANOTHER VISUAL/USABILITY ROUND",
    passed: false,
    reasons: [
      `${requiredPasses} of ${totalChecks} acceptance checks passed.`
    ],
    checks
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

export function visualSessionsToCsv(sessions = []) {
  const headers = [
    "participant_code",
    "segment",
    "status",
    "started_at",
    "ended_at",
    "product_type",
    "piece_identity_recall",
    "remembered_elements",
    "first_impression_mood",
    "first_tap_expectation",
    "initial_finish_impression",
    "visual_appeal_1_to_5",
    "piece_identity_after_play",
    "direction_understanding",
    "feather_meaning",
    "feather_feeling",
    "replay_intent",
    "theme_understanding",
    "text_readability",
    "motion_comfort",
    "critical_defect",
    "critical_defect_description",
    "highest_level_completed",
    "completed_first_five",
    "voluntary_replay",
    "theme_selection_count",
    "daily_started",
    "additional_comments"
  ];

  const rows = sessions.map((session) => {
    const summary =
      session.summary ?? summarizeVisualSession(session);
    const recall = session.recall ?? {};
    const responses = session.responses ?? {};

    return [
      session.participantCode,
      session.segment,
      session.status,
      session.startedAt,
      session.endedAt,
      recall.productType,
      recall.pieceIdentity,
      recall.rememberedElements,
      recall.mood,
      recall.firstTap,
      recall.finishImpression,
      responses.visualAppeal,
      responses.pieceIdentityAfterPlay,
      responses.directionUnderstanding,
      responses.featherMeaning,
      responses.featherFeeling,
      responses.replayIntent,
      responses.themeUnderstanding,
      responses.textReadability,
      responses.motionComfort,
      responses.criticalDefect,
      responses.criticalDefectDescription,
      summary.highestCampaignLevelCompleted,
      summary.completedFirstFive,
      summary.voluntaryReplay,
      summary.themeSelectionCount,
      summary.dailyStarted,
      responses.additionalComments
    ].map(csvEscape);
  });

  return [
    headers.join(","),
    ...rows.map((row) => row.join(","))
  ].join("\n");
}
