import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateMobileCertificationReports,
  completeDeviceCertificationReport,
  createDeviceCertificationReport,
  evaluateDeviceCertificationReport,
  importDeviceCertificationReports,
  isValidCertificationCode,
  mobileCertificationReportsToCsv,
  normalizeCertificationCode,
  normalizeDeviceFamily,
  validateDeviceCertificationReport
} from "../src/mobile-certification-core.js";

function passedReport({
  reportId,
  participantCode,
  deviceFamily
}) {
  const report = createDeviceCertificationReport({
    reportId,
    participantCode,
    deviceFamily,
    startedAt: "2026-06-19T00:00:00.000Z"
  });

  return completeDeviceCertificationReport(report, {
    completedAt: "2026-06-19T00:15:00.000Z",
    patch: {
      automaticAuditPassed: true,
      installMethodPassed: true,
      standaloneLaunchPassed: true,
      exactResumePassed: true,
      offlineLaunchPassed: true,
      updatePreservedPassed: true,
      criticalDefect: false
    }
  });
}

test("mobile certification codes and device families normalize safely", () => {
  assert.equal(
    normalizeCertificationCode(" mc android "),
    "MC-ANDROID"
  );
  assert.equal(isValidCertificationCode("MC-ANDROID"), true);
  assert.equal(isValidCertificationCode("A"), false);
  assert.equal(normalizeDeviceFamily("iPadOS"), "ios");
  assert.equal(normalizeDeviceFamily("Chrome-Android"), "android");
  assert.equal(normalizeDeviceFamily("desktop"), "other");
});

test("a device report passes only when every physical check passes", () => {
  const android = passedReport({
    reportId: "android-1",
    participantCode: "MC-ANDROID",
    deviceFamily: "android"
  });
  assert.equal(
    evaluateDeviceCertificationReport(android).passed,
    true
  );

  const incomplete = structuredClone(android);
  incomplete.checks.offlineLaunchPassed = false;
  const evaluation =
    evaluateDeviceCertificationReport(incomplete);
  assert.equal(evaluation.passed, false);
  assert.deepEqual(
    evaluation.failedChecks,
    ["offlineLaunchPassed"]
  );
});

test("a critical defect blocks an otherwise complete device report", () => {
  const report = passedReport({
    reportId: "ios-1",
    participantCode: "MC-IOS",
    deviceFamily: "ios"
  });
  report.criticalDefect = true;
  assert.equal(
    evaluateDeviceCertificationReport(report).passed,
    false
  );
});

test("mobile installation certification requires passing Android and iOS reports", () => {
  const android = passedReport({
    reportId: "android-2",
    participantCode: "MC-A2",
    deviceFamily: "android"
  });

  let aggregate =
    aggregateMobileCertificationReports([android]);
  assert.equal(aggregate.certified, false);
  assert.equal(
    aggregate.decision,
    "MOBILE INSTALLATION TESTING REQUIRED"
  );

  const ios = passedReport({
    reportId: "ios-2",
    participantCode: "MC-I2",
    deviceFamily: "ios"
  });
  aggregate =
    aggregateMobileCertificationReports([android, ios]);

  assert.equal(aggregate.androidPassed, true);
  assert.equal(aggregate.iosPassed, true);
  assert.equal(aggregate.certified, true);
  assert.equal(
    aggregate.decision,
    "MOBILE INSTALLATION CERTIFIED"
  );
  assert.equal(aggregate.closedAlphaApproved, false);
});

test("mobile report import rejects malformed and duplicate evidence", () => {
  const android = passedReport({
    reportId: "android-import",
    participantCode: "MC-IMPORT",
    deviceFamily: "android"
  });

  const result = importDeviceCertificationReports(
    [],
    [
      { report: android },
      { report: android },
      { product: "Another Product" }
    ]
  );

  assert.equal(result.imported.length, 1);
  assert.equal(result.rejected.length, 2);
  assert.equal(result.reports.length, 1);
});

test("mobile report validation rejects desktop and incomplete reports", () => {
  const report = createDeviceCertificationReport({
    reportId: "desktop",
    participantCode: "MC-DESKTOP",
    deviceFamily: "other"
  });
  const validation =
    validateDeviceCertificationReport(report);
  assert.equal(validation.valid, false);
  assert.match(
    validation.problems.join(" "),
    /Android or iPhone\/iPad/
  );
});

test("mobile certification CSV escapes free-text notes", () => {
  const report = passedReport({
    reportId: "ios-csv",
    participantCode: "MC-CSV",
    deviceFamily: "ios"
  });
  report.notes = 'Works, "offline"\nwith Home Screen launch';

  const csv = mobileCertificationReportsToCsv([report]);
  assert.match(
    csv,
    /"Works, ""offline""\nwith Home Screen launch"/
  );
});
