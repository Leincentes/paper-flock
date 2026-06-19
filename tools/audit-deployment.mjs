#!/usr/bin/env node
import {
  validateManifest
} from "../src/install-audit-core.js";

const rawUrl = process.argv[2];
const retries = Number(
  process.argv.find((arg) => arg.startsWith("--retries="))?.split("=")[1] ?? 5
);
const delayMs = Number(
  process.argv.find((arg) => arg.startsWith("--delay="))?.split("=")[1] ?? 3000
);

if (!rawUrl) {
  console.error(
    "Usage: node tools/audit-deployment.mjs <https-url> [--retries=5] [--delay=3000]"
  );
  process.exit(2);
}

const baseUrl = new URL(rawUrl);
if (
  baseUrl.protocol !== "https:" &&
  !["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname)
) {
  console.error("FAIL: deployment must use HTTPS, except localhost.");
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
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) {
      await sleep(delayMs);
    }
  }
  throw new Error(`Could not fetch ${url}: ${lastError?.message ?? "unknown error"}`);
}

function extractManifestHref(html) {
  return html.match(
    /<link[^>]+rel=["'][^"']*manifest[^"']*["'][^>]+href=["']([^"']+)["']/i
  )?.[1] ??
  html.match(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*manifest[^"']*["']/i
  )?.[1] ??
  null;
}

function check(id, passed, message) {
  return { id, passed: Boolean(passed), message };
}

const checks = [];
const indexResponse = await fetchWithRetry(baseUrl.href);
const html = await indexResponse.text();

checks.push(check(
  "https",
  baseUrl.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname),
  `Deployment protocol is ${baseUrl.protocol}`
));
checks.push(check(
  "html",
  /text\/html/i.test(indexResponse.headers.get("content-type") ?? ""),
  `Index content type: ${indexResponse.headers.get("content-type") ?? "missing"}`
));
checks.push(check(
  "viewport",
  /name=["']viewport["']/i.test(html),
  "Mobile viewport metadata is present."
));
checks.push(check(
  "platform-module",
  /src=["']\.\/src\/platform-ui\.js["']/i.test(html),
  "Platform module is loaded."
));
checks.push(check(
  "mobile-viewport-module",
  /src=["']\.\/src\/mobile-viewport-ui\.js["']/i.test(html),
  "Mobile gameplay viewport controller is deployed."
));
checks.push(check(
  "boot-recovery-module",
  /src=["']\.\/src\/boot-guard\.js["']/i.test(html),
  "Startup recovery module is deployed."
));
checks.push(check(
  "production-release-module",
  /src=["']\.\/src\/production-release-ui\.js["']/i.test(html),
  "Production release evidence center is deployed."
));
checks.push(check(
  "performance-monitor-module",
  /src=["']\.\/src\/performance-monitor\.js["']/i.test(html),
  "Performance monitor is deployed."
));
checks.push(check(
  "accessibility-certification-module",
  /src=["']\.\/src\/accessibility-certification-ui\.js["']/i.test(html),
  "Accessibility certification collector is deployed."
));
checks.push(check(
  "accessibility-module",
  /src=["']\.\/src\/accessibility-ui\.js["']/i.test(html),
  "Accessibility runtime module is loaded."
));
checks.push(check(
  "content-security-policy",
  /http-equiv=["']Content-Security-Policy["']/i.test(html),
  "Content Security Policy is deployed."
));
checks.push(check(
  "beta-operations-module",
  /src=["']\.\/src\/beta-operations-ui\.js["']/i.test(html),
  "Public-beta operations module is loaded."
));
checks.push(check(
  "privacy-link",
  /privacy\.html/i.test(html),
  "Privacy notice is linked."
));
checks.push(check(
  "install-audit-module",
  /src=["']\.\/src\/install-audit-ui\.js["']/i.test(html),
  "Install audit module is loaded."
));

const manifestHref = extractManifestHref(html);
checks.push(check(
  "manifest-link",
  Boolean(manifestHref),
  manifestHref ? `Manifest link: ${manifestHref}` : "Manifest link missing."
));

let manifest = null;
let manifestAudit = null;
let manifestUrl = null;
let assetResults = [];

if (manifestHref) {
  manifestUrl = new URL(manifestHref, baseUrl).href;
  const response = await fetchWithRetry(manifestUrl);
  const contentType = response.headers.get("content-type") ?? "";
  checks.push(check(
    "manifest-content-type",
    /application\/(manifest\+json|json)|text\/json/i.test(contentType),
    `Manifest content type: ${contentType || "missing"}`
  ));
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
        contentType: response.headers.get("content-type") ?? ""
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

  checks.push(check(
    "manifest-assets",
    assetResults.length > 0 && assetResults.every((asset) => asset.ok),
    `${assetResults.filter((asset) => asset.ok).length}/${assetResults.length} manifest assets fetched.`
  ));
}

for (const page of [
  "./privacy.html",
  "./support.html",
  "./release-notes.html",
  "./known-issues.html",
  "./accessibility.html",
  "./terms.html",
  "./credits.html",
  "./release.json",
  "./asset-manifest.json",
  "./quality-evidence.schema.json",
  "./app-config.json",
  "./known-issues.json",
  "./release-notes.json"
]) {
  const response = await fetchWithRetry(new URL(page, baseUrl).href);
  checks.push(check(
    `public-resource-${page}`,
    response.ok,
    `${page} fetched with status ${response.status}.`
  ));
}

const serviceWorkerUrl = new URL("./service-worker.js", baseUrl).href;
const serviceWorkerResponse = await fetchWithRetry(serviceWorkerUrl);
const serviceWorkerSource = await serviceWorkerResponse.text();
checks.push(check(
  "service-worker",
  /paper-flock-static-v0\.14/.test(serviceWorkerSource),
  "v1.0 service worker is deployed."
));
checks.push(check(
  "cache-status-protocol",
  /GET_CACHE_STATUS/.test(serviceWorkerSource),
  "Service worker supports cache-status verification."
));

const buildInfoUrl = new URL("./build-info.json", baseUrl).href;
const buildInfoResponse = await fetchWithRetry(buildInfoUrl);
const buildInfo = await buildInfoResponse.json();
checks.push(check(
  "build-version",
  buildInfo.buildVersion === "1.0",
  `Deployed build version: ${buildInfo.buildVersion ?? "missing"}`
));
checks.push(check(
  "release-gate",
  buildInfo.closedAlphaApproved === false &&
    buildInfo.releaseGate === "real-field-evidence-required" &&
    buildInfo.productionApproved === false,
  "Real-field and production gates remain enforced."
));

const requiredFailures = checks.filter(
  (item) =>
    item.passed === false &&
    item.severity !== "recommended"
);
const report = {
  product: "Paper Flock",
  auditedAt: new Date().toISOString(),
  url: baseUrl.href,
  passed: requiredFailures.length === 0,
  checks,
  manifestAudit,
  assetResults,
  buildInfo
};

console.log(JSON.stringify(report, null, 2));

if (!report.passed) {
  process.exit(1);
}
