
import {
  applyMove,
  boardStatus,
  createLevel,
  getLegalMoves
} from "../src/game-core.js";

function encode(board) {
  return board.map((row) => row.join(",")).join(";");
}

function candidateMoves(board, strategy) {
  const legal = getLegalMoves(board);
  if (strategy === "random") return legal;

  const scored = legal.map((move) => {
    const result = applyMove(board, move.row, move.col);
    return {
      move,
      immediateDeadlock: boardStatus(result.board) === "deadlock",
      nextLegal: getLegalMoves(result.board).length,
      rotations: result.rotated.length
    };
  });

  if (strategy === "rotation") {
    const maxRotations = Math.max(...scored.map((x) => x.rotations));
    return scored
      .filter((x) => x.rotations === maxRotations)
      .map((x) => x.move);
  }

  const safe = scored.filter((x) => !x.immediateDeadlock);
  const pool = safe.length ? safe : scored;
  const maxNext = Math.max(...pool.map((x) => x.nextLegal));
  const bestNext = pool.filter((x) => x.nextLegal === maxNext);
  const maxRotations = Math.max(...bestNext.map((x) => x.rotations));
  return bestNext
    .filter((x) => x.rotations === maxRotations)
    .map((x) => x.move);
}

function exactSuccessProbability(initialBoard, strategy) {
  const memo = new Map();
  function solve(board) {
    const status = boardStatus(board);
    if (status === "complete") return 1;
    if (status === "deadlock") return 0;

    const key = `${strategy}:${encode(board)}`;
    if (memo.has(key)) return memo.get(key);

    const moves = candidateMoves(board, strategy);
    const probability =
      moves.reduce((sum, move) => {
        const next = applyMove(board, move.row, move.col).board;
        return sum + solve(next);
      }, 0) / moves.length;

    memo.set(key, probability);
    return probability;
  }
  return { probability: solve(initialBoard), states: memo.size };
}

const rows = [];
for (let level = 1; level <= 40; level += 1) {
  const board = createLevel(level).board;
  const random = exactSuccessProbability(board, "random");
  const rotation = exactSuccessProbability(board, "rotation");
  const oneStepSafe = exactSuccessProbability(board, "oneStepSafe");
  rows.push({
    level,
    random,
    randomWith2Restarts: 1 - Math.pow(1 - random.probability, 3),
    rotation,
    oneStepSafe,
    oneStepSafeWith2Restarts:
      1 - Math.pow(1 - oneStepSafe.probability, 3)
  });
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  method: "exact recursive probability over the actual board state graph",
  rows
}, null, 2));
