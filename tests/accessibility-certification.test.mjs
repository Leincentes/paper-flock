import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ACCESSIBILITY_TEST_TYPES,
  accessibilityCertificationReportsToCsv,
  aggregateAccessibilityCertificationReports,
  completeAccessibilityCertificationReport,
  createAccessibilityCertificationReport,
  evaluateAccessibilityCertificationReport,
  importAccessibilityCertificationReports,
  normalizeAccessibilityCertificationCode,
  normalizeAccessibilityTestType,
  requiredChecksForType,
  validateAccessibilityCertificationReport
} from "../src/accessibility-certification-core.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function passingReport(testType, index = 1) {
  const report = createAccessibilityCertificationReport({
    reportId: `${testType}-${index}`,
    participantCode:
      `AC-${testType.replaceAll("-", "").toUpperCase()}-${index}`,
    testType,
    startedAt: "2026-06-19T00:00:00.000Z"
  });

  const patch = Object.fromEntries(
    requiredChecksForType(testType).map(
      (key) => [key, true]
    )
  );

  return completeAccessibilityCertificationReport(
    report,
    {
      completedAt: "2026-06-19T00:20:00.000Z",
      patch: {
        ...patch,
        assistiveTechnology: testType,
        criticalDefect: false
      }
    }
  );
}

test("accessibility certification codes and test types normalize", () => {
  assert.equal(
    normalizeAccessibilityCertificationCode(" ac voiceover "),
    "AC-VOICEOVER"
  );
  assert.equal(normalizeAccessibilityTestType("TalkBack"), "talkback");
  assert.equal(normalizeAccessibilityTestType("unknown"), "other");
});

test("each supported test type defines physical checks", () => {
  for (const type of ACCESSIBILITY_TEST_TYPES) {
    assert.ok(requiredChecksForType(type).length >= 5);
  }
});

test("a report passes only when every check passes and no critical barrier exists", () => {
  const passed = passingReport("keyboard");
  assert.equal(
    evaluateAccessibilityCertificationReport(passed).passed,
    true
  );

  const incomplete = structuredClone(passed);
  incomplete.checks.skipLinkPassed = false;
  assert.equal(
    evaluateAccessibilityCertificationReport(incomplete).passed,
    false
  );

  const critical = structuredClone(passed);
  critical.criticalDefect = true;
  assert.equal(
    evaluateAccessibilityCertificationReport(critical).passed,
    false
  );
});

test("certification requires keyboard, VoiceOver, TalkBack, text, and contrast evidence", () => {
  const partial = ACCESSIBILITY_TEST_TYPES
    .slice(0, 4)
    .map((type, index) => passingReport(type, index + 1));

  let aggregate =
    aggregateAccessibilityCertificationReports(partial);
  assert.equal(aggregate.certified, false);
  assert.deepEqual(aggregate.missingTypes, ["contrast"]);

  const complete = [
    ...partial,
    passingReport("contrast", 5)
  ];
  aggregate =
    aggregateAccessibilityCertificationReports(complete);

  assert.equal(aggregate.certified, true);
  assert.equal(
    aggregate.decision,
    "ACCESSIBILITY CERTIFIED FOR PUBLIC BETA"
  );
  assert.equal(aggregate.productionApproved, false);
});

test("report import rejects malformed and duplicate evidence", () => {
  const keyboard = passingReport("keyboard");
  const result = importAccessibilityCertificationReports(
    [],
    [
      { report: keyboard },
      { report: keyboard },
      { product: "Another game" }
    ]
  );

  assert.equal(result.imported.length, 1);
  assert.equal(result.rejected.length, 2);
  assert.equal(result.reports.length, 1);
});

test("validation rejects incomplete reports", () => {
  const report = createAccessibilityCertificationReport({
    reportId: "active",
    participantCode: "AC-ACTIVE",
    testType: "contrast"
  });
  const validation =
    validateAccessibilityCertificationReport(report);

  assert.equal(validation.valid, false);
  assert.match(validation.problems.join(" "), /not complete/);
});

test("accessibility CSV escapes assistive-technology notes", () => {
  const report = passingReport("voiceover");
  report.notes = 'Focus moved, "then returned"\nafter close.';

  const csv = accessibilityCertificationReportsToCsv([report]);
  assert.match(
    csv,
    /"Focus moved, ""then returned""\nafter close\."/
  );
});

test("accessibility certification remains internal and is excluded from production", () => {
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );
  const worker = fs.readFileSync(
    path.join(root, "service-worker.js"),
    "utf8"
  );

  assert.equal(
    fs.existsSync(
      path.join(root, "src/accessibility-certification-core.js")
    ),
    true
  );
  assert.doesNotMatch(
    html,
    /accessibility-certification-ui/
  );
  assert.doesNotMatch(
    worker,
    /accessibility-certification/
  );
});
