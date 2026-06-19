export const QUALITY_EVIDENCE_SCHEMA_VERSION = 1;
export const PRODUCTION_APPROVAL_SCHEMA_VERSION = 1;

export const REQUIRED_QUALITY_CHECKS = Object.freeze([
  "unitTestsPassed",
  "packageAuditPassed",
  "dependencyAuditPassed",
  "releaseAuditPassed",
  "browserTestsPassed",
  "lighthousePassed",
  "codeqlPassed",
  "deploymentAuditPassed",
  "sbomCreated",
  "provenanceCreated"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, maximum = 1000) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maximum);
}

export function createQualityEvidence({
  buildVersion = "1.4.4",
  commitSha,
  repository,
  workflowRunId,
  workflowRunUrl = "",
  generatedAt = new Date().toISOString(),
  releaseDigest,
  checks = {}
} = {}) {
  return {
    product: "Paper Flock",
    schemaVersion: QUALITY_EVIDENCE_SCHEMA_VERSION,
    buildVersion: String(buildVersion),
    commitSha: cleanText(commitSha, 80),
    repository: cleanText(repository, 200),
    workflowRunId: cleanText(workflowRunId, 80),
    workflowRunUrl: cleanText(workflowRunUrl, 500),
    generatedAt: String(generatedAt),
    releaseDigest: cleanText(releaseDigest, 128),
    checks: Object.fromEntries(
      REQUIRED_QUALITY_CHECKS.map((key) => [
        key,
        Boolean(checks[key])
      ])
    )
  };
}

export function validateQualityEvidence(
  payload,
  {
    expectedBuildVersion = "",
    expectedRepository = ""
  } = {}
) {
  const problems = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      valid: false,
      problems: ["Quality evidence must be a JSON object."]
    };
  }

  if (payload.product !== "Paper Flock") {
    problems.push("Evidence product is not Paper Flock.");
  }
  if (payload.schemaVersion !== QUALITY_EVIDENCE_SCHEMA_VERSION) {
    problems.push("Unsupported quality-evidence schema.");
  }
  if (!payload.buildVersion) {
    problems.push("Build version is missing.");
  }
  if (
    expectedBuildVersion &&
    payload.buildVersion !== expectedBuildVersion
  ) {
    problems.push(
      `Evidence is for build ${payload.buildVersion}, not ${expectedBuildVersion}.`
    );
  }
  if (!/^[0-9a-f]{7,64}$/i.test(String(payload.commitSha ?? ""))) {
    problems.push("Commit SHA is missing or invalid.");
  }
  if (!payload.repository) {
    problems.push("Repository is missing.");
  }
  if (
    expectedRepository &&
    payload.repository !== expectedRepository
  ) {
    problems.push("Evidence belongs to a different repository.");
  }
  if (!payload.workflowRunId) {
    problems.push("Workflow run ID is missing.");
  }
  if (!/^[0-9a-f]{64}$/i.test(String(payload.releaseDigest ?? ""))) {
    problems.push("Release SHA-256 digest is missing or invalid.");
  }
  if (!payload.checks || typeof payload.checks !== "object") {
    problems.push("Quality checks are missing.");
  }

  return {
    valid: problems.length === 0,
    problems
  };
}

export function evaluateQualityEvidence(payload = {}) {
  const checks = Object.fromEntries(
    REQUIRED_QUALITY_CHECKS.map((key) => [
      key,
      Boolean(payload?.checks?.[key])
    ])
  );
  const allChecksPassed =
    REQUIRED_QUALITY_CHECKS.every((key) => checks[key]);

  return {
    passed:
      validateQualityEvidence(payload).valid &&
      allChecksPassed,
    checks,
    failedChecks: REQUIRED_QUALITY_CHECKS.filter(
      (key) => !checks[key]
    ),
    allChecksPassed
  };
}

export function importQualityEvidence(
  payload,
  options = {}
) {
  const evidence =
    payload?.evidence && typeof payload.evidence === "object"
      ? payload.evidence
      : payload;
  const validation = validateQualityEvidence(
    evidence,
    options
  );

  if (!validation.valid) {
    return {
      imported: false,
      evidence: null,
      problems: validation.problems
    };
  }

  const normalized = createQualityEvidence(evidence);
  normalized.evaluation = evaluateQualityEvidence(normalized);

  return {
    imported: true,
    evidence: normalized,
    problems: []
  };
}

export function expectedApprovalPhrase(buildVersion) {
  return `RELEASE PAPER FLOCK ${String(buildVersion)}`;
}

export function createProductionApproval({
  buildVersion = "1.4.4",
  reviewerCode,
  confirmation,
  readiness,
  qualityEvidence,
  reviewedAt = new Date().toISOString(),
  notes = ""
} = {}) {
  const normalizedReviewer = cleanText(
    reviewerCode,
    30
  ).toUpperCase();
  const expected = expectedApprovalPhrase(buildVersion);
  const qualityEvaluation =
    evaluateQualityEvidence(qualityEvidence);

  if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(normalizedReviewer)) {
    throw new Error(
      "Reviewer code must contain 2–30 letters, numbers, hyphens, or underscores."
    );
  }
  if (cleanText(confirmation, 100) !== expected) {
    throw new Error(
      `Type the exact confirmation phrase: ${expected}`
    );
  }
  if (readiness?.productionCandidateReady !== true) {
    throw new Error(
      "Production readiness gates have not all passed."
    );
  }
  if (!qualityEvaluation.passed) {
    throw new Error(
      "Imported CI quality evidence has not passed."
    );
  }

  return {
    product: "Paper Flock",
    schemaVersion: PRODUCTION_APPROVAL_SCHEMA_VERSION,
    buildVersion: String(buildVersion),
    reviewerCode: normalizedReviewer,
    reviewedAt: String(reviewedAt),
    confirmation: expected,
    notes: cleanText(notes, 2000),
    qualityEvidence: {
      commitSha: qualityEvidence.commitSha,
      repository: qualityEvidence.repository,
      workflowRunId: qualityEvidence.workflowRunId,
      releaseDigest: qualityEvidence.releaseDigest
    },
    productionApproved: true,
    finalHumanReleaseReviewPassed: true
  };
}

export function validateProductionApproval(payload) {
  const problems = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      valid: false,
      problems: ["Approval must be a JSON object."]
    };
  }
  if (payload.product !== "Paper Flock") {
    problems.push("Approval product is not Paper Flock.");
  }
  if (
    payload.schemaVersion !==
    PRODUCTION_APPROVAL_SCHEMA_VERSION
  ) {
    problems.push("Unsupported production-approval schema.");
  }
  if (payload.productionApproved !== true) {
    problems.push("Production approval flag is not true.");
  }
  if (
    payload.confirmation !==
    expectedApprovalPhrase(payload.buildVersion)
  ) {
    problems.push("Approval confirmation phrase is invalid.");
  }
  if (!payload.qualityEvidence?.releaseDigest) {
    problems.push("Approval is not linked to a release digest.");
  }

  return {
    valid: problems.length === 0,
    problems
  };
}
