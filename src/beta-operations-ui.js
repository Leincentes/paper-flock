import {
  STORAGE_KEYS
} from "./storage-core.js";
import {
  aggregateFeedbackReports,
  createBetaDisclosure,
  createFeedbackReport,
  createOperationsState,
  deriveProductionReadiness,
  feedbackReportsToCsv,
  isBetaDisclosureAccepted,
  mergeFeedbackReports,
  normalizeOperationalChecks
} from "./beta-operations-core.js";

const BUILD_VERSION = "1.2";

const state = {
  config: {},
  knownIssues: [],
  feedbackReports: loadFeedbackReports(),
  operations: loadOperationsState()
};

injectBetaInterface();
wireBetaInterface();
initializeBetaOperations();
globalThis.addEventListener(
  "paperflock:accessibility-certification-changed",
  renderReadiness
);

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `beta-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function loadFeedbackReports() {
  const value = loadJson(STORAGE_KEYS.betaFeedback, []);
  return Array.isArray(value) ? value : [];
}

function saveFeedbackReports() {
  localStorage.setItem(
    STORAGE_KEYS.betaFeedback,
    JSON.stringify(state.feedbackReports)
  );
  renderReadiness();
}

function loadOperationsState() {
  const parsed = loadJson(STORAGE_KEYS.betaOperations, null);
  if (
    parsed &&
    parsed.schemaVersion === 1 &&
    parsed.checks
  ) {
    return createOperationsState({
      buildVersion: BUILD_VERSION,
      updatedAt: parsed.updatedAt,
      checks: parsed.checks
    });
  }
  return createOperationsState({
    buildVersion: BUILD_VERSION
  });
}

function saveOperationsState() {
  state.operations = createOperationsState({
    buildVersion: BUILD_VERSION,
    checks: state.operations.checks
  });
  localStorage.setItem(
    STORAGE_KEYS.betaOperations,
    JSON.stringify(state.operations)
  );
  renderReadiness();
}

async function initializeBetaOperations() {
  const [config, knownIssues] = await Promise.all([
    fetchJson("./app-config.json", {}),
    fetchJson("./known-issues.json", { issues: [] })
  ]);
  state.config = config;
  state.knownIssues = Array.isArray(knownIssues.issues)
    ? knownIssues.issues
    : [];

  renderReadiness();
  showBetaDisclosureWhenNeeded();
}

async function fetchJson(url, fallback) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return fallback;
    }
    return await response.json();
  } catch {
    return fallback;
  }
}

function currentQueryIsTestMode() {
  const query = new URLSearchParams(globalThis.location.search);
  return [
    "fieldtest",
    "tactiletest",
    "visualtest",
    "mobilecert",
    "a11ycert",
    "installcheck"
  ].some((key) => query.get(key) === "1");
}

function showBetaDisclosureWhenNeeded() {
  if (
    state.config.releaseChannel === "production" ||
    currentQueryIsTestMode()
  ) {
    return;
  }

  const accepted = isBetaDisclosureAccepted(
    loadJson(STORAGE_KEYS.betaDisclosure, null)
  );
  if (!accepted) {
    const disclosure = document.querySelector("#beta-disclosure");
    disclosure.hidden = false;
    document.querySelector("#beta-disclosure-continue")?.focus();
  }
}

function injectBetaInterface() {
  const prototypeTools = document.querySelector(
    ".prototype-tools .tool-body"
  );

  prototypeTools?.insertAdjacentHTML(
    "beforeend",
    `
      <section
        class="beta-operations-section"
        aria-labelledby="beta-operations-title"
      >
        <h3 id="beta-operations-title">Public beta and production readiness</h3>
        <p id="beta-readiness-summary">
          Calculating local evidence and operational readiness…
        </p>

        <div class="beta-readiness-grid" id="beta-readiness-grid"></div>

        <fieldset class="beta-operations-checklist">
          <legend>Creator verification</legend>

          <label>
            <input
              type="checkbox"
              data-beta-operation="backupRestoreVerified"
            >
            Backup and restore drill passed.
          </label>

          <label>
            <input
              type="checkbox"
              data-beta-operation="rollbackVerified"
            >
            Deployment rollback drill passed.
          </label>

          <label>
            <input
              type="checkbox"
              data-beta-operation="androidChromeVerified"
            >
            Current Android Chrome verification passed.
          </label>

          <label>
            <input
              type="checkbox"
              data-beta-operation="iosSafariVerified"
            >
            Current iPhone/iPad Safari verification passed.
          </label>

          <label>
            <input
              type="checkbox"
              data-beta-operation="offlineUpdateVerified"
            >
            Offline launch and deployed-update preservation passed.
          </label>

          <label>
            <input
              type="checkbox"
              data-beta-operation="keyboardNavigationVerified"
            >
            Keyboard-only puzzle and modal navigation passed.
          </label>

          <label>
            <input
              type="checkbox"
              data-beta-operation="screenReaderVerified"
            >
            Screen-reader labels, announcements, and focus order passed.
          </label>

          <label>
            <input
              type="checkbox"
              data-beta-operation="textScalingVerified"
            >
            Large and extra-large text passed without lost controls.
          </label>

          <label>
            <input
              type="checkbox"
              data-beta-operation="forcedColorsVerified"
            >
            Forced-colors or high-contrast verification passed.
          </label>
        </fieldset>

        <div class="tool-buttons">
          <button
            class="secondary-button"
            id="beta-import-feedback-button"
            type="button"
          >
            Import feedback reports
          </button>
          <button
            class="secondary-button"
            id="beta-export-feedback-json"
            type="button"
          >
            Export feedback JSON
          </button>
          <button
            class="secondary-button"
            id="beta-export-feedback-csv"
            type="button"
          >
            Export feedback CSV
          </button>
          <button
            class="secondary-button"
            id="beta-export-readiness"
            type="button"
          >
            Export readiness report
          </button>
          <input
            id="beta-import-feedback-input"
            type="file"
            accept="application/json,.json"
            multiple
            hidden
          >
        </div>

        <p
          class="beta-operations-status"
          id="beta-operations-status"
          aria-live="polite"
        ></p>
      </section>
    `
  );

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="beta-modal" id="beta-disclosure" hidden>
        <section
          class="beta-modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="beta-disclosure-title"
        >
          <span class="beta-modal-kicker">Public beta</span>
          <h2 id="beta-disclosure-title">Paper Flock is still being tested</h2>
          <p>
            Progress stays on this device. The game does not automatically
            upload play data, feedback, diagnostics, or personal information.
            You can export files deliberately when you choose to help test it.
          </p>
          <p>
            Features, levels, visuals, and saved data formats may change during
            the beta. Back up local progress before major updates.
          </p>
          <div class="beta-modal-actions">
            <a href="./privacy.html">Read privacy notice</a>
            <button
              class="primary-button"
              id="beta-disclosure-continue"
              type="button"
            >
              Continue to beta
            </button>
          </div>
        </section>
      </div>

      <div class="beta-modal" id="beta-feedback-modal" hidden>
        <section
          class="beta-modal-panel beta-feedback-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="beta-feedback-title"
        >
          <header class="beta-feedback-header">
            <div>
              <span class="beta-modal-kicker">Local feedback export</span>
              <h2 id="beta-feedback-title">Tell the creator what happened</h2>
            </div>
            <button
              class="beta-modal-close"
              id="beta-feedback-close"
              type="button"
              aria-label="Close feedback form"
            >
              ×
            </button>
          </header>

          <p>
            Do not enter your name, email, phone number, account name, or other
            personal details. This form downloads a JSON file; it does not
            upload anything automatically.
          </p>

          <form id="beta-feedback-form">
            <label>
              Category *
              <select name="category" required>
                <option value="">Choose one</option>
                <option value="gameplay">Gameplay or level</option>
                <option value="visual">Visual or animation</option>
                <option value="install-offline">Installation or offline</option>
                <option value="performance">Performance</option>
                <option value="accessibility">Accessibility</option>
                <option value="progress-data">Progress or saved data</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              Severity *
              <select name="severity" required>
                <option value="">Choose one</option>
                <option value="suggestion">Suggestion</option>
                <option value="minor">Minor problem</option>
                <option value="major">Major problem</option>
                <option value="critical">Critical — blocked play or lost progress</option>
              </select>
            </label>

            <label>
              Short summary *
              <input
                name="summary"
                type="text"
                maxlength="160"
                required
              >
            </label>

            <label>
              What happened? *
              <textarea
                name="description"
                rows="4"
                required
              ></textarea>
            </label>

            <label>
              Steps to reproduce
              <textarea name="reproductionSteps" rows="3"></textarea>
            </label>

            <label>
              What did you expect?
              <textarea name="expectedResult" rows="2"></textarea>
            </label>

            <label>
              What happened instead?
              <textarea name="actualResult" rows="2"></textarea>
            </label>

            <p
              class="beta-form-error"
              id="beta-feedback-error"
              aria-live="polite"
            ></p>

            <button class="primary-button full-width" type="submit">
              Save and download feedback
            </button>
          </form>
        </section>
      </div>
    `
  );
}

function elements() {
  return {
    disclosure: document.querySelector("#beta-disclosure"),
    disclosureContinue: document.querySelector(
      "#beta-disclosure-continue"
    ),
    feedbackButton: document.querySelector("#beta-feedback-button"),
    feedbackModal: document.querySelector("#beta-feedback-modal"),
    feedbackClose: document.querySelector("#beta-feedback-close"),
    feedbackForm: document.querySelector("#beta-feedback-form"),
    feedbackError: document.querySelector("#beta-feedback-error"),
    summary: document.querySelector("#beta-readiness-summary"),
    grid: document.querySelector("#beta-readiness-grid"),
    importFeedback: document.querySelector(
      "#beta-import-feedback-button"
    ),
    importInput: document.querySelector(
      "#beta-import-feedback-input"
    ),
    exportFeedbackJson: document.querySelector(
      "#beta-export-feedback-json"
    ),
    exportFeedbackCsv: document.querySelector(
      "#beta-export-feedback-csv"
    ),
    exportReadiness: document.querySelector(
      "#beta-export-readiness"
    ),
    status: document.querySelector("#beta-operations-status")
  };
}

function wireBetaInterface() {
  const el = elements();

  el.disclosureContinue?.addEventListener("click", () => {
    localStorage.setItem(
      STORAGE_KEYS.betaDisclosure,
      JSON.stringify(
        createBetaDisclosure({ buildVersion: BUILD_VERSION })
      )
    );
    el.disclosure.hidden = true;
  });

  el.feedbackButton?.addEventListener("click", openFeedback);
  el.feedbackClose?.addEventListener("click", closeFeedback);
  el.feedbackModal?.addEventListener("click", (event) => {
    if (event.target === el.feedbackModal) {
      closeFeedback();
    }
  });
  el.feedbackForm?.addEventListener("submit", submitFeedback);

  document.querySelectorAll("[data-beta-operation]").forEach((control) => {
    const key = control.dataset.betaOperation;
    control.checked = Boolean(state.operations.checks[key]);
    control.addEventListener("change", () => {
      state.operations.checks[key] = control.checked;
      saveOperationsState();
    });
  });

  el.importFeedback?.addEventListener(
    "click",
    () => el.importInput.click()
  );
  el.importInput?.addEventListener("change", importFeedback);
  el.exportFeedbackJson?.addEventListener(
    "click",
    exportFeedbackJson
  );
  el.exportFeedbackCsv?.addEventListener(
    "click",
    exportFeedbackCsv
  );
  el.exportReadiness?.addEventListener(
    "click",
    exportReadiness
  );
}

function openFeedback() {
  const el = elements();
  el.feedbackModal.hidden = false;
  el.feedbackForm.querySelector("select")?.focus();
}

function closeFeedback() {
  const el = elements();
  el.feedbackModal.hidden = true;
  el.feedbackButton?.focus();
}

function environmentSummary() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    viewportWidth: globalThis.innerWidth,
    viewportHeight: globalThis.innerHeight,
    pixelRatio: globalThis.devicePixelRatio,
    online: navigator.onLine,
    displayMode:
      globalThis.matchMedia?.("(display-mode: standalone)").matches ||
      navigator.standalone === true
        ? "standalone"
        : "browser",
    reducedMotion:
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
      false
  };
}

function submitFeedback(event) {
  event.preventDefault();
  const el = elements();
  const form = event.currentTarget;

  if (!form.reportValidity()) {
    el.feedbackError.textContent =
      "Complete the required feedback fields.";
    return;
  }

  const data = new FormData(form);
  const report = createFeedbackReport({
    reportId: createId(),
    buildVersion: BUILD_VERSION,
    category: data.get("category"),
    severity: data.get("severity"),
    summary: data.get("summary"),
    description: data.get("description"),
    reproductionSteps: data.get("reproductionSteps"),
    expectedResult: data.get("expectedResult"),
    actualResult: data.get("actualResult"),
    environment: environmentSummary()
  });

  state.feedbackReports = [
    ...state.feedbackReports,
    report
  ].slice(-200);
  saveFeedbackReports();
  downloadReport(report);
  form.reset();
  el.feedbackError.textContent = "";
  closeFeedback();
}

function downloadReport(report) {
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-feedback-${report.reportId}.json`,
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

async function importFeedback(event) {
  const files = [...(event.target.files ?? [])];
  event.target.value = "";
  if (files.length === 0) {
    return;
  }

  const payloads = [];
  const parseErrors = [];

  for (const file of files) {
    try {
      payloads.push(JSON.parse(await file.text()));
    } catch {
      parseErrors.push(`${file.name}: invalid JSON`);
    }
  }

  const result = mergeFeedbackReports(
    state.feedbackReports,
    payloads
  );
  state.feedbackReports = result.reports;
  saveFeedbackReports();

  elements().status.textContent =
    `${result.imported.length} feedback report(s) imported; ` +
    `${result.rejected.length + parseErrors.length} rejected.`;
}

function readArchive(key, arrayKey) {
  const parsed = loadJson(key, {});
  return Array.isArray(parsed?.[arrayKey])
    ? parsed[arrayKey]
    : [];
}

function currentReadiness() {
  return deriveProductionReadiness({
    fieldSessions: readArchive(
      STORAGE_KEYS.tactileResearch,
      "sessions"
    ),
    mobileReports: readArchive(
      STORAGE_KEYS.mobileCertification,
      "reports"
    ),
    accessibilityReports: readArchive(
      STORAGE_KEYS.accessibilityCertification,
      "reports"
    ),
    feedbackReports: state.feedbackReports,
    operations: state.operations,
    knownIssues: state.knownIssues,
    config: state.config,
    qualityEvidence: loadJson(
      STORAGE_KEYS.qualityEvidence,
      null
    )
  });
}

function renderReadiness() {
  const el = elements();
  if (!el.summary || !el.grid) {
    return;
  }

  const readiness = currentReadiness();
  el.summary.textContent =
    `${readiness.decision}. Public beta setup: ` +
    `${readiness.publicBetaReady ? "ready" : "incomplete"}; ` +
    `production candidate: ` +
    `${readiness.productionCandidateReady ? "ready for final review" : "not ready"}.`;

  const cards = [
    [
      "Mobile install",
      readiness.mobileAggregate.certified
        ? "Certified"
        : "Android + iPhone reports required",
      readiness.mobileAggregate.certified
    ],
    [
      "Real players",
      readiness.fieldEvaluation.decision,
      readiness.fieldEvaluation.passed === true
    ],
    [
      "Feedback",
      `${readiness.feedbackAggregate.validReports} reports · ` +
        `${readiness.feedbackAggregate.criticalReports} critical`,
      readiness.feedbackAggregate.criticalReports === 0
    ],
    [
      "Support",
      readiness.supportConfigured
        ? "Public contact configured"
        : "Configure app-config.json",
      readiness.supportConfigured
    ],
    [
      "Known issues",
      `${readiness.criticalKnownIssues.length} unresolved critical`,
      readiness.criticalKnownIssues.length === 0
    ],
    [
      "Accessibility",
      readiness.productionChecks.keyboardNavigationVerified &&
      readiness.productionChecks.screenReaderVerified &&
      readiness.productionChecks.textScalingVerified &&
      readiness.productionChecks.forcedColorsVerified
        ? "Physical checks complete"
        : "Keyboard, screen reader, text, and contrast checks pending",
      readiness.productionChecks.keyboardNavigationVerified &&
      readiness.productionChecks.screenReaderVerified &&
      readiness.productionChecks.textScalingVerified &&
      readiness.productionChecks.forcedColorsVerified
    ],
    [
      "Release drills",
      readiness.productionChecks.backupRestoreVerified &&
      readiness.productionChecks.rollbackVerified &&
      readiness.productionChecks.offlineUpdateVerified
        ? "Complete"
        : "Incomplete",
      readiness.productionChecks.backupRestoreVerified &&
      readiness.productionChecks.rollbackVerified &&
      readiness.productionChecks.offlineUpdateVerified
    ]
  ];

  el.grid.replaceChildren();
  for (const [title, detail, passed] of cards) {
    const card = document.createElement("article");
    card.className = `beta-readiness-card ${passed ? "passed" : "pending"}`;
    card.innerHTML = `
      <span>${passed ? "Ready" : "Pending"}</span>
      <strong>${title}</strong>
      <small>${detail}</small>
    `;
    el.grid.append(card);
  }
}

function exportFeedbackJson() {
  const aggregate = aggregateFeedbackReports(
    state.feedbackReports
  );
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-beta-feedback.json`,
    "application/json",
    JSON.stringify(
      {
        product: "Paper Flock",
        buildVersion: BUILD_VERSION,
        exportedAt: new Date().toISOString(),
        aggregate,
        reports: state.feedbackReports
      },
      null,
      2
    )
  );
}

function exportFeedbackCsv() {
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-beta-feedback.csv`,
    "text/csv;charset=utf-8",
    feedbackReportsToCsv(state.feedbackReports)
  );
}

function exportReadiness() {
  const readiness = currentReadiness();
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-production-readiness.json`,
    "application/json",
    JSON.stringify(
      {
        product: "Paper Flock",
        buildVersion: BUILD_VERSION,
        generatedAt: new Date().toISOString(),
        readiness,
        operations: state.operations,
        config: {
          supportEmailConfigured:
            Boolean(String(state.config.supportEmail ?? "").trim()),
          supportUrlConfigured:
            Boolean(String(state.config.supportUrl ?? "").trim())
        }
      },
      null,
      2
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
