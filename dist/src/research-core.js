const PARTICIPANT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,15}$/;

export function normalizeParticipantCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

export function isValidParticipantCode(value) {
  return PARTICIPANT_CODE_PATTERN.test(normalizeParticipantCode(value));
}

export function createResearchSession({
  participantCode,
  segment = "not-specified",
  sessionId,
  startedAt
}) {
  const code = normalizeParticipantCode(participantCode);
  if (!isValidParticipantCode(code)) {
    throw new Error(
      "Participant code must be 2–16 characters using letters, numbers, hyphens, or underscores."
    );
  }
  if (!sessionId) {
    throw new Error("A session ID is required.");
  }

  return {
    schemaVersion: 1,
    participantCode: code,
    segment: String(segment || "not-specified"),
    sessionId: String(sessionId),
    status: "active",
    consentedAt: String(startedAt),
    startedAt: String(startedAt),
    endedAt: null,
    events: [],
    responses: {},
    summary: null
  };
}

export function appendSessionEvent(session, event) {
  return {
    ...session,
    events: [...(session.events ?? []), structuredCloneSafe(event)]
  };
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueSortedNumbers(values) {
  return [...new Set(values.filter(Number.isInteger))].sort((a, b) => a - b);
}

export function summarizeEvents(events = []) {
  const ordered = [...events].sort((a, b) =>
    String(a.occurredAt).localeCompare(String(b.occurredAt))
  );
  const completedLevels = uniqueSortedNumbers(
    ordered
      .filter(
        (event) =>
          event.name === "puzzle_complete" &&
          event.mode === "campaign" &&
          Number.isInteger(event.level)
      )
      .map((event) => event.level)
  );
  const lastElapsed = ordered.reduce(
    (maximum, event) =>
      Math.max(maximum, Number.isFinite(event.elapsedMs) ? event.elapsedMs : 0),
    0
  );
  const firstEscape = ordered.find((event) => event.name === "bird_escape");
  const replayEvents = ordered.filter(
    (event) =>
      event.name === "replay_started" ||
      (event.name === "puzzle_start" &&
        ["completion_replay", "map_replay"].includes(event.reason))
  );

  return {
    eventCount: ordered.length,
    sessionDurationMs: lastElapsed,
    firstEscapeMs: firstEscape?.elapsedMs ?? null,
    blockedTaps: ordered.filter((event) => event.name === "blocked_tap").length,
    hintsUsed: ordered.filter((event) => event.name === "safe_hint_used").length,
    undoCount: ordered.filter((event) => event.name === "undo").length,
    restartCount: ordered.filter((event) => event.name === "level_restart").length,
    deadlockCount: ordered.filter((event) => event.name === "level_deadlock").length,
    completedLevels,
    highestCampaignLevelCompleted:
      completedLevels.length > 0 ? Math.max(...completedLevels) : 0,
    completedFirstFive: [1, 2, 3, 4, 5].every((level) =>
      completedLevels.includes(level)
    ),
    levelMapOpened: ordered.some((event) => event.name === "level_map_opened"),
    levelSelectedFromMap: ordered.some(
      (event) => event.name === "map_level_selected"
    ),
    dailyUnlockedSeen: ordered.some(
      (event) => event.name === "daily_unlock_presented"
    ),
    dailyInvitationOpened: ordered.some(
      (event) => event.name === "daily_invitation_opened"
    ),
    dailyStarted: ordered.some((event) => event.name === "daily_started"),
    dailyDeclined: ordered.some((event) => event.name === "daily_declined"),
    voluntaryReplay: replayEvents.length > 0,
    featherRecordImproved: ordered.some(
      (event) =>
        event.name === "puzzle_complete" && event.newBestFeathers === true
    )
  };
}

export function completeResearchSession(session, {
  endedAt,
  responses = {}
}) {
  return {
    ...session,
    status: "complete",
    endedAt: String(endedAt),
    responses: structuredCloneSafe(responses),
    summary: summarizeEvents(session.events ?? [])
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function sessionsToCsv(sessions = []) {
  const headers = [
    "participant_code",
    "segment",
    "status",
    "started_at",
    "ended_at",
    "duration_seconds",
    "first_escape_seconds",
    "highest_level_completed",
    "completed_first_five",
    "blocked_taps",
    "hints_used",
    "undo_count",
    "restart_count",
    "deadlock_count",
    "level_map_opened",
    "level_selected_from_map",
    "daily_unlocked_seen",
    "daily_invitation_opened",
    "daily_started",
    "daily_declined",
    "voluntary_replay",
    "feather_record_improved",
    "feather_meaning",
    "feather_feedback_effect",
    "daily_expectation",
    "daily_optional_required",
    "return_reason",
    "stop_reason",
    "additional_comments"
  ];

  const rows = sessions.map((session) => {
    const summary = session.summary ?? summarizeEvents(session.events ?? []);
    const responses = session.responses ?? {};
    return [
      session.participantCode,
      session.segment,
      session.status,
      session.startedAt,
      session.endedAt,
      Math.round((summary.sessionDurationMs ?? 0) / 1000),
      summary.firstEscapeMs === null
        ? ""
        : Math.round(summary.firstEscapeMs / 1000),
      summary.highestCampaignLevelCompleted,
      summary.completedFirstFive,
      summary.blockedTaps,
      summary.hintsUsed,
      summary.undoCount,
      summary.restartCount,
      summary.deadlockCount,
      summary.levelMapOpened,
      summary.levelSelectedFromMap,
      summary.dailyUnlockedSeen,
      summary.dailyInvitationOpened,
      summary.dailyStarted,
      summary.dailyDeclined,
      summary.voluntaryReplay,
      summary.featherRecordImproved,
      responses.featherMeaning,
      responses.featherEffect,
      responses.dailyExpectation,
      responses.dailyOptionalRequired,
      responses.returnReason,
      responses.stopReason,
      responses.additionalComments
    ].map(csvEscape);
  });

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export function aggregateSessions(sessions = []) {
  const completed = sessions.filter((session) => session.status === "complete");
  const summaries = completed.map(
    (session) => session.summary ?? summarizeEvents(session.events ?? [])
  );

  const rate = (predicate) =>
    completed.length === 0
      ? null
      : summaries.filter(predicate).length / completed.length;

  return {
    totalSessions: sessions.length,
    completedSessions: completed.length,
    completedFirstFiveRate: rate((summary) => summary.completedFirstFive),
    levelMapUseRate: rate((summary) => summary.levelSelectedFromMap),
    dailyNoticeRate: rate((summary) => summary.dailyInvitationOpened),
    dailyStartRate: rate((summary) => summary.dailyStarted),
    voluntaryReplayRate: rate((summary) => summary.voluntaryReplay),
    criticalDefectsReported: completed.filter(
      (session) =>
        String(session.responses?.additionalComments ?? "")
          .toLowerCase()
          .includes("[critical]")
    ).length
  };
}
