import fs from "node:fs";
import {
  aggregateTactileSessions,
  evaluateTactileReadiness,
  tactileSessionsToCsv
} from "../src/tactile-test-core.js";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error(
    "Usage: node tools/analyze-tactile-test.mjs <core-feel-sessions.json> [--csv]"
  );
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const sessions = Array.isArray(payload.sessions)
  ? payload.sessions
  : payload.session
    ? [payload.session]
    : [];

const aggregate = aggregateTactileSessions(sessions);
const evaluation = evaluateTactileReadiness(aggregate);

console.log(JSON.stringify({ aggregate, evaluation }, null, 2));

if (process.argv.includes("--csv")) {
  process.stdout.write("\n");
  process.stdout.write(tactileSessionsToCsv(sessions));
  process.stdout.write("\n");
}
