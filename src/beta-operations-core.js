import {
  evaluateFieldReadiness
} from "./field-test-core.js";
import {
  aggregateMobileCertificationReports
} from "./mobile-certification-core.js";
import {
  aggregateAccessibilityCertificationReports
} from "./accessibility-certification-core.js";
import {
  evaluateQualityEvidence
} from "./quality-evidence-core.js";

export const BETA_FEEDBACK_SCHEMA_VERSION = 1;
export const BETA_OPERATIONS_SCHEMA_VERSION = 1;
export const MAX_FEEDBACK_REPORTS = 200;

export const DEFAULT_OPERATIONAL_CHECKS = Object.freeze({
  betaDisclosurePublished: true,
  privacyPublished: true,
  supportPagePublished: true,
  releaseNotesPublished: true,
  knownIssuesPublished: true,
  accessibilityStatementPublished: true,
  feedbackExportAvailable: true,
  securityAuditPassed: true,
  backupRestoreVerified: false,
  rollbackVerified: false,
  androidChromeVerified: false,
  iosSafariVerified: false,
  offlineUpdateVerified: false,
  keyboardNavigationVerified: false,
  screenReaderVerified: false,
  textScalingVerified: false,
  forcedColorsVerified: false
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, maximum = 2000) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maximum);
}

export function createBetaDisclosure({
  acceptedAt = new Date().toISOString(),
  buildVersion = "1.2"
} = {}) {
  return {
    schemaVersion: 1,
    accepted: true,
    acceptedAt: String(acceptedAt),
    buildVersion: String(buildVersion)
  };
}

export function isBetaDisclosureAccepted(payload) {
  return Boolean(
    payload &&
    payload.schemaVersion === 1 &&
    payload.accepted === true &&
    payload.acceptedAt
  );
}

export function createFeedbackReport({
  reportId,
  buildVersion = "1.2",
  createdAt = new Date().toISOString(),
  category,
  severity,
  summary,
  description,
  reproductionSteps = "",
  expectedResult = "",
  actualResult = "",
  environment = {}
} = {}) {
  if (!reportId) {
    throw new Error("Feedback report ID is required.");
  }

  return {
    product: "Paper Flock",
    schemaVersion: BETA_FEEDBACK_SCHEMA_VERSION,
    reportId: String(reportId),
    buildVersion: String(buildVersion),
    createdAt: String(createdAt),
    category: cleanText(category, 40),
    severity: cleanText(severity, 20),
    summary: cleanText(summary, 160),
    description: cleanText(description, 3000),
    reproductionSteps: cleanText(reproductionSteps, 3000),
    expectedResult: cleanText(expectedResult, 1500),
    actualResult: cleanText(actualResult, 1500),
    environment: clone(environment)
  };
}

export function validateFeedbackReport(report) {
  const problems = [];
  const categories = new Set([
    "gameplay",
    "visual",
    "install-offline",
    "performance",
    "accessibility",
    "progress-data",
    "other"
  ]);
  const severities = new Set([
    "suggestion",
    "minor",
    "major",
    "critical"
  ]);

  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return {
      valid: false,
      problems: ["Feedback report must be an object."]
    };
  }

  if (report.product !== "Paper Flock") {
    problems.push("Feedback product is not Paper Flock.");
  }
  if (report.schemaVersion !== BETA_FEEDBACK_SCHEMA_VERSION) {
    problems.push("Unsupported feedback schema version.");
  }
  if (!report.reportId) {
    problems.push("Feedback report ID is missing.");
  }
  if (!categories.has(report.category)) {
    problems.push("Feedback category is invalid.");
  }
  if (!severities.has(report.severity)) {
    problems.push("Feedback severity is invalid.");
  }
  if (cleanText(report.summary, 160).length < 3) {
    problems.push("Feedback summary is too short.");
  }
  if (cleanText(report.description, 3000).length < 5) {
    problems.push("Feedback description is too short.");
  }

  return {
    valid: problems.length === 0,
    problems
  };
}

export function mergeFeedbackReports(
  currentReports = [],
  importedPayloads = []
) {
  const reports = currentReports.map(clone);
  const ids = new Set(reports.map((report) => report.reportId));
  const imported = [];
  const rejected = [];

  for (const payload of importedPayloads) {
    const report =
      payload?.report && typeof payload.report === "object"
        ? payload.report
        : payload;
    const validation = validateFeedbackReport(report);

    if (!validation.valid) {
      rejected.push({
        reportId: String(report?.reportId ?? ""),
        reason: validation.problems.join(" ")
      });
      continue;
    }
    if (ids.has(report.reportId)) {
      rejected.push({
        reportId: report.reportId,
        reason: "Duplicate report ID."
      });
      continue;
    }

    const normalized = createFeedbackReport(report);
    reports.push(normalized);
    imported.push(normalized);
    ids.add(normalized.reportId);
  }

  return {
    reports: reports.slice(-MAX_FEEDBACK_REPORTS),
    imported,
    rejected
  };
}

export function aggregateFeedbackReports(reports = []) {
  const valid = reports.filter(
    (report) => validateFeedbackReport(report).valid
  );
  const counts = Object.fromEntries(
    ["suggestion", "minor", "major", "critical"].map(
      (severity) => [
        severity,
        valid.filter((report) => report.severity === severity).length
      ]
    )
  );

  return {
    totalReports: reports.length,
    validReports: valid.length,
    severityCounts: counts,
    criticalReports: counts.critical,
    majorOrCriticalReports: counts.major + counts.critical,
    categories: Object.fromEntries(
      [
        "gameplay",
        "visual",
        "install-offline",
        "performance",
        "accessibility",
        "progress-data",
        "other"
      ].map((category) => [
        category,
        valid.filter((report) => report.category === category).length
      ])
    )
  };
}

export function normalizeOperationalChecks(value = {}) {
  return Object.fromEntries(
    Object.keys(DEFAULT_OPERATIONAL_CHECKS).map((key) => [
      key,
      Object.prototype.hasOwnProperty.call(value, key)
        ? Boolean(value[key])
        : DEFAULT_OPERATIONAL_CHECKS[key]
    ])
  );
}

export function createOperationsState({
  buildVersion = "1.2",
  updatedAt = new Date().toISOString(),
  checks = {}
} = {}) {
  return {
    schemaVersion: BETA_OPERATIONS_SCHEMA_VERSION,
    buildVersion: String(buildVersion),
    updatedAt: String(updatedAt),
    checks: normalizeOperationalChecks(checks)
  };
}

export function supportContactConfigured(config = {}) {
  return Boolean(
    String(config.supportEmail ?? "").trim() ||
    String(config.supportUrl ?? "").trim()
  );
}

export function unresolvedCriticalKnownIssues(issues = []) {
  return issues.filter(
    (issue) =>
      issue?.status !== "resolved" &&
      issue?.severity === "critical"
  );
}

export function deriveProductionReadiness({
  fieldSessions = [],
  mobileReports = [],
  accessibilityReports = [],
  feedbackReports = [],
  operations = createOperationsState(),
  knownIssues = [],
  config = {},
  qualityEvidence = null
} = {}) {
  const fieldEvaluation = evaluateFieldReadiness(fieldSessions);
  const mobileAggregate =
    aggregateMobileCertificationReports(mobileReports);
  const accessibilityAggregate =
    aggregateAccessibilityCertificationReports(
      accessibilityReports
    );
  const feedbackAggregate =
    aggregateFeedbackReports(feedbackReports);
  const qualityEvaluation =
    evaluateQualityEvidence(qualityEvidence ?? {});
  const checks = normalizeOperationalChecks(operations.checks);
  const supportConfigured = supportContactConfigured(config);
  const criticalKnownIssues =
    unresolvedCriticalKnownIssues(knownIssues);

  const publicBetaChecks = {
    betaDisclosurePublished: checks.betaDisclosurePublished,
    privacyPublished: checks.privacyPublished,
    supportPagePublished: checks.supportPagePublished,
    releaseNotesPublished: checks.releaseNotesPublished,
    knownIssuesPublished: checks.knownIssuesPublished,
    accessibilityStatementPublished:
      checks.accessibilityStatementPublished,
    feedbackExportAvailable: checks.feedbackExportAvailable,
    securityAuditPassed: checks.securityAuditPassed,
    noCriticalKnownIssues: criticalKnownIssues.length === 0
  };

  const productionChecks = {
    mobileInstallationCertified: mobileAggregate.certified,
    realPlayerEvidencePassed:
      fieldEvaluation.passed === true &&
      fieldEvaluation.decision === "READY FOR CLOSED ALPHA",
    supportContactConfigured: supportConfigured,
    backupRestoreVerified: checks.backupRestoreVerified,
    rollbackVerified: checks.rollbackVerified,
    androidChromeVerified: checks.androidChromeVerified,
    iosSafariVerified: checks.iosSafariVerified,
    offlineUpdateVerified: checks.offlineUpdateVerified,
    accessibilityCertified:
      accessibilityAggregate.certified,
    ciQualityEvidencePassed: qualityEvaluation.passed,
    noCriticalKnownIssues: criticalKnownIssues.length === 0,
    noCriticalFeedback: feedbackAggregate.criticalReports === 0
  };

  const publicBetaReady =
    Object.values(publicBetaChecks).every(Boolean);
  const productionCandidateReady =
    publicBetaReady &&
    Object.values(productionChecks).every(Boolean);

  let decision = "COMPLETE PUBLIC BETA SETUP";
  const reasons = [];

  if (!publicBetaReady) {
    reasons.push("One or more public-beta operational surfaces are incomplete.");
  } else if (!mobileAggregate.certified) {
    decision = "MOBILE CERTIFICATION EVIDENCE REQUIRED";
    reasons.push("Passing Android and iPhone/iPad device reports are required.");
  } else if (
    !fieldEvaluation.passed ||
    fieldEvaluation.decision !== "READY FOR CLOSED ALPHA"
  ) {
    decision = "REAL PLAYER EVIDENCE REQUIRED";
    reasons.push(
      "The 8–10 participant field-evidence gate has not passed."
    );
  } else if (!accessibilityAggregate.certified) {
    decision = "ACCESSIBILITY CERTIFICATION EVIDENCE REQUIRED";
    reasons.push(
      "Keyboard, VoiceOver, TalkBack, text-scaling, and contrast reports are required."
    );
  } else if (!qualityEvaluation.passed) {
    decision = "CI QUALITY EVIDENCE REQUIRED";
    reasons.push(
      "Import the successful GitHub Actions quality-evidence file for this build."
    );
  } else if (
    criticalKnownIssues.length > 0 ||
    feedbackAggregate.criticalReports > 0
  ) {
    decision = "RESOLVE CRITICAL DEFECTS";
    reasons.push(
      "Critical known issues or beta feedback remain unresolved."
    );
  } else if (!supportConfigured) {
    decision = "CONFIGURE PUBLIC SUPPORT CONTACT";
    reasons.push(
      "A public support email or support URL is required for production."
    );
  } else if (
    !checks.backupRestoreVerified ||
    !checks.rollbackVerified ||
    !checks.androidChromeVerified ||
    !checks.iosSafariVerified ||
    !checks.offlineUpdateVerified
  ) {
    decision = "COMPLETE RELEASE OPERATIONS";
    reasons.push(
      "Backup, rollback, browser, or offline-update drills remain incomplete."
    );
  } else if (productionCandidateReady) {
    decision = "PRODUCTION CANDIDATE READY FOR FINAL REVIEW";
    reasons.push(
      "All defined technical, evidence, support, and operational gates passed."
    );
  }

  return {
    decision,
    publicBetaReady,
    productionCandidateReady,
    publicBetaChecks,
    productionChecks,
    fieldEvaluation,
    mobileAggregate,
    accessibilityAggregate,
    feedbackAggregate,
    qualityEvaluation,
    criticalKnownIssues,
    supportConfigured,
    reasons,
    productionApproved: false,
    finalHumanReleaseReviewRequired: true
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

export function feedbackReportsToCsv(reports = []) {
  const headers = [
    "report_id",
    "build_version",
    "created_at",
    "category",
    "severity",
    "summary",
    "description",
    "reproduction_steps",
    "expected_result",
    "actual_result",
    "display_mode",
    "online",
    "user_agent"
  ];

  const rows = reports.map((report) => [
    report.reportId,
    report.buildVersion,
    report.createdAt,
    report.category,
    report.severity,
    report.summary,
    report.description,
    report.reproductionSteps,
    report.expectedResult,
    report.actualResult,
    report.environment?.displayMode,
    report.environment?.online,
    report.environment?.userAgent
  ].map(csvEscape));

  return [
    headers.join(","),
    ...rows.map((row) => row.join(","))
  ].join("\n");
}
