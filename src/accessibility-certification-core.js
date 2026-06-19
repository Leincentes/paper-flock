import {
  STORAGE_KEYS
} from "./storage-core.js";

export const ACCESSIBILITY_CERTIFICATION_SCHEMA_VERSION = 1;
export const ACCESSIBILITY_CERTIFICATION_ARCHIVE_KEY =
  STORAGE_KEYS.accessibilityCertification;

export const ACCESSIBILITY_TEST_TYPES = Object.freeze([
  "keyboard",
  "voiceover",
  "talkback",
  "text-scaling",
  "contrast"
]);

export const ACCESSIBILITY_CHECKS = Object.freeze({
  keyboard: Object.freeze([
    "skipLinkPassed",
    "boardArrowNavigationPassed",
    "keyboardActivationPassed",
    "modalFocusTrapPassed",
    "escapeClosePassed",
    "focusReturnPassed"
  ]),
  voiceover: Object.freeze([
    "controlsDiscoverablePassed",
    "birdLabelsPassed",
    "gameAnnouncementsPassed",
    "modalFocusPassed",
    "completePuzzlePassed"
  ]),
  talkback: Object.freeze([
    "controlsDiscoverablePassed",
    "birdLabelsPassed",
    "gameAnnouncementsPassed",
    "modalFocusPassed",
    "completePuzzlePassed"
  ]),
  "text-scaling": Object.freeze([
    "largeTextPassed",
    "extraLargeTextPassed",
    "noClippingPassed",
    "scrollReachabilityPassed",
    "puzzleStillPlayablePassed"
  ]),
  contrast: Object.freeze([
    "focusVisiblePassed",
    "birdDirectionVisiblePassed",
    "emptyCellsDistinctPassed",
    "disabledControlsDistinctPassed",
    "noColorOnlyInformationPassed"
  ])
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, maximum = 1500) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximum);
}

export function normalizeAccessibilityTestType(value) {
  const normalized = cleanText(value, 40).toLowerCase();
  return ACCESSIBILITY_TEST_TYPES.includes(normalized)
    ? normalized
    : "other";
}

export function normalizeAccessibilityCertificationCode(value) {
  return cleanText(value, 18)
    .toUpperCase()
    .replace(/\s+/g, "-");
}

export function isValidAccessibilityCertificationCode(value) {
  return /^[A-Z0-9][A-Z0-9_-]{1,17}$/.test(
    normalizeAccessibilityCertificationCode(value)
  );
}

export function requiredChecksForType(testType) {
  return [
    ...(ACCESSIBILITY_CHECKS[
      normalizeAccessibilityTestType(testType)
    ] ?? [])
  ];
}

export function createAccessibilityCertificationReport({
  reportId,
  participantCode,
  testType,
  buildVersion = "1.4.2",
  startedAt = new Date().toISOString(),
  environment = {}
} = {}) {
  const code =
    normalizeAccessibilityCertificationCode(participantCode);
  const normalizedType =
    normalizeAccessibilityTestType(testType);

  if (!reportId) {
    throw new Error("Accessibility report ID is required.");
  }
  if (!isValidAccessibilityCertificationCode(code)) {
    throw new Error(
      "Certification code must contain 2–18 letters, numbers, hyphens, or underscores."
    );
  }
  if (!ACCESSIBILITY_TEST_TYPES.includes(normalizedType)) {
    throw new Error("A supported accessibility test type is required.");
  }

  return {
    product: "Paper Flock",
    schemaVersion: ACCESSIBILITY_CERTIFICATION_SCHEMA_VERSION,
    buildVersion: String(buildVersion),
    reportId: String(reportId),
    participantCode: code,
    testType: normalizedType,
    status: "active",
    startedAt: String(startedAt),
    completedAt: null,
    checks: Object.fromEntries(
      requiredChecksForType(normalizedType).map(
        (key) => [key, false]
      )
    ),
    environment: clone(environment),
    assistiveTechnology: "",
    criticalDefect: false,
    criticalDefectDescription: "",
    notes: ""
  };
}

export function updateAccessibilityCertificationReport(
  report,
  patch = {}
) {
  const next = clone(report);
  const required = requiredChecksForType(next.testType);

  next.checks = Object.fromEntries(
    required.map((key) => [
      key,
      Object.prototype.hasOwnProperty.call(patch, key)
        ? Boolean(patch[key])
        : Boolean(report?.checks?.[key])
    ])
  );

  if (
    Object.prototype.hasOwnProperty.call(
      patch,
      "assistiveTechnology"
    )
  ) {
    next.assistiveTechnology = cleanText(
      patch.assistiveTechnology,
      120
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(
      patch,
      "criticalDefect"
    )
  ) {
    next.criticalDefect = Boolean(patch.criticalDefect);
  }
  if (
    Object.prototype.hasOwnProperty.call(
      patch,
      "criticalDefectDescription"
    )
  ) {
    next.criticalDefectDescription = cleanText(
      patch.criticalDefectDescription,
      1200
    );
  }
  if (Object.prototype.hasOwnProperty.call(patch, "notes")) {
    next.notes = cleanText(patch.notes, 1800);
  }

  return next;
}

export function evaluateAccessibilityCertificationReport(
  report = {}
) {
  const type = normalizeAccessibilityTestType(report.testType);
  const required = requiredChecksForType(type);
  const checks = Object.fromEntries(
    required.map((key) => [key, Boolean(report?.checks?.[key])])
  );
  const validType = ACCESSIBILITY_TEST_TYPES.includes(type);
  const allChecksPassed =
    required.length > 0 &&
    required.every((key) => checks[key]);
  const noCriticalDefect = report.criticalDefect !== true;

  return {
    passed: validType && allChecksPassed && noCriticalDefect,
    validType,
    allChecksPassed,
    noCriticalDefect,
    checks,
    failedChecks: required.filter((key) => !checks[key])
  };
}

export function completeAccessibilityCertificationReport(
  report,
  {
    completedAt = new Date().toISOString(),
    patch = {}
  } = {}
) {
  const next = updateAccessibilityCertificationReport(
    report,
    patch
  );
  next.status = "complete";
  next.completedAt = String(completedAt);
  next.evaluation =
    evaluateAccessibilityCertificationReport(next);
  next.productionApproved = false;
  next.finalHumanReleaseReviewRequired = true;
  return next;
}

export function validateAccessibilityCertificationReport(
  payload
) {
  const problems = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      valid: false,
      problems: ["Report must be a JSON object."]
    };
  }

  if (payload.product !== "Paper Flock") {
    problems.push("Report product is not Paper Flock.");
  }
  if (
    payload.schemaVersion !==
    ACCESSIBILITY_CERTIFICATION_SCHEMA_VERSION
  ) {
    problems.push("Unsupported accessibility report schema.");
  }
  if (!payload.reportId) {
    problems.push("Report ID is missing.");
  }
  if (
    !isValidAccessibilityCertificationCode(
      payload.participantCode
    )
  ) {
    problems.push("Participant code is invalid.");
  }
  if (
    !ACCESSIBILITY_TEST_TYPES.includes(
      normalizeAccessibilityTestType(payload.testType)
    )
  ) {
    problems.push("Accessibility test type is invalid.");
  }
  if (payload.status !== "complete") {
    problems.push("Report is not complete.");
  }
  if (!payload.checks || typeof payload.checks !== "object") {
    problems.push("Accessibility checks are missing.");
  }

  return {
    valid: problems.length === 0,
    problems
  };
}

export function importAccessibilityCertificationReports(
  currentReports = [],
  payloads = []
) {
  const reports = currentReports.map(clone);
  const reportIds = new Set(
    reports.map((report) => report.reportId)
  );
  const testCodes = new Set(
    reports.map(
      (report) =>
        `${report.testType}:${report.participantCode}`
    )
  );
  const imported = [];
  const rejected = [];

  for (const payload of payloads) {
    const report =
      payload?.report && typeof payload.report === "object"
        ? payload.report
        : payload;
    const validation =
      validateAccessibilityCertificationReport(report);

    if (!validation.valid) {
      rejected.push({
        reportId: String(report?.reportId ?? ""),
        reason: validation.problems.join(" ")
      });
      continue;
    }

    const key =
      `${normalizeAccessibilityTestType(report.testType)}:` +
      `${normalizeAccessibilityCertificationCode(
        report.participantCode
      )}`;

    if (reportIds.has(report.reportId)) {
      rejected.push({
        reportId: report.reportId,
        reason: "Duplicate report ID."
      });
      continue;
    }
    if (testCodes.has(key)) {
      rejected.push({
        reportId: report.reportId,
        reason:
          "Duplicate participant code for this accessibility test type."
      });
      continue;
    }

    const normalized = clone(report);
    normalized.testType =
      normalizeAccessibilityTestType(normalized.testType);
    normalized.participantCode =
      normalizeAccessibilityCertificationCode(
        normalized.participantCode
      );
    normalized.evaluation =
      evaluateAccessibilityCertificationReport(normalized);

    reports.push(normalized);
    imported.push(normalized);
    reportIds.add(normalized.reportId);
    testCodes.add(key);
  }

  return {
    reports,
    imported,
    rejected
  };
}

export function aggregateAccessibilityCertificationReports(
  reports = []
) {
  const validReports = reports.filter(
    (report) =>
      validateAccessibilityCertificationReport(report).valid
  );
  const passedReports = validReports.filter(
    (report) =>
      evaluateAccessibilityCertificationReport(report).passed
  );

  const typeResults = Object.fromEntries(
    ACCESSIBILITY_TEST_TYPES.map((type) => {
      const matching = validReports.filter(
        (report) =>
          normalizeAccessibilityTestType(report.testType) === type
      );
      const passed = matching.filter(
        (report) =>
          evaluateAccessibilityCertificationReport(report).passed
      );
      return [
        type,
        {
          reports: matching.length,
          passedReports: passed.length,
          passed: passed.length > 0
        }
      ];
    })
  );

  const criticalDefects = validReports.filter(
    (report) => report.criticalDefect === true
  ).length;
  const certified =
    ACCESSIBILITY_TEST_TYPES.every(
      (type) => typeResults[type].passed
    ) &&
    criticalDefects === 0;

  return {
    totalReports: reports.length,
    validReports: validReports.length,
    passedReports: passedReports.length,
    typeResults,
    missingTypes: ACCESSIBILITY_TEST_TYPES.filter(
      (type) => !typeResults[type].passed
    ),
    criticalDefects,
    certified,
    decision: certified
      ? "ACCESSIBILITY CERTIFIED FOR PUBLIC BETA"
      : validReports.length === 0
        ? "NOT ENOUGH ACCESSIBILITY EVIDENCE"
        : "ACCESSIBILITY TESTING REQUIRED",
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

export function accessibilityCertificationReportsToCsv(
  reports = []
) {
  const checkHeaders = [
    ...new Set(
      Object.values(ACCESSIBILITY_CHECKS).flat()
    )
  ];
  const headers = [
    "participant_code",
    "report_id",
    "test_type",
    "build_version",
    "status",
    ...checkHeaders,
    "assistive_technology",
    "critical_defect",
    "critical_defect_description",
    "notes",
    "started_at",
    "completed_at"
  ];

  const rows = reports.map((report) => [
    report.participantCode,
    report.reportId,
    normalizeAccessibilityTestType(report.testType),
    report.buildVersion,
    report.status,
    ...checkHeaders.map(
      (key) =>
        Object.prototype.hasOwnProperty.call(
          report.checks ?? {},
          key
        )
          ? Boolean(report.checks[key])
          : ""
    ),
    report.assistiveTechnology,
    Boolean(report.criticalDefect),
    report.criticalDefectDescription,
    report.notes,
    report.startedAt,
    report.completedAt
  ].map(csvEscape));

  return [
    headers.join(","),
    ...rows.map((row) => row.join(","))
  ].join("\n");
}
