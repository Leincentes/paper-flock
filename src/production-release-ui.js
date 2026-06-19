import {
  STORAGE_KEYS
} from "./storage-core.js";
import {
  createProductionApproval,
  evaluateQualityEvidence,
  expectedApprovalPhrase,
  importQualityEvidence
} from "./quality-evidence-core.js";
import {
  createOperationsState,
  deriveProductionReadiness
} from "./beta-operations-core.js";

const BUILD_VERSION = "0.21";
const state = {
  config: {},
  knownIssues: [],
  qualityEvidence: loadJson(
    STORAGE_KEYS.qualityEvidence,
    null
  )
};

injectReleaseCenter();
wireReleaseCenter();
initialize();

async function initialize() {
  const [config, knownIssues] = await Promise.all([
    fetchJson("./app-config.json", {}),
    fetchJson("./known-issues.json", { issues: [] })
  ]);
  state.config = config;
  state.knownIssues = Array.isArray(knownIssues.issues)
    ? knownIssues.issues
    : [];
  render();
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

async function fetchJson(url, fallback) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return response.ok ? await response.json() : fallback;
  } catch {
    return fallback;
  }
}

function readArchive(key, arrayKey) {
  const parsed = loadJson(key, {});
  return Array.isArray(parsed?.[arrayKey])
    ? parsed[arrayKey]
    : [];
}

function loadOperations() {
  const parsed = loadJson(STORAGE_KEYS.betaOperations, null);
  return parsed?.checks
    ? parsed
    : createOperationsState({
        buildVersion: BUILD_VERSION
      });
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
    feedbackReports: loadJson(
      STORAGE_KEYS.betaFeedback,
      []
    ),
    operations: loadOperations(),
    knownIssues: state.knownIssues,
    config: state.config,
    qualityEvidence: state.qualityEvidence
  });
}

function injectReleaseCenter() {
  const body = document.querySelector(
    ".prototype-tools .tool-body"
  );
  body?.insertAdjacentHTML(
    "beforeend",
    `
      <section
        class="production-release-center"
        aria-labelledby="production-release-title"
      >
        <h3 id="production-release-title">
          Production release evidence
        </h3>
        <p id="production-release-summary">
          Import the successful GitHub Actions quality-evidence file.
        </p>

        <div
          class="production-release-grid"
          id="production-release-grid"
        ></div>

        <div class="tool-buttons">
          <button
            class="secondary-button"
            id="quality-evidence-import-button"
            type="button"
          >
            Import CI quality evidence
          </button>
          <button
            class="secondary-button"
            id="production-decision-export-button"
            type="button"
          >
            Export production decision
          </button>
          <input
            id="quality-evidence-import-input"
            type="file"
            accept="application/json,.json"
            hidden
          >
        </div>

        <fieldset class="production-signoff">
          <legend>Final human release review</legend>

          <label>
            Reviewer code
            <input
              id="production-reviewer-code"
              type="text"
              maxlength="30"
              autocomplete="off"
              placeholder="Example: CREATOR"
            >
          </label>

          <label>
            Confirmation phrase
            <input
              id="production-confirmation"
              type="text"
              autocomplete="off"
              placeholder="${expectedApprovalPhrase(BUILD_VERSION)}"
            >
          </label>

          <label>
            Review notes
            <textarea
              id="production-review-notes"
              rows="3"
            ></textarea>
          </label>

          <button
            class="primary-button"
            id="production-approval-button"
            type="button"
          >
            Create production approval record
          </button>
        </fieldset>

        <p
          class="production-release-status"
          id="production-release-status"
          aria-live="polite"
        ></p>
      </section>
    `
  );
}

function elements() {
  return {
    summary: document.querySelector(
      "#production-release-summary"
    ),
    grid: document.querySelector(
      "#production-release-grid"
    ),
    importButton: document.querySelector(
      "#quality-evidence-import-button"
    ),
    importInput: document.querySelector(
      "#quality-evidence-import-input"
    ),
    exportDecision: document.querySelector(
      "#production-decision-export-button"
    ),
    reviewer: document.querySelector(
      "#production-reviewer-code"
    ),
    confirmation: document.querySelector(
      "#production-confirmation"
    ),
    notes: document.querySelector(
      "#production-review-notes"
    ),
    approve: document.querySelector(
      "#production-approval-button"
    ),
    status: document.querySelector(
      "#production-release-status"
    )
  };
}

function wireReleaseCenter() {
  const el = elements();

  el.importButton?.addEventListener(
    "click",
    () => el.importInput.click()
  );
  el.importInput?.addEventListener(
    "change",
    importEvidence
  );
  el.exportDecision?.addEventListener(
    "click",
    exportDecision
  );
  el.approve?.addEventListener(
    "click",
    createApproval
  );

  for (const eventName of [
    "paperflock:accessibility-certification-changed"
  ]) {
    globalThis.addEventListener(eventName, render);
  }
  globalThis.addEventListener("storage", render);
}

async function importEvidence(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) {
    return;
  }

  const el = elements();
  try {
    const payload = JSON.parse(await file.text());
    const result = importQualityEvidence(payload, {
      expectedBuildVersion: BUILD_VERSION
    });

    if (!result.imported) {
      el.status.textContent =
        result.problems.join(" ");
      return;
    }

    state.qualityEvidence = result.evidence;
    localStorage.setItem(
      STORAGE_KEYS.qualityEvidence,
      JSON.stringify(result.evidence)
    );
    el.status.textContent =
      "CI quality evidence imported.";
    render();
  } catch {
    el.status.textContent =
      "The selected quality-evidence file is invalid JSON.";
  }
}

function render() {
  const el = elements();
  if (!el.summary || !el.grid) {
    return;
  }

  const readiness = currentReadiness();
  const quality = evaluateQualityEvidence(
    state.qualityEvidence ?? {}
  );

  el.summary.textContent =
    `${readiness.decision}. CI evidence: ` +
    `${quality.passed ? "passed" : "missing or incomplete"}.`;

  const cards = [
    [
      "CI quality",
      quality.passed
        ? "All automated release checks passed"
        : `${quality.failedChecks.length} checks missing`,
      quality.passed
    ],
    [
      "Mobile",
      readiness.mobileAggregate.certified
        ? "Android and iPhone certified"
        : "Physical reports required",
      readiness.mobileAggregate.certified
    ],
    [
      "Accessibility",
      readiness.accessibilityAggregate.certified
        ? "Five physical test types passed"
        : `${readiness.accessibilityAggregate.missingTypes.length} test types pending`,
      readiness.accessibilityAggregate.certified
    ],
    [
      "Real players",
      readiness.fieldEvaluation.decision,
      readiness.fieldEvaluation.passed === true
    ],
    [
      "Operations",
      readiness.productionChecks.backupRestoreVerified &&
      readiness.productionChecks.rollbackVerified &&
      readiness.productionChecks.offlineUpdateVerified
        ? "Backup, rollback, and update drills passed"
        : "Release drills incomplete",
      readiness.productionChecks.backupRestoreVerified &&
      readiness.productionChecks.rollbackVerified &&
      readiness.productionChecks.offlineUpdateVerified
    ],
    [
      "Production candidate",
      readiness.productionCandidateReady
        ? "Ready for final human review"
        : "Blocked by remaining gates",
      readiness.productionCandidateReady
    ]
  ];

  el.grid.replaceChildren();
  for (const [title, detail, passed] of cards) {
    const article = document.createElement("article");
    article.className =
      `production-release-card ${passed ? "passed" : "pending"}`;
    const badge = document.createElement("span");
    badge.textContent = passed ? "Ready" : "Pending";
    const heading = document.createElement("strong");
    heading.textContent = title;
    const description = document.createElement("small");
    description.textContent = detail;
    article.append(badge, heading, description);
    el.grid.append(article);
  }

  el.approve.disabled =
    !readiness.productionCandidateReady ||
    !quality.passed;
}

function exportDecision() {
  const readiness = currentReadiness();
  const qualityEvaluation =
    evaluateQualityEvidence(state.qualityEvidence ?? {});

  downloadJson(
    `paper-flock-v${BUILD_VERSION}-production-decision.json`,
    {
      product: "Paper Flock",
      buildVersion: BUILD_VERSION,
      exportedAt: new Date().toISOString(),
      readiness,
      qualityEvaluation,
      qualityEvidence: state.qualityEvidence,
      productionApproved: false,
      finalHumanReleaseReviewRequired: true
    }
  );
}

function createApproval() {
  const el = elements();
  const readiness = currentReadiness();

  try {
    const approval = createProductionApproval({
      buildVersion: BUILD_VERSION,
      reviewerCode: el.reviewer.value,
      confirmation: el.confirmation.value,
      readiness,
      qualityEvidence: state.qualityEvidence,
      notes: el.notes.value
    });

    localStorage.setItem(
      STORAGE_KEYS.productionApproval,
      JSON.stringify(approval)
    );
    downloadJson(
      `paper-flock-v${BUILD_VERSION}-production-approval.json`,
      approval
    );
    el.status.textContent =
      "Production approval record created and downloaded.";
  } catch (error) {
    el.status.textContent =
      error instanceof Error
        ? error.message
        : "Production approval could not be created.";
  }
}

function downloadJson(filename, payload) {
  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: "application/json" }
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
