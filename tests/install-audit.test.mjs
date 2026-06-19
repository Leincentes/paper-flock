import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  INSTALL_CERTIFICATION_KEY,
  createInstallReport,
  evaluateMobileCertification,
  evaluateRuntimeInstallability,
  normalizeCertification,
  parseIconSizes,
  updateCertification,
  validateManifest
} from "../src/install-audit-core.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function validManifest() {
  return {
    id: "./",
    name: "Paper Flock",
    short_name: "Paper Flock",
    description:
      "A calm origami logic puzzle that installs and works offline.",
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: "#151a32",
    theme_color: "#151a32",
    icons: [
      {
        src: "./assets/paper-flock-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "./assets/paper-flock-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "./assets/paper-flock-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
    screenshots: [
      {
        src: "./assets/screenshots/paper-flock-phone.png",
        sizes: "1170x2532",
        type: "image/png"
      }
    ]
  };
}

test("icon-size parsing rejects malformed records", () => {
  assert.deepEqual(parseIconSizes("192x192 512x512"), [
    { width: 192, height: 192 },
    { width: 512, height: 512 }
  ]);
  assert.deepEqual(parseIconSizes("any malformed"), []);
});

test("valid mobile manifest passes every required install check", () => {
  const audit = validateManifest(validManifest(), {
    manifestUrl:
      "https://example.test/paper-flock/manifest.webmanifest",
    documentUrl: "https://example.test/paper-flock/"
  });

  assert.equal(audit.valid, true);
  assert.equal(
    audit.checks
      .filter((check) => check.severity === "required")
      .every((check) => check.passed),
    true
  );
  assert.equal(
    audit.resolved.startUrl,
    "https://example.test/paper-flock/"
  );
});

test("manifest audit catches missing 512 icon and out-of-scope start URL", () => {
  const manifest = validManifest();
  manifest.start_url = "../other/";
  manifest.icons = manifest.icons.filter(
    (icon) => icon.sizes !== "512x512"
  );

  const audit = validateManifest(manifest, {
    manifestUrl:
      "https://example.test/paper-flock/manifest.webmanifest",
    documentUrl: "https://example.test/paper-flock/"
  });

  assert.equal(audit.valid, false);
  assert.equal(
    audit.checks.find((check) => check.id === "start-in-scope").passed,
    false
  );
  assert.equal(
    audit.checks.find((check) => check.id === "icon-512").passed,
    false
  );
});

test("runtime installability requires deployment and offline checks", () => {
  const complete = evaluateRuntimeInstallability({
    secureContext: true,
    manifestLinked: true,
    manifestValid: true,
    iconsAccessible: true,
    serviceWorkerSupported: true,
    serviceWorkerActive: true,
    offlineCacheComplete: true,
    installPromptAvailable: true,
    iosManualInstallAvailable: false,
    standalone: false,
    updateHandlingReady: true
  });
  assert.equal(complete.eligible, true);

  const incomplete = evaluateRuntimeInstallability({
    secureContext: true,
    manifestLinked: true,
    manifestValid: true,
    iconsAccessible: true,
    serviceWorkerSupported: true,
    serviceWorkerActive: true,
    offlineCacheComplete: false,
    installPromptAvailable: true
  });
  assert.equal(incomplete.eligible, false);
});

test("mobile certification cannot pass without physical Android and iOS checks", () => {
  const evaluation = evaluateMobileCertification({
    runtimeEligible: true,
    certification: {
      installedStandalone: true,
      offlineLaunchPassed: true,
      exactResumePassed: true,
      updatePassed: true,
      androidTested: true,
      iosTested: false
    }
  });

  assert.equal(evaluation.certified, false);
  assert.equal(
    evaluation.decision,
    "MOBILE INSTALLATION TESTING REQUIRED"
  );
});

test("mobile certification passes only after complete physical evidence", () => {
  const evaluation = evaluateMobileCertification({
    runtimeEligible: true,
    certification: {
      installedStandalone: true,
      offlineLaunchPassed: true,
      exactResumePassed: true,
      updatePassed: true,
      androidTested: true,
      iosTested: true
    }
  });

  assert.equal(evaluation.certified, true);
  assert.equal(
    evaluation.decision,
    "MOBILE INSTALLATION CERTIFIED"
  );
});

test("certification updates are stable and timestamped", () => {
  const initial = normalizeCertification();
  const updated = updateCertification(
    initial,
    {
      installedStandalone: true,
      androidTested: true
    },
    "2026-06-19T12:00:00.000Z"
  );

  assert.equal(updated.installedStandalone, true);
  assert.equal(updated.androidTested, true);
  assert.equal(updated.iosTested, false);
  assert.equal(
    updated.lastUpdatedAt,
    "2026-06-19T12:00:00.000Z"
  );
  assert.equal(
    INSTALL_CERTIFICATION_KEY,
    "paper-flock-install-certification"
  );
});

test("install report preserves both install and real-evidence gates", () => {
  const report = createInstallReport({
    runtime: {
      secureContext: true
    }
  });

  assert.equal(report.closedAlphaApproved, false);
  assert.equal(
    report.releaseGate,
    "real-field-evidence-required"
  );
});

test("package manifest includes separate any and maskable icons", () => {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(root, "manifest.webmanifest"),
      "utf8"
    )
  );

  assert.ok(
    manifest.icons.some(
      (icon) =>
        icon.sizes === "512x512" &&
        icon.purpose === "any"
    )
  );
  assert.ok(
    manifest.icons.some(
      (icon) =>
        icon.sizes === "512x512" &&
        icon.purpose === "maskable"
    )
  );
  assert.equal(manifest.prefer_related_applications, false);
});

test("service worker exposes complete-cache status messaging", () => {
  const source = fs.readFileSync(
    path.join(root, "service-worker.js"),
    "utf8"
  );

  assert.match(source, /GET_CACHE_STATUS/);
  assert.match(source, /expectedCount/);
  assert.match(source, /cachedCount/);
  assert.match(source, /missing/);
  assert.match(source, /paper-flock-static-v1\.2/);
});

test("production HTML excludes install audit and loads player platform support", () => {
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );

  assert.doesNotMatch(html, /install-audit-ui/);
  assert.match(html, /src="\.\/src\/app-platform-ui\.js"/);
  assert.match(html, /name="mobile-web-app-capable"/);
  assert.match(html, /Paper Flock v1\.2/);
});


test("GitHub Pages workflow audits the live HTTPS deployment", () => {
  const workflow = fs.readFileSync(
    path.join(root, ".github/workflows/static.yml"),
    "utf8"
  );

  assert.match(workflow, /npm run audit:package/);
  assert.match(workflow, /post-deployment-audit/);
  assert.match(workflow, /tools\/audit-deployment\.mjs/);
  assert.match(workflow, /needs\.deploy\.outputs\.page_url/);
});

test("build metadata keeps physical installation and closed-alpha gates separate", () => {
  const buildInfo = JSON.parse(
    fs.readFileSync(
      path.join(root, "build-info.json"),
      "utf8"
    )
  );

  assert.equal(buildInfo.mobileInstallationCertified, false);
  assert.equal(
    buildInfo.installationGate,
    "android-and-ios-device-reports-required"
  );
  assert.equal(buildInfo.closedAlphaApproved, false);
  assert.equal(
    buildInfo.releaseGate,
    "real-field-evidence-required"
  );
});
