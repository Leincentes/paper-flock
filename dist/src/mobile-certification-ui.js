import {
  MOBILE_CERTIFICATION_ARCHIVE_KEY,
  aggregateMobileCertificationReports,
  completeDeviceCertificationReport,
  createDeviceCertificationReport,
  evaluateDeviceCertificationReport,
  importDeviceCertificationReports,
  isValidCertificationCode,
  mobileCertificationReportsToCsv,
  normalizeCertificationCode,
  normalizeDeviceFamily,
  updateDeviceCertificationReport
} from "./mobile-certification-core.js";
import {
  INSTALL_CERTIFICATION_KEY,
  normalizeCertification
} from "./install-audit-core.js";

const BUILD_VERSION = "1.0";
const ACTIVE_KEY = "paper-flock-mobile-certification-active";

const state = {
  archive: loadArchive(),
  active: loadActiveReport()
};

injectCertificationInterface();
wireCertificationInterface();
renderCreatorSummary();
recordAutomaticEvidence();

if (
  new URLSearchParams(globalThis.location.search).get("mobilecert") === "1"
) {
  openCertificationFlow();
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `mobile-cert-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function detectDeviceFamily() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) {
    return "android";
  }
  if (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1)
  ) {
    return "ios";
  }
  return "other";
}

function standaloneMode() {
  return (
    globalThis.matchMedia?.("(display-mode: standalone)").matches === true ||
    navigator.standalone === true
  );
}

function loadArchive() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(MOBILE_CERTIFICATION_ARCHIVE_KEY) || "{}"
    );
    return {
      schemaVersion: 1,
      reports: Array.isArray(parsed.reports)
        ? parsed.reports
        : []
    };
  } catch {
    return {
      schemaVersion: 1,
      reports: []
    };
  }
}

function saveArchive() {
  localStorage.setItem(
    MOBILE_CERTIFICATION_ARCHIVE_KEY,
    JSON.stringify(state.archive)
  );
  renderCreatorSummary();
}

function loadActiveReport() {
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(ACTIVE_KEY) || "null"
    );
    return parsed && parsed.status === "active"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function saveActiveReport() {
  if (state.active) {
    sessionStorage.setItem(
      ACTIVE_KEY,
      JSON.stringify(state.active)
    );
  } else {
    sessionStorage.removeItem(ACTIVE_KEY);
  }
}

function readInstallCertification() {
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

function injectCertificationInterface() {
  const toolBody = document.querySelector(".prototype-tools .tool-body");
  toolBody?.insertAdjacentHTML(
    "beforeend",
    `
      <section
        class="mobile-cert-tool-section"
        aria-labelledby="mobile-cert-tool-title"
      >
        <h3 id="mobile-cert-tool-title">Android and iPhone certification</h3>
        <p id="mobile-cert-summary">
          No mobile certification reports imported.
        </p>
        <div class="tool-buttons">
          <button
            class="secondary-button"
            id="mobile-cert-launch-button"
            type="button"
          >
            Run certification on this device
          </button>
          <button
            class="secondary-button"
            id="mobile-cert-import-button"
            type="button"
          >
            Import device reports
          </button>
          <button
            class="secondary-button"
            id="mobile-cert-export-json-button"
            type="button"
          >
            Export certification JSON
          </button>
          <button
            class="secondary-button"
            id="mobile-cert-export-csv-button"
            type="button"
          >
            Export certification CSV
          </button>
          <input
            id="mobile-cert-import-input"
            type="file"
            accept="application/json,.json"
            multiple
            hidden
          >
        </div>
        <p
          class="mobile-cert-tool-status"
          id="mobile-cert-tool-status"
          aria-live="polite"
        ></p>
      </section>
    `
  );

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div
        class="mobile-cert-overlay"
        id="mobile-cert-overlay"
        hidden
      >
        <section
          class="mobile-cert-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-cert-title"
        >
          <header class="mobile-cert-header">
            <div>
              <span class="mobile-cert-kicker">Paper Flock v${BUILD_VERSION}</span>
              <h2 id="mobile-cert-title">Mobile installation certification</h2>
            </div>
            <button
              class="mobile-cert-close"
              id="mobile-cert-close-button"
              type="button"
              aria-label="Close mobile certification"
            >
              ×
            </button>
          </header>

          <div id="mobile-cert-start">
            <p>
              Complete this flow separately on one Android phone and one
              iPhone or iPad. Use anonymous codes such as
              <strong>MC-ANDROID</strong> and <strong>MC-IOS</strong>.
            </p>

            <label>
              Anonymous certification code
              <input
                id="mobile-cert-code"
                type="text"
                maxlength="16"
                autocomplete="off"
                placeholder="Example: MC-ANDROID"
              >
            </label>

            <label>
              Device family
              <select id="mobile-cert-device">
                <option value="android">Android</option>
                <option value="ios">iPhone or iPad</option>
              </select>
            </label>

            <p
              class="mobile-cert-error"
              id="mobile-cert-start-error"
            ></p>

            <button
              class="primary-button full-width"
              id="mobile-cert-start-button"
              type="button"
            >
              Start device certification
            </button>
          </div>

          <form id="mobile-cert-form" hidden>
            <div class="mobile-cert-device-status">
              <span id="mobile-cert-device-label"></span>
              <span id="mobile-cert-standalone-label"></span>
              <span id="mobile-cert-network-label"></span>
            </div>

            <ol class="mobile-cert-steps">
              <li>
                <label>
                  <input
                    name="automaticAuditPassed"
                    type="checkbox"
                  >
                  <span>
                    <strong>Automatic installation audit passed.</strong>
                    Open <code>?installcheck=1</code>, run the checks, and
                    confirm all required items are green.
                  </span>
                </label>
              </li>

              <li>
                <label>
                  <input
                    name="installMethodPassed"
                    type="checkbox"
                  >
                  <span id="mobile-cert-install-copy">
                    The supported installation path completed successfully.
                  </span>
                </label>
              </li>

              <li>
                <label>
                  <input
                    name="standaloneLaunchPassed"
                    type="checkbox"
                  >
                  <span>
                    <strong>Home Screen launch passed.</strong>
                    Close the browser, then launch Paper Flock from its app
                    icon without a normal browser address bar.
                  </span>
                </label>
              </li>

              <li>
                <label>
                  <input
                    name="exactResumePassed"
                    type="checkbox"
                  >
                  <span>
                    <strong>Exact resume passed.</strong>
                    Make at least three moves, fully close the installed app,
                    reopen it, and confirm the board and Undo state return.
                  </span>
                </label>
              </li>

              <li>
                <label>
                  <input
                    name="offlineLaunchPassed"
                    type="checkbox"
                  >
                  <span>
                    <strong>Offline launch passed.</strong>
                    Fully close the app, enable airplane mode, relaunch from
                    the Home Screen, and complete one valid move.
                  </span>
                </label>
              </li>

              <li>
                <label>
                  <input
                    name="updatePreservedPassed"
                    type="checkbox"
                  >
                  <span>
                    <strong>Update preservation passed.</strong>
                    Apply a deployed update through “Update ready” and confirm
                    the active puzzle, progress, themes, and settings remain.
                  </span>
                </label>
              </li>
            </ol>

            <label class="mobile-cert-critical">
              <input
                id="mobile-cert-critical"
                name="criticalDefect"
                type="checkbox"
              >
              <span>A critical install, resume, offline, or update defect occurred.</span>
            </label>

            <label>
              Describe a critical defect, when selected.
              <textarea
                name="criticalDefectDescription"
                rows="3"
              ></textarea>
            </label>

            <label>
              Notes
              <textarea name="notes" rows="3"></textarea>
            </label>

            <p
              class="mobile-cert-error"
              id="mobile-cert-form-error"
            ></p>

            <button
              class="primary-button full-width"
              type="submit"
            >
              Complete and download device report
            </button>
          </form>

          <div id="mobile-cert-complete" hidden>
            <h3>Device report complete</h3>
            <p id="mobile-cert-complete-summary"></p>
            <div class="mobile-cert-complete-actions">
              <button
                class="secondary-button"
                id="mobile-cert-download-again"
                type="button"
              >
                Download report again
              </button>
              <button
                class="primary-button"
                id="mobile-cert-finish-button"
                type="button"
              >
                Finish
              </button>
            </div>
          </div>
        </section>
      </div>
    `
  );
}

function elements() {
  return {
    summary: document.querySelector("#mobile-cert-summary"),
    toolStatus: document.querySelector("#mobile-cert-tool-status"),
    launch: document.querySelector("#mobile-cert-launch-button"),
    importButton: document.querySelector("#mobile-cert-import-button"),
    importInput: document.querySelector("#mobile-cert-import-input"),
    exportJson: document.querySelector("#mobile-cert-export-json-button"),
    exportCsv: document.querySelector("#mobile-cert-export-csv-button"),
    overlay: document.querySelector("#mobile-cert-overlay"),
    close: document.querySelector("#mobile-cert-close-button"),
    startSection: document.querySelector("#mobile-cert-start"),
    code: document.querySelector("#mobile-cert-code"),
    device: document.querySelector("#mobile-cert-device"),
    startError: document.querySelector("#mobile-cert-start-error"),
    startButton: document.querySelector("#mobile-cert-start-button"),
    form: document.querySelector("#mobile-cert-form"),
    formError: document.querySelector("#mobile-cert-form-error"),
    deviceLabel: document.querySelector("#mobile-cert-device-label"),
    standaloneLabel: document.querySelector("#mobile-cert-standalone-label"),
    networkLabel: document.querySelector("#mobile-cert-network-label"),
    installCopy: document.querySelector("#mobile-cert-install-copy"),
    complete: document.querySelector("#mobile-cert-complete"),
    completeSummary: document.querySelector(
      "#mobile-cert-complete-summary"
    ),
    downloadAgain: document.querySelector(
      "#mobile-cert-download-again"
    ),
    finish: document.querySelector("#mobile-cert-finish-button")
  };
}

function wireCertificationInterface() {
  const el = elements();

  el.launch?.addEventListener("click", () => {
    globalThis.location.href =
      `${globalThis.location.pathname}?mobilecert=1`;
  });
  el.importButton?.addEventListener(
    "click",
    () => el.importInput.click()
  );
  el.importInput?.addEventListener(
    "change",
    importReports
  );
  el.exportJson?.addEventListener(
    "click",
    exportAggregateJson
  );
  el.exportCsv?.addEventListener(
    "click",
    exportAggregateCsv
  );
  el.close?.addEventListener("click", closeCertificationFlow);
  el.startButton?.addEventListener(
    "click",
    startCertification
  );
  el.form?.addEventListener(
    "submit",
    completeCertification
  );
  el.downloadAgain?.addEventListener(
    "click",
    downloadLastCompletedReport
  );
  el.finish?.addEventListener(
    "click",
    closeCertificationFlow
  );

  globalThis.addEventListener("online", recordAutomaticEvidence);
  globalThis.addEventListener("offline", recordAutomaticEvidence);
}

function openCertificationFlow() {
  const el = elements();
  el.overlay.hidden = false;

  if (state.active) {
    showActiveForm();
    return;
  }

  el.device.value = normalizeDeviceFamily(
    detectDeviceFamily()
  ) === "ios"
    ? "ios"
    : "android";
  el.code.focus();
}

function closeCertificationFlow() {
  elements().overlay.hidden = true;
}

function startCertification() {
  const el = elements();
  const code = normalizeCertificationCode(el.code.value);

  if (!isValidCertificationCode(code)) {
    el.startError.textContent =
      "Use a 2–16 character anonymous code.";
    el.code.focus();
    return;
  }

  const duplicate = state.archive.reports.some(
    (report) => report.participantCode === code
  );
  if (duplicate) {
    el.startError.textContent =
      "That certification code already exists on this device.";
    el.code.focus();
    return;
  }

  state.active = createDeviceCertificationReport({
    reportId: createId(),
    participantCode: code,
    deviceFamily: el.device.value,
    buildVersion: BUILD_VERSION,
    environment: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      viewportWidth: globalThis.innerWidth,
      viewportHeight: globalThis.innerHeight,
      standaloneDetected: standaloneMode(),
      serviceWorkerControlled:
        Boolean(navigator.serviceWorker?.controller),
      onlineAtStart: navigator.onLine
    }
  });

  saveActiveReport();
  el.startError.textContent = "";
  showActiveForm();
}

function showActiveForm() {
  const el = elements();
  const device = normalizeDeviceFamily(
    state.active.deviceFamily
  );

  el.startSection.hidden = true;
  el.complete.hidden = true;
  el.form.hidden = false;
  el.deviceLabel.textContent =
    device === "ios"
      ? "iPhone or iPad"
      : "Android";
  el.installCopy.innerHTML =
    device === "ios"
      ? "<strong>Safari Add to Home Screen passed.</strong> Use Share → Add to Home Screen → Open as Web App."
      : "<strong>Chrome installation passed.</strong> Use the in-game Install button or Chrome’s Install app option.";

  recordAutomaticEvidence();
  hydrateForm();
}

function hydrateForm() {
  const el = elements();
  if (!state.active) {
    return;
  }

  for (const key of Object.keys(state.active.checks)) {
    const control = el.form.elements.namedItem(key);
    if (control) {
      control.checked = Boolean(state.active.checks[key]);
    }
  }

  el.form.elements.criticalDefect.checked =
    Boolean(state.active.criticalDefect);
  el.form.elements.criticalDefectDescription.value =
    state.active.criticalDefectDescription ?? "";
  el.form.elements.notes.value =
    state.active.notes ?? "";
}

function recordAutomaticEvidence() {
  const el = elements();
  const standalone = standaloneMode();
  const offline = navigator.onLine === false;

  if (state.active) {
    const installCertification = readInstallCertification();
    state.active = updateDeviceCertificationReport(
      state.active,
      {
        standaloneLaunchPassed:
          state.active.checks.standaloneLaunchPassed ||
          standalone,
        offlineLaunchPassed:
          state.active.checks.offlineLaunchPassed ||
          (standalone && offline),
        automaticAuditPassed:
          state.active.checks.automaticAuditPassed ||
          (
            installCertification.installedStandalone &&
            installCertification.offlineLaunchPassed
          )
      }
    );
    saveActiveReport();
  }

  if (el.standaloneLabel) {
    el.standaloneLabel.textContent =
      standalone
        ? "Standalone detected"
        : "Browser mode";
  }
  if (el.networkLabel) {
    el.networkLabel.textContent =
      navigator.onLine
        ? "Online"
        : "Offline";
  }

  if (state.active && !el.form.hidden) {
    hydrateForm();
  }
}

function collectFormPatch(form) {
  const data = new FormData(form);
  const patch = {};

  for (const key of Object.keys(state.active.checks)) {
    patch[key] = form.elements.namedItem(key).checked;
  }

  patch.criticalDefect =
    form.elements.criticalDefect.checked;
  patch.criticalDefectDescription = String(
    data.get("criticalDefectDescription") ?? ""
  );
  patch.notes = String(data.get("notes") ?? "");
  return patch;
}

function completeCertification(event) {
  event.preventDefault();
  const el = elements();
  const patch = collectFormPatch(el.form);

  if (
    patch.criticalDefect &&
    !patch.criticalDefectDescription.trim()
  ) {
    el.formError.textContent =
      "Describe the critical defect before completing the report.";
    el.form.elements.criticalDefectDescription.focus();
    return;
  }

  const completed = completeDeviceCertificationReport(
    state.active,
    { patch }
  );
  state.archive.reports.push(completed);
  state.active = null;
  saveActiveReport();
  saveArchive();

  el.formError.textContent = "";
  el.form.hidden = true;
  el.complete.hidden = false;

  const evaluation =
    evaluateDeviceCertificationReport(completed);
  el.completeSummary.textContent =
    `${completed.participantCode}: ` +
    `${evaluation.passed ? "all device checks passed" : `failed checks: ${evaluation.failedChecks.join(", ") || "critical defect"}`}.`;

  el.downloadAgain.dataset.reportId = completed.reportId;
  downloadReport(completed);
}

function downloadLastCompletedReport() {
  const reportId =
    elements().downloadAgain.dataset.reportId;
  const report = state.archive.reports.find(
    (candidate) => candidate.reportId === reportId
  );
  if (report) {
    downloadReport(report);
  }
}

function downloadReport(report) {
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-${report.participantCode}-mobile-install.json`,
    "application/json",
    JSON.stringify(
      {
        buildVersion: BUILD_VERSION,
        exportedAt: new Date().toISOString(),
        report
      },
      null,
      2
    )
  );
}

async function importReports(event) {
  const files = [...(event.target.files ?? [])];
  event.target.value = "";
  if (files.length === 0) {
    return;
  }

  const payloads = [];
  const fileErrors = [];

  for (const file of files) {
    try {
      payloads.push(JSON.parse(await file.text()));
    } catch {
      fileErrors.push(`${file.name}: invalid JSON`);
    }
  }

  const result = importDeviceCertificationReports(
    state.archive.reports,
    payloads
  );
  state.archive.reports = result.reports;
  saveArchive();

  const messages = [
    `${result.imported.length} report(s) imported.`
  ];
  if (result.rejected.length > 0) {
    messages.push(
      `${result.rejected.length} report(s) rejected.`
    );
  }
  if (fileErrors.length > 0) {
    messages.push(fileErrors.join(" "));
  }
  elements().toolStatus.textContent = messages.join(" ");
}

function renderCreatorSummary() {
  const el = elements();
  if (!el.summary) {
    return;
  }

  const aggregate =
    aggregateMobileCertificationReports(
      state.archive.reports
    );

  el.summary.textContent =
    `${aggregate.decision}. ` +
    `Android passed: ${aggregate.androidPassed ? "yes" : "no"}; ` +
    `iPhone/iPad passed: ${aggregate.iosPassed ? "yes" : "no"}; ` +
    `critical defects: ${aggregate.criticalDefects}.`;
}

function exportAggregateJson() {
  const aggregate =
    aggregateMobileCertificationReports(
      state.archive.reports
    );
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-mobile-certification.json`,
    "application/json",
    JSON.stringify(
      {
        product: "Paper Flock",
        buildVersion: BUILD_VERSION,
        exportedAt: new Date().toISOString(),
        aggregate,
        reports: state.archive.reports
      },
      null,
      2
    )
  );
}

function exportAggregateCsv() {
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-mobile-certification.csv`,
    "text/csv;charset=utf-8",
    mobileCertificationReportsToCsv(
      state.archive.reports
    )
  );
}

function downloadBlob(filename, type, content) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
