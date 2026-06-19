import fs from "node:fs";
import {
  aggregateVisualSessions,
  evaluateVisualReadiness,
  visualSessionsToCsv
} from "../src/visual-test-core.js";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error(
    "Usage: node tools/analyze-visual-test.mjs <visual-sessions.json> [--csv]"
  );
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const sessions = Array.isArray(payload.sessions)
  ? payload.sessions
  : payload.session
    ? [payload.session]
    : [];

const aggregate = aggregateVisualSessions(sessions);
const evaluation = evaluateVisualReadiness(aggregate);

console.log(
  JSON.stringify(
    {
      aggregate,
      evaluation
    },
    null,
    2
  )
);

if (process.argv.includes("--csv")) {
  process.stdout.write("\n");
  process.stdout.write(visualSessionsToCsv(sessions));
  process.stdout.write("\n");
}
