import { dailySeed } from "./progress-core.js";

export const EMPTY = -1;

export const DIRECTIONS = Object.freeze([
  Object.freeze({ name: "north", dr: -1, dc: 0, angle: 0 }),
  Object.freeze({ name: "east", dr: 0, dc: 1, angle: 90 }),
  Object.freeze({ name: "south", dr: 1, dc: 0, angle: 180 }),
  Object.freeze({ name: "west", dr: 0, dc: -1, angle: 270 })
]);

const TUTORIAL_LEVELS = Object.freeze({
  1: Object.freeze({
    title: "Clear path",
    instruction:
      "Tap the only bird whose beak has a clear path to the edge.",
    board: Object.freeze([
      Object.freeze([EMPTY, EMPTY, EMPTY]),
      Object.freeze([0, 1, 3]),
      Object.freeze([EMPTY, EMPTY, EMPTY])
    ])
  }),
  2: Object.freeze({
    title: "Turning neighbors",
    instruction:
      "Watch closely: an escaping bird turns every touching neighbor clockwise.",
    board: Object.freeze([
      Object.freeze([EMPTY, EMPTY, EMPTY]),
      Object.freeze([2, 3, EMPTY]),
      Object.freeze([2, 3, EMPTY])
    ])
  }),
  3: Object.freeze({
    title: "Open a chain",
    instruction:
      "Each turn can open the next flight path. Follow the chain.",
    board: Object.freeze([
      Object.freeze([EMPTY, EMPTY, EMPTY]),
      Object.freeze([0, 2, 2]),
      Object.freeze([EMPTY, 0, 0])
    ])
  }),
  4: Object.freeze({
    title: "Undo a dead end",
    instruction:
      "Try the left bird first. When the flock gets stuck, use Undo and choose the other path.",
    board: Object.freeze([
      Object.freeze([EMPTY, 3, 1]),
      Object.freeze([EMPTY, 0, 3]),
      Object.freeze([EMPTY, EMPTY, EMPTY])
    ])
  }),
  5: Object.freeze({
    title: "Fly solo",
    instruction:
      "No guide this time. Read the beaks, predict the turns, and free the flock.",
    board: Object.freeze([
      Object.freeze([3, 2, EMPTY]),
      Object.freeze([1, 3, 0]),
      Object.freeze([EMPTY, EMPTY, EMPTY])
    ])
  })
});

const GENERATED_LEVELS = Object.freeze({
  6: Object.freeze({ size: 4, targetBirds: 7, seed: 2766504, difficulty: "Gentle" }),
  7: Object.freeze({ size: 4, targetBirds: 8, seed: 1675464, difficulty: "Gentle" }),
  8: Object.freeze({ size: 4, targetBirds: 9, seed: 3593644, difficulty: "Gentle" }),
  9: Object.freeze({ size: 4, targetBirds: 10, seed: 2542199, difficulty: "Steady" }),
  10: Object.freeze({ size: 4, targetBirds: 11, seed: 2607333, difficulty: "Steady" }),
  11: Object.freeze({ size: 4, targetBirds: 12, seed: 2308193, difficulty: "Steady" }),
  12: Object.freeze({ size: 4, targetBirds: 13, seed: 2832629, difficulty: "Steady" }),
  13: Object.freeze({ size: 5, targetBirds: 13, seed: 385531988, difficulty: "Measured" }),
  14: Object.freeze({ size: 5, targetBirds: 14, seed: 3985116566, difficulty: "Measured" }),
  15: Object.freeze({ size: 5, targetBirds: 15, seed: 889425083, difficulty: "Measured" }),
  16: Object.freeze({ size: 5, targetBirds: 16, seed: 266088435, difficulty: "Tricky" }),
  17: Object.freeze({ size: 5, targetBirds: 17, seed: 2502917069, difficulty: "Tricky" }),
  18: Object.freeze({ size: 5, targetBirds: 18, seed: 3665837911, difficulty: "Tricky" }),
  19: Object.freeze({ size: 5, targetBirds: 19, seed: 394418690, difficulty: "Expert" }),
  20: Object.freeze({ size: 5, targetBirds: 20, seed: 535272574, difficulty: "Expert" })
});

export function createEmptyBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill(EMPTY));
}

export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

export function countBirds(board) {
  return board.reduce(
    (total, row) => total + row.filter((cell) => cell !== EMPTY).length,
    0
  );
}

export function isInside(board, row, col) {
  return row >= 0 && col >= 0 && row < board.length && col < board.length;
}


export function tracePath(board, row, col, direction) {
  if (!isInside(board, row, col) || board[row][col] === EMPTY) {
    return {
      cells: [],
      blocker: null,
      exitsBoard: false
    };
  }

  const vector = DIRECTIONS[direction];
  const cells = [];
  let r = row + vector.dr;
  let c = col + vector.dc;

  while (isInside(board, r, c)) {
    const cell = {
      row: r,
      col: c,
      occupied: board[r][c] !== EMPTY
    };
    cells.push(cell);

    if (cell.occupied) {
      return {
        cells,
        blocker: { row: r, col: c },
        exitsBoard: false
      };
    }

    r += vector.dr;
    c += vector.dc;
  }

  return {
    cells,
    blocker: null,
    exitsBoard: true
  };
}

export function isPathClear(board, row, col, direction) {
  if (!isInside(board, row, col) || board[row][col] === EMPTY) {
    return false;
  }

  const vector = DIRECTIONS[direction];
  let r = row + vector.dr;
  let c = col + vector.dc;

  while (isInside(board, r, c)) {
    if (board[r][c] !== EMPTY) {
      return false;
    }
    r += vector.dr;
    c += vector.dc;
  }
  return true;
}

export function getLegalMoves(board) {
  const legal = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const direction = board[row][col];
      if (direction !== EMPTY && isPathClear(board, row, col, direction)) {
        legal.push({ row, col, direction });
      }
    }
  }
  return legal;
}

export function getOrthogonalNeighbors(board, row, col) {
  const neighbors = [];
  for (const { dr, dc } of DIRECTIONS) {
    const nextRow = row + dr;
    const nextCol = col + dc;
    if (isInside(board, nextRow, nextCol)) {
      neighbors.push({ row: nextRow, col: nextCol });
    }
  }
  return neighbors;
}

export function applyMove(board, row, col) {
  const direction = board[row]?.[col] ?? EMPTY;
  if (direction === EMPTY || !isPathClear(board, row, col, direction)) {
    return {
      ok: false,
      board: cloneBoard(board),
      rotated: [],
      removed: null
    };
  }

  const next = cloneBoard(board);
  next[row][col] = EMPTY;
  const rotated = [];

  for (const neighbor of getOrthogonalNeighbors(next, row, col)) {
    const value = next[neighbor.row][neighbor.col];
    if (value !== EMPTY) {
      next[neighbor.row][neighbor.col] = (value + 1) % 4;
      rotated.push({
        ...neighbor,
        from: value,
        to: next[neighbor.row][neighbor.col]
      });
    }
  }

  return {
    ok: true,
    board: next,
    rotated,
    removed: { row, col, direction }
  };
}

function rotateNeighborsCounterClockwise(board, row, col) {
  for (const neighbor of getOrthogonalNeighbors(board, row, col)) {
    const value = board[neighbor.row][neighbor.col];
    if (value !== EMPTY) {
      board[neighbor.row][neighbor.col] = (value + 3) % 4;
    }
  }
}

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function candidateScore(board, candidate) {
  const neighbors = getOrthogonalNeighbors(board, candidate.row, candidate.col);
  const occupiedNeighbors = neighbors.filter(
    ({ row, col }) => board[row][col] !== EMPTY
  ).length;

  const center = (board.length - 1) / 2;
  const distanceFromCenter =
    Math.abs(candidate.row - center) + Math.abs(candidate.col - center);
  const centrality = board.length - distanceFromCenter;

  return occupiedNeighbors * 10 + centrality;
}

export function generateSolvableBoard(size, targetBirds, seed) {
  if (!Number.isInteger(size) || size < 2) {
    throw new Error("Board size must be an integer of at least 2.");
  }
  if (
    !Number.isInteger(targetBirds) ||
    targetBirds < 1 ||
    targetBirds > size * size
  ) {
    throw new Error("Target bird count must fit on the board.");
  }

  const random = mulberry32(seed);
  const board = createEmptyBoard(size);
  const reverseMoves = [];

  for (let placed = 0; placed < targetBirds; placed += 1) {
    const candidates = [];

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (board[row][col] !== EMPTY) {
          continue;
        }

        for (let direction = 0; direction < DIRECTIONS.length; direction += 1) {
          board[row][col] = direction;
          const clear = isPathClear(board, row, col, direction);
          board[row][col] = EMPTY;

          if (clear) {
            candidates.push({ row, col, direction });
          }
        }
      }
    }

    if (candidates.length === 0) {
      throw new Error(
        `Unable to generate level: no reverse move at ${placed}/${targetBirds}.`
      );
    }

    const randomized = shuffled(candidates, random);
    randomized.sort(
      (a, b) => candidateScore(board, b) - candidateScore(board, a)
    );

    const poolSize = Math.min(6, randomized.length);
    const selected = randomized[Math.floor(random() * poolSize)];

    rotateNeighborsCounterClockwise(board, selected.row, selected.col);
    board[selected.row][selected.col] = selected.direction;
    reverseMoves.push(selected);
  }

  return {
    board,
    solution: reverseMoves.reverse(),
    seed,
    size,
    targetBirds
  };
}

function encodeBoard(board) {
  return board.map((row) => row.join(",")).join(";");
}

export function findSolution(board, options = {}) {
  const nodeLimit = Number.isInteger(options.nodeLimit)
    ? options.nodeLimit
    : 150000;
  const seen = new Set();
  let visitedNodes = 0;
  let exhausted = false;

  function search(current) {
    if (countBirds(current) === 0) {
      return [];
    }

    visitedNodes += 1;
    if (visitedNodes > nodeLimit) {
      exhausted = true;
      return null;
    }

    const key = encodeBoard(current);
    if (seen.has(key)) {
      return null;
    }
    seen.add(key);

    const candidates = getLegalMoves(current)
      .map((move) => {
        const result = applyMove(current, move.row, move.col);
        return {
          move,
          result,
          rotationCount: result.rotated.length,
          nextLegalCount: getLegalMoves(result.board).length
        };
      })
      .sort(
        (a, b) =>
          b.rotationCount - a.rotationCount ||
          b.nextLegalCount - a.nextLegalCount
      );

    for (const candidate of candidates) {
      const remaining = search(candidate.result.board);
      if (remaining !== null) {
        return [candidate.move, ...remaining];
      }
      if (exhausted) {
        return null;
      }
    }

    return null;
  }

  const solution = search(cloneBoard(board));
  return {
    solution,
    visitedNodes,
    exhausted
  };
}

function tutorialDefinition(levelNumber) {
  const tutorial = TUTORIAL_LEVELS[levelNumber];
  if (!tutorial) {
    return null;
  }
  return {
    size: tutorial.board.length,
    targetBirds: countBirds(tutorial.board),
    title: tutorial.title,
    instruction: tutorial.instruction,
    difficulty: "Tutorial",
    tutorial: true
  };
}

export function levelDefinition(levelNumber) {
  const level = Math.max(1, Math.min(20, Number(levelNumber) || 1));
  return (
    tutorialDefinition(level) ?? {
      ...GENERATED_LEVELS[level],
      title: `${GENERATED_LEVELS[level].difficulty} flock`,
      instruction:
        "Free every bird. Read the beaks and predict each clockwise turn.",
      tutorial: false
    }
  );
}

export function createLevel(levelNumber) {
  const level = Math.max(1, Math.min(20, Number(levelNumber) || 1));
  const tutorial = TUTORIAL_LEVELS[level];

  if (tutorial) {
    const board = cloneBoard(tutorial.board);
    const solved = findSolution(board, { nodeLimit: 50000 });
    if (!solved.solution) {
      throw new Error(`Curated tutorial level ${level} is not solvable.`);
    }
    return {
      levelNumber: level,
      board,
      solution: solved.solution,
      seed: null,
      size: board.length,
      targetBirds: countBirds(board),
      title: tutorial.title,
      instruction: tutorial.instruction,
      difficulty: "Tutorial",
      tutorial: true
    };
  }

  const definition = GENERATED_LEVELS[level];
  return {
    levelNumber: level,
    title: `${definition.difficulty} flock`,
    instruction:
      "Free every bird. Read the beaks and predict each clockwise turn.",
    tutorial: false,
    difficulty: definition.difficulty,
    ...generateSolvableBoard(
      definition.size,
      definition.targetBirds,
      definition.seed
    )
  };
}

export function createDailyLevel(dateKey) {
  const seed = dailySeed(dateKey);
  const targetBirds = 14 + (seed % 5);
  return {
    levelNumber: null,
    dateKey,
    title: "Daily Flock",
    instruction:
      "One new flock for today. Solve it at your pace; there is no streak or timer.",
    tutorial: false,
    difficulty: targetBirds >= 17 ? "Daily challenge" : "Daily",
    ...generateSolvableBoard(5, targetBirds, seed)
  };
}

export function boardStatus(board) {
  const remaining = countBirds(board);
  if (remaining === 0) {
    return "complete";
  }
  if (getLegalMoves(board).length === 0) {
    return "deadlock";
  }
  return "playing";
}
