import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  CHAPTERS,
  MAX_CAMPAIGN_FEATHERS,
  MAX_CAMPAIGN_LEVEL,
  actForLevel,
  campaignProgress,
  chapterForLevel,
  chapterMastery,
  chapterProgress,
  isCampaignFinale,
  isChapterFinale,
  masteryGoalForLevel,
  migrateUnlockedLevel
} from "../src/campaign-core.js";
import {
  createLevel,
  findSolution
} from "../src/game-core.js";
import {
  unlockedThemes
} from "../src/mastery-core.js";

const root = path.resolve(
  new URL("..", import.meta.url).pathname
);

function boardKey(board) {
  return board
    .map((row) => row.join(","))
    .join(";");
}

test("campaign exposes two twenty-level chapters", () => {
  assert.equal(MAX_CAMPAIGN_LEVEL, 40);
  assert.equal(MAX_CAMPAIGN_FEATHERS, 120);
  assert.equal(CHAPTERS.length, 2);
  assert.deepEqual(
    CHAPTERS.map((chapter) => [
      chapter.name,
      chapter.startLevel,
      chapter.endLevel
    ]),
    [
      ["The First Flight", 1, 20],
      ["Twilight Flock", 21, 40]
    ]
  );
});

test("chapter and act lookup covers every campaign level", () => {
  for (let level = 1; level <= 40; level += 1) {
    const chapter = chapterForLevel(level);
    const act = actForLevel(level);

    assert.ok(
      level >= chapter.startLevel &&
        level <= chapter.endLevel
    );
    assert.ok(
      level >= act.startLevel &&
        level <= act.endLevel
    );
  }

  assert.equal(
    chapterForLevel(21).name,
    "Twilight Flock"
  );
  assert.equal(
    actForLevel(40).name,
    "Midnight Mastery"
  );
});

test("v1.2 players who completed Level 20 receive Level 21 access", () => {
  assert.equal(
    migrateUnlockedLevel({
      unlockedLevel: 20,
      completedLevels: Array.from(
        { length: 20 },
        (_, index) => index + 1
      )
    }),
    21
  );

  assert.equal(
    migrateUnlockedLevel({
      unlockedLevel: 20,
      completedLevels: [1, 2, 3]
    }),
    20
  );
});

test("chapter and campaign progress use unique completed levels", () => {
  assert.deepEqual(
    chapterProgress([21, 21, 22, 23], 21),
    {
      chapter: CHAPTERS[1],
      completed: 3,
      total: 20,
      percent: 15,
      remaining: 17
    }
  );
  assert.deepEqual(
    campaignProgress([1, 1, 2, 21]),
    {
      completed: 3,
      total: 40,
      percent: 8
    }
  );
});

test("mastery totals are derived from the existing feather records", () => {
  const records = {
    21: 3,
    22: 2,
    23: 1,
    24: 3
  };
  const mastery = chapterMastery(records, 21);

  assert.equal(mastery.perfectLevels, 2);
  assert.equal(mastery.feathers, 9);
  assert.equal(mastery.maximumFeathers, 60);
  assert.equal(mastery.percent, 15);
});

test("chapter finales and mastery guidance are explicit", () => {
  assert.equal(isChapterFinale(20), true);
  assert.equal(isChapterFinale(40), true);
  assert.equal(isChapterFinale(21), false);
  assert.equal(isCampaignFinale(40), true);
  assert.equal(isCampaignFinale(20), false);
  assert.match(masteryGoalForLevel(21), /hint/i);
  assert.match(masteryGoalForLevel(39), /three feathers/i);
});

test("Levels 21–40 are unique, solvable, and use five-by-five boards", () => {
  const boards = new Set();

  for (let levelNumber = 21; levelNumber <= 40; levelNumber += 1) {
    const level = createLevel(levelNumber);
    const solved = findSolution(
      level.board,
      { nodeLimit: 300000 }
    );

    assert.equal(level.size, 5);
    assert.equal(solved.exhausted, false);
    assert.ok(solved.solution);
    assert.equal(
      solved.solution.length,
      level.targetBirds
    );
    assert.equal(
      boards.has(boardKey(level.board)),
      false,
      `Level ${levelNumber} duplicates another Chapter 2 board.`
    );
    boards.add(boardKey(level.board));
  }

  assert.equal(boards.size, 20);
});

test("all forty campaign boards are unique", () => {
  const boards = new Map();

  for (let levelNumber = 1; levelNumber <= 40; levelNumber += 1) {
    const key = boardKey(
      createLevel(levelNumber).board
    );
    assert.equal(
      boards.has(key),
      false,
      `Level ${levelNumber} duplicates Level ${boards.get(key)}.`
    );
    boards.set(key, levelNumber);
  }

  assert.equal(boards.size, 40);
});

test("new chapter themes unlock without revoking v1.2 themes", () => {
  const firstChapter = Array.from(
    { length: 20 },
    (_, index) => index + 1
  );
  const atTwentyFive = Array.from(
    { length: 25 },
    (_, index) => index + 1
  );
  const allLevels = Array.from(
    { length: 40 },
    (_, index) => index + 1
  );

  assert.ok(
    unlockedThemes(firstChapter).some(
      (theme) => theme.id === "aurora"
    )
  );
  assert.ok(
    unlockedThemes(atTwentyFive).some(
      (theme) => theme.id === "moonlit"
    )
  );
  assert.ok(
    unlockedThemes(allLevels).some(
      (theme) => theme.id === "midnight"
    )
  );
});

test("production runtime caches and deploys the campaign model", () => {
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );
  const worker = fs.readFileSync(
    path.join(root, "service-worker.js"),
    "utf8"
  );
  const build = fs.readFileSync(
    path.join(root, "tools/build-release.mjs"),
    "utf8"
  );

  assert.match(html, /Paper Flock v1\.4/);
  assert.match(worker, /\.\/src\/campaign-core\.js/);
  assert.match(build, /src\/campaign-core\.js/);
  assert.match(build, /campaignLevelCount:\s*40/);
});
