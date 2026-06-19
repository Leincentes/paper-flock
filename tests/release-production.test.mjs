import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createReleaseGate,
  createReleaseMetadata,
  evaluatePerformanceSample,
  normalizeCanonicalUrl,
  validateProductionConfiguration
} from "../src/release-core.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);

test("canonical production URLs require HTTPS and a trailing slash", () => {
  assert.equal(
    normalizeCanonicalUrl("https://example.test/game"),
    "https://example.test/game/"
  );
  assert.equal(
    normalizeCanonicalUrl("http://example.test/game"),
    ""
  );
  assert.equal(normalizeCanonicalUrl("not a url"), "");
});

test("production configuration requires support, publisher, HTTPS URL, and channel", () => {
  const incomplete = validateProductionConfiguration({
    releaseChannel: "public-beta",
    automaticUploads: false,
    analyticsEnabled: false
  });
  assert.equal(incomplete.valid, false);
  assert.ok(incomplete.problems.length >= 4);

  const valid = validateProductionConfiguration({
    releaseChannel: "production",
    automaticUploads: false,
    analyticsEnabled: false,
    supportEmail: "support@example.test",
    canonicalUrl: "https://example.test/paper-flock/",
    publisherName: "Example Publisher"
  });
  assert.equal(valid.valid, true);
});

test("performance samples enforce current web-vitals budgets", () => {
  assert.equal(
    evaluatePerformanceSample({
      largestContentfulPaintMs: 2400,
      interactionToNextPaintMs: 180,
      cumulativeLayoutShift: 0.05,
      longTaskCount: 2
    }).passed,
    true
  );

  const failed = evaluatePerformanceSample({
    largestContentfulPaintMs: 3000,
    interactionToNextPaintMs: 250,
    cumulativeLayoutShift: 0.2,
    longTaskCount: 5
  });
  assert.equal(failed.passed, false);
  assert.equal(failed.checks.largestContentfulPaint, false);
});

test("production approval requires every technical, evidence, and human gate", () => {
  const common = {
    configuration: {
      releaseChannel: "production",
      automaticUploads: false,
      analyticsEnabled: false,
      supportEmail: "support@example.test",
      canonicalUrl: "https://example.test/paper-flock/",
      publisherName: "Example Publisher"
    },
    packageAuditPassed: true,
    browserTestsPassed: true,
    lighthousePassed: true,
    deploymentAuditPassed: true,
    mobileCertified: true,
    accessibilityCertified: true,
    realPlayerEvidencePassed: true,
    noCriticalDefects: true,
    rollbackVerified: true,
    backupRestoreVerified: true
  };

  assert.equal(
    createReleaseGate(common).ready,
    false
  );
  assert.equal(
    createReleaseGate({
      ...common,
      finalHumanReviewPassed: true
    }).ready,
    true
  );
});

test("release metadata records deterministic hashes and commit", () => {
  const release = createReleaseMetadata({
    buildVersion: "1.1",
    releaseChannel: "public-beta",
    commitSha: "abc123",
    generatedAt: "2026-06-19T00:00:00.000Z",
    files: [
      {
        path: "index.html",
        bytes: 100,
        sha256: "deadbeef"
      }
    ]
  });

  assert.equal(release.schemaVersion, 1);
  assert.equal(release.commitSha, "abc123");
  assert.equal(release.files[0].path, "index.html");
});

test("runtime loads player recovery and settings without internal monitoring", () => {
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );
  assert.match(html, /src="\.\/src\/boot-guard\.js"/);
  assert.match(html, /src="\.\/src\/settings-ui\.js"/);
  assert.doesNotMatch(html, /performance-monitor/);
  assert.match(html, /href="\.\/terms\.html"/);
  assert.match(html, /href="\.\/credits\.html"/);
});

test("quality workflow gates deploy on browser testing", () => {
  const workflow = fs.readFileSync(
    path.join(root, ".github/workflows/static.yml"),
    "utf8"
  );
  assert.match(workflow, /npm run test:e2e/);
  assert.match(workflow, /npm run test:lighthouse/);
  assert.match(
    workflow,
    /needs: \[static-quality, browser-quality, codeql-quality\]/
  );
  assert.match(
    workflow,
    /--codeql=\$\{\{ needs\.codeql-quality\.result == 'success' \}\}/
  );
  assert.doesNotMatch(workflow, /--codeql=true/);
  assert.match(
    workflow,
    /--provenance=\$\{\{ needs\.static-quality\.outputs\.provenance_created \}\}/
  );
  assert.doesNotMatch(workflow, /--provenance=true/);
});

test("Cloudflare-compatible response header template blocks framing and sniffing", () => {
  const headers = fs.readFileSync(
    path.join(root, "_headers"),
    "utf8"
  );
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /Permissions-Policy:/);
});
