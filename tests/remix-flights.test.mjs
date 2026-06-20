import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  REMIX_BACKUP_KEY,
  REMIX_FLIGHTS,
  REMIX_MODIFIERS,
  REMIX_ROUTES,
  REMIX_STORAGE_KEY,
  REMIX_TRAILS,
  applyRemixMove,
  createRemixPuzzle,
  findRemixSolution,
  getRemixLegalMoves,
  normalizeRemixProgress,
  recordRemixPuzzleCompletion,
  remixCellState,
  remixProgressSummary,
  selectRemixTrail
} from "../src/remix-core.js";
import {
  PLAYER_STORAGE_KEYS
} from "../src/settings-core.js";
import {
  normalizePlayerStats,
  recordPuzzleCompletion
} from "../src/achievement-core.js";

test("Remix Flights defines two branching flights and twelve unique puzzles", () => {
  assert.equal(REMIX_FLIGHTS.length, 2);
  assert.equal(REMIX_ROUTES.length, 4);
  assert.ok(REMIX_ROUTES.every((route) => route.puzzleIds.length === 3));

  const puzzleIds = REMIX_ROUTES.flatMap((route) => route.puzzleIds);
  assert.equal(puzzleIds.length, 12);
  assert.equal(new Set(puzzleIds).size, 12);
  assert.deepEqual(
    new Set(REMIX_ROUTES.flatMap((route) => route.modifierIds)),
    new Set(["linked", "locked", "tailwind"])
  );
});

test("all twelve curated Remix puzzles are solver-verified", () => {
  for (const route of REMIX_ROUTES) {
    for (let index = 0; index < route.puzzleIds.length; index += 1) {
      const puzzle = createRemixPuzzle(route.id, index);
      const result = findRemixSolution(
        puzzle.board,
        puzzle,
        { nodeLimit: 500000 }
      );
      assert.ok(
        result.solution,
        `${route.id}/${puzzle.remixPuzzleId} must be solvable`
      );
      assert.equal(
        result.solution.length,
        puzzle.targetBirds,
        "every bird should escape exactly once"
      );
      assert.equal(result.exhausted, false);
    }
  }
});

test("Linked Folds turns the surviving partner after escape", () => {
  const puzzle = createRemixPuzzle("gentle-thread", 0);
  const [row, col] = puzzle.modifierConfig.a;
  const [partnerRow, partnerCol] = puzzle.modifierConfig.b;
  const solution = findRemixSolution(puzzle.board, puzzle).solution;
  const firstLinkedMove = solution.find(
    (move) =>
      (move.row === row && move.col === col) ||
      (move.row === partnerRow && move.col === partnerCol)
  );
  assert.ok(firstLinkedMove);

  let board = puzzle.board.map((line) => [...line]);
  let moves = 0;
  for (const move of solution) {
    const beforePartner =
      move.row === row && move.col === col
        ? board[partnerRow][partnerCol]
        : move.row === partnerRow && move.col === partnerCol
          ? board[row][col]
          : -1;
    const result = applyRemixMove(
      board,
      move.row,
      move.col,
      puzzle,
      moves
    );
    assert.equal(result.ok, true);
    if (
      move.row === firstLinkedMove.row &&
      move.col === firstLinkedMove.col
    ) {
      assert.ok(
        result.modifierEffects.some(
          (effect) => effect.kind === "linked_partner"
        )
      );
      assert.notEqual(beforePartner, -1);
      break;
    }
    board = result.board;
    moves += 1;
  }
});

test("Locked Fold blocks its marked bird until the key escapes", () => {
  const puzzle = createRemixPuzzle("quiet-gate", 0);
  const [lockedRow, lockedCol] = puzzle.modifierConfig.locked;
  const [triggerRow, triggerCol] = puzzle.modifierConfig.trigger;

  const marker = remixCellState(
    puzzle.board,
    lockedRow,
    lockedCol,
    puzzle,
    0
  );
  assert.equal(marker.locked, true);
  assert.ok(marker.classes.includes("remix-locked"));

  const legal = getRemixLegalMoves(puzzle.board, puzzle, 0);
  assert.equal(
    legal.some(
      (move) =>
        move.row === lockedRow && move.col === lockedCol
    ),
    false
  );

  const solution = findRemixSolution(puzzle.board, puzzle).solution;
  const triggerIndex = solution.findIndex(
    (move) =>
      move.row === triggerRow && move.col === triggerCol
  );
  assert.ok(triggerIndex >= 0);
});

test("Tailwind reports and applies a visible automatic turn", () => {
  const puzzle = createRemixPuzzle("soft-wind", 0);
  const solution = findRemixSolution(puzzle.board, puzzle).solution;
  let board = puzzle.board.map((row) => [...row]);
  let triggered = false;

  solution.forEach((move, index) => {
    const result = applyRemixMove(
      board,
      move.row,
      move.col,
      puzzle,
      index
    );
    assert.equal(result.ok, true);
    if (
      result.modifierEffects.some(
        (effect) => effect.kind === "tailwind_turn"
      )
    ) {
      triggered = true;
    }
    board = result.board;
  });

  assert.equal(triggered, true);
});

test("route completion unlocks one cosmetic trail without random rewards", () => {
  let progress = normalizeRemixProgress({});
  const route = REMIX_ROUTES[0];
  let finalResult = null;

  route.puzzleIds.forEach((puzzleId, index) => {
    const puzzle = createRemixPuzzle(route.id, index);
    assert.equal(puzzle.remixPuzzleId, puzzleId);
    finalResult = recordRemixPuzzleCompletion(
      progress,
      puzzle,
      3
    );
    progress = finalResult.progress;
  });

  assert.equal(finalResult.routeComplete, true);
  assert.equal(finalResult.newlyCompletedRoute, true);
  assert.equal(finalResult.rewardTrailId, route.rewardTrailId);
  assert.ok(progress.unlockedTrails.includes(route.rewardTrailId));

  const selected = selectRemixTrail(progress, route.rewardTrailId);
  assert.equal(selected.selectedTrail, route.rewardTrailId);
});

test("Remix progress normalization rejects unknown routes, puzzles, and trails", () => {
  const progress = normalizeRemixProgress({
    completedRoutes: ["gentle-thread", "unknown"],
    completedPuzzles: ["linked-01", "fake"],
    bestFeathers: {
      "linked-01": 9,
      fake: 3
    },
    unlockedTrails: ["sunrise", "loot-box"],
    selectedTrail: "loot-box"
  });

  assert.deepEqual(progress.completedRoutes, ["gentle-thread"]);
  assert.deepEqual(progress.completedPuzzles, ["linked-01"]);
  assert.equal(progress.bestFeathers["linked-01"], 3);
  assert.equal(progress.bestFeathers.fake, undefined);
  assert.equal(progress.selectedTrail, "plain");
  assert.equal(remixProgressSummary(progress).totalPuzzles, 12);
});

test("Remix progress participates in recoverable player backup", () => {
  assert.ok(PLAYER_STORAGE_KEYS.includes(REMIX_STORAGE_KEY));
  assert.ok(PLAYER_STORAGE_KEYS.includes(REMIX_BACKUP_KEY));
});

test("production package includes Remix modules, UI, offline cache, and metadata", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const serviceWorker = fs.readFileSync("service-worker.js", "utf8");
  const builder = fs.readFileSync("tools/build-release.mjs", "utf8");
  const styles = fs.readFileSync("styles.css", "utf8");
  const config = JSON.parse(fs.readFileSync("app-config.json", "utf8"));

  assert.match(html, /src\/remix-ui\.js/);
  assert.match(serviceWorker, /src\/remix-core\.js/);
  assert.match(serviceWorker, /src\/remix-ui\.js/);
  assert.match(builder, /src\/remix-core\.js/);
  assert.match(builder, /src\/remix-ui\.js/);
  assert.match(styles, /\.remix-overlay/);
  assert.match(styles, /\.remix-linked/);
  assert.match(styles, /\.remix-tailwind/);
  assert.equal(config.remixFlightsAvailable, true);
  assert.equal(config.remixPuzzleCount, 12);
  assert.equal(config.remixRouteCount, 4);
  assert.equal(config.remixModifierCount, 3);
});

test("Remix design remains optional and non-expiring", () => {
  const source = [
    fs.readFileSync("src/remix-core.js", "utf8"),
    fs.readFileSync("src/remix-ui.js", "utf8")
  ].join("\n");

  assert.doesNotMatch(source, /streak/i);
  assert.doesNotMatch(source, /countdown/i);
  assert.doesNotMatch(source, /loot[\s-]?box/i);
  assert.doesNotMatch(source, /paid[\s-]?skip/i);
  assert.ok(Object.keys(REMIX_MODIFIERS).length === 3);
  assert.equal(REMIX_TRAILS[0].id, "plain");
});

test("Remix completions count as lifetime puzzles without inflating campaign or Daily totals", () => {
  const before = normalizePlayerStats({
    puzzleCompletions: 4,
    campaignCompletions: 3,
    dailyCompletions: 1
  });
  const after = recordPuzzleCompletion(before, {
    mode: "remix",
    moves: 8,
    feathers: 3
  });

  assert.equal(after.puzzleCompletions, 5);
  assert.equal(after.campaignCompletions, 3);
  assert.equal(after.dailyCompletions, 1);
  assert.equal(after.cleanCompletions, before.cleanCompletions + 1);
});
