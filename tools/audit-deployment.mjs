#!/usr/bin/env node
import {
  validateManifest
} from "../src/install-audit-core.js";

const rawUrl = process.argv[2];
const retries = Number(
  process.argv
    .find((arg) => arg.startsWith("--retries="))
    ?.split("=")[1] ?? 5
);
const delayMs = Number(
  process.argv
    .find((arg) => arg.startsWith("--delay="))
    ?.split("=")[1] ?? 3000
);

if (!rawUrl) {
  console.error(
    "Usage: node tools/audit-deployment.mjs " +
    "<https-url> [--retries=5] [--delay=3000]"
  );
  process.exit(2);
}

const baseUrl = new URL(rawUrl);
const localHosts = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]"
]);

if (
  baseUrl.protocol !== "https:" &&
  !localHosts.has(baseUrl.hostname)
) {
  console.error(
    "FAIL: deployment must use HTTPS, except localhost."
  );
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        cache: "no-store",
        ...options
      });

      if (response.ok) {
        return response;
      }

      lastError = new Error(
        `${response.status} ${response.statusText}`
      );
    } catch (error) {
      lastError = error;
    }

    if (attempt < retries) {
      await sleep(delayMs);
    }
  }

  throw new Error(
    `Could not fetch ${url}: ` +
    `${lastError?.message ?? "unknown error"}`
  );
}

async function fetchStatus(url) {
  try {
    return await fetch(url, {
      redirect: "follow",
      cache: "no-store"
    });
  } catch {
    return null;
  }
}

function extractManifestHref(html) {
  return (
    html.match(
      /<link[^>]+rel=["'][^"']*manifest[^"']*["'][^>]+href=["']([^"']+)["']/i
    )?.[1] ??
    html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*manifest[^"']*["']/i
    )?.[1] ??
    null
  );
}

function check(id, passed, message) {
  return {
    id,
    passed: Boolean(passed),
    message
  };
}

const checks = [];
const indexResponse = await fetchWithRetry(baseUrl.href);
const html = await indexResponse.text();

checks.push(
  check(
    "https",
    baseUrl.protocol === "https:" ||
      localHosts.has(baseUrl.hostname),
    `Deployment protocol is ${baseUrl.protocol}`
  )
);
checks.push(
  check(
    "html",
    /text\/html/i.test(
      indexResponse.headers.get("content-type") ?? ""
    ),
    `Index content type: ` +
      `${indexResponse.headers.get("content-type") ?? "missing"}`
  )
);
checks.push(
  check(
    "viewport",
    /name=["']viewport["']/i.test(html),
    "Mobile viewport metadata is present."
  )
);
checks.push(
  check(
    "production-runtime",
    /name=["']paper-flock-runtime["'][^>]+content=["']production["']|content=["']production["'][^>]+name=["']paper-flock-runtime["']/i.test(
      html
    ),
    "The document identifies itself as the production runtime."
  )
);

const requiredModules = [
  "boot-guard.js",
  "tutorial-player-ui.js",
  "game-player-ui.js",
  "app-platform-ui.js",
  "mobile-lifecycle-ui.js",
  "mobile-viewport-player-ui.js",
  "accessibility-ui.js",
  "settings-ui.js",
  "journal-ui.js"
];

for (const module of requiredModules) {
  checks.push(
    check(
      `player-module-${module}`,
      html.includes(`./src/${module}`),
      `${module} is deployed.`
    )
  );
}

const forbiddenHtmlMarkers = [
  "Prototype testing tools",
  "visual-test-ui",
  "tactile-test-ui",
  "install-audit-ui",
  "mobile-certification-ui",
  "accessibility-certification-ui",
  "beta-operations-ui",
  "production-release-ui",
  "performance-monitor",
  "beta-feedback-button"
];

for (const marker of forbiddenHtmlMarkers) {
  checks.push(
    check(
      `html-excludes-${marker}`,
      !html.includes(marker),
      `Production HTML excludes ${marker}.`
    )
  );
}

checks.push(
  check(
    "content-security-policy",
    /http-equiv=["']Content-Security-Policy["']/i.test(
      html
    ),
    "Content Security Policy is deployed."
  )
);
checks.push(
  check(
    "privacy-link",
    /privacy\.html/i.test(html),
    "Privacy notice is linked."
  )
);
checks.push(
  check(
    "settings-entry",
    /settings-entry/i.test(html) &&
      /settings-ui\.js/i.test(html),
    "Player Settings is deployed."
  )
);

const manifestHref = extractManifestHref(html);
checks.push(
  check(
    "manifest-link",
    Boolean(manifestHref),
    manifestHref
      ? `Manifest link: ${manifestHref}`
      : "Manifest link missing."
  )
);

let manifest = null;
let manifestAudit = null;
let manifestUrl = null;
const assetResults = [];

if (manifestHref) {
  manifestUrl = new URL(manifestHref, baseUrl).href;
  const response = await fetchWithRetry(manifestUrl);
  const contentType =
    response.headers.get("content-type") ?? "";

  checks.push(
    check(
      "manifest-content-type",
      /application\/(manifest\+json|json)|text\/json/i.test(
        contentType
      ),
      `Manifest content type: ${contentType || "missing"}`
    )
  );

  manifest = await response.json();
  manifestAudit = validateManifest(manifest, {
    manifestUrl,
    documentUrl: baseUrl.href
  });
  checks.push(...manifestAudit.checks);

  const assetUrls = [
    ...manifestAudit.resolved.iconUrls,
    ...manifestAudit.resolved.screenshotUrls
  ];

  for (const url of [...new Set(assetUrls)]) {
    try {
      const response = await fetchWithRetry(url);
      assetResults.push({
        url,
        ok: response.ok,
        status: response.status,
        contentType:
          response.headers.get("content-type") ?? ""
      });
    } catch (error) {
      assetResults.push({
        url,
        ok: false,
        status: 0,
        error: error.message
      });
    }
  }

  checks.push(
    check(
      "manifest-assets",
      assetResults.length > 0 &&
        assetResults.every((asset) => asset.ok),
      `${assetResults.filter((asset) => asset.ok).length}/` +
        `${assetResults.length} manifest assets fetched.`
    )
  );
}

for (const resource of [
  "./privacy.html",
  "./support.html",
  "./release-notes.html",
  "./known-issues.html",
  "./accessibility.html",
  "./terms.html",
  "./credits.html",
  "./release.json",
  "./asset-manifest.json",
  "./app-config.json",
  "./build-info.json",
  "./known-issues.json",
  "./release-notes.json"
]) {
  const response = await fetchWithRetry(
    new URL(resource, baseUrl).href
  );
  checks.push(
    check(
      `public-resource-${resource}`,
      response.ok,
      `${resource} fetched with status ${response.status}.`
    )
  );
}

const serviceWorkerUrl =
  new URL("./service-worker.js", baseUrl).href;
const serviceWorkerResponse =
  await fetchWithRetry(serviceWorkerUrl);
const serviceWorkerSource =
  await serviceWorkerResponse.text();

checks.push(
  check(
    "service-worker-version",
    /paper-flock-static-v1\.4/.test(serviceWorkerSource),
    "The v1.4.4 service worker is deployed."
  )
);
checks.push(
  check(
    "cache-status-protocol",
    /GET_CACHE_STATUS/.test(serviceWorkerSource),
    "Service worker supports cache-status verification."
  )
);
checks.push(
  check(
    "service-worker-clean",
    !/visual-test|tactile-test|install-audit|certification|beta-operations|quality-evidence|production-release/.test(
      serviceWorkerSource
    ),
    "Service worker excludes internal QA modules."
  )
);

const buildInfo = await (
  await fetchWithRetry(
    new URL("./build-info.json", baseUrl).href
  )
).json();

checks.push(
  check(
    "build-version",
    buildInfo.buildVersion === "1.4.4",
    `Deployed build version: ` +
      `${buildInfo.buildVersion ?? "missing"}`
  )
);
checks.push(
  check(
    "clean-build-metadata",
    buildInfo.releaseChannel === "production" &&
      buildInfo.productionRuntimeClean === true &&
      buildInfo.internalToolsIncluded === false,
    "Build metadata confirms a clean production runtime."
  )
);
checks.push(
  check(
    "campaign-build-metadata",
    buildInfo.campaignLevelCount === 40 &&
      buildInfo.campaignChapterCount === 2 &&
      buildInfo.twilightFlockChapter === true &&
      buildInfo.levelSolverValidationConfigured === true &&
      buildInfo.duplicateLevelDetectionConfigured === true,
    "Build metadata confirms the validated forty-level campaign."
  )
);
checks.push(
  check(
    "achievement-build-metadata",
    buildInfo.achievementJournal === true &&
      buildInfo.achievementCount === 20 &&
      buildInfo.playerStatisticsSchemaVersion === 1 &&
      buildInfo.saveSchemaVersion === 12 &&
      buildInfo.ethicalReplayGoals === true,
    "Build metadata confirms the Achievement Journal and v12 player save."
  )
);

const appConfig = await (
  await fetchWithRetry(
    new URL("./app-config.json", baseUrl).href
  )
).json();

checks.push(
  check(
    "production-config",
    appConfig.releaseChannel === "production" &&
      appConfig.analyticsEnabled === false &&
      appConfig.advertisingEnabled === false &&
      appConfig.automaticUploads === false,
    "Public configuration is production and local-first."
  )
);
checks.push(
  check(
    "campaign-config",
    appConfig.campaignLevels === 40 &&
      appConfig.campaignChapters === 2 &&
      appConfig.chapterTwoAvailable === true &&
      appConfig.chapterTwoName === "Twilight Flock" &&
      appConfig.validatedDailyCampaignPool === true,
    "Public configuration exposes Chapter 2 and the validated Daily pool."
  )
);
checks.push(
  check(
    "achievement-config",
    appConfig.achievementJournalAvailable === true &&
      appConfig.achievementCount === 20 &&
      appConfig.lifetimePlayerStatistics === true &&
      appConfig.replayGoalRecommendation === true &&
      appConfig.streaksEnabled === false &&
      appConfig.expiringRewardsEnabled === false,
    "Public configuration exposes permanent goals without streak pressure."
  )
);

const assetManifest = await (
  await fetchWithRetry(
    new URL("./asset-manifest.json", baseUrl).href
  )
).json();

const releasePaths = Array.isArray(assetManifest.files)
  ? assetManifest.files.map((file) =>
      String(file.path ?? "").toLowerCase()
    )
  : [];

const forbiddenPathFragments = [
  "research",
  "visual-test",
  "tactile-test",
  "field-test",
  "install-audit",
  "certification",
  "beta-operations",
  "performance-monitor",
  "quality-evidence",
  "production-release"
];

checks.push(
  check(
    "campaign-module-deployed",
    releasePaths.includes("src/campaign-core.js"),
    "The campaign progression model is deployed."
  )
);
checks.push(
  check(
    "achievement-modules-deployed",
    releasePaths.includes("src/achievement-core.js") &&
      releasePaths.includes("src/journal-ui.js"),
    "The player achievement domain and Journal interface are deployed."
  )
);
checks.push(
  check(
    "asset-manifest-clean",
    releasePaths.length > 0 &&
      forbiddenPathFragments.every(
        (fragment) =>
          !releasePaths.some((path) =>
            path.includes(fragment)
          )
      ),
    "Release asset manifest contains no internal QA files."
  )
);

for (const internalResource of [
  "./src/visual-test-ui.js",
  "./src/tactile-test-ui.js",
  "./src/install-audit-ui.js",
  "./src/mobile-certification-ui.js",
  "./src/accessibility-certification-ui.js",
  "./src/beta-operations-ui.js",
  "./src/production-release-ui.js",
  "./quality-evidence.schema.json"
]) {
  const response = await fetchStatus(
    new URL(internalResource, baseUrl).href
  );

  checks.push(
    check(
      `internal-resource-absent-${internalResource}`,
      response !== null && !response.ok,
      `${internalResource} is not a deployable production resource.`
    )
  );
}

const requiredFailures = checks.filter(
  (item) => item.passed === false
);

const report = {
  product: "Paper Flock",
  buildVersion: "1.4.4",
  auditedAt: new Date().toISOString(),
  url: baseUrl.href,
  passed: requiredFailures.length === 0,
  checks,
  manifestAudit,
  assetResults,
  buildInfo,
  appConfig
};

console.log(JSON.stringify(report, null, 2));

if (!report.passed) {
  process.exit(1);
}
