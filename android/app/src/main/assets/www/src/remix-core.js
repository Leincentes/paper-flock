import {
  EMPTY,
  applyMove,
  cloneBoard,
  countBirds,
  createLevel,
  getLegalMoves,
  isPathClear
} from "./game-core.js";

export const REMIX_SCHEMA_VERSION = 1;
export const REMIX_STORAGE_KEY = "paper-flock-remix";
export const REMIX_BACKUP_KEY = "paper-flock-remix-backup";
export const REMIX_UNLOCK_LEVEL = 6;
export const REMIX_REQUIRED_CAMPAIGN_LEVEL = 5;

export const REMIX_MODIFIERS = Object.freeze({
  linked: Object.freeze({
    id: "linked",
    name: "Linked Folds",
    symbol: "∞",
    summary:
      "Escaping either linked bird turns its partner one extra quarter-turn.",
    instruction:
      "The two ringed birds are linked. When either escapes, its partner turns clockwise once more."
  }),
  locked: Object.freeze({
    id: "locked",
    name: "Locked Fold",
    symbol: "◇",
    summary:
      "One marked bird remains folded until its key bird escapes.",
    instruction:
      "The diamond bird is locked. Free the key-marked bird first to release it."
  }),
  tailwind: Object.freeze({
    id: "tailwind",
    name: "Tailwind",
    symbol: "≈",
    summary:
      "A marked bird turns after a visible number of successful moves.",
    instruction:
      "Watch the wind counter. The wave-marked bird turns automatically when the counter reaches zero."
  })
});

export const REMIX_TRAILS = Object.freeze([
  Object.freeze({
    id: "plain",
    name: "Quiet fold",
    description: "The original clean paper trail.",
    routeId: null
  }),
  Object.freeze({
    id: "sunrise",
    name: "Sunrise ribbon",
    description: "A warm trail earned from Gentle Thread.",
    routeId: "gentle-thread"
  }),
  Object.freeze({
    id: "moonline",
    name: "Moonline",
    description: "A silver trail earned from Quiet Gate.",
    routeId: "quiet-gate"
  }),
  Object.freeze({
    id: "current",
    name: "Sky current",
    description: "A flowing trail earned from Soft Wind.",
    routeId: "soft-wind"
  }),
  Object.freeze({
    id: "constellation",
    name: "Constellation ink",
    description: "A starlit trail earned from Bold Weave.",
    routeId: "bold-weave"
  })
]);

const PUZZLES = Object.freeze({
  "linked-01": Object.freeze({
    id: "linked-01",
    sourceLevel: 6,
    title: "Twin opening",
    modifier: "linked",
    config: Object.freeze({ a: Object.freeze([1, 1]), b: Object.freeze([1, 2]) })
  }),
  "linked-02": Object.freeze({
    id: "linked-02",
    sourceLevel: 8,
    title: "Folded promise",
    modifier: "linked",
    config: Object.freeze({ a: Object.freeze([1, 3]), b: Object.freeze([2, 2]) })
  }),
  "linked-03": Object.freeze({
    id: "linked-03",
    sourceLevel: 10,
    title: "Two skies",
    modifier: "linked",
    config: Object.freeze({ a: Object.freeze([1, 0]), b: Object.freeze([2, 0]) })
  }),
  "locked-01": Object.freeze({
    id: "locked-01",
    sourceLevel: 7,
    title: "Paper key",
    modifier: "locked",
    config: Object.freeze({
      locked: Object.freeze([2, 2]),
      trigger: Object.freeze([2, 3])
    })
  }),
  "locked-02": Object.freeze({
    id: "locked-02",
    sourceLevel: 9,
    title: "Quiet latch",
    modifier: "locked",
    config: Object.freeze({
      locked: Object.freeze([1, 1]),
      trigger: Object.freeze([3, 2])
    })
  }),
  "locked-03": Object.freeze({
    id: "locked-03",
    sourceLevel: 11,
    title: "Open the gate",
    modifier: "locked",
    config: Object.freeze({
      locked: Object.freeze([1, 1]),
      trigger: Object.freeze([3, 1])
    })
  }),
  "wind-01": Object.freeze({
    id: "wind-01",
    sourceLevel: 12,
    title: "First current",
    modifier: "tailwind",
    config: Object.freeze({
      marked: Object.freeze([1, 1]),
      interval: 3
    })
  }),
  "wind-02": Object.freeze({
    id: "wind-02",
    sourceLevel: 14,
    title: "Turning weather",
    modifier: "tailwind",
    config: Object.freeze({
      marked: Object.freeze([2, 1]),
      interval: 3
    })
  }),
  "wind-03": Object.freeze({
    id: "wind-03",
    sourceLevel: 16,
    title: "Rising current",
    modifier: "tailwind",
    config: Object.freeze({
      marked: Object.freeze([3, 0]),
      interval: 2
    })
  }),
  "weave-01": Object.freeze({
    id: "weave-01",
    sourceLevel: 13,
    title: "Night thread",
    modifier: "linked",
    config: Object.freeze({ a: Object.freeze([2, 4]), b: Object.freeze([3, 2]) })
  }),
  "weave-02": Object.freeze({
    id: "weave-02",
    sourceLevel: 15,
    title: "Moon lock",
    modifier: "locked",
    config: Object.freeze({
      locked: Object.freeze([2, 3]),
      trigger: Object.freeze([1, 1])
    })
  }),
  "weave-03": Object.freeze({
    id: "weave-03",
    sourceLevel: 17,
    title: "Midnight wind",
    modifier: "tailwind",
    config: Object.freeze({
      marked: Object.freeze([2, 1]),
      interval: 3
    })
  })
});

export const REMIX_FLIGHTS = Object.freeze([
  Object.freeze({
    id: "dawn-crossroads",
    name: "Dawn Crossroads",
    description: "Choose a gentle relationship puzzle or a deliberate unlocking route.",
    branches: Object.freeze(["gentle-thread", "quiet-gate"])
  }),
  Object.freeze({
    id: "twilight-crossroads",
    name: "Twilight Crossroads",
    description: "Choose a moving wind route or a mixed midnight challenge.",
    branches: Object.freeze(["soft-wind", "bold-weave"])
  })
]);

export const REMIX_ROUTES = Object.freeze([
  Object.freeze({
    id: "gentle-thread",
    flightId: "dawn-crossroads",
    name: "Gentle Thread",
    tone: "Calm",
    description: "Learn how two marked folds influence one another.",
    modifierIds: Object.freeze(["linked"]),
    puzzleIds: Object.freeze(["linked-01", "linked-02", "linked-03"]),
    rewardTrailId: "sunrise"
  }),
  Object.freeze({
    id: "quiet-gate",
    flightId: "dawn-crossroads",
    name: "Quiet Gate",
    tone: "Measured",
    description: "Read the key and release the locked bird at the right time.",
    modifierIds: Object.freeze(["locked"]),
    puzzleIds: Object.freeze(["locked-01", "locked-02", "locked-03"]),
    rewardTrailId: "moonline"
  }),
  Object.freeze({
    id: "soft-wind",
    flightId: "twilight-crossroads",
    name: "Soft Wind",
    tone: "Dynamic",
    description: "Plan around a visible automatic turn every few moves.",
    modifierIds: Object.freeze(["tailwind"]),
    puzzleIds: Object.freeze(["wind-01", "wind-02", "wind-03"]),
    rewardTrailId: "current"
  }),
  Object.freeze({
    id: "bold-weave",
    flightId: "twilight-crossroads",
    name: "Bold Weave",
    tone: "Challenge",
    description: "Combine all three remix ideas in a short midnight route.",
    modifierIds: Object.freeze(["linked", "locked", "tailwind"]),
    puzzleIds: Object.freeze(["weave-01", "weave-02", "weave-03"]),
    rewardTrailId: "constellation"
  })
]);

function coordinate(value) {
  return Array.isArray(value) && value.length === 2
    ? { row: Number(value[0]), col: Number(value[1]) }
    : null;
}

function sameCoordinate(left, right) {
  return Boolean(
    left &&
    right &&
    left.row === right.row &&
    left.col === right.col
  );
}

export function remixRoute(routeId) {
  return REMIX_ROUTES.find((route) => route.id === routeId) ?? null;
}

export function remixPuzzle(puzzleId) {
  return PUZZLES[puzzleId] ?? null;
}

export function createRemixPuzzle(routeId, puzzleIndex = 0) {
  const route = remixRoute(routeId);
  if (!route) {
    throw new Error(`Unknown Remix route: ${routeId}`);
  }
  const index = Math.max(
    0,
    Math.min(route.puzzleIds.length - 1, Number(puzzleIndex) || 0)
  );
  const definition = remixPuzzle(route.puzzleIds[index]);
  const source = createLevel(definition.sourceLevel);
  const modifier = REMIX_MODIFIERS[definition.modifier];

  return {
    ...source,
    levelNumber: null,
    remix: true,
    remixRouteId: route.id,
    remixPuzzleId: definition.id,
    remixPuzzleIndex: index,
    title: definition.title,
    difficulty: `${route.tone} remix`,
    instruction: modifier.instruction,
    masteryGoal: "Remix mastery: finish without a hint, restart, or dead end.",
    modifier: definition.modifier,
    modifierName: modifier.name,
    modifierSummary: modifier.summary,
    modifierConfig: JSON.parse(JSON.stringify(definition.config))
  };
}

export function isRemixMoveAllowed(board, row, col, puzzle, moveCount = 0) {
  const direction = board[row]?.[col] ?? EMPTY;
  if (direction === EMPTY || !isPathClear(board, row, col, direction)) {
    return false;
  }

  if (puzzle?.modifier === "locked") {
    const locked = coordinate(puzzle.modifierConfig?.locked);
    const trigger = coordinate(puzzle.modifierConfig?.trigger);
    if (
      sameCoordinate({ row, col }, locked) &&
      trigger &&
      board[trigger.row]?.[trigger.col] !== EMPTY
    ) {
      return false;
    }
  }

  return true;
}

export function getRemixLegalMoves(board, puzzle, moveCount = 0) {
  return getLegalMoves(board).filter((move) =>
    isRemixMoveAllowed(
      board,
      move.row,
      move.col,
      puzzle,
      moveCount
    )
  );
}

function rotateExtra(next, point, reason, rotated, effects) {
  if (!point || next[point.row]?.[point.col] === EMPTY) {
    return;
  }

  const from = next[point.row][point.col];
  const to = (from + 1) % 4;
  next[point.row][point.col] = to;
  const existing = rotated.find(
    (item) => item.row === point.row && item.col === point.col
  );
  if (existing) {
    existing.to = to;
    existing.remix = true;
  } else {
    rotated.push({
      row: point.row,
      col: point.col,
      from,
      to,
      remix: true
    });
  }
  effects.push({
    kind: reason,
    row: point.row,
    col: point.col,
    from,
    to
  });
}

export function applyRemixMove(
  board,
  row,
  col,
  puzzle,
  moveCount = 0
) {
  if (!isRemixMoveAllowed(board, row, col, puzzle, moveCount)) {
    return {
      ok: false,
      board: cloneBoard(board),
      rotated: [],
      removed: null,
      modifierEffects: []
    };
  }

  const base = applyMove(board, row, col);
  const next = cloneBoard(base.board);
  const rotated = base.rotated.map((item) => ({ ...item }));
  const modifierEffects = [];
  const selected = { row, col };

  if (puzzle.modifier === "linked") {
    const first = coordinate(puzzle.modifierConfig?.a);
    const second = coordinate(puzzle.modifierConfig?.b);
    const partner = sameCoordinate(selected, first)
      ? second
      : sameCoordinate(selected, second)
        ? first
        : null;
    rotateExtra(next, partner, "linked_partner", rotated, modifierEffects);
  }

  if (puzzle.modifier === "tailwind") {
    const interval = Math.max(
      2,
      Number(puzzle.modifierConfig?.interval) || 3
    );
    if ((moveCount + 1) % interval === 0) {
      rotateExtra(
        next,
        coordinate(puzzle.modifierConfig?.marked),
        "tailwind_turn",
        rotated,
        modifierEffects
      );
    }
  }

  return {
    ...base,
    board: next,
    rotated,
    modifierEffects
  };
}

function encodeRemixState(board, moveCount, puzzle) {
  const phase =
    puzzle.modifier === "tailwind"
      ? moveCount % Math.max(
          2,
          Number(puzzle.modifierConfig?.interval) || 3
        )
      : 0;
  return `${board.map((row) => row.join(",")).join(";")}|${phase}`;
}

export function findRemixSolution(
  board,
  puzzle,
  {
    moveCount = 0,
    nodeLimit = 250000
  } = {}
) {
  const seen = new Set();
  let visitedNodes = 0;
  let exhausted = false;

  function search(current, moves) {
    if (countBirds(current) === 0) {
      return [];
    }

    visitedNodes += 1;
    if (visitedNodes > nodeLimit) {
      exhausted = true;
      return null;
    }

    const key = encodeRemixState(current, moves, puzzle);
    if (seen.has(key)) {
      return null;
    }
    seen.add(key);

    const candidates = getRemixLegalMoves(current, puzzle, moves)
      .map((move) => {
        const result = applyRemixMove(
          current,
          move.row,
          move.col,
          puzzle,
          moves
        );
        return {
          move,
          result,
          nextLegalCount: getRemixLegalMoves(
            result.board,
            puzzle,
            moves + 1
          ).length,
          effectCount: result.modifierEffects.length
        };
      })
      .sort(
        (left, right) =>
          right.effectCount - left.effectCount ||
          right.result.rotated.length - left.result.rotated.length ||
          right.nextLegalCount - left.nextLegalCount
      );

    for (const candidate of candidates) {
      const remaining = search(candidate.result.board, moves + 1);
      if (remaining !== null) {
        return [candidate.move, ...remaining];
      }
      if (exhausted) {
        return null;
      }
    }

    return null;
  }

  const solution = search(cloneBoard(board), moveCount);
  return {
    solution,
    visitedNodes,
    exhausted
  };
}

export function remixBoardStatus(board, puzzle, moveCount = 0) {
  if (countBirds(board) === 0) {
    return "complete";
  }
  return getRemixLegalMoves(board, puzzle, moveCount).length === 0
    ? "deadlock"
    : "playing";
}

export function remixCellState(board, row, col, puzzle, moveCount = 0) {
  if (!puzzle?.remix || board[row]?.[col] === EMPTY) {
    return {
      classes: [],
      label: "",
      locked: false
    };
  }

  const point = { row, col };
  const classes = [];
  const labels = [];
  let locked = false;

  if (puzzle.modifier === "linked") {
    const a = coordinate(puzzle.modifierConfig?.a);
    const b = coordinate(puzzle.modifierConfig?.b);
    if (sameCoordinate(point, a) || sameCoordinate(point, b)) {
      classes.push("remix-linked");
      labels.push("linked bird");
    }
  }

  if (puzzle.modifier === "locked") {
    const lockedPoint = coordinate(puzzle.modifierConfig?.locked);
    const trigger = coordinate(puzzle.modifierConfig?.trigger);
    if (sameCoordinate(point, lockedPoint)) {
      locked = Boolean(
        trigger && board[trigger.row]?.[trigger.col] !== EMPTY
      );
      classes.push(locked ? "remix-locked" : "remix-unlocked");
      labels.push(locked ? "locked bird" : "released bird");
    }
    if (sameCoordinate(point, trigger)) {
      classes.push("remix-key");
      labels.push("key bird");
    }
  }

  if (puzzle.modifier === "tailwind") {
    const marked = coordinate(puzzle.modifierConfig?.marked);
    if (sameCoordinate(point, marked)) {
      classes.push("remix-tailwind");
      const interval = Math.max(
        2,
        Number(puzzle.modifierConfig?.interval) || 3
      );
      const remaining = interval - (moveCount % interval);
      labels.push(`tailwind bird, turns after ${remaining} successful ${remaining === 1 ? "move" : "moves"}`);
    }
  }

  return {
    classes,
    label: labels.join(", "),
    locked
  };
}

export function normalizeRemixProgress(value = {}) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  const routeIds = new Set(REMIX_ROUTES.map((route) => route.id));
  const puzzleIds = new Set(Object.keys(PUZZLES));
  const trailIds = new Set(REMIX_TRAILS.map((trail) => trail.id));

  const completedRoutes = Array.isArray(source.completedRoutes)
    ? [...new Set(source.completedRoutes.filter((id) => routeIds.has(id)))]
    : [];
  const completedPuzzles = Array.isArray(source.completedPuzzles)
    ? [...new Set(source.completedPuzzles.filter((id) => puzzleIds.has(id)))]
    : [];
  const bestFeathers = {};
  if (source.bestFeathers && typeof source.bestFeathers === "object") {
    for (const [id, value] of Object.entries(source.bestFeathers)) {
      if (puzzleIds.has(id)) {
        bestFeathers[id] = Math.max(
          0,
          Math.min(3, Number(value) || 0)
        );
      }
    }
  }

  const unlockedTrails = new Set(["plain"]);
  for (const routeId of completedRoutes) {
    const route = remixRoute(routeId);
    if (route?.rewardTrailId) {
      unlockedTrails.add(route.rewardTrailId);
    }
  }
  if (Array.isArray(source.unlockedTrails)) {
    source.unlockedTrails
      .filter((id) => trailIds.has(id))
      .forEach((id) => unlockedTrails.add(id));
  }

  const selectedTrail =
    trailIds.has(source.selectedTrail) &&
    unlockedTrails.has(source.selectedTrail)
      ? source.selectedTrail
      : "plain";

  return {
    schemaVersion: REMIX_SCHEMA_VERSION,
    completedRoutes,
    completedPuzzles,
    bestFeathers,
    unlockedTrails: [...unlockedTrails],
    selectedTrail
  };
}

export function recordRemixPuzzleCompletion(
  progress,
  puzzle,
  feathers
) {
  const normalized = normalizeRemixProgress(progress);
  const puzzleId = puzzle.remixPuzzleId;
  const route = remixRoute(puzzle.remixRouteId);
  const completedPuzzles = new Set(normalized.completedPuzzles);
  completedPuzzles.add(puzzleId);
  const previousBest = normalized.bestFeathers[puzzleId] ?? 0;
  const best = Math.max(previousBest, Math.max(0, Math.min(3, feathers)));
  const bestFeathers = {
    ...normalized.bestFeathers,
    [puzzleId]: best
  };

  const routeComplete = route.puzzleIds.every((id) =>
    completedPuzzles.has(id)
  );
  const completedRoutes = new Set(normalized.completedRoutes);
  const routeWasComplete = completedRoutes.has(route.id);
  if (routeComplete) {
    completedRoutes.add(route.id);
  }

  const updated = normalizeRemixProgress({
    ...normalized,
    completedPuzzles: [...completedPuzzles],
    completedRoutes: [...completedRoutes],
    bestFeathers
  });

  return {
    progress: updated,
    previousBest,
    best,
    improved: best > previousBest,
    routeComplete,
    newlyCompletedRoute: routeComplete && !routeWasComplete,
    rewardTrailId:
      routeComplete && !routeWasComplete
        ? route.rewardTrailId
        : null
  };
}

export function selectRemixTrail(progress, trailId) {
  const normalized = normalizeRemixProgress(progress);
  if (!normalized.unlockedTrails.includes(trailId)) {
    return normalized;
  }
  return {
    ...normalized,
    selectedTrail: trailId
  };
}

export function remixProgressSummary(progress) {
  const normalized = normalizeRemixProgress(progress);
  return {
    completedRoutes: normalized.completedRoutes.length,
    totalRoutes: REMIX_ROUTES.length,
    completedPuzzles: normalized.completedPuzzles.length,
    totalPuzzles: Object.keys(PUZZLES).length,
    unlockedTrails: normalized.unlockedTrails.length,
    totalTrails: REMIX_TRAILS.length
  };
}
