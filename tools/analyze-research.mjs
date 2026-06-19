import fs from "node:fs";
import {
  aggregateSessions,
  sessionsToCsv
} from "../src/research-core.js";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node tools/analyze-research.mjs <research-sessions.json>");
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const sessions = Array.isArray(payload.sessions)
  ? payload.sessions
  : payload.session
    ? [payload.session]
    : [];

const aggregate = aggregateSessions(sessions);
console.log(JSON.stringify(aggregate, null, 2));

if (process.argv.includes("--csv")) {
  process.stdout.write("\n");
  process.stdout.write(sessionsToCsv(sessions));
  process.stdout.write("\n");
}
