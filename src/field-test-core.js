import {
  aggregateTactileSessions,
  evaluateTactileReadiness,
  summarizeTactileSession
} from "./tactile-test-core.js";

export const FIELD_REQUIREMENTS = Object.freeze({
  minimumCompletedSessions: 8,
  preferredCompletedSessions: 10,
  minimumProtocolCompleteSessions: 8,
  minimumCasualPuzzleSessions: 4,
  minimumExperiencedPuzzleSessions: 1,
  minimumCasualNonPuzzleSessions: 1,
  minimumAccessibilityPerspectiveSessions: 1,
  minimumLowEndSessions: 1,
  minimumSoundTestedSessions: 3,
  minimumHapticsTestedSessions: 3,
  minimumBlockedEligibleSessions: 3,
  minimumRotationEligibleSessions: 3
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseTime(value) {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? time : null;
}

export function extractTactileSessions(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  if (Array.isArray(payload.sessions)) {
    return payload.sessions;
  }
  if (payload.session && typeof payload.session === "object") {
    return [payload.session];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  return [];
}

export function validateImportedTactileSession(session) {
  const problems = [];

  if (!session || typeof session !== "object") {
    return {
      valid: false,
      problems: ["Session is not an object."]
    };
  }

  if (!session.sessionId || typeof session.sessionId !== "string") {
    problems.push("Missing session ID.");
  }
  if (
    !session.participantCode ||
    typeof session.participantCode !== "string"
  ) {
    problems.push("Missing anonymous participant code.");
  }
  if (!["active", "complete"].includes(session.status)) {
    problems.push("Unsupported session status.");
  }
  if (!Array.isArray(session.events)) {
    problems.push("Events must be an array.");
  }
  if (!Array.isArray(session.frameSamplesMs)) {
    problems.push("Frame samples must be an array.");
  }
  if (!session.capabilities || typeof session.capabilities !== "object") {
    problems.push("Missing device capability profile.");
  }

  return {
    valid: problems.length === 0,
    problems
  };
}

export function mergeImportedTactileSessions(
  existingSessions = [],
  importedSessions = []
) {
  const merged = existingSessions.map(clone);
  const sessionIds = new Set(
    merged.map((session) => session.sessionId).filter(Boolean)
  );
  const participantCodes = new Set(
    merged.map((session) => session.participantCode).filter(Boolean)
  );
  const added = [];
  const duplicates = [];
  const rejected = [];

  for (const rawSession of importedSessions) {
    const validation = validateImportedTactileSession(rawSession);
    if (!validation.valid) {
      rejected.push({
        participantCode: rawSession?.participantCode ?? "unknown",
        problems: validation.problems
      });
      continue;
    }

    const session = clone(rawSession);
    const duplicateReason =
      sessionIds.has(session.sessionId)
        ? "session-id"
        : participantCodes.has(session.participantCode)
          ? "participant-code"
          : null;

    if (duplicateReason) {
      duplicates.push({
        participantCode: session.participantCode,
        reason: duplicateReason
      });
      continue;
    }

    merged.push(session);
    sessionIds.add(session.sessionId);
    participantCodes.add(session.participantCode);
    added.push(session.participantCode);
  }

  return {
    sessions: merged,
    added,
    duplicates,
    rejected
  };
}

export function tactileSessionProtocolStatus(session) {
  const summary = session.summary ?? summarizeTactileSession(session);
  const startedAt = parseTime(session.startedAt);
  const endedAt = parseTime(session.endedAt);
  const durationMs =
    startedAt !== null && endedAt !== null
      ? Math.max(0, endedAt - startedAt)
      : null;
  const responses = session.responses ?? {};
  const soundRequired = Boolean(session.capabilities?.audioContext);
  const hapticsRequired = Boolean(session.capabilities?.vibrate);
  const lowEnd = session.deviceTier === "low-end";
  const effectsModes = summary.effectsModes ?? [];

  const checks = {
    complete: session.status === "complete",
    meaningfulDuration:
      durationMs === null ? false : durationMs >= 120000,
    tapSamples: Number(summary.tapSamples) >= 3,
    frameSamples: Number(summary.frameSampleCount) >= 60,
    surveyComplete:
      Boolean(responses.tapResponse) &&
      Boolean(responses.blockedPathUnderstanding) &&
      Boolean(responses.rotationUnderstanding) &&
      Boolean(responses.movementRating) &&
      Boolean(responses.effectsDistracting) &&
      Boolean(responses.stutterObserved),
    soundResolved:
      !soundRequired ||
      Boolean(responses.soundFeeling) &&
        responses.soundFeeling !== "not-tested",
    hapticsResolved:
      !hapticsRequired ||
      Boolean(responses.hapticFeeling) &&
        responses.hapticFeeling !== "not-tested",
    lowEndEffectsObserved:
      !lowEnd ||
      effectsModes.some((mode) =>
        ["lite", "minimal"].includes(mode)
      )
  };

  return {
    participantCode: session.participantCode,
    durationMs,
    checks,
    protocolComplete: Object.values(checks).every(Boolean)
  };
}

function countBySegment(sessions, segment) {
  return sessions.filter((session) => session.segment === segment).length;
}

export function aggregateFieldCoverage(
  sessions = [],
  requirements = FIELD_REQUIREMENTS
) {
  const completed = sessions.filter(
    (session) => session.status === "complete"
  );
  const protocolStatuses = completed.map(tactileSessionProtocolStatus);
  const protocolCompleteSessions = protocolStatuses.filter(
    (status) => status.protocolComplete
  ).length;
  const accessibilityPerspectiveSessions = completed.filter(
    (session) =>
      ["older-low-vision", "motion-sound-sensitive"].includes(
        session.segment
      )
  ).length;
  const tactileAggregate = aggregateTactileSessions(sessions);

  const counts = {
    completedSessions: completed.length,
    protocolCompleteSessions,
    casualPuzzleSessions: countBySegment(
      completed,
      "casual-puzzle"
    ),
    experiencedPuzzleSessions: countBySegment(
      completed,
      "experienced-puzzle"
    ),
    casualNonPuzzleSessions: countBySegment(
      completed,
      "casual-non-puzzle"
    ),
    accessibilityPerspectiveSessions,
    lowEndSessions: completed.filter(
      (session) => session.deviceTier === "low-end"
    ).length,
    soundTestedSessions: tactileAggregate.soundTestedSessions,
    hapticsTestedSessions: tactileAggregate.hapticsTestedSessions,
    blockedEligibleSessions: tactileAggregate.blockedEligibleSessions,
    rotationEligibleSessions: tactileAggregate.rotationEligibleSessions
  };

  const checks = {
    enoughCompleted:
      counts.completedSessions >=
      requirements.minimumCompletedSessions,
    enoughProtocolComplete:
      counts.protocolCompleteSessions >=
      requirements.minimumProtocolCompleteSessions,
    casualPuzzleCovered:
      counts.casualPuzzleSessions >=
      requirements.minimumCasualPuzzleSessions,
    experiencedPuzzleCovered:
      counts.experiencedPuzzleSessions >=
      requirements.minimumExperiencedPuzzleSessions,
    casualNonPuzzleCovered:
      counts.casualNonPuzzleSessions >=
      requirements.minimumCasualNonPuzzleSessions,
    accessibilityPerspectiveCovered:
      counts.accessibilityPerspectiveSessions >=
      requirements.minimumAccessibilityPerspectiveSessions,
    lowEndCovered:
      counts.lowEndSessions >=
      requirements.minimumLowEndSessions,
    soundCovered:
      counts.soundTestedSessions >=
      requirements.minimumSoundTestedSessions,
    hapticsCovered:
      counts.hapticsTestedSessions >=
      requirements.minimumHapticsTestedSessions,
    blockedPathCovered:
      counts.blockedEligibleSessions >=
      requirements.minimumBlockedEligibleSessions,
    rotationCovered:
      counts.rotationEligibleSessions >=
      requirements.minimumRotationEligibleSessions
  };

  return {
    requirements,
    counts,
    checks,
    complete: Object.values(checks).every(Boolean),
    protocolStatuses
  };
}

function missingCoverageReasons(coverage) {
  const labels = {
    enoughCompleted: "Complete at least eight sessions.",
    enoughProtocolComplete:
      "At least eight sessions must contain enough timing, frame, and survey evidence.",
    casualPuzzleCovered:
      "Include at least four casual puzzle players.",
    experiencedPuzzleCovered:
      "Include at least one experienced puzzle player.",
    casualNonPuzzleCovered:
      "Include at least one casual non-puzzle player.",
    accessibilityPerspectiveCovered:
      "Include at least one older, low-vision, motion-sensitive, sound-sensitive, or haptic-sensitive participant.",
    lowEndCovered:
      "Include at least one completed low-end-phone session.",
    soundCovered:
      "Test enabled sound in at least three sessions.",
    hapticsCovered:
      "Test haptics on at least three compatible devices.",
    blockedPathCovered:
      "Collect at least three sessions where blocked-path feedback can be evaluated.",
    rotationCovered:
      "Collect at least three sessions that reach the neighbor-rotation learning point."
  };

  return Object.entries(coverage.checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => labels[key]);
}

export function evaluateFieldReadiness(
  sessions = [],
  requirements = FIELD_REQUIREMENTS
) {
  const tactileAggregate = aggregateTactileSessions(sessions);
  const tactileEvaluation = evaluateTactileReadiness(
    tactileAggregate
  );
  const coverage = aggregateFieldCoverage(
    sessions,
    requirements
  );

  if (!coverage.complete) {
    return {
      decision: "NOT ENOUGH EVIDENCE",
      passed: false,
      reasons: missingCoverageReasons(coverage),
      coverage,
      tactileAggregate,
      tactileEvaluation
    };
  }

  return {
    ...tactileEvaluation,
    coverage,
    tactileAggregate,
    tactileEvaluation
  };
}

export function nextParticipantRecommendations(
  sessions = [],
  requirements = FIELD_REQUIREMENTS
) {
  const coverage = aggregateFieldCoverage(
    sessions,
    requirements
  );
  const suggestions = [];

  if (!coverage.checks.casualPuzzleCovered) {
    suggestions.push("Recruit another casual puzzle player.");
  }
  if (!coverage.checks.experiencedPuzzleCovered) {
    suggestions.push("Recruit an experienced puzzle player.");
  }
  if (!coverage.checks.casualNonPuzzleCovered) {
    suggestions.push("Recruit a casual player who rarely plays puzzles.");
  }
  if (!coverage.checks.accessibilityPerspectiveCovered) {
    suggestions.push(
      "Recruit an older, low-vision, motion-sensitive, sound-sensitive, or haptic-sensitive participant."
    );
  }
  if (!coverage.checks.lowEndCovered) {
    suggestions.push("Recruit a participant using a low-end or older Android phone.");
  }
  if (!coverage.checks.soundCovered) {
    suggestions.push("Ensure the next session tests enabled sound.");
  }
  if (!coverage.checks.hapticsCovered) {
    suggestions.push("Use a vibration-capable phone and test haptics.");
  }
  if (!coverage.checks.blockedPathCovered) {
    suggestions.push("Continue until blocked-path feedback is encountered naturally.");
  }
  if (!coverage.checks.rotationCovered) {
    suggestions.push("Continue through Level 3 to evaluate rotation learning.");
  }
  if (suggestions.length === 0) {
    suggestions.push(
      "The sample coverage is complete. Review the product-readiness decision."
    );
  }

  return suggestions;
}
