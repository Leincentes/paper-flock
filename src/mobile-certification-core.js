import { STORAGE_KEYS } from "./storage-core.js";

export const MOBILE_CERTIFICATION_SCHEMA_VERSION = 1;
export const MOBILE_CERTIFICATION_ARCHIVE_KEY =
  STORAGE_KEYS.mobileCertification;

export const REQUIRED_DEVICE_FAMILIES = Object.freeze([
  "android",
  "ios"
]);

export const REQUIRED_DEVICE_CHECKS = Object.freeze([
  "automaticAuditPassed",
  "installMethodPassed",
  "standaloneLaunchPassed",
  "exactResumePassed",
  "offlineLaunchPassed",
  "updatePreservedPassed"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanString(value, maximum = 500) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximum);
}

export function normalizeDeviceFamily(value) {
  const normalized = cleanString(value, 30).toLowerCase();
  if (["iphone", "ipad", "ios", "ipados"].includes(normalized)) {
    return "ios";
  }
  if (["android", "chrome-android"].includes(normalized)) {
    return "android";
  }
  return "other";
}

export function normalizeCertificationCode(value) {
  return cleanString(value, 16)
    .toUpperCase()
    .replace(/\s+/g, "-");
}

export function isValidCertificationCode(value) {
  return /^[A-Z0-9][A-Z0-9_-]{1,15}$/.test(
    normalizeCertificationCode(value)
  );
}

export function createDeviceCertificationReport({
  reportId,
  participantCode,
  deviceFamily,
  buildVersion = "1.2",
  startedAt = new Date().toISOString(),
  environment = {}
} = {}) {
  const code = normalizeCertificationCode(participantCode);
  if (!isValidCertificationCode(code)) {
    throw new Error(
      "Certification code must contain 2–16 letters, numbers, hyphens, or underscores."
    );
  }
  if (!reportId) {
    throw new Error("A report ID is required.");
  }

  return {
    product: "Paper Flock",
    schemaVersion: MOBILE_CERTIFICATION_SCHEMA_VERSION,
    buildVersion: String(buildVersion),
    reportId: String(reportId),
    participantCode: code,
    deviceFamily: normalizeDeviceFamily(deviceFamily),
    status: "active",
    startedAt: String(startedAt),
    completedAt: null,
    checks: Object.fromEntries(
      REQUIRED_DEVICE_CHECKS.map((key) => [key, false])
    ),
    environment: clone(environment),
    criticalDefect: false,
    criticalDefectDescription: "",
    notes: ""
  };
}

export function updateDeviceCertificationReport(
  report,
  patch = {}
) {
  const next = clone(report);
  next.checks = {
    ...Object.fromEntries(
      REQUIRED_DEVICE_CHECKS.map((key) => [
        key,
        Boolean(report?.checks?.[key])
      ])
    ),
    ...Object.fromEntries(
      REQUIRED_DEVICE_CHECKS
        .filter((key) =>
          Object.prototype.hasOwnProperty.call(patch, key)
        )
        .map((key) => [key, Boolean(patch[key])])
    )
  };

  if (Object.prototype.hasOwnProperty.call(patch, "criticalDefect")) {
    next.criticalDefect = Boolean(patch.criticalDefect);
  }
  if (
    Object.prototype.hasOwnProperty.call(
      patch,
      "criticalDefectDescription"
    )
  ) {
    next.criticalDefectDescription = cleanString(
      patch.criticalDefectDescription,
      1000
    );
  }
  if (Object.prototype.hasOwnProperty.call(patch, "notes")) {
    next.notes = cleanString(patch.notes, 1500);
  }

  return next;
}

export function evaluateDeviceCertificationReport(report = {}) {
  const checks = Object.fromEntries(
    REQUIRED_DEVICE_CHECKS.map((key) => [
      key,
      Boolean(report?.checks?.[key])
    ])
  );
  const requiredPassed = REQUIRED_DEVICE_CHECKS.every(
    (key) => checks[key]
  );
  const validDevice = REQUIRED_DEVICE_FAMILIES.includes(
    normalizeDeviceFamily(report.deviceFamily)
  );
  const noCriticalDefect = report.criticalDefect !== true;

  return {
    passed: requiredPassed && validDevice && noCriticalDefect,
    requiredPassed,
    validDevice,
    noCriticalDefect,
    checks,
    failedChecks: REQUIRED_DEVICE_CHECKS.filter(
      (key) => !checks[key]
    )
  };
}

export function completeDeviceCertificationReport(
  report,
  {
    completedAt = new Date().toISOString(),
    patch = {}
  } = {}
) {
  const next = updateDeviceCertificationReport(report, patch);
  next.status = "complete";
  next.completedAt = String(completedAt);
  next.evaluation = evaluateDeviceCertificationReport(next);
  next.closedAlphaApproved = false;
  next.releaseGate = "real-field-evidence-required";
  return next;
}

export function validateDeviceCertificationReport(payload) {
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
  if (payload.schemaVersion !== MOBILE_CERTIFICATION_SCHEMA_VERSION) {
    problems.push("Unsupported certification schema version.");
  }
  if (!payload.reportId) {
    problems.push("Report ID is missing.");
  }
  if (!isValidCertificationCode(payload.participantCode)) {
    problems.push("Participant code is invalid.");
  }
  if (
    !REQUIRED_DEVICE_FAMILIES.includes(
      normalizeDeviceFamily(payload.deviceFamily)
    )
  ) {
    problems.push("Device must be Android or iPhone/iPad.");
  }
  if (payload.status !== "complete") {
    problems.push("Report is not complete.");
  }
  if (!payload.checks || typeof payload.checks !== "object") {
    problems.push("Certification checks are missing.");
  }

  return {
    valid: problems.length === 0,
    problems
  };
}

export function importDeviceCertificationReports(
  currentReports = [],
  payloads = []
) {
  const reports = [...currentReports];
  const reportIds = new Set(
    reports.map((report) => report.reportId)
  );
  const participantCodes = new Set(
    reports.map((report) => report.participantCode)
  );

  const imported = [];
  const rejected = [];

  for (const payload of payloads) {
    const report =
      payload?.report && typeof payload.report === "object"
        ? payload.report
        : payload;
    const validation = validateDeviceCertificationReport(report);

    if (!validation.valid) {
      rejected.push({
        reason: validation.problems.join(" "),
        reportId: String(report?.reportId ?? "")
      });
      continue;
    }

    if (reportIds.has(report.reportId)) {
      rejected.push({
        reason: "Duplicate report ID.",
        reportId: report.reportId
      });
      continue;
    }

    if (participantCodes.has(report.participantCode)) {
      rejected.push({
        reason: "Duplicate participant code.",
        reportId: report.reportId
      });
      continue;
    }

    const normalized = clone(report);
    normalized.deviceFamily = normalizeDeviceFamily(
      normalized.deviceFamily
    );
    normalized.evaluation =
      evaluateDeviceCertificationReport(normalized);

    reports.push(normalized);
    imported.push(normalized);
    reportIds.add(normalized.reportId);
    participantCodes.add(normalized.participantCode);
  }

  return {
    reports,
    imported,
    rejected
  };
}

export function aggregateMobileCertificationReports(
  reports = []
) {
  const complete = reports.filter(
    (report) =>
      validateDeviceCertificationReport(report).valid
  );
  const passed = complete.filter(
    (report) =>
      evaluateDeviceCertificationReport(report).passed
  );

  const androidReports = complete.filter(
    (report) => normalizeDeviceFamily(report.deviceFamily) === "android"
  );
  const iosReports = complete.filter(
    (report) => normalizeDeviceFamily(report.deviceFamily) === "ios"
  );
  const androidPassed = androidReports.some(
    (report) =>
      evaluateDeviceCertificationReport(report).passed
  );
  const iosPassed = iosReports.some(
    (report) =>
      evaluateDeviceCertificationReport(report).passed
  );

  const criticalDefects = complete.filter(
    (report) => report.criticalDefect === true
  ).length;
  const certified =
    androidPassed &&
    iosPassed &&
    criticalDefects === 0;

  return {
    totalReports: reports.length,
    validReports: complete.length,
    passedReports: passed.length,
    androidReports: androidReports.length,
    iosReports: iosReports.length,
    androidPassed,
    iosPassed,
    criticalDefects,
    certified,
    decision: certified
      ? "MOBILE INSTALLATION CERTIFIED"
      : complete.length === 0
        ? "NOT ENOUGH INSTALLATION EVIDENCE"
        : "MOBILE INSTALLATION TESTING REQUIRED",
    closedAlphaApproved: false,
    releaseGate: "real-field-evidence-required"
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

export function mobileCertificationReportsToCsv(
  reports = []
) {
  const headers = [
    "participant_code",
    "report_id",
    "device_family",
    "build_version",
    "status",
    "automatic_audit_passed",
    "install_method_passed",
    "standalone_launch_passed",
    "exact_resume_passed",
    "offline_launch_passed",
    "update_preserved_passed",
    "critical_defect",
    "critical_defect_description",
    "notes",
    "started_at",
    "completed_at"
  ];

  const rows = reports.map((report) => [
    report.participantCode,
    report.reportId,
    normalizeDeviceFamily(report.deviceFamily),
    report.buildVersion,
    report.status,
    ...REQUIRED_DEVICE_CHECKS.map(
      (key) => Boolean(report.checks?.[key])
    ),
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
