import {
  applyMove,
  countBirds,
  findSolution,
  getLegalMoves
} from "./game-core.js";

function average(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function analyzeOpeningMoves(board, nodeLimit = 150000) {
  const openings = getLegalMoves(board);
  const results = openings.map((move) => {
    const after = applyMove(board, move.row, move.col).board;
    const solved = findSolution(after, { nodeLimit });
    return {
      row: move.row,
      col: move.col,
      direction: move.direction,
      solvable: Boolean(solved.solution),
      exhausted: solved.exhausted,
      solverNodes: solved.visitedNodes
    };
  });

  return {
    openingMoves: openings.length,
    safeOpenings: results.filter((item) => item.solvable).length,
    immediateDeadEnds: results.filter(
      (item) => !item.solvable && !item.exhausted
    ).length,
    exhaustedOpenings: results.filter((item) => item.exhausted).length,
    openings: results
  };
}

export function analyzeSolutionBranching(board, solution) {
  let current = board.map((row) => [...row]);
  const legalCounts = [];

  for (const move of solution) {
    legalCounts.push(getLegalMoves(current).length);
    const result = applyMove(current, move.row, move.col);
    if (!result.ok) {
      throw new Error("Provided solution contains a blocked move.");
    }
    current = result.board;
  }

  return {
    legalCounts,
    averageLegalChoices: average(legalCounts),
    peakLegalChoices: legalCounts.length ? Math.max(...legalCounts) : 0,
    forcedSteps: legalCounts.filter((count) => count === 1).length,
    choiceSteps: legalCounts.filter((count) => count > 1).length
  };
}

export function classifyLevelQuality(metrics) {
  const trapRatio =
    metrics.openingMoves === 0
      ? 0
      : metrics.immediateDeadEnds / metrics.openingMoves;

  if (metrics.tutorial) {
    return "tutorial";
  }
  if (
    metrics.targetBirds <= 9 &&
    trapRatio <= 0.2 &&
    metrics.averageLegalChoices <= 3
  ) {
    return "gentle";
  }
  if (
    metrics.targetBirds <= 14 &&
    trapRatio <= 0.45 &&
    metrics.averageLegalChoices <= 4
  ) {
    return "steady";
  }
  if (
    trapRatio <= 0.65 &&
    metrics.peakLegalChoices <= 7
  ) {
    return "tricky";
  }
  return "expert";
}

export function qualityFlags(metrics) {
  const flags = [];

  if (metrics.openingMoves === 0) {
    flags.push("no-opening");
  }
  if (metrics.safeOpenings === 0) {
    flags.push("no-safe-opening");
  }
  if (
    metrics.openingMoves >= 3 &&
    metrics.immediateDeadEnds / metrics.openingMoves > 0.66
  ) {
    flags.push("opening-trap-heavy");
  } else if (
    !metrics.tutorial &&
    metrics.immediateDeadEnds > 0
  ) {
    flags.push("contains-opening-trap");
  }
  if (metrics.peakLegalChoices >= 8) {
    flags.push("high-branching");
  }
  if (metrics.averageLegalChoices < 1.15 && !metrics.tutorial) {
    flags.push("overly-forced");
  }
  if (metrics.solverNodes > 1000) {
    flags.push("high-search-complexity");
  }
  if (metrics.solverExhausted) {
    flags.push("solver-budget-risk");
  }

  return flags;
}

export function analyzeLevel(level, {
  concept = "Predict rotations and clear the flock",
  patternTags = [],
  nodeLimit = 300000
} = {}) {
  const solved = findSolution(level.board, { nodeLimit });
  if (!solved.solution) {
    return {
      level: level.levelNumber,
      concept,
      patternTags,
      targetBirds: countBirds(level.board),
      tutorial: Boolean(level.tutorial),
      solverExhausted: solved.exhausted,
      solvable: false,
      flags: ["unsolved"]
    };
  }

  const opening = analyzeOpeningMoves(level.board, nodeLimit);
  const branching = analyzeSolutionBranching(
    level.board,
    solved.solution
  );

  const metrics = {
    level: level.levelNumber,
    concept,
    patternTags,
    targetBirds: countBirds(level.board),
    boardSize: level.board.length,
    tutorial: Boolean(level.tutorial),
    solutionDepth: solved.solution.length,
    solverNodes: solved.visitedNodes,
    solverExhausted: solved.exhausted,
    solvable: true,
    openingMoves: opening.openingMoves,
    safeOpenings: opening.safeOpenings,
    immediateDeadEnds: opening.immediateDeadEnds,
    exhaustedOpenings: opening.exhaustedOpenings,
    averageLegalChoices: Number(
      branching.averageLegalChoices.toFixed(2)
    ),
    peakLegalChoices: branching.peakLegalChoices,
    forcedSteps: branching.forcedSteps,
    choiceSteps: branching.choiceSteps
  };

  return {
    ...metrics,
    qualityBand: classifyLevelQuality(metrics),
    flags: qualityFlags(metrics)
  };
}
