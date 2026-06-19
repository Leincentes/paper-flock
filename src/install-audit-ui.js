import {
  INSTALL_CERTIFICATION_KEY,
  createInstallReport,
  evaluateMobileCertification,
  evaluateRuntimeInstallability,
  normalizeCertification,
  updateCertification,
  validateManifest
} from "./install-audit-core.js";
import { isIosLike } from "./platform-core.js";

const BUILD_VERSION = "1.4.2";

const state = {
  installPromptAvailable:
    document.documentElement.dataset.installPromptAvailable === "true",
  manifest: null,
  manifestAudit: null,
  cacheStatus: null,
  runtime: null,
  certification: loadCertification(),
  lastReport: null,
  running: false
};

injectInstallAuditInterface();
wireInstallAuditInterface();
observeInstallationEvents();
recordAutomaticCertification();
updateCertificationView();

if (
  new URLSearchParams(globalThis.location.search).get("installcheck") === "1"
) {
  openInstallAudit();
}

function loadCertification() {
  try {
    return normalizeCertification(
      JSON.parse(
        localStorage.getItem(INSTALL_CERTIFICATION_KEY) || "{}"
      )
    );
  } catch {
    return normalizeCertification();
  }
}

function saveCertification() {
  localStorage.setItem(
    INSTALL_CERTIFICATION_KEY,
    JSON.stringify(state.certification)
  );
  updateCertificationView();
}

function standaloneMode() {
  return (
    globalThis.matchMedia?.("(display-mode: standalone)").matches === true ||
    navigator.standalone === true
  );
}

function iosManualInstallAvailable() {
  return isIosLike({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints
  });
}

function observeInstallationEvents() {
  globalThis.addEventListener("beforeinstallprompt", () => {
    state.installPromptAvailable = true;
    updateCertificationView();
  });

  globalThis.addEventListener(
    "paperflock:install-prompt-available",
    () => {
      state.installPromptAvailable = true;
      updateCertificationView();
    }
  );

  globalThis.addEventListener("appinstalled", () => {
    state.certification = updateCertification(
      state.certification,
      {
        installedStandalone: true,
        androidTested: /Android/i.test(navigator.userAgent)
          ? true
          : state.certification.androidTested
      }
    );
    saveCertification();
  });

  globalThis.addEventListener("online", updateCertificationView);
  globalThis.addEventListener("offline", () => {
    recordAutomaticCertification();
    updateCertificationView();
  });
}

function recordAutomaticCertification() {
  const standalone = standaloneMode();
  const offlineStandalone = standalone && navigator.onLine === false;
  const patch = {};

  if (standalone) {
    patch.installedStandalone = true;
  }
  if (offlineStandalone) {
    patch.offlineLaunchPassed = true;
  }
  if (/Android/i.test(navigator.userAgent) && standalone) {
    patch.androidTested = true;
  }
  if (iosManualInstallAvailable() && standalone) {
    patch.iosTested = true;
  }

  if (Object.keys(patch).length > 0) {
    state.certification = updateCertification(
      state.certification,
      patch
    );
    saveCertification();
  }
}

function injectInstallAuditInterface() {
  const toolBody = document.querySelector(".prototype-tools .tool-body");
  toolBody?.insertAdjacentHTML(
    "beforeend",
    `
      <section
        class="install-audit-tool-section"
        aria-labelledby="install-audit-tool-title"
      >
        <h3 id="install-audit-tool-title">Mobile installation certification</h3>
        <p id="install-audit-tool-summary">
          Run the automatic audit, then complete the Android and iPhone device
          checks.
        </p>
        <div class="tool-buttons">
          <button
            class="secondary-button"
            id="install-audit-open-button"
            type="button"
          >
            Check mobile installation
          </button>
          <button
            class="secondary-button"
            id="install-audit-export-button"
            type="button"
            disabled
          >
            Export install report
          </button>
        </div>
      </section>
    `
  );

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="install-audit-overlay" id="install-audit-overlay" hidden>
        <section
          class="install-audit-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-audit-title"
        >
          <header class="install-audit-header">
            <div>
              <span class="install-audit-kicker">Paper Flock v${BUILD_VERSION}</span>
              <h2 id="install-audit-title">Mobile installation check</h2>
            </div>
            <button
              class="install-audit-close"
              id="install-audit-close-button"
              type="button"
              aria-label="Close installation check"
            >
              ×
            </button>
          </header>

          <p class="install-audit-intro">
            Automatic checks confirm the deployment, manifest, icons, service
            worker, and offline shell. Physical phone checks remain required.
          </p>

          <section class="install-audit-section">
            <div class="install-audit-section-heading">
              <div>
                <span>Step 1</span>
                <h3>Automatic deployment audit</h3>
              </div>
              <button
                class="primary-button"
                id="install-audit-run-button"
                type="button"
              >
                Run checks
              </button>
            </div>
            <div
              class="install-check-list"
              id="install-audit-automatic-list"
              aria-live="polite"
            >
              <p>Checks have not run yet.</p>
            </div>
          </section>

          <section class="install-audit-section">
            <div class="install-audit-section-heading">
              <div>
                <span>Step 2</span>
                <h3>Install on this device</h3>
              </div>
            </div>
            <div
              class="install-check-list"
              id="install-audit-device-list"
            ></div>
            <button
              class="primary-button full-width"
              id="install-audit-install-button"
              type="button"
            >
              Show installation instructions
            </button>
          </section>

          <section class="install-audit-section">
            <div class="install-audit-section-heading">
              <div>
                <span>Step 3</span>
                <h3>Physical phone certification</h3>
              </div>
            </div>
            <p class="install-audit-help">
              Mark a result only after performing it on the deployed HTTPS site.
            </p>
            <div class="install-certification-list">
              <label>
                <input
                  id="certification-exact-resume"
                  type="checkbox"
                >
                <span>
                  Exact puzzle returned after fully closing and relaunching the
                  installed app.
                </span>
              </label>
              <label>
                <input
                  id="certification-update"
                  type="checkbox"
                >
                <span>
                  A new deployed build updated safely and preserved progress.
                </span>
              </label>
              <label>
                <input
                  id="certification-android"
                  type="checkbox"
                >
                <span>
                  Android Chrome installation and offline launch passed.
                </span>
              </label>
              <label>
                <input
                  id="certification-ios"
                  type="checkbox"
                >
                <span>
                  iPhone or iPad Safari “Add to Home Screen” and offline launch
                  passed.
                </span>
              </label>
            </div>
          </section>

          <section class="install-audit-decision" id="install-audit-decision">
            <strong>Mobile installation testing required</strong>
            <p>Run the audit and complete the physical phone checks.</p>
          </section>

          <div class="install-audit-actions">
            <button
              class="visual-test-secondary"
              id="install-audit-reset-button"
              type="button"
            >
              Reset certification
            </button>
            <button
              class="primary-button"
              id="install-audit-export-modal-button"
              type="button"
              disabled
            >
              Download report
            </button>
          </div>
        </section>
      </div>
    `
  );
}

function elements() {
  return {
    toolSummary: document.querySelector("#install-audit-tool-summary"),
    open: document.querySelector("#install-audit-open-button"),
    exportTool: document.querySelector("#install-audit-export-button"),
    overlay: document.querySelector("#install-audit-overlay"),
    close: document.querySelector("#install-audit-close-button"),
    run: document.querySelector("#install-audit-run-button"),
    automaticList: document.querySelector(
      "#install-audit-automatic-list"
    ),
    deviceList: document.querySelector("#install-audit-device-list"),
    install: document.querySelector("#install-audit-install-button"),
    exactResume: document.querySelector("#certification-exact-resume"),
    update: document.querySelector("#certification-update"),
    android: document.querySelector("#certification-android"),
    ios: document.querySelector("#certification-ios"),
    decision: document.querySelector("#install-audit-decision"),
    reset: document.querySelector("#install-audit-reset-button"),
    exportModal: document.querySelector(
      "#install-audit-export-modal-button"
    )
  };
}

function wireInstallAuditInterface() {
  const el = elements();

  el.open?.addEventListener("click", openInstallAudit);
  el.close?.addEventListener("click", closeInstallAudit);
  el.overlay?.addEventListener("click", (event) => {
    if (event.target === el.overlay) {
      closeInstallAudit();
    }
  });
  el.run?.addEventListener("click", runInstallAudit);
  el.install?.addEventListener("click", showInstallationInstructions);
  el.exportTool?.addEventListener("click", exportInstallReport);
  el.exportModal?.addEventListener("click", exportInstallReport);
  el.reset?.addEventListener("click", resetCertification);

  for (const [control, key] of [
    [el.exactResume, "exactResumePassed"],
    [el.update, "updatePassed"],
    [el.android, "androidTested"],
    [el.ios, "iosTested"]
  ]) {
    control?.addEventListener("change", () => {
      state.certification = updateCertification(
        state.certification,
        {
          [key]: control.checked
        }
      );
      saveCertification();
    });
  }
}

function openInstallAudit() {
  const el = elements();
  el.overlay.hidden = false;
  updateCertificationView();
  el.run.focus();
}

function closeInstallAudit() {
  const el = elements();
  el.overlay.hidden = true;
  el.open.focus();
}

async function runInstallAudit() {
  if (state.running) {
    return;
  }

  state.running = true;
  const el = elements();
  el.run.disabled = true;
  el.run.textContent = "Checking…";
  el.automaticList.innerHTML = `<p>Checking deployment and offline shell…</p>`;

  try {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    const manifestUrl = manifestLink
      ? new URL(manifestLink.href, globalThis.location.href).href
      : null;

    let manifest = null;
    let manifestAudit = null;
    let iconResults = [];

    if (manifestUrl) {
      const manifestResponse = await fetch(manifestUrl, {
        cache: "no-store"
      });
      if (manifestResponse.ok) {
        manifest = await manifestResponse.json();
        manifestAudit = validateManifest(manifest, {
          manifestUrl,
          documentUrl: globalThis.location.href
        });
        iconResults = await fetchAssets(
          manifestAudit.resolved.iconUrls
        );
      }
    }

    const registration =
      "serviceWorker" in navigator
        ? await waitForServiceWorkerReady(5000)
        : null;
    const cacheStatus = registration
      ? await requestCacheStatus(registration)
      : null;

    const runtime = {
      secureContext:
        globalThis.isSecureContext === true ||
        ["localhost", "127.0.0.1", "[::1]"].includes(
          globalThis.location.hostname
        ),
      manifestLinked: Boolean(manifestLink),
      manifestValid: manifestAudit?.valid === true,
      iconsAccessible:
        iconResults.length > 0 &&
        iconResults.every((result) => result.ok),
      serviceWorkerSupported: "serviceWorker" in navigator,
      serviceWorkerActive: Boolean(registration?.active),
      serviceWorkerControlled: Boolean(
        navigator.serviceWorker?.controller
      ),
      offlineCacheComplete:
        cacheStatus?.complete === true &&
        cacheStatus?.missing?.length === 0,
      installPromptAvailable: state.installPromptAvailable,
      iosManualInstallAvailable: iosManualInstallAvailable(),
      standalone: standaloneMode(),
      updateHandlingReady: Boolean(registration)
    };

    state.manifest = manifest;
    state.manifestAudit = manifestAudit;
    state.cacheStatus = cacheStatus;
    state.runtime = runtime;

    const platform =
      /Android/i.test(navigator.userAgent)
        ? "android"
        : iosManualInstallAvailable()
          ? "ios"
          : "other";

    state.lastReport = createInstallReport({
      buildVersion: BUILD_VERSION,
      pageUrl: globalThis.location.href,
      platform,
      runtime,
      manifest: {
        url: manifestUrl,
        validation: manifestAudit,
        assetResults: iconResults
      },
      cache: cacheStatus ?? {},
      certification: state.certification
    });

    renderAutomaticChecks();
    updateCertificationView();
  } catch (error) {
    el.automaticList.innerHTML = `
      <article class="install-check-row failed">
        <span aria-hidden="true">!</span>
        <div>
          <strong>Audit could not finish</strong>
          <p>${escapeHtml(error.message)}</p>
        </div>
      </article>
    `;
  } finally {
    state.running = false;
    el.run.disabled = false;
    el.run.textContent = "Run checks";
  }
}


function waitForServiceWorkerReady(timeoutMs) {
  return Promise.race([
    navigator.serviceWorker.ready.catch(() => null),
    new Promise((resolve) => {
      globalThis.setTimeout(() => resolve(null), timeoutMs);
    })
  ]);
}

async function fetchAssets(urls) {
  const unique = [...new Set(urls)];
  return Promise.all(
    unique.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        return {
          url,
          ok: response.ok,
          status: response.status,
          contentType: response.headers.get("content-type") ?? ""
        };
      } catch (error) {
        return {
          url,
          ok: false,
          status: 0,
          error: error.message
        };
      }
    })
  );
}

function requestCacheStatus(registration) {
  return new Promise((resolve) => {
    const worker =
      navigator.serviceWorker?.controller ??
      registration.active ??
      registration.waiting;

    if (!worker) {
      resolve(null);
      return;
    }

    const channel = new MessageChannel();
    const timeout = globalThis.setTimeout(() => resolve(null), 3000);

    channel.port1.onmessage = (event) => {
      globalThis.clearTimeout(timeout);
      resolve(event.data ?? null);
    };

    worker.postMessage(
      {
        type: "GET_CACHE_STATUS"
      },
      [channel.port2]
    );
  });
}

function renderAutomaticChecks() {
  const el = elements();
  const runtimeEvaluation = evaluateRuntimeInstallability(
    state.runtime ?? {}
  );
  const manifestChecks = state.manifestAudit?.checks ?? [];

  const checks = [
    ...runtimeEvaluation.checks,
    ...manifestChecks.filter(
      (check) =>
        ![
          "manifest-object",
          "name",
          "start-url",
          "scope",
          "same-origin",
          "start-in-scope",
          "document-in-scope",
          "display",
          "icon-192",
          "icon-512"
        ].includes(check.id) || !check.passed
    )
  ];

  el.automaticList.replaceChildren(
    ...checks.map((check) => checkRow(check))
  );
}

function checkRow(check) {
  const article = document.createElement("article");
  article.className =
    `install-check-row ${check.passed ? "passed" : "failed"}`;
  article.innerHTML = `
    <span aria-hidden="true">${check.passed ? "✓" : "!"}</span>
    <div>
      <strong>${escapeHtml(humanize(check.id))}</strong>
      <p>${escapeHtml(check.message)}</p>
    </div>
  `;
  return article;
}

function renderDeviceChecks() {
  const el = elements();
  const checks = [
    {
      id: "installed standalone",
      passed: state.certification.installedStandalone,
      message: state.certification.installedStandalone
        ? "This app has launched in standalone mode."
        : "Install the app, then launch it from its Home Screen icon."
    },
    {
      id: "offline launch",
      passed: state.certification.offlineLaunchPassed,
      message: state.certification.offlineLaunchPassed
        ? "An offline standalone launch was detected."
        : "After one online visit, enable airplane mode and relaunch the installed app."
    },
    {
      id: "network state",
      passed: navigator.onLine,
      message: navigator.onLine
        ? "Device is currently online."
        : "Device is currently offline; this is useful for the offline-launch test."
    }
  ];

  el.deviceList.replaceChildren(
    ...checks.map((check) => checkRow(check))
  );
}

function updateCertificationView() {
  const el = elements();
  const certification = state.certification;

  if (el.exactResume) {
    el.exactResume.checked = certification.exactResumePassed;
    el.update.checked = certification.updatePassed;
    el.android.checked = certification.androidTested;
    el.ios.checked = certification.iosTested;
  }

  renderDeviceChecks();

  const runtimeEligible =
    state.lastReport?.runtimeEvaluation?.eligible === true;
  const evaluation = evaluateMobileCertification({
    runtimeEligible,
    certification
  });

  el.decision.classList.toggle("certified", evaluation.certified);
  el.decision.innerHTML = `
    <strong>${escapeHtml(evaluation.decision)}</strong>
    <p>${
      evaluation.certified
        ? "The installation, offline, resume, update, Android, and iOS checks are complete."
        : `${evaluation.checks.filter((check) => !check.passed).length} certification check(s) remain.`
    }</p>
  `;

  const completeCount = evaluation.checks.filter(
    (check) => check.passed
  ).length;
  el.toolSummary.textContent =
    `${completeCount} of ${evaluation.checks.length} mobile certification checks passed.`;

  const canExport = Boolean(state.lastReport);
  el.exportTool.disabled = !canExport;
  el.exportModal.disabled = !canExport;

  if (state.lastReport) {
    state.lastReport = createInstallReport({
      buildVersion: BUILD_VERSION,
      pageUrl: globalThis.location.href,
      platform: state.lastReport.platform,
      runtime: state.runtime,
      manifest: state.lastReport.manifest,
      cache: state.cacheStatus ?? {},
      certification
    });
  }
}

function showInstallationInstructions() {
  const platformInstall = document.querySelector(
    "#platform-install-button"
  );

  if (platformInstall && !platformInstall.hidden) {
    platformInstall.click();
    return;
  }

  const ios = iosManualInstallAvailable();
  const message = ios
    ? "On iPhone or iPad: open in Safari, tap Share, choose Add to Home Screen, turn on Open as Web App, then tap Add."
    : "On Android Chrome: open the browser menu and choose Install app or Add to Home screen. Use the in-page Install button when Chrome offers it.";

  globalThis.alert(message);
}

function resetCertification() {
  const confirmed = globalThis.confirm(
    "Reset only the mobile installation certification results?"
  );
  if (!confirmed) {
    return;
  }

  state.certification = normalizeCertification();
  localStorage.removeItem(INSTALL_CERTIFICATION_KEY);
  recordAutomaticCertification();
  state.lastReport = null;
  updateCertificationView();
  elements().automaticList.innerHTML = `<p>Checks have not run yet.</p>`;
}

function exportInstallReport() {
  if (!state.lastReport) {
    return;
  }

  const report = createInstallReport({
    buildVersion: BUILD_VERSION,
    pageUrl: globalThis.location.href,
    platform: state.lastReport.platform,
    runtime: state.runtime,
    manifest: state.lastReport.manifest,
    cache: state.cacheStatus ?? {},
    certification: state.certification
  });

  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-install-report.json`,
    "application/json",
    JSON.stringify(report, null, 2)
  );
}

function humanize(value) {
  return String(value)
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadBlob(filename, type, content) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
