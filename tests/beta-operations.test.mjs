import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  aggregateFeedbackReports,
  createBetaDisclosure,
  createFeedbackReport,
  createOperationsState,
  deriveProductionReadiness,
  feedbackReportsToCsv,
  isBetaDisclosureAccepted,
  mergeFeedbackReports,
  supportContactConfigured,
  validateFeedbackReport
} from "../src/beta-operations-core.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function feedback(overrides = {}) {
  return createFeedbackReport({
    reportId: overrides.reportId ?? "feedback-1",
    category: overrides.category ?? "gameplay",
    severity: overrides.severity ?? "minor",
    summary: overrides.summary ?? "Level response felt unclear",
    description:
      overrides.description ??
      "The tapped bird did not appear to react immediately.",
    reproductionSteps: overrides.reproductionSteps ?? "Open Level 3 and tap.",
    expectedResult: overrides.expectedResult ?? "Immediate response",
    actualResult: overrides.actualResult ?? "Response felt delayed"
  });
}

test("beta disclosure requires an explicit accepted record", () => {
  assert.equal(isBetaDisclosureAccepted(null), false);
  assert.equal(
    isBetaDisclosureAccepted(
      createBetaDisclosure({
        acceptedAt: "2026-06-19T00:00:00.000Z"
      })
    ),
    true
  );
});

test("feedback validation requires safe structured fields", () => {
  const report = feedback();
  assert.equal(validateFeedbackReport(report).valid, true);

  const invalid = {
    ...report,
    category: "unknown",
    severity: "danger",
    summary: ""
  };
  assert.equal(validateFeedbackReport(invalid).valid, false);
});

test("feedback import rejects duplicate IDs and malformed payloads", () => {
  const report = feedback();
  const result = mergeFeedbackReports(
    [report],
    [
      { report },
      { product: "Another game" },
      { report: feedback({ reportId: "feedback-2" }) }
    ]
  );

  assert.equal(result.imported.length, 1);
  assert.equal(result.rejected.length, 2);
  assert.equal(result.reports.length, 2);
});

test("feedback aggregation exposes critical production blockers", () => {
  const aggregate = aggregateFeedbackReports([
    feedback({ reportId: "minor", severity: "minor" }),
    feedback({ reportId: "critical", severity: "critical" })
  ]);

  assert.equal(aggregate.validReports, 2);
  assert.equal(aggregate.criticalReports, 1);
  assert.equal(aggregate.majorOrCriticalReports, 1);
});

test("feedback CSV safely escapes multiline text", () => {
  const report = feedback({
    summary: 'Bird "stopped", then moved',
    description: "First line\nSecond line"
  });
  const csv = feedbackReportsToCsv([report]);
  assert.match(csv, /"Bird ""stopped"", then moved"/);
  assert.match(csv, /"First line\nSecond line"/);
});

test("support contact accepts either email or URL", () => {
  assert.equal(supportContactConfigured({}), false);
  assert.equal(
    supportContactConfigured({ supportEmail: "support@example.test" }),
    true
  );
  assert.equal(
    supportContactConfigured({ supportUrl: "https://example.test/help" }),
    true
  );
});

test("production readiness remains blocked without real evidence", () => {
  const readiness = deriveProductionReadiness({
    operations: createOperationsState(),
    config: {},
    knownIssues: [],
    feedbackReports: []
  });

  assert.equal(readiness.publicBetaReady, true);
  assert.equal(readiness.productionCandidateReady, false);
  assert.equal(
    readiness.decision,
    "MOBILE CERTIFICATION EVIDENCE REQUIRED"
  );
  assert.equal(readiness.productionApproved, false);
});

test("critical beta feedback takes precedence after evidence gates", () => {
  const mockMobileReports = [
    {
      product: "Paper Flock",
      schemaVersion: 1,
      buildVersion: "1.0",
      reportId: "android",
      participantCode: "MC-ANDROID",
      deviceFamily: "android",
      status: "complete",
      checks: {
        automaticAuditPassed: true,
        installMethodPassed: true,
        standaloneLaunchPassed: true,
        exactResumePassed: true,
        offlineLaunchPassed: true,
        updatePreservedPassed: true
      },
      criticalDefect: false
    },
    {
      product: "Paper Flock",
      schemaVersion: 1,
      buildVersion: "1.0",
      reportId: "ios",
      participantCode: "MC-IOS",
      deviceFamily: "ios",
      status: "complete",
      checks: {
        automaticAuditPassed: true,
        installMethodPassed: true,
        standaloneLaunchPassed: true,
        exactResumePassed: true,
        offlineLaunchPassed: true,
        updatePreservedPassed: true
      },
      criticalDefect: false
    }
  ];

  // No field sessions still means real-player evidence is the next gate.
  const readiness = deriveProductionReadiness({
    mobileReports: mockMobileReports,
    feedbackReports: [
      feedback({ reportId: "critical-2", severity: "critical" })
    ],
    operations: createOperationsState({
      checks: {
        backupRestoreVerified: true,
        rollbackVerified: true,
        androidChromeVerified: true,
        iosSafariVerified: true,
        offlineUpdateVerified: true
      }
    }),
    config: {
      supportEmail: "support@example.test"
    }
  });

  assert.equal(
    readiness.decision,
    "REAL PLAYER EVIDENCE REQUIRED"
  );
  assert.equal(readiness.feedbackAggregate.criticalReports, 1);
});

test("public beta pages and machine-readable registers exist", () => {
  for (const file of [
    "privacy.html",
    "support.html",
    "release-notes.html",
    "known-issues.html",
    "app-config.json",
    "known-issues.json",
    "release-notes.json"
  ]) {
    assert.equal(
      fs.existsSync(path.join(root, file)),
      true,
      `${file} should exist`
    );
  }

  const config = JSON.parse(
    fs.readFileSync(path.join(root, "app-config.json"), "utf8")
  );
  assert.equal(config.releaseChannel, "production");
  assert.equal(config.automaticUploads, false);
});

test("index loads beta operations and exposes public support links", () => {
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );
  assert.match(html, /src="\.\/src\/beta-operations-ui\.js"/);
  assert.match(html, /id="beta-feedback-button"/);
  assert.match(html, /privacy\.html/);
  assert.match(html, /support\.html/);
});
