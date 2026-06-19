#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  fileURLToPath
} from "node:url";
import {
  validateManifest
} from "../src/install-audit-core.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const read = (relative) =>
  fs.readFileSync(path.join(root, relative), "utf8");

const failures = [];
const passes = [];
const check = (id, passed, message) => {
  (passed ? passes : failures).push({ id, message });
};

const html = read("index.html");
const css = read("styles.css");
const manifest = JSON.parse(read("manifest.webmanifest"));
const worker = read("service-worker.js");
const buildInfo = JSON.parse(read("build-info.json"));
const appConfig = JSON.parse(read("app-config.json"));
const knownIssues = JSON.parse(read("known-issues.json"));
const releaseNotes = JSON.parse(read("release-notes.json"));

check("title-version", /Paper Flock v1\.0/.test(html), "HTML title uses v1.0.");
check(
  "install-audit-script",
  /src="\.\/src\/install-audit-ui\.js"/.test(html),
  "Install-audit UI module is loaded."
);
check(
  "mobile-certification-script",
  /src="\.\/src\/mobile-certification-ui\.js"/.test(html),
  "Mobile-certification UI module is loaded."
);
check(
  "boot-guard-script",
  /src="\.\/src\/boot-guard\.js"/.test(html),
  "Startup recovery module is loaded."
);
check(
  "production-release-script",
  /src="\.\/src\/production-release-ui\.js"/.test(html),
  "Production release evidence center is loaded."
);
check(
  "performance-monitor-script",
  /src="\.\/src\/performance-monitor\.js"/.test(html),
  "Local performance monitor is loaded."
);
check(
  "accessibility-certification-script",
  /src="\.\/src\/accessibility-certification-ui\.js"/.test(html),
  "Accessibility certification collector is loaded."
);
check(
  "accessibility-script",
  /src="\.\/src\/accessibility-ui\.js"/.test(html),
  "Accessibility runtime module is loaded."
);
check(
  "content-security-policy",
  /http-equiv="Content-Security-Policy"/.test(html) &&
    /object-src 'none'/.test(html),
  "Content Security Policy is present."
);
check(
  "beta-operations-script",
  /src="\.\/src\/beta-operations-ui\.js"/.test(html),
  "Public-beta operations module is loaded."
);
check(
  "public-beta-footer",
  /id="beta-feedback-button"/.test(html) &&
    /privacy\.html/.test(html) &&
    /support\.html/.test(html),
  "Public beta footer and support links are present."
);
check(
  "mobile-viewport-script",
  /src="\.\/src\/mobile-viewport-ui\.js"/.test(html),
  "Mobile gameplay viewport controller is loaded."
);
check(
  "mobile-viewport-styles",
  /mobile-gameplay-lock/.test(css) &&
    /overflow:\s*hidden/.test(css) &&
    /--mobile-board-size/.test(css),
  "Mobile gameplay no-scroll and board-fit styles are present."
);
check(
  "mobile-lifecycle-script",
  /src="\.\/src\/mobile-lifecycle-ui\.js"/.test(html),
  "Mobile lifecycle module is loaded."
);
check(
  "manifest-link",
  /rel="manifest"/.test(html),
  "Manifest is linked."
);
check(
  "apple-touch-icon",
  /rel="apple-touch-icon"/.test(html),
  "Apple touch icon is linked."
);

const manifestAudit = validateManifest(manifest, {
  manifestUrl: "https://example.test/paper-flock/manifest.webmanifest",
  documentUrl: "https://example.test/paper-flock/"
});
for (const item of manifestAudit.checks) {
  if (item.severity === "required") {
    check(`manifest-${item.id}`, item.passed, item.message);
  }
}

for (const url of [
  ...manifestAudit.resolved.iconUrls,
  ...manifestAudit.resolved.screenshotUrls
]) {
  const pathname = new URL(url).pathname.replace("/paper-flock/", "");
  check(
    `asset-${pathname}`,
    fs.existsSync(path.join(root, pathname)),
    `${pathname} exists.`
  );
}

const listMatch = worker.match(
  /const APP_STATIC_RESOURCES = Object\.freeze\(\[([\s\S]*?)\]\);/
);
check("worker-asset-list", Boolean(listMatch), "Service-worker asset list exists.");

if (listMatch) {
  const resources = [...listMatch[1].matchAll(/"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((item) => item !== "./");

  for (const resource of resources) {
    check(
      `cache-${resource}`,
      fs.existsSync(path.join(root, resource.replace(/^\.\//, ""))),
      `Cached resource ${resource} exists.`
    );
  }
}

check(
  "worker-version",
  /paper-flock-static-v1\.0/.test(worker),
  "Service-worker cache is v1.0."
);
check(
  "worker-cache-status",
  /GET_CACHE_STATUS/.test(worker),
  "Service worker exposes cache status."
);
check(
  "build-version",
  buildInfo.buildVersion === "1.0",
  "build-info.json reports v1.0."
);
for (const page of [
  "privacy.html",
  "support.html",
  "release-notes.html",
  "known-issues.html",
  "accessibility.html",
  "terms.html",
  "credits.html",
  "404.html",
  "legal.css",
  "_headers"
]) {
  check(
    `public-page-${page}`,
    fs.existsSync(path.join(root, page)),
    `${page} exists.`
  );
}
check(
  "public-beta-config",
  appConfig.releaseChannel === "production" &&
    appConfig.automaticUploads === false,
  "Production configuration is local-first."
);
check(
  "known-issues-register",
  Array.isArray(knownIssues.issues) &&
    knownIssues.issues.length > 0,
  "Known-issues register is populated."
);
check(
  "release-notes-register",
  releaseNotes.currentVersion === "1.0" &&
    Array.isArray(releaseNotes.releases),
  "Current release notes are published."
);
check(
  "supply-chain-gates",
  fs.existsSync(path.join(root, "package-lock.json")) &&
    fs.existsSync(path.join(root, ".github/dependabot.yml")) &&
    fs.existsSync(path.join(root, ".github/workflows/dependency-review.yml")) &&
    fs.existsSync(path.join(root, ".github/workflows/codeql.yml")),
  "Lockfile, dependency review, Dependabot, and CodeQL are configured."
);
check(
  "mobile-viewport-build-info",
  buildInfo.mobileGameplayViewportLock === true &&
    buildInfo.mobilePageScrollingDuringGameplay === false &&
    buildInfo.visualViewportSizingEnabled === true,
  "Build metadata records the locked mobile gameplay viewport."
);
check(
  "release-quality-gates",
  buildInfo.productionCandidateQualityGatesAvailable === true &&
    buildInfo.browserE2ETestsConfigured === true &&
    buildInfo.lighthouseBudgetsConfigured === true &&
    buildInfo.deterministicReleaseManifest === true,
  "Production candidate quality gates are configured."
);
check(
  "production-gate",
  buildInfo.productionApproved === false &&
    buildInfo.productionGate ===
      "v1-ci-evidence-import-and-final-human-signoff-required",
  "Production approval remains gated."
);
check(
  "accessibility-gate",
  buildInfo.accessibilityCertified === false &&
    buildInfo.accessibilityCertificationCollectorAvailable === true &&
    buildInfo.accessibilityGate ===
      "keyboard-voiceover-talkback-text-and-contrast-reports-required",
  "Physical accessibility certification remains evidence-gated."
);
check(
  "mobile-gate",
  buildInfo.mobileInstallationCertified === false &&
    buildInfo.installationGate === "android-and-ios-device-reports-required" &&
    buildInfo.mobileCertificationCollectorAvailable === true,
  "Physical mobile certification remains required."
);

const result = {
  product: "Paper Flock",
  buildVersion: "1.0",
  passed: failures.length === 0,
  passCount: passes.length,
  failureCount: failures.length,
  passes,
  failures
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.passed ? 0 : 1);
