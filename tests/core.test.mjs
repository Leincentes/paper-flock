import test from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY,
  applyMove,
  boardStatus,
  countBirds,
  createDailyLevel,
  createLevel,
  findSolution,
  generateSolvableBoard,
  getLegalMoves,
  isPathClear,
  levelDefinition,
  tracePath
} from "../src/game-core.js";
import {
  dailySeed,
  isDailyUnlocked,
  localDateKey,
} from "../src/progress-core.js";
import {
  calculateFeathers,
  currentFeatherPotential,
  featherText,
  isThemeUnlocked,
  nextThemeUnlock,
  normalizeFeatherMap,
  totalFeathers,
  trimFeatherRecords,
  unlockedThemes,
  updateFeatherRecord
} from "../src/mastery-core.js";


import {
  DEFAULT_ONBOARDING,
  adaptivePuzzleInstruction,
  effectsLabel,
  feedbackMessage,
  hapticPattern,
  nextEffectsPreference,
  normalizeOnboarding,
  recordOnboardingEvent,
  resolveEffectsMode
} from "../src/experience-core.js";
import {
  analyzeLevel,
  analyzeOpeningMoves,
  analyzeSolutionBranching
} from "../src/level-quality-core.js";

test("path checks stop at occupied cells", () => {
  const board = [
    [1, EMPTY, 3],
    [EMPTY, EMPTY, EMPTY],
    [EMPTY, EMPTY, EMPTY]
  ];
  assert.equal(isPathClear(board, 0, 0, 1), false);
  assert.equal(isPathClear(board, 0, 2, 3), false);
});

test("a legal escape removes the bird and rotates orthogonal neighbors", () => {
  const board = [
    [EMPTY, 2, EMPTY],
    [0, 1, EMPTY],
    [EMPTY, 3, EMPTY]
  ];
  const result = applyMove(board, 1, 1);
  assert.equal(result.ok, true);
  assert.equal(result.board[1][1], EMPTY);
  assert.equal(result.board[0][1], 3);
  assert.equal(result.board[1][0], 1);
  assert.equal(result.board[2][1], 0);
  assert.equal(result.rotated.length, 3);
});

test("a blocked escape leaves the board unchanged", () => {
  const board = [
    [1, EMPTY, 0],
    [EMPTY, EMPTY, EMPTY],
    [EMPTY, EMPTY, EMPTY]
  ];
  const result = applyMove(board, 0, 0);
  assert.equal(result.ok, false);
  assert.deepEqual(result.board, board);
});

test("all 20 v0.4 campaign levels have a valid complete solution", () => {
  for (let levelNumber = 1; levelNumber <= 20; levelNumber += 1) {
    const level = createLevel(levelNumber);
    let board = level.board.map((row) => [...row]);

    assert.equal(countBirds(board), level.targetBirds);
    assert.ok(getLegalMoves(board).length > 0);

    for (const move of level.solution) {
      const result = applyMove(board, move.row, move.col);
      assert.equal(
        result.ok,
        true,
        `Level ${levelNumber} solution move was unexpectedly blocked.`
      );
      board = result.board;
    }

    assert.equal(boardStatus(board), "complete");
    assert.equal(countBirds(board), 0);
  }
});

test("tutorial level 1 has exactly one opening move", () => {
  assert.equal(getLegalMoves(createLevel(1).board).length, 1);
});

test("tutorial level 2 demonstrates two neighbor rotations", () => {
  const level = createLevel(2);
  const opening = getLegalMoves(level.board);
  assert.equal(opening.length, 1);
  const result = applyMove(level.board, opening[0].row, opening[0].col);
  assert.equal(result.rotated.length, 2);
});

test("tutorial level 3 begins with a forced two-move chain", () => {
  let board = createLevel(3).board;
  for (let step = 0; step < 2; step += 1) {
    const moves = getLegalMoves(board);
    assert.equal(moves.length, 1);
    board = applyMove(board, moves[0].row, moves[0].col).board;
  }
});

test("tutorial level 4 contains one immediate dead end and one safe opening", () => {
  const board = createLevel(4).board;
  const openings = getLegalMoves(board);
  assert.equal(openings.length, 2);

  const outcomes = openings.map((move) => {
    const after = applyMove(board, move.row, move.col).board;
    return {
      deadlock: boardStatus(after) === "deadlock",
      solvable: Boolean(findSolution(after, { nodeLimit: 50000 }).solution)
    };
  });

  assert.equal(outcomes.filter((outcome) => outcome.deadlock).length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.solvable).length, 1);
});

test("tutorial level 5 has multiple safe opening choices", () => {
  const board = createLevel(5).board;
  const openings = getLegalMoves(board);
  assert.ok(openings.length >= 2);

  for (const move of openings) {
    const after = applyMove(board, move.row, move.col).board;
    assert.ok(findSolution(after, { nodeLimit: 50000 }).solution);
  }
});

test("the mobile board never exceeds five by five", () => {
  for (let levelNumber = 1; levelNumber <= 20; levelNumber += 1) {
    const definition = levelDefinition(levelNumber);
    assert.ok(definition.size <= 5);
    assert.ok(definition.targetBirds <= definition.size ** 2);
  }
});

test("generator rejects invalid requested density", () => {
  assert.throws(() => generateSolvableBoard(3, 10, 1));
});

test("safe hints lead toward a complete solution on every v0.4 campaign level", () => {
  for (let levelNumber = 1; levelNumber <= 20; levelNumber += 1) {
    const level = createLevel(levelNumber);
    const result = findSolution(level.board, { nodeLimit: 150000 });
    assert.equal(
      result.exhausted,
      false,
      `Solver exhausted on level ${levelNumber}.`
    );
    assert.ok(result.solution, `No safe solution found for level ${levelNumber}.`);
    assert.equal(result.solution.length, level.targetBirds);
  }
});


test("daily puzzles are deterministic for the same date", () => {
  const first = createDailyLevel("2026-06-19");
  const second = createDailyLevel("2026-06-19");
  assert.deepEqual(first.board, second.board);
  assert.equal(first.seed, second.seed);
});

test("365 daily puzzles are unique, solvable, and within the solver budget", () => {
  const boards = new Set();

  for (let day = 1; day <= 365; day += 1) {
    const date = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
    const level = createDailyLevel(date);
    const encoded = level.board.map((row) => row.join(",")).join(";");
    boards.add(encoded);

    const result = findSolution(level.board, { nodeLimit: 150000 });
    assert.equal(result.exhausted, false, `Solver exhausted for ${date}.`);
    assert.ok(result.solution, `No solution found for ${date}.`);
    assert.equal(result.solution.length, level.targetBirds);
  }

  assert.equal(boards.size, 365);
});



test("daily unlock and local date helpers are predictable", () => {
  assert.equal(isDailyUnlocked(5), false);
  assert.equal(isDailyUnlocked(6), true);
  assert.equal(localDateKey(new Date(2026, 5, 19, 12, 0, 0)), "2026-06-19");
  assert.equal(dailySeed("2026-06-19"), dailySeed("2026-06-19"));
  assert.throws(() => dailySeed("June 19"));
});


import {
  aggregateSessions,
  appendSessionEvent,
  completeResearchSession,
  createResearchSession,
  isValidParticipantCode,
  normalizeParticipantCode,
  sessionsToCsv,
  summarizeEvents
} from "../src/research-core.js";

test("participant codes are normalized and validated without collecting identity", () => {
  assert.equal(normalizeParticipantCode(" r3 01 "), "R3-01");
  assert.equal(isValidParticipantCode("R3-01"), true);
  assert.equal(isValidParticipantCode("A"), false);
  assert.equal(isValidParticipantCode("real person@example.com"), false);
});

test("research sessions summarize observed game behavior", () => {
  let session = createResearchSession({
    participantCode: "R3-01",
    segment: "casual-puzzle",
    sessionId: "session-1",
    startedAt: "2026-06-19T00:00:00.000Z"
  });

  const events = [
    { name: "bird_escape", elapsedMs: 12000, occurredAt: "2026-06-19T00:00:12.000Z", mode: "campaign", level: 1 },
    ...[1, 2, 3, 4, 5].map((level, index) => ({
      name: "puzzle_complete",
      elapsedMs: 20000 + index * 10000,
      occurredAt: `2026-06-19T00:00:${20 + index * 10}.000Z`,
      mode: "campaign",
      level,
      newBestFeathers: true, bestFeathers: 3
    })),
    { name: "level_map_opened", elapsedMs: 72000, occurredAt: "2026-06-19T00:01:12.000Z", mode: "campaign", level: 5 },
    { name: "map_level_selected", elapsedMs: 74000, occurredAt: "2026-06-19T00:01:14.000Z", mode: "campaign", level: 5 },
    { name: "replay_started", elapsedMs: 76000, occurredAt: "2026-06-19T00:01:16.000Z", mode: "campaign", level: 3 },
    { name: "daily_invitation_opened", elapsedMs: 80000, occurredAt: "2026-06-19T00:01:20.000Z", mode: "campaign", level: 5 },
    { name: "daily_started", elapsedMs: 82000, occurredAt: "2026-06-19T00:01:22.000Z", mode: "daily", level: null }
  ];

  for (const event of events) {
    session = appendSessionEvent(session, event);
  }

  const summary = summarizeEvents(session.events);
  assert.equal(summary.completedFirstFive, true);
  assert.equal(summary.highestCampaignLevelCompleted, 5);
  assert.equal(summary.levelSelectedFromMap, true);
  assert.equal(summary.voluntaryReplay, true);
  assert.equal(summary.dailyStarted, true);
  assert.equal(summary.firstEscapeMs, 12000);
});

test("completed research sessions retain answers and calculated evidence", () => {
  let session = createResearchSession({
    participantCode: "R3-02",
    segment: "experienced-puzzle",
    sessionId: "session-2",
    startedAt: "2026-06-19T00:00:00.000Z"
  });
  session = appendSessionEvent(session, {
    name: "puzzle_complete",
    occurredAt: "2026-06-19T00:01:00.000Z",
    elapsedMs: 60000,
    mode: "campaign",
    level: 1,
    newBestFeathers: true, bestFeathers: 3
  });

  const completed = completeResearchSession(session, {
    endedAt: "2026-06-19T00:02:00.000Z",
    responses: {
      featherMeaning: "How cleanly I solved the flock",
      featherEffect: "wanted-to-replay",
      dailyOptionalRequired: "optional"
    }
  });

  assert.equal(completed.status, "complete");
  assert.equal(completed.summary.highestCampaignLevelCompleted, 1);
  assert.equal(completed.responses.dailyOptionalRequired, "optional");
});

test("research CSV safely escapes free-text responses", () => {
  const session = {
    participantCode: "R3-03",
    segment: "other",
    status: "complete",
    startedAt: "2026-06-19T00:00:00.000Z",
    endedAt: "2026-06-19T00:03:00.000Z",
    events: [],
    summary: summarizeEvents([]),
    responses: {
      featherMeaning: 'My "feathers", not a target',
      additionalComments: "Line one\nLine two"
    }
  };
  const csv = sessionsToCsv([session]);
  assert.match(csv, /"My ""feathers"", not a target"/);
  assert.match(csv, /"Line one\nLine two"/);
});

test("aggregate research metrics use only completed sessions", () => {
  const baseSummary = {
    ...summarizeEvents([]),
    completedFirstFive: true,
    levelSelectedFromMap: true,
    dailyInvitationOpened: true,
    dailyStarted: false,
    voluntaryReplay: true
  };
  const aggregate = aggregateSessions([
    { status: "complete", summary: baseSummary, responses: {} },
    { status: "active", summary: { ...baseSummary, dailyStarted: true }, responses: {} }
  ]);

  assert.equal(aggregate.totalSessions, 2);
  assert.equal(aggregate.completedSessions, 1);
  assert.equal(aggregate.completedFirstFiveRate, 1);
  assert.equal(aggregate.dailyStartRate, 0);
  assert.equal(aggregate.voluntaryReplayRate, 1);
});


test("feather awards reward completion, independence, and planning transparently", () => {
  assert.equal(calculateFeathers({ completed: false }), 0);
  assert.equal(calculateFeathers({}), 3);
  assert.equal(calculateFeathers({ hintsUsed: 1 }), 1);
  assert.equal(calculateFeathers({ restarts: 1 }), 2);
  assert.equal(calculateFeathers({ deadlocks: 1 }), 2);
  assert.equal(
    currentFeatherPotential({ hintsUsed: 0, restarts: 0, deadlocks: 0 }),
    3
  );
});

test("feather records only improve and never decrease", () => {
  let result = updateFeatherRecord({}, "6", 1);
  assert.equal(result.improved, true);
  assert.equal(result.best, 1);

  result = updateFeatherRecord(result.records, "6", 3);
  assert.equal(result.improved, true);
  assert.equal(result.previousBest, 1);
  assert.equal(result.best, 3);

  result = updateFeatherRecord(result.records, "6", 2);
  assert.equal(result.improved, false);
  assert.equal(result.best, 3);
});

test("feather maps reject invalid values and total valid records", () => {
  const normalized = normalizeFeatherMap({
    1: 3,
    2: 0,
    3: 4,
    4: 2,
    bad: "3"
  });
  assert.deepEqual(normalized, { 1: 3, 4: 2 });
  assert.equal(totalFeathers(normalized), 5);
  assert.equal(featherText(2), "◆◆◇");
});

test("paper themes unlock only at transparent campaign milestones", () => {
  assert.deepEqual(
    unlockedThemes([]).map((theme) => theme.id),
    ["dawn"]
  );
  assert.equal(isThemeUnlocked("meadow", [1, 2, 3, 4]), false);
  assert.equal(isThemeUnlocked("meadow", [1, 2, 3, 4, 5]), true);
  assert.equal(nextThemeUnlock([1, 2, 3, 4, 5]).id, "twilight");
  assert.equal(
    unlockedThemes(Array.from({ length: 20 }, (_, index) => index + 1)).length,
    5
  );
});

test("daily feather history retains only the newest requested entries", () => {
  const records = {};
  for (let day = 1; day <= 40; day += 1) {
    records[`2026-05-${String(day).padStart(2, "0")}`] = (day % 3) + 1;
  }
  const trimmed = trimFeatherRecords(records, 31);
  assert.equal(Object.keys(trimmed).length, 31);
});


import {
  aggregateVisualSessions,
  appendVisualEvent,
  completeVisualExposure,
  completeVisualSession,
  createVisualSession,
  evaluateVisualReadiness,
  isValidVisualParticipantCode,
  normalizeVisualParticipantCode,
  startVisualExposure,
  submitVisualRecall,
  summarizeVisualSession,
  visualSessionsToCsv
} from "../src/visual-test-core.js";

function createCompletedVisualSession(index, overrides = {}) {
  let session = createVisualSession({
    participantCode: `VA-${String(index).padStart(2, "0")}`,
    segment: "casual-puzzle",
    sessionId: `visual-session-${index}`,
    startedAt: "2026-06-19T00:00:00.000Z"
  });
  session = startVisualExposure(
    session,
    "2026-06-19T00:00:01.000Z"
  );
  session = completeVisualExposure(
    session,
    "2026-06-19T00:00:06.000Z"
  );
  session = submitVisualRecall(
    session,
    {
      productType: "puzzle-game",
      pieceIdentity: "origami-birds",
      rememberedElements: "paper birds and a sky",
      mood: "calm",
      firstTap: "a bird",
      finishImpression: "distinctive-finished",
      ...(overrides.recall ?? {})
    },
    "2026-06-19T00:00:20.000Z"
  );

  for (let level = 1; level <= 5; level += 1) {
    session = appendVisualEvent(session, {
      name: "puzzle_complete",
      mode: "campaign",
      level,
      feathersEarned: 3,
      occurredAt: `2026-06-19T00:0${level}:00.000Z`,
      elapsedMs: level * 60000
    });
  }
  session = appendVisualEvent(session, {
    name: "replay_started",
    mode: "campaign",
    level: 2,
    occurredAt: "2026-06-19T00:06:00.000Z",
    elapsedMs: 360000
  });
  session = appendVisualEvent(session, {
    name: "theme_selected",
    themeId: "meadow",
    occurredAt: "2026-06-19T00:06:15.000Z",
    elapsedMs: 375000
  });

  return completeVisualSession(session, {
    endedAt: "2026-06-19T00:10:00.000Z",
    responses: {
      visualAppeal: "5",
      pieceIdentityAfterPlay: "origami-birds",
      directionUnderstanding: "clear",
      featherMeaning: "mastery",
      featherFeeling: "motivating",
      replayIntent: "already-replayed",
      themeUnderstanding: "cosmetic",
      textReadability: "easy",
      motionComfort: "comfortable",
      criticalDefect: false,
      criticalDefectDescription: "",
      additionalComments: "",
      ...(overrides.responses ?? {})
    }
  });
}

test("visual participant codes are anonymous and validated", () => {
  assert.equal(normalizeVisualParticipantCode(" va 01 "), "VA-01");
  assert.equal(isValidVisualParticipantCode("VA-01"), true);
  assert.equal(isValidVisualParticipantCode("A"), false);
  assert.equal(
    isValidVisualParticipantCode("person@example.com"),
    false
  );
});

test("five-second visual sessions preserve separate exposure and play phases", () => {
  let session = createVisualSession({
    participantCode: "VA-01",
    segment: "casual-puzzle",
    sessionId: "visual-1",
    startedAt: "2026-06-19T00:00:00.000Z"
  });
  session = startVisualExposure(
    session,
    "2026-06-19T00:00:01.000Z"
  );
  session = completeVisualExposure(
    session,
    "2026-06-19T00:00:06.000Z"
  );
  session = submitVisualRecall(
    session,
    { productType: "puzzle-game" },
    "2026-06-19T00:00:15.000Z"
  );

  assert.equal(session.phase, "play");
  assert.equal(session.exposureStartedAt, "2026-06-19T00:00:01.000Z");
  assert.equal(session.exposureEndedAt, "2026-06-19T00:00:06.000Z");
  assert.equal(session.recall.productType, "puzzle-game");
});

test("visual session summaries separate observed behavior from opinions", () => {
  const session = createCompletedVisualSession(1);
  const summary = summarizeVisualSession(session);

  assert.equal(summary.completedFirstFive, true);
  assert.equal(summary.highestCampaignLevelCompleted, 5);
  assert.equal(summary.voluntaryReplay, true);
  assert.equal(summary.themeSelectionCount, 1);
  assert.equal(summary.maximumFeathersEarned, 3);
});

test("ten strong real-session-shaped records produce the closed-alpha decision", () => {
  const sessions = Array.from(
    { length: 10 },
    (_, index) => createCompletedVisualSession(index + 1)
  );
  const aggregate = aggregateVisualSessions(sessions);
  const evaluation = evaluateVisualReadiness(aggregate);

  assert.equal(aggregate.completedSessions, 10);
  assert.equal(aggregate.visualAppeal4PlusRate, 1);
  assert.equal(aggregate.themeSelectionRate, 1);
  assert.equal(evaluation.decision, "READY FOR CLOSED ALPHA");
  assert.equal(evaluation.passed, true);
});

test("insufficient visual sessions cannot produce a release decision", () => {
  const sessions = Array.from(
    { length: 5 },
    (_, index) => createCompletedVisualSession(index + 1)
  );
  const evaluation = evaluateVisualReadiness(
    aggregateVisualSessions(sessions)
  );
  assert.equal(evaluation.decision, "NOT ENOUGH EVIDENCE");
});

test("low visual recognition triggers visual redesign", () => {
  const sessions = Array.from({ length: 10 }, (_, index) =>
    createCompletedVisualSession(index + 1, {
      recall: {
        productType: "website",
        pieceIdentity: "arrows"
      },
      responses: {
        visualAppeal: "2"
      }
    })
  );
  const evaluation = evaluateVisualReadiness(
    aggregateVisualSessions(sessions)
  );
  assert.equal(evaluation.decision, "REDESIGN VISUAL IDENTITY");
});

test("confusing or pressuring feathers trigger feather redesign", () => {
  const sessions = Array.from({ length: 10 }, (_, index) =>
    createCompletedVisualSession(index + 1, {
      responses: {
        featherMeaning: "unsure",
        featherFeeling: "pressured"
      }
    })
  );
  const evaluation = evaluateVisualReadiness(
    aggregateVisualSessions(sessions)
  );
  assert.equal(
    evaluation.decision,
    "REMOVE OR REDESIGN FEATHERS"
  );
});

test("visual CSV safely escapes recall and survey text", () => {
  const session = createCompletedVisualSession(1, {
    recall: {
      rememberedElements: 'Birds, "paper", sky'
    },
    responses: {
      additionalComments: "First line\nSecond line"
    }
  });
  const csv = visualSessionsToCsv([session]);

  assert.match(csv, /"Birds, ""paper"", sky"/);
  assert.match(csv, /"First line\nSecond line"/);
});


test("path traces identify the exact blocking bird", () => {
  const board = [
    [1, EMPTY, 0],
    [EMPTY, EMPTY, EMPTY],
    [EMPTY, EMPTY, EMPTY]
  ];
  const trace = tracePath(board, 0, 0, 1);
  assert.deepEqual(trace.blocker, { row: 0, col: 2 });
  assert.equal(trace.cells.length, 2);
  assert.equal(trace.cells[0].occupied, false);
  assert.equal(trace.cells[1].occupied, true);
  assert.equal(trace.exitsBoard, false);
});

test("clear path traces reach the edge without a blocker", () => {
  const board = [
    [1, EMPTY, EMPTY],
    [EMPTY, EMPTY, EMPTY],
    [EMPTY, EMPTY, EMPTY]
  ];
  const trace = tracePath(board, 0, 0, 1);
  assert.equal(trace.blocker, null);
  assert.equal(trace.cells.length, 2);
  assert.equal(trace.exitsBoard, true);
});

test("effects auto mode protects reduced-motion and lower-end devices", () => {
  assert.equal(
    resolveEffectsMode({
      preference: "auto",
      reducedMotion: true,
      deviceMemory: 8,
      hardwareConcurrency: 8
    }),
    "minimal"
  );
  assert.equal(
    resolveEffectsMode({
      preference: "auto",
      deviceMemory: 4,
      hardwareConcurrency: 8
    }),
    "lite"
  );
  assert.equal(
    resolveEffectsMode({
      preference: "auto",
      deviceMemory: 8,
      hardwareConcurrency: 8
    }),
    "full"
  );
  assert.equal(
    resolveEffectsMode({
      preference: "lite",
      deviceMemory: 8,
      hardwareConcurrency: 8
    }),
    "lite"
  );
});

test("effects preferences cycle predictably and remain understandable", () => {
  assert.equal(nextEffectsPreference("auto"), "full");
  assert.equal(nextEffectsPreference("full"), "lite");
  assert.equal(nextEffectsPreference("lite"), "minimal");
  assert.equal(nextEffectsPreference("minimal"), "auto");
  assert.equal(effectsLabel("auto", "lite"), "Effects auto · lite");
});

test("adaptive onboarding retires repeated instructions after demonstrated skill", () => {
  let onboarding = normalizeOnboarding(DEFAULT_ONBOARDING);
  assert.match(
    adaptivePuzzleInstruction({
      onboarding,
      levelInstruction: "Tap the only clear bird.",
      levelNumber: 1
    }),
    /Tap the only/
  );

  onboarding = recordOnboardingEvent(
    onboarding,
    "successful_escape",
    { rotatedBirds: 2 }
  );
  onboarding = recordOnboardingEvent(
    onboarding,
    "successful_escape",
    { rotatedBirds: 0 }
  );

  assert.equal(
    adaptivePuzzleInstruction({
      onboarding,
      levelInstruction: "Long tutorial text",
      levelNumber: 3
    }),
    "Read the beaks, predict the folds, and free the flock."
  );
});

test("adaptive feedback explains penalties once, then becomes concise", () => {
  const fresh = normalizeOnboarding(DEFAULT_ONBOARDING);
  assert.match(
    feedbackMessage({ kind: "hint", onboarding: fresh }),
    /one feather/
  );

  const experienced = recordOnboardingEvent(
    fresh,
    "hint_penalty_explained"
  );
  assert.equal(
    feedbackMessage({ kind: "hint", onboarding: experienced }),
    "The glow marks a verified safe bird."
  );

  assert.ok(hapticPattern("complete", 3).length >
    hapticPattern("complete", 1).length);
});

test("all campaign levels have safe openings and fit the analysis budget", () => {
  for (let levelNumber = 1; levelNumber <= 20; levelNumber += 1) {
    const level = createLevel(levelNumber);
    const metrics = analyzeLevel(level, { nodeLimit: 300000 });
    assert.equal(metrics.solvable, true, `Level ${levelNumber}`);
    assert.ok(metrics.openingMoves > 0, `Level ${levelNumber}`);
    assert.ok(metrics.safeOpenings > 0, `Level ${levelNumber}`);
    assert.equal(
      metrics.flags.includes("no-safe-opening"),
      false,
      `Level ${levelNumber}`
    );
    assert.equal(
      metrics.flags.includes("solver-budget-risk"),
      false,
      `Level ${levelNumber}`
    );
  }
});

test("quality analysis exposes opening traps and solution branching", () => {
  const level = createLevel(4);
  const opening = analyzeOpeningMoves(level.board);
  const branching = analyzeSolutionBranching(
    level.board,
    level.solution
  );
  assert.equal(opening.openingMoves, 2);
  assert.equal(opening.safeOpenings, 1);
  assert.equal(opening.immediateDeadEnds, 1);
  assert.ok(branching.legalCounts.length > 0);
  assert.ok(branching.peakLegalChoices >= 1);
});
