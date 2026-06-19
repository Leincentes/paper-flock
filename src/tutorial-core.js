import {
  EMPTY,
  applyMove,
  boardStatus,
  cloneBoard,
  findSolution,
  tracePath
} from "./game-core.js";

export const TUTORIAL_SCHEMA_VERSION = 1;

export const TUTORIAL_STEP_IDS = Object.freeze([
  "welcome",
  "escape",
  "blocked",
  "rotation",
  "practice"
]);

const BOARDS = Object.freeze({
  escape: Object.freeze([
    Object.freeze([EMPTY, EMPTY, EMPTY]),
    Object.freeze([EMPTY, 1, EMPTY]),
    Object.freeze([EMPTY, EMPTY, EMPTY])
  ]),
  blocked: Object.freeze([
    Object.freeze([EMPTY, EMPTY, EMPTY]),
    Object.freeze([1, EMPTY, 3]),
    Object.freeze([EMPTY, EMPTY, EMPTY])
  ]),
  rotation: Object.freeze([
    Object.freeze([EMPTY, EMPTY, EMPTY]),
    Object.freeze([3, 0, EMPTY]),
    Object.freeze([EMPTY, EMPTY, EMPTY])
  ]),
  practice: Object.freeze([
    Object.freeze([EMPTY, EMPTY, EMPTY]),
    Object.freeze([0, 1, 3]),
    Object.freeze([EMPTY, EMPTY, EMPTY])
  ])
});

export const TUTORIAL_STEPS = Object.freeze({
  welcome: Object.freeze({
    id: "welcome",
    number: 1,
    title: "Welcome to Paper Flock",
    instruction:
      "Free every origami bird. Each beak shows the direction it wants to fly.",
    success: "",
    board: null,
    target: null
  }),
  escape: Object.freeze({
    id: "escape",
    number: 2,
    title: "Find a clear path",
    instruction:
      "Tap the highlighted bird. Its beak points right and nothing blocks the edge.",
    success: "Clear path found. The bird flies away.",
    board: BOARDS.escape,
    target: Object.freeze({ row: 1, col: 1 })
  }),
  blocked: Object.freeze({
    id: "blocked",
    number: 3,
    title: "Notice a blocked path",
    instruction:
      "Tap the highlighted left bird. Another bird is standing in its flight path.",
    success:
      "Blocked birds stay on the paper until the bird in their path moves.",
    board: BOARDS.blocked,
    target: Object.freeze({ row: 1, col: 0 })
  }),
  rotation: Object.freeze({
    id: "rotation",
    number: 4,
    title: "Watch touching birds turn",
    instruction:
      "Tap the highlighted left bird. When it escapes, the touching bird folds clockwise.",
    success:
      "The neighboring bird turned clockwise. Its new beak direction changes the puzzle.",
    board: BOARDS.rotation,
    target: Object.freeze({ row: 1, col: 0 })
  }),
  practice: Object.freeze({
    id: "practice",
    number: 5,
    title: "Free a tiny flock",
    instruction:
      "Use what you learned. Free all three birds. A hint is available if you need it.",
    success: "Practice complete. You are ready for the journey.",
    board: BOARDS.practice,
    target: null
  })
});

function cleanText(value, maximum = 120) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maximum);
}

export function normalizeTutorialProgress(value = {}) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  const status = ["unseen", "active", "completed", "skipped"].includes(
    source.status
  )
    ? source.status
    : "unseen";
  const lastStepId = TUTORIAL_STEP_IDS.includes(source.lastStepId)
    ? source.lastStepId
    : "welcome";

  return {
    schemaVersion: TUTORIAL_SCHEMA_VERSION,
    status,
    lastStepId,
    startedAt: cleanText(source.startedAt, 40),
    completedAt: cleanText(source.completedAt, 40),
    skippedAt: cleanText(source.skippedAt, 40),
    replayCount: Math.max(
      0,
      Number.isInteger(source.replayCount)
        ? source.replayCount
        : 0
    )
  };
}

export function shouldLaunchTutorial({
  progress = {},
  hasExistingSave = false,
  force = false,
  bypass = false
} = {}) {
  if (force) {
    return true;
  }
  if (bypass) {
    return false;
  }

  const normalized = normalizeTutorialProgress(progress);
  if (
    normalized.status === "completed" ||
    normalized.status === "skipped"
  ) {
    return false;
  }

  return !hasExistingSave || normalized.status === "active";
}

export function startTutorialProgress(
  progress = {},
  {
    replay = false,
    startedAt = new Date().toISOString()
  } = {}
) {
  const normalized = normalizeTutorialProgress(progress);
  return {
    ...normalized,
    status: "active",
    lastStepId: "welcome",
    startedAt: String(startedAt),
    completedAt: "",
    skippedAt: "",
    replayCount:
      normalized.replayCount + (replay ? 1 : 0)
  };
}

export function completeTutorialProgress(
  progress = {},
  {
    completedAt = new Date().toISOString()
  } = {}
) {
  const normalized = normalizeTutorialProgress(progress);
  return {
    ...normalized,
    status: "completed",
    lastStepId: "practice",
    completedAt: String(completedAt),
    skippedAt: ""
  };
}

export function skipTutorialProgress(
  progress = {},
  {
    skippedAt = new Date().toISOString()
  } = {}
) {
  const normalized = normalizeTutorialProgress(progress);
  if (normalized.status === "completed") {
    return normalized;
  }
  return {
    ...normalized,
    status: "skipped",
    skippedAt: String(skippedAt)
  };
}

export function createTutorialSession(stepId = "welcome") {
  const id = TUTORIAL_STEP_IDS.includes(stepId)
    ? stepId
    : "welcome";
  const step = TUTORIAL_STEPS[id];

  return {
    stepId: id,
    board: step.board ? cloneBoard(step.board) : null,
    stepComplete: false,
    practiceComplete: false,
    deadlocked: false,
    moves: 0,
    feedback: step.instruction,
    lastTrace: null,
    rotated: []
  };
}

export function nextTutorialStepId(stepId) {
  const index = TUTORIAL_STEP_IDS.indexOf(stepId);
  if (index < 0 || index >= TUTORIAL_STEP_IDS.length - 1) {
    return null;
  }
  return TUTORIAL_STEP_IDS[index + 1];
}

export function advanceTutorialSession(session = {}) {
  const nextId = nextTutorialStepId(session.stepId);
  return nextId ? createTutorialSession(nextId) : null;
}

export function tutorialHint(session = {}) {
  const step = TUTORIAL_STEPS[session.stepId];
  if (!step) {
    return null;
  }
  if (step.target) {
    return { ...step.target };
  }
  if (session.stepId !== "practice" || !session.board) {
    return null;
  }

  const result = findSolution(session.board, {
    nodeLimit: 50000
  });
  return result.solution?.[0]
    ? {
        row: result.solution[0].row,
        col: result.solution[0].col
      }
    : null;
}

export function applyTutorialAction(
  session = {},
  row,
  col
) {
  const step = TUTORIAL_STEPS[session.stepId];
  if (!step || !Array.isArray(session.board)) {
    return {
      ...session,
      accepted: false,
      feedback: "Start the tutorial to continue."
    };
  }

  const target = step.target;
  if (
    target &&
    (row !== target.row || col !== target.col)
  ) {
    return {
      ...session,
      accepted: false,
      feedback: "Try the highlighted bird."
    };
  }

  if (session.stepId === "blocked") {
    const direction = session.board[row]?.[col] ?? EMPTY;
    const trace = tracePath(
      session.board,
      row,
      col,
      direction
    );
    return {
      ...session,
      accepted: true,
      stepComplete: Boolean(trace.blocker),
      feedback: trace.blocker
        ? step.success
        : "That path is clear. Try the highlighted bird.",
      lastTrace: trace,
      rotated: []
    };
  }

  const result = applyMove(session.board, row, col);
  if (!result.ok) {
    const direction = session.board[row]?.[col] ?? EMPTY;
    const trace = tracePath(
      session.board,
      row,
      col,
      direction
    );
    return {
      ...session,
      accepted: false,
      feedback:
        "That bird is blocked. Follow its beak to the bird in the way.",
      lastTrace: trace,
      rotated: []
    };
  }

  const status = boardStatus(result.board);
  if (session.stepId === "practice") {
    return {
      ...session,
      accepted: true,
      board: result.board,
      moves: Number(session.moves ?? 0) + 1,
      practiceComplete: status === "complete",
      stepComplete: status === "complete",
      deadlocked: status === "deadlock",
      feedback:
        status === "complete"
          ? step.success
          : status === "deadlock"
            ? "No clear paths remain. Restart the practice and try another order."
            : "Good move. Read the new beak directions.",
      lastTrace: null,
      rotated: result.rotated
    };
  }

  const rotationPassed =
    session.stepId !== "rotation" ||
    result.rotated.length > 0;

  return {
    ...session,
    accepted: rotationPassed,
    board: result.board,
    moves: Number(session.moves ?? 0) + 1,
    stepComplete: rotationPassed,
    feedback: rotationPassed
      ? step.success
      : "Try the highlighted bird beside another bird.",
    lastTrace: null,
    rotated: result.rotated
  };
}
