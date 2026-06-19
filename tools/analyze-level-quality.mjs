import fs from "node:fs";
import {
  MAX_CAMPAIGN_LEVEL,
  chapterForLevel
} from "../src/campaign-core.js";
import {
  createLevel
} from "../src/game-core.js";
import {
  analyzeLevel
} from "../src/level-quality-core.js";

const concepts = Object.freeze({
  1: Object.freeze({
    concept: "Single clear path",
    patternTags: Object.freeze(["tutorial", "direction"]),
    expectedBands: Object.freeze(["tutorial"])
  }),
  2: Object.freeze({
    concept: "Observe two clockwise folds",
    patternTags: Object.freeze(["tutorial", "rotation"]),
    expectedBands: Object.freeze(["tutorial"])
  }),
  3: Object.freeze({
    concept: "Follow a forced chain",
    patternTags: Object.freeze(["tutorial", "chain"]),
    expectedBands: Object.freeze(["tutorial"])
  }),
  4: Object.freeze({
    concept: "Recover from a deliberate dead end",
    patternTags: Object.freeze(["tutorial", "undo", "trap"]),
    expectedBands: Object.freeze(["tutorial"])
  }),
  5: Object.freeze({
    concept: "Independent understanding check",
    patternTags: Object.freeze(["tutorial", "choice"]),
    expectedBands: Object.freeze(["tutorial"])
  }),
  6: Object.freeze({
    concept: "Wide openings with low punishment",
    patternTags: Object.freeze(["edge-reading", "gentle"]),
    expectedBands: Object.freeze(["gentle", "steady"])
  }),
  7: Object.freeze({
    concept: "Compare multiple safe exits",
    patternTags: Object.freeze(["choice", "gentle"]),
    expectedBands: Object.freeze(["gentle", "steady"])
  }),
  8: Object.freeze({
    concept: "Plan around a compact cluster",
    patternTags: Object.freeze(["cluster", "gentle"]),
    expectedBands: Object.freeze(["gentle", "steady"])
  }),
  9: Object.freeze({
    concept: "Use a rotation to open the edge",
    patternTags: Object.freeze(["setup", "steady"]),
    expectedBands: Object.freeze(["steady", "tricky"])
  }),
  10: Object.freeze({
    concept: "Avoid an early misleading route",
    patternTags: Object.freeze(["trap", "steady"]),
    expectedBands: Object.freeze(["steady", "tricky"])
  }),
  11: Object.freeze({
    concept: "Balance two active regions",
    patternTags: Object.freeze(["split-board", "steady"]),
    expectedBands: Object.freeze(["steady", "tricky"])
  }),
  12: Object.freeze({
    concept: "Preserve a future escape lane",
    patternTags: Object.freeze(["lane", "steady"]),
    expectedBands: Object.freeze(["steady", "tricky"])
  }),
  13: Object.freeze({
    concept: "Read a larger five-by-five flock",
    patternTags: Object.freeze(["board-growth", "measured"]),
    expectedBands: Object.freeze(["steady", "tricky"])
  }),
  14: Object.freeze({
    concept: "Sequence several edge releases",
    patternTags: Object.freeze(["sequence", "measured"]),
    expectedBands: Object.freeze(["steady", "tricky"])
  }),
  15: Object.freeze({
    concept: "Choose between competing chains",
    patternTags: Object.freeze(["branching", "measured"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  16: Object.freeze({
    concept: "Recover from a mid-puzzle trap",
    patternTags: Object.freeze(["trap", "tricky"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  17: Object.freeze({
    concept: "Plan a longer rotation cascade",
    patternTags: Object.freeze(["cascade", "tricky"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  18: Object.freeze({
    concept: "Protect a narrow late-game lane",
    patternTags: Object.freeze(["lane", "tricky"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  19: Object.freeze({
    concept: "Expert branching and trap control",
    patternTags: Object.freeze(["branching", "expert"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  20: Object.freeze({
    concept: "First chapter mastery finale",
    patternTags: Object.freeze(["finale", "expert"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  21: Object.freeze({
    concept: "Re-enter on a calm twelve-bird board",
    patternTags: Object.freeze(["chapter-2", "re-entry", "steady"]),
    expectedBands: Object.freeze(["steady"])
  }),
  22: Object.freeze({
    concept: "Compare safe dusk openings",
    patternTags: Object.freeze(["chapter-2", "choice", "steady"]),
    expectedBands: Object.freeze(["steady"])
  }),
  23: Object.freeze({
    concept: "Preserve the center during re-entry",
    patternTags: Object.freeze(["chapter-2", "center", "steady"]),
    expectedBands: Object.freeze(["steady"])
  }),
  24: Object.freeze({
    concept: "Prepare a two-step moonlit lane",
    patternTags: Object.freeze(["chapter-2", "sequence", "tricky"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  25: Object.freeze({
    concept: "Complete the twilight warm-up",
    patternTags: Object.freeze(["chapter-2", "lane", "tricky"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  26: Object.freeze({
    concept: "Begin a connected rotation chain",
    patternTags: Object.freeze(["chapter-2", "cascade", "tricky"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  27: Object.freeze({
    concept: "Connect two active regions",
    patternTags: Object.freeze(["chapter-2", "split-board", "tricky"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  28: Object.freeze({
    concept: "Preserve multiple continuations",
    patternTags: Object.freeze(["chapter-2", "branching", "tricky"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  29: Object.freeze({
    concept: "Evaluate a high-choice opening",
    patternTags: Object.freeze(["chapter-2", "branching", "expert"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  30: Object.freeze({
    concept: "Reject a misleading moonlit opening",
    patternTags: Object.freeze(["chapter-2", "trap", "tricky"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  31: Object.freeze({
    concept: "Balance an inked constellation",
    patternTags: Object.freeze(["chapter-2", "balance", "tricky"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  32: Object.freeze({
    concept: "Read a dense whole-board pattern",
    patternTags: Object.freeze(["chapter-2", "dense", "expert"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  33: Object.freeze({
    concept: "Protect a late-game constellation lane",
    patternTags: Object.freeze(["chapter-2", "lane", "expert"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  34: Object.freeze({
    concept: "Coordinate several live escape lanes",
    patternTags: Object.freeze(["chapter-2", "branching", "expert"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  35: Object.freeze({
    concept: "Plan through deeper search complexity",
    patternTags: Object.freeze(["chapter-2", "search", "expert"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  36: Object.freeze({
    concept: "Enter midnight with deliberate commitments",
    patternTags: Object.freeze(["chapter-2", "midnight", "expert"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  37: Object.freeze({
    concept: "Preserve a narrow shadow route",
    patternTags: Object.freeze(["chapter-2", "lane", "expert"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  38: Object.freeze({
    concept: "Separate immediate and future value",
    patternTags: Object.freeze(["chapter-2", "planning", "expert"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  39: Object.freeze({
    concept: "Control a near-full expert board",
    patternTags: Object.freeze(["chapter-2", "dense", "expert"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  }),
  40: Object.freeze({
    concept: "Complete the Twilight Flock finale",
    patternTags: Object.freeze(["chapter-2", "finale", "expert"]),
    expectedBands: Object.freeze(["tricky", "expert"])
  })
});

const metrics = [];
const boardKeys = new Map();
const duplicateBoards = [];

for (
  let levelNumber = 1;
  levelNumber <= MAX_CAMPAIGN_LEVEL;
  levelNumber += 1
) {
  const definition = concepts[levelNumber];
  const level = createLevel(levelNumber);
  const metric = analyzeLevel(level, {
    concept: definition.concept,
    patternTags: definition.patternTags,
    nodeLimit: 300000
  });
  const boardKey = level.board
    .map((row) => row.join(","))
    .join(";");

  if (boardKeys.has(boardKey)) {
    duplicateBoards.push({
      level: levelNumber,
      duplicateOf: boardKeys.get(boardKey)
    });
  } else {
    boardKeys.set(boardKey, levelNumber);
  }

  metrics.push({
    ...metric,
    chapter: chapterForLevel(levelNumber).name,
    expectedBands: definition.expectedBands,
    intendedBandPassed:
      definition.expectedBands.includes(metric.qualityBand)
  });
}

const criticalFlags = new Set([
  "unsolved",
  "no-opening",
  "no-safe-opening",
  "solver-budget-risk"
]);

const criticalFindings = metrics
  .filter(
    (item) =>
      !item.solvable ||
      !item.intendedBandPassed ||
      item.flags.some((flag) => criticalFlags.has(flag))
  )
  .map((item) => ({
    level: item.level,
    qualityBand: item.qualityBand,
    expectedBands: item.expectedBands,
    flags: item.flags
  }));

const summary = {
  generatedAt: new Date().toISOString(),
  levels: metrics.length,
  chapters: 2,
  solvable: metrics.filter((item) => item.solvable).length,
  uniqueBoards: boardKeys.size,
  duplicateBoards,
  intendedDifficultyPassed: metrics.filter(
    (item) => item.intendedBandPassed
  ).length,
  criticalFindings,
  diagnosticFlags: metrics
    .filter((item) => item.flags.length > 0)
    .map((item) => ({
      level: item.level,
      flags: item.flags
    })),
  qualityBands: Object.fromEntries(
    [...new Set(metrics.map((item) => item.qualityBand))]
      .filter(Boolean)
      .map((band) => [
        band,
        metrics.filter(
          (item) => item.qualityBand === band
        ).length
      ])
  ),
  passed:
    metrics.length === MAX_CAMPAIGN_LEVEL &&
    metrics.every((item) => item.solvable) &&
    metrics.every((item) => item.intendedBandPassed) &&
    duplicateBoards.length === 0 &&
    criticalFindings.length === 0
};

const output = {
  summary,
  metrics
};
const json = JSON.stringify(output, null, 2);

if (process.argv[2]) {
  fs.writeFileSync(process.argv[2], `${json}\n`);
} else {
  console.log(json);
}

if (!summary.passed) {
  process.exitCode = 1;
}
