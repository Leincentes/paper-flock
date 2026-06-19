import {
  ACCESSIBILITY_CERTIFICATION_ARCHIVE_KEY,
  ACCESSIBILITY_CHECKS,
  ACCESSIBILITY_TEST_TYPES,
  accessibilityCertificationReportsToCsv,
  aggregateAccessibilityCertificationReports,
  completeAccessibilityCertificationReport,
  createAccessibilityCertificationReport,
  evaluateAccessibilityCertificationReport,
  importAccessibilityCertificationReports,
  isValidAccessibilityCertificationCode,
  normalizeAccessibilityCertificationCode,
  normalizeAccessibilityTestType,
  requiredChecksForType
} from "./accessibility-certification-core.js";

const BUILD_VERSION = "1.0";
const ACTIVE_KEY =
  "paper-flock-accessibility-certification-active";

const TEST_DETAILS = Object.freeze({
  keyboard: {
    title: "Keyboard-only navigation",
    code: "AC-KEYBOARD",
    technology: "Physical keyboard",
    description:
      "Complete the entire core flow without a mouse or touch.",
    checks: {
      skipLinkPassed:
        "The skip link moves focus directly to the puzzle board.",
      boardArrowNavigationPassed:
        "Arrow keys move predictably between active birds.",
      keyboardActivationPassed:
        "Enter and Space activate focused birds and controls.",
      modalFocusTrapPassed:
        "Tab and Shift+Tab stay inside every open modal.",
      escapeClosePassed:
        "Escape closes modals that provide a close action.",
      focusReturnPassed:
        "Closing a modal returns focus to the control that opened it."
    }
  },
  voiceover: {
    title: "iPhone or iPad VoiceOver",
    code: "AC-VOICEOVER",
    technology: "Apple VoiceOver",
    description:
      "Use Safari or the installed web app with VoiceOver enabled.",
    checks: {
      controlsDiscoverablePassed:
        "All gameplay and navigation controls are discoverable and named.",
      birdLabelsPassed:
        "Each bird announces its row, column, and facing direction.",
      gameAnnouncementsPassed:
        "Blocked, escape, hint, deadlock, undo, restart, and completion results are announced.",
      modalFocusPassed:
        "VoiceOver focus enters modal content and does not wander behind it.",
      completePuzzlePassed:
        "A complete puzzle can be played without sighted assistance."
    }
  },
  talkback: {
    title: "Android TalkBack",
    code: "AC-TALKBACK",
    technology: "Android TalkBack",
    description:
      "Use Chrome or the installed web app with TalkBack enabled.",
    checks: {
      controlsDiscoverablePassed:
        "All gameplay and navigation controls are discoverable and named.",
      birdLabelsPassed:
        "Each bird announces its row, column, and facing direction.",
      gameAnnouncementsPassed:
        "Blocked, escape, hint, deadlock, undo, restart, and completion results are announced.",
      modalFocusPassed:
        "TalkBack focus enters modal content and does not wander behind it.",
      completePuzzlePassed:
        "A complete puzzle can be played without sighted assistance."
    }
  },
  "text-scaling": {
    title: "Large text and reflow",
    code: "AC-TEXT",
    technology: "Browser and Paper Flock text settings",
    description:
      "Test both Large and Extra large text at a phone-sized viewport.",
    checks: {
      largeTextPassed:
        "Large text preserves all content and controls.",
      extraLargeTextPassed:
        "Extra large text preserves all content and controls.",
      noClippingPassed:
        "Labels, buttons, values, and dialog content are not clipped.",
      scrollReachabilityPassed:
        "Every action remains reachable through scrolling.",
      puzzleStillPlayablePassed:
        "The board and essential puzzle controls remain usable."
    }
  },
  contrast: {
    title: "High contrast or forced colors",
    code: "AC-CONTRAST",
    technology: "Increased contrast or forced-colors mode",
    description:
      "Use device increased contrast or a forced-colors environment.",
    checks: {
      focusVisiblePassed:
        "Keyboard focus remains clearly visible.",
      birdDirectionVisiblePassed:
        "Bird direction remains distinguishable.",
      emptyCellsDistinctPassed:
        "Empty and occupied cells remain distinguishable.",
      disabledControlsDistinctPassed:
        "Disabled and active controls remain distinguishable.",
      noColorOnlyInformationPassed:
        "No essential state or instruction depends on color alone."
    }
  }
});

const state = {
  archive: loadArchive(),
  active: loadActive(),
  lastCompletedReportId: null
};

injectCertificationInterface();
wireCertificationInterface();
renderCreatorSummary();

if (
  new URLSearchParams(globalThis.location.search).get("a11ycert") === "1"
) {
  openCertificationFlow();
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `a11y-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadArchive() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(
        ACCESSIBILITY_CERTIFICATION_ARCHIVE_KEY
      ) || "{}"
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
    ACCESSIBILITY_CERTIFICATION_ARCHIVE_KEY,
    JSON.stringify(state.archive)
  );
  globalThis.dispatchEvent(
    new CustomEvent(
      "paperflock:accessibility-certification-changed"
    )
  );
  renderCreatorSummary();
}

function loadActive() {
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(ACTIVE_KEY) || "null"
    );
    return parsed?.status === "active"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function saveActive() {
  if (state.active) {
    sessionStorage.setItem(
      ACTIVE_KEY,
      JSON.stringify(state.active)
    );
  } else {
    sessionStorage.removeItem(ACTIVE_KEY);
  }
}

function injectCertificationInterface() {
  const toolBody = document.querySelector(
    ".prototype-tools .tool-body"
  );

  toolBody?.insertAdjacentHTML(
    "beforeend",
    `
      <section
        class="a11y-cert-tool-section"
        aria-labelledby="a11y-cert-tool-title"
      >
        <h3 id="a11y-cert-tool-title">
          Physical accessibility certification
        </h3>
        <p id="a11y-cert-summary">
          No physical accessibility reports imported.
        </p>
        <div class="tool-buttons">
          <button
            class="secondary-button"
            id="a11y-cert-launch-button"
            type="button"
          >
            Run accessibility test
          </button>
          <button
            class="secondary-button"
            id="a11y-cert-import-button"
            type="button"
          >
            Import accessibility reports
          </button>
          <button
            class="secondary-button"
            id="a11y-cert-export-json"
            type="button"
          >
            Export accessibility JSON
          </button>
          <button
            class="secondary-button"
            id="a11y-cert-export-csv"
            type="button"
          >
            Export accessibility CSV
          </button>
          <input
            id="a11y-cert-import-input"
            type="file"
            accept="application/json,.json"
            multiple
            hidden
          >
        </div>
        <p
          class="a11y-cert-tool-status"
          id="a11y-cert-tool-status"
          aria-live="polite"
        ></p>
      </section>
    `
  );

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div
        class="a11y-cert-overlay"
        id="a11y-cert-overlay"
        hidden
      >
        <section
          class="a11y-cert-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="a11y-cert-title"
        >
          <header class="a11y-cert-header">
            <div>
              <span class="a11y-cert-kicker">
                Paper Flock v${BUILD_VERSION}
              </span>
              <h2 id="a11y-cert-title">
                Physical accessibility test
              </h2>
            </div>
            <button
              class="a11y-cert-close"
              id="a11y-cert-close"
              type="button"
              aria-label="Close accessibility certification"
            >
              ×
            </button>
          </header>

          <div id="a11y-cert-start">
            <p>
              Complete each test using the real keyboard, assistive
              technology, or display mode. Do not mark a check merely because
              the feature should work.
            </p>

            <label>
              Test type
              <select id="a11y-cert-type">
                <option value="keyboard">Keyboard-only navigation</option>
                <option value="voiceover">iPhone or iPad VoiceOver</option>
                <option value="talkback">Android TalkBack</option>
                <option value="text-scaling">Large text and reflow</option>
                <option value="contrast">High contrast or forced colors</option>
              </select>
            </label>

            <label>
              Anonymous test code
              <input
                id="a11y-cert-code"
                type="text"
                maxlength="18"
                autocomplete="off"
                placeholder="Example: AC-KEYBOARD"
              >
            </label>

            <p
              class="a11y-cert-error"
              id="a11y-cert-start-error"
            ></p>

            <button
              class="primary-button full-width"
              id="a11y-cert-start-button"
              type="button"
            >
              Start physical test
            </button>
          </div>

          <form id="a11y-cert-form" hidden>
            <div class="a11y-cert-intro">
              <strong id="a11y-cert-test-title"></strong>
              <p id="a11y-cert-test-description"></p>
            </div>

            <div
              class="a11y-cert-checks"
              id="a11y-cert-checks"
            ></div>

            <label>
              Assistive technology, device, or display mode
              <input
                name="assistiveTechnology"
                type="text"
                maxlength="120"
                placeholder="Example: VoiceOver on iPhone Safari"
              >
            </label>

            <label class="a11y-cert-critical">
              <input
                name="criticalDefect"
                type="checkbox"
              >
              <span>
                A barrier blocked a common task or made the core puzzle
                unusable.
              </span>
            </label>

            <label>
              Describe a critical barrier when selected.
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
              class="a11y-cert-error"
              id="a11y-cert-form-error"
            ></p>

            <button
              class="primary-button full-width"
              type="submit"
            >
              Complete and download report
            </button>
          </form>

          <div id="a11y-cert-complete" hidden>
            <h3>Accessibility report complete</h3>
            <p id="a11y-cert-complete-summary"></p>
            <div class="a11y-cert-complete-actions">
              <button
                class="secondary-button"
                id="a11y-cert-download-again"
                type="button"
              >
                Download report again
              </button>
              <button
                class="primary-button"
                id="a11y-cert-finish"
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
    summary: document.querySelector("#a11y-cert-summary"),
    toolStatus: document.querySelector("#a11y-cert-tool-status"),
    launch: document.querySelector("#a11y-cert-launch-button"),
    importButton: document.querySelector("#a11y-cert-import-button"),
    importInput: document.querySelector("#a11y-cert-import-input"),
    exportJson: document.querySelector("#a11y-cert-export-json"),
    exportCsv: document.querySelector("#a11y-cert-export-csv"),
    overlay: document.querySelector("#a11y-cert-overlay"),
    close: document.querySelector("#a11y-cert-close"),
    start: document.querySelector("#a11y-cert-start"),
    type: document.querySelector("#a11y-cert-type"),
    code: document.querySelector("#a11y-cert-code"),
    startError: document.querySelector("#a11y-cert-start-error"),
    startButton: document.querySelector("#a11y-cert-start-button"),
    form: document.querySelector("#a11y-cert-form"),
    formError: document.querySelector("#a11y-cert-form-error"),
    testTitle: document.querySelector("#a11y-cert-test-title"),
    testDescription: document.querySelector(
      "#a11y-cert-test-description"
    ),
    checks: document.querySelector("#a11y-cert-checks"),
    complete: document.querySelector("#a11y-cert-complete"),
    completeSummary: document.querySelector(
      "#a11y-cert-complete-summary"
    ),
    downloadAgain: document.querySelector(
      "#a11y-cert-download-again"
    ),
    finish: document.querySelector("#a11y-cert-finish")
  };
}

function wireCertificationInterface() {
  const el = elements();

  el.launch?.addEventListener("click", () => {
    globalThis.location.href =
      `${globalThis.location.pathname}?a11ycert=1`;
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
  el.type?.addEventListener("change", suggestCode);
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
    downloadLastCompleted
  );
  el.finish?.addEventListener(
    "click",
    closeCertificationFlow
  );
}

function openCertificationFlow() {
  const el = elements();
  el.overlay.hidden = false;

  if (state.active) {
    showActiveForm();
    return;
  }

  suggestCode();
  el.type.focus();
}

function closeCertificationFlow() {
  elements().overlay.hidden = true;
}

function suggestCode() {
  const el = elements();
  const details = TEST_DETAILS[el.type.value];
  if (!el.code.value.trim()) {
    el.code.value = details?.code ?? "";
  }
}

function environmentSummary() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    viewportWidth: globalThis.innerWidth,
    viewportHeight: globalThis.innerHeight,
    pixelRatio: globalThis.devicePixelRatio,
    reducedMotion:
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches ?? false,
    prefersMoreContrast:
      globalThis.matchMedia?.("(prefers-contrast: more)")
        .matches ?? false,
    forcedColors:
      globalThis.matchMedia?.("(forced-colors: active)")
        .matches ?? false,
    displayMode:
      globalThis.matchMedia?.("(display-mode: standalone)").matches ||
      navigator.standalone === true
        ? "standalone"
        : "browser"
  };
}

function startCertification() {
  const el = elements();
  const code =
    normalizeAccessibilityCertificationCode(el.code.value);
  const type = normalizeAccessibilityTestType(el.type.value);

  if (!isValidAccessibilityCertificationCode(code)) {
    el.startError.textContent =
      "Use a 2–18 character anonymous code.";
    el.code.focus();
    return;
  }

  const duplicate = state.archive.reports.some(
    (report) =>
      report.testType === type &&
      report.participantCode === code
  );
  if (duplicate) {
    el.startError.textContent =
      "That code already exists for this test type.";
    el.code.focus();
    return;
  }

  state.active = createAccessibilityCertificationReport({
    reportId: createId(),
    participantCode: code,
    testType: type,
    buildVersion: BUILD_VERSION,
    environment: environmentSummary()
  });
  saveActive();
  el.startError.textContent = "";
  showActiveForm();
}

function showActiveForm() {
  const el = elements();
  const type = state.active.testType;
  const details = TEST_DETAILS[type];

  el.start.hidden = true;
  el.complete.hidden = true;
  el.form.hidden = false;
  el.testTitle.textContent = details.title;
  el.testDescription.textContent = details.description;
  renderCheckFields(type);
  el.form.elements.assistiveTechnology.value =
    state.active.assistiveTechnology || details.technology;
  el.form.elements.criticalDefect.checked =
    Boolean(state.active.criticalDefect);
  el.form.elements.criticalDefectDescription.value =
    state.active.criticalDefectDescription ?? "";
  el.form.elements.notes.value = state.active.notes ?? "";
}

function renderCheckFields(type) {
  const el = elements();
  const details = TEST_DETAILS[type];
  el.checks.replaceChildren();

  for (const key of requiredChecksForType(type)) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = key;
    input.checked = Boolean(state.active.checks[key]);

    const text = document.createElement("span");
    text.textContent = details.checks[key];

    label.append(input, text);
    el.checks.append(label);
  }
}

function collectPatch(form) {
  const data = new FormData(form);
  const patch = {};

  for (
    const key of requiredChecksForType(state.active.testType)
  ) {
    patch[key] = form.elements.namedItem(key).checked;
  }

  patch.assistiveTechnology = String(
    data.get("assistiveTechnology") ?? ""
  );
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
  const patch = collectPatch(el.form);

  if (
    patch.criticalDefect &&
    !patch.criticalDefectDescription.trim()
  ) {
    el.formError.textContent =
      "Describe the blocking accessibility barrier.";
    el.form.elements.criticalDefectDescription.focus();
    return;
  }

  const completed =
    completeAccessibilityCertificationReport(
      state.active,
      { patch }
    );
  state.archive.reports.push(completed);
  state.lastCompletedReportId = completed.reportId;
  state.active = null;
  saveActive();
  saveArchive();

  el.formError.textContent = "";
  el.form.hidden = true;
  el.complete.hidden = false;

  const evaluation =
    evaluateAccessibilityCertificationReport(completed);
  el.completeSummary.textContent =
    `${completed.participantCode} · ` +
    `${TEST_DETAILS[completed.testType].title}: ` +
    `${evaluation.passed
      ? "all checks passed"
      : `failed checks: ${evaluation.failedChecks.join(", ") || "critical barrier"}`}.`;

  downloadReport(completed);
}

function downloadLastCompleted() {
  const report = state.archive.reports.find(
    (candidate) =>
      candidate.reportId === state.lastCompletedReportId
  );
  if (report) {
    downloadReport(report);
  }
}

function downloadReport(report) {
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-${report.participantCode}-${report.testType}.json`,
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
  let parseErrors = 0;

  for (const file of files) {
    try {
      payloads.push(JSON.parse(await file.text()));
    } catch {
      parseErrors += 1;
    }
  }

  const result = importAccessibilityCertificationReports(
    state.archive.reports,
    payloads
  );
  state.archive.reports = result.reports;
  saveArchive();

  elements().toolStatus.textContent =
    `${result.imported.length} report(s) imported; ` +
    `${result.rejected.length + parseErrors} rejected.`;
}

function renderCreatorSummary() {
  const el = elements();
  if (!el.summary) {
    return;
  }

  const aggregate =
    aggregateAccessibilityCertificationReports(
      state.archive.reports
    );
  const missing = aggregate.missingTypes
    .map((type) => TEST_DETAILS[type]?.title ?? type)
    .join(", ");

  el.summary.textContent =
    `${aggregate.decision}. ` +
    `${aggregate.passedReports}/${ACCESSIBILITY_TEST_TYPES.length} required test types passed. ` +
    `${missing ? `Still required: ${missing}.` : "All required types passed."}`;
}

function exportAggregateJson() {
  const aggregate =
    aggregateAccessibilityCertificationReports(
      state.archive.reports
    );
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-accessibility-certification.json`,
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
    `paper-flock-v${BUILD_VERSION}-accessibility-certification.csv`,
    "text/csv;charset=utf-8",
    accessibilityCertificationReportsToCsv(
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
