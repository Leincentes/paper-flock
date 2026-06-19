export const RELEASE_SCHEMA_VERSION = 1;

export const DEFAULT_PERFORMANCE_BUDGETS = Object.freeze({
  largestContentfulPaintMs: 2500,
  interactionToNextPaintMs: 200,
  cumulativeLayoutShift: 0.1,
  longTaskCount: 3,
  totalRuntimeBytes: 1_500_000,
  javascriptBytes: 650_000,
  stylesheetBytes: 180_000
});

function cleanText(value, maximum = 1000) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maximum);
}

export function normalizeCanonicalUrl(value) {
  const text = cleanText(value, 500);
  if (!text) {
    return "";
  }

  try {
    const url = new URL(text);
    if (url.protocol !== "https:") {
      return "";
    }
    url.hash = "";
    url.search = "";
    if (!url.pathname.endsWith("/")) {
      url.pathname += "/";
    }
    return url.href;
  } catch {
    return "";
  }
}

export function validateProductionConfiguration(config = {}) {
  const problems = [];
  const supportEmail = cleanText(config.supportEmail, 320);
  const supportUrl = normalizeCanonicalUrl(config.supportUrl);
  const canonicalUrl = normalizeCanonicalUrl(config.canonicalUrl);
  const publisherName = cleanText(config.publisherName, 160);
  const releaseChannel = cleanText(config.releaseChannel, 30);

  if (!supportEmail && !supportUrl) {
    problems.push("Configure a public support email or HTTPS support URL.");
  }
  if (!canonicalUrl) {
    problems.push("Configure a canonical HTTPS production URL.");
  }
  if (!publisherName) {
    problems.push("Configure the publisher or creator name.");
  }
  if (releaseChannel !== "production") {
    problems.push("Set releaseChannel to production.");
  }
  if (config.automaticUploads !== false) {
    problems.push("automaticUploads must remain false unless a reviewed backend is added.");
  }
  if (config.analyticsEnabled !== false) {
    problems.push("analyticsEnabled must remain false unless consent and privacy review are completed.");
  }

  return {
    valid: problems.length === 0,
    problems,
    normalized: {
      supportEmail,
      supportUrl,
      canonicalUrl,
      publisherName,
      releaseChannel
    }
  };
}

export function evaluatePerformanceSample(
  sample = {},
  budgets = DEFAULT_PERFORMANCE_BUDGETS
) {
  const checks = {
    largestContentfulPaint:
      Number(sample.largestContentfulPaintMs) <=
      budgets.largestContentfulPaintMs,
    interactionToNextPaint:
      Number(sample.interactionToNextPaintMs) <=
      budgets.interactionToNextPaintMs,
    cumulativeLayoutShift:
      Number(sample.cumulativeLayoutShift) <=
      budgets.cumulativeLayoutShift,
    longTasks:
      Number(sample.longTaskCount) <= budgets.longTaskCount
  };

  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    budgets: { ...budgets }
  };
}

export function createReleaseGate({
  configuration = {},
  packageAuditPassed = false,
  browserTestsPassed = false,
  lighthousePassed = false,
  deploymentAuditPassed = false,
  mobileCertified = false,
  accessibilityCertified = false,
  realPlayerEvidencePassed = false,
  noCriticalDefects = false,
  rollbackVerified = false,
  backupRestoreVerified = false,
  finalHumanReviewPassed = false
} = {}) {
  const configurationResult =
    validateProductionConfiguration(configuration);

  const checks = {
    configurationValid: configurationResult.valid,
    packageAuditPassed: Boolean(packageAuditPassed),
    browserTestsPassed: Boolean(browserTestsPassed),
    lighthousePassed: Boolean(lighthousePassed),
    deploymentAuditPassed: Boolean(deploymentAuditPassed),
    mobileCertified: Boolean(mobileCertified),
    accessibilityCertified: Boolean(accessibilityCertified),
    realPlayerEvidencePassed: Boolean(realPlayerEvidencePassed),
    noCriticalDefects: Boolean(noCriticalDefects),
    rollbackVerified: Boolean(rollbackVerified),
    backupRestoreVerified: Boolean(backupRestoreVerified),
    finalHumanReviewPassed: Boolean(finalHumanReviewPassed)
  };

  const ready = Object.values(checks).every(Boolean);

  return {
    ready,
    decision: ready
      ? "PRODUCTION RELEASE APPROVED"
      : "PRODUCTION GATES INCOMPLETE",
    checks,
    configurationProblems: configurationResult.problems
  };
}

export function createReleaseMetadata({
  buildVersion,
  releaseChannel,
  generatedAt = new Date().toISOString(),
  commitSha = "",
  files = []
} = {}) {
  return {
    schemaVersion: RELEASE_SCHEMA_VERSION,
    product: "Paper Flock",
    buildVersion: String(buildVersion),
    releaseChannel: String(releaseChannel),
    generatedAt: String(generatedAt),
    commitSha: cleanText(commitSha, 80),
    files: files.map((file) => ({
      path: String(file.path),
      bytes: Number(file.bytes),
      sha256: String(file.sha256)
    }))
  };
}
