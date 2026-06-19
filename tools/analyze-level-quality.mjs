import fs from "node:fs";
import { createLevel } from "../src/game-core.js";
import { analyzeLevel } from "../src/level-quality-core.js";

const concepts = {
  1: ["Single clear path", ["tutorial", "direction"]],
  2: ["Observe two clockwise folds", ["tutorial", "rotation"]],
  3: ["Follow a forced chain", ["tutorial", "chain"]],
  4: ["Recover from a deliberate dead end", ["tutorial", "undo", "trap"]],
  5: ["Independent understanding check", ["tutorial", "choice"]],
  6: ["Wide openings with low punishment", ["edge-reading", "gentle"]],
  7: ["Compare multiple safe exits", ["choice", "gentle"]],
  8: ["Plan around a compact cluster", ["cluster", "gentle"]],
  9: ["Use a rotation to open the edge", ["setup", "steady"]],
  10: ["Avoid an early misleading route", ["trap", "steady"]],
  11: ["Balance two active regions", ["split-board", "steady"]],
  12: ["Preserve a future escape lane", ["lane", "steady"]],
  13: ["Read a larger five-by-five flock", ["board-growth", "measured"]],
  14: ["Sequence several edge releases", ["sequence", "measured"]],
  15: ["Choose between competing chains", ["branching", "measured"]],
  16: ["Recover from a mid-puzzle trap", ["trap", "tricky"]],
  17: ["Plan a longer rotation cascade", ["cascade", "tricky"]],
  18: ["Protect a narrow late-game lane", ["lane", "tricky"]],
  19: ["Expert branching and trap control", ["branching", "expert"]],
  20: ["Full-system mastery finale", ["finale", "expert"]]
};

const metrics = [];
for (let levelNumber = 1; levelNumber <= 20; levelNumber += 1) {
  const [concept, patternTags] = concepts[levelNumber];
  metrics.push(
    analyzeLevel(createLevel(levelNumber), {
      concept,
      patternTags,
      nodeLimit: 300000
    })
  );
}

const summary = {
  generatedAt: new Date().toISOString(),
  levels: metrics.length,
  solvable: metrics.filter((item) => item.solvable).length,
  flaggedLevels: metrics
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
        metrics.filter((item) => item.qualityBand === band).length
      ])
  )
};

const output = { summary, metrics };
const json = JSON.stringify(output, null, 2);

if (process.argv[2]) {
  fs.writeFileSync(process.argv[2], `${json}\n`);
} else {
  console.log(json);
}
