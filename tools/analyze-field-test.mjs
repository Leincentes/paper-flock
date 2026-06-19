import fs from "node:fs";
import {
  aggregateFieldCoverage,
  evaluateFieldReadiness,
  extractTactileSessions,
  nextParticipantRecommendations
} from "../src/field-test-core.js";
import {
  aggregateTactileSessions,
  tactileSessionsToCsv
} from "../src/tactile-test-core.js";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error(
    "Usage: node tools/analyze-field-test.mjs <field-sessions.json> [--csv]"
  );
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const sessions = extractTactileSessions(payload);
const tactileAggregate = aggregateTactileSessions(sessions);
const fieldCoverage = aggregateFieldCoverage(sessions);
const fieldEvaluation = evaluateFieldReadiness(sessions);
const recommendations = nextParticipantRecommendations(sessions);

console.log(
  JSON.stringify(
    {
      tactileAggregate,
      fieldCoverage,
      fieldEvaluation,
      recommendations
    },
    null,
    2
  )
);

if (process.argv.includes("--csv")) {
  process.stdout.write("\n");
  process.stdout.write(tactileSessionsToCsv(sessions));
  process.stdout.write("\n");
}
