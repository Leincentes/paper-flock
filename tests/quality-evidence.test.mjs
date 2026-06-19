import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createProductionApproval,
  createQualityEvidence,
  evaluateQualityEvidence,
  expectedApprovalPhrase,
  importQualityEvidence,
  validateProductionApproval,
  validateQualityEvidence
} from "../src/quality-evidence-core.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function passingEvidence() {
  return createQualityEvidence({
    buildVersion: "1.1",
    commitSha:
      "0123456789abcdef0123456789abcdef01234567",
    repository: "example/paper-flock",
    workflowRunId: "123456",
    releaseDigest: "a".repeat(64),
    checks: {
      unitTestsPassed: true,
      packageAuditPassed: true,
      dependencyAuditPassed: true,
      releaseAuditPassed: true,
      browserTestsPassed: true,
      lighthousePassed: true,
      codeqlPassed: true,
      deploymentAuditPassed: true,
      sbomCreated: true,
      provenanceCreated: true
    }
  });
}

test("quality evidence requires repository, commit, digest, and checks", () => {
  const evidence = passingEvidence();
  assert.equal(validateQualityEvidence(evidence).valid, true);
  assert.equal(evaluateQualityEvidence(evidence).passed, true);

  const invalid = {
    ...evidence,
    releaseDigest: ""
  };
  assert.equal(validateQualityEvidence(invalid).valid, false);
});

test("quality evidence import rejects another build", () => {
  const result = importQualityEvidence(
    { evidence: passingEvidence() },
    { expectedBuildVersion: "0.22" }
  );

  assert.equal(result.imported, false);
  assert.match(result.problems.join(" "), /not 0\.22/);
});

test("one failed CI check blocks quality evidence", () => {
  const evidence = passingEvidence();
  evidence.checks.lighthousePassed = false;

  const evaluation = evaluateQualityEvidence(evidence);
  assert.equal(evaluation.passed, false);
  assert.deepEqual(
    evaluation.failedChecks,
    ["lighthousePassed"]
  );
});

test("production approval requires readiness, quality evidence, and exact phrase", () => {
  const evidence = passingEvidence();
  const phrase = expectedApprovalPhrase("1.1");

  assert.throws(
    () => createProductionApproval({
      buildVersion: "1.1",
      reviewerCode: "CREATOR",
      confirmation: phrase,
      readiness: {
        productionCandidateReady: false
      },
      qualityEvidence: evidence
    }),
    /readiness gates/
  );

  const approval = createProductionApproval({
    buildVersion: "1.1",
    reviewerCode: "creator",
    confirmation: phrase,
    readiness: {
      productionCandidateReady: true
    },
    qualityEvidence: evidence,
    reviewedAt: "2026-06-19T12:00:00.000Z"
  });

  assert.equal(approval.productionApproved, true);
  assert.equal(approval.reviewerCode, "CREATOR");
  assert.equal(
    validateProductionApproval(approval).valid,
    true
  );
});

test("production evidence center remains internal and is not shipped to players", () => {
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );
  assert.equal(
    fs.existsSync(path.join(root, "src/production-release-ui.js")),
    true
  );
  assert.doesNotMatch(
    html,
    /production-release-ui/
  );
});

test("supply-chain controls are present", () => {
  assert.equal(
    fs.existsSync(path.join(root, "package-lock.json")),
    true
  );
  assert.equal(
    fs.existsSync(
      path.join(root, ".github/dependabot.yml")
    ),
    true
  );

  const workflow = fs.readFileSync(
    path.join(root, ".github/workflows/static.yml"),
    "utf8"
  );
  assert.match(workflow, /\bnpm ci\b/);
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.match(workflow, /npm sbom --sbom-format=cyclonedx/);
  assert.match(workflow, /uses: actions\/attest@v4/);
});

test("dependency review and CodeQL workflows use current major actions", () => {
  const dependencyReview = fs.readFileSync(
    path.join(
      root,
      ".github/workflows/dependency-review.yml"
    ),
    "utf8"
  );
  const codeql = fs.readFileSync(
    path.join(root, ".github/workflows/codeql.yml"),
    "utf8"
  );

  assert.match(
    dependencyReview,
    /actions\/dependency-review-action@v4/
  );
  assert.match(
    codeql,
    /github\/codeql-action\/init@v4/
  );
  assert.match(
    codeql,
    /github\/codeql-action\/analyze@v4/
  );
});
