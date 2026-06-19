import {
  STORAGE_KEYS,
  migrateLegacyStorage
} from "./storage-core.js";
import {
  aggregateVisualSessions,
  appendVisualEvent,
  completeVisualExposure,
  completeVisualSession,
  createVisualSession,
  evaluateVisualReadiness,
  isValidVisualParticipantCode,
  normalizeVisualParticipantCode,
  startVisualExposure,
  submitVisualRecall,
  visualSessionsToCsv
} from "./visual-test-core.js";

const BUILD_VERSION = "1.0";
const ARCHIVE_KEY = STORAGE_KEYS.visualResearch;
const PENDING_KEY = STORAGE_KEYS.visualPending;
const GAME_SAVE_KEY = STORAGE_KEYS.save;
const GAME_EVENT_KEY = STORAGE_KEYS.events;
const storageMigration = migrateLegacyStorage(localStorage);

const visualRequested =
  new URLSearchParams(globalThis.location.search).get("visualtest") === "1";

const state = {
  archive: loadArchive(),
  activeSessionId: null,
  captureGameEvents: false,
  exposureTimer: null
};

injectVisualTestInterface();
wireInterface();
updateToolSummary();

if (visualRequested) {
  prepareRequestedMode();
}

function createSessionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `visual-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadArchive() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || "{}");
    return {
      schemaVersion: 1,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
    };
  } catch {
    localStorage.removeItem(ARCHIVE_KEY);
    return { schemaVersion: 1, sessions: [] };
  }
}

function saveArchive() {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(state.archive));
  updateToolSummary();
}

function activeIndex() {
  return state.archive.sessions.findIndex(
    (session) => session.sessionId === state.activeSessionId
  );
}

function activeSession() {
  const index = activeIndex();
  return index >= 0 ? state.archive.sessions[index] : null;
}

function replaceActiveSession(session) {
  const index = activeIndex();
  if (index < 0) {
    throw new Error("No active visual-test session exists.");
  }
  state.archive.sessions[index] = session;
  saveArchive();
}

function injectVisualTestInterface() {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <aside class="visual-test-ribbon" id="visual-test-ribbon" hidden>
        <span>
          Visual test:
          <strong id="visual-test-code"></strong>
          <small id="visual-test-phase">play</small>
        </span>
        <button id="visual-test-end-button" type="button">End test</button>
      </aside>

      <div class="visual-test-overlay" id="visual-test-welcome" hidden>
        <section
          class="visual-test-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visual-test-welcome-title"
        >
          <span class="visual-test-kicker">Paper Flock v1.0</span>
          <h2 id="visual-test-welcome-title">Visual appeal test</h2>
          <p>
            This test begins with a five-second look at the customer-facing
            game, followed by unaided recall and natural play.
          </p>

          <label>
            Anonymous participant code
            <input
              id="visual-participant-code"
              type="text"
              maxlength="16"
              autocomplete="off"
              placeholder="Example: VA-01"
            >
          </label>

          <label>
            Broad target segment
            <select id="visual-participant-segment">
              <option value="casual-puzzle">Casual puzzle player</option>
              <option value="casual-non-puzzle">Casual non-puzzle player</option>
              <option value="experienced-puzzle">Experienced puzzle player</option>
              <option value="older-low-vision">Older or low-vision participant</option>
              <option value="low-end-small-screen">Low-end or small-screen Android</option>
              <option value="relaxation-focused">Relaxation-focused player</option>
              <option value="other">Other target player</option>
            </select>
          </label>

          <label class="visual-consent">
            <input id="visual-consent" type="checkbox">
            <span>
              I understand this is an unfinished prototype. Anonymous local
              interaction and survey data may be exported after this session.
              I may stop at any time.
            </span>
          </label>

          <p class="visual-test-error" id="visual-welcome-error"></p>

          <div class="visual-test-actions">
            <a class="visual-test-link" href="./">Return to normal play</a>
            <button
              class="primary-button"
              id="visual-prepare-button"
              type="button"
            >
              Prepare five-second test
            </button>
          </div>
        </section>
      </div>

      <div class="visual-test-overlay" id="visual-test-ready" hidden>
        <section
          class="visual-test-panel visual-test-ready-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visual-test-ready-title"
        >
          <span class="visual-test-kicker">First impression</span>
          <h2 id="visual-test-ready-title">Ready for five seconds?</h2>
          <p>
            Place the device naturally. The participant should look at the
            screen without touching it. The game will disappear automatically.
          </p>
          <button
            class="primary-button full-width"
            id="visual-begin-exposure-button"
            type="button"
          >
            Begin five-second look
          </button>
        </section>
      </div>

      <div
        class="visual-test-recall-screen"
        id="visual-test-recall"
        hidden
      >
        <section
          class="visual-test-panel visual-test-long-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visual-recall-title"
        >
          <span class="visual-test-kicker">Unaided recall</span>
          <h2 id="visual-recall-title">What did you see?</h2>
          <p>Answer from memory. Do not return to the game yet.</p>

          <form id="visual-recall-form">
            <label>
              What type of product did it appear to be? *
              <select name="productType" required>
                <option value="">Choose one</option>
                <option value="puzzle-game">A puzzle game</option>
                <option value="other-game">Another type of game</option>
                <option value="application">A non-game application</option>
                <option value="website">A website</option>
                <option value="unsure">Unsure</option>
              </select>
            </label>

            <label>
              What did the main pieces look like? *
              <select name="pieceIdentity" required>
                <option value="">Choose one</option>
                <option value="origami-birds">Origami birds</option>
                <option value="paper-birds">Paper birds</option>
                <option value="paper-airplanes">Paper airplanes</option>
                <option value="arrows">Arrows</option>
                <option value="abstract-shapes">Abstract shapes</option>
                <option value="not-sure">Not sure</option>
              </select>
            </label>

            <label>
              What visual elements do you remember?
              <textarea
                name="rememberedElements"
                rows="3"
                placeholder="Use your own words."
              ></textarea>
            </label>

            <label>
              What mood did the screen create? *
              <select name="mood" required>
                <option value="">Choose one</option>
                <option value="calm">Calm</option>
                <option value="playful">Playful</option>
                <option value="curious">Curious</option>
                <option value="exciting">Exciting</option>
                <option value="confusing">Confusing</option>
                <option value="plain">Plain</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              What would you have tapped first?
              <textarea name="firstTap" rows="2"></textarea>
            </label>

            <label>
              How finished did it appear? *
              <select name="finishImpression" required>
                <option value="">Choose one</option>
                <option value="distinctive-finished">Distinctive and finished</option>
                <option value="finished-generic">Finished but generic</option>
                <option value="interesting-prototype">Interesting prototype</option>
                <option value="unfinished">Unfinished</option>
                <option value="unsure">Unsure</option>
              </select>
            </label>

            <p class="visual-test-error" id="visual-recall-error"></p>

            <button class="primary-button full-width" type="submit">
              Continue to natural play
            </button>
          </form>
        </section>
      </div>

      <div class="visual-test-overlay" id="visual-test-survey" hidden>
        <section
          class="visual-test-panel visual-test-long-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visual-survey-title"
        >
          <span class="visual-test-kicker">After natural play</span>
          <h2 id="visual-survey-title">Visual and mastery questions</h2>
          <form id="visual-survey-form">
            <label>
              Overall visual appeal *
              <select name="visualAppeal" required>
                <option value="">Choose 1–5</option>
                <option value="1">1 — Not appealing</option>
                <option value="2">2</option>
                <option value="3">3 — Neutral</option>
                <option value="4">4</option>
                <option value="5">5 — Very appealing</option>
              </select>
            </label>

            <label>
              After playing, what did the pieces appear to be? *
              <select name="pieceIdentityAfterPlay" required>
                <option value="">Choose one</option>
                <option value="origami-birds">Origami birds</option>
                <option value="paper-birds">Paper birds</option>
                <option value="paper-airplanes">Paper airplanes</option>
                <option value="arrows">Arrows</option>
                <option value="abstract-shapes">Abstract shapes</option>
                <option value="unsure">Unsure</option>
              </select>
            </label>

            <label>
              How clear was each bird’s flight direction? *
              <select name="directionUnderstanding" required>
                <option value="">Choose one</option>
                <option value="clear">Clear without help</option>
                <option value="learned">Unclear at first, then learned</option>
                <option value="unclear">Still unclear</option>
              </select>
            </label>

            <label>
              What do the feathers represent? *
              <select name="featherMeaning" required>
                <option value="">Choose one</option>
                <option value="mastery">How independently and cleanly I solved the puzzle</option>
                <option value="currency">A currency for buying things</option>
                <option value="lives">Lives or attempts</option>
                <option value="speed">How fast I solved it</option>
                <option value="unsure">Unsure</option>
              </select>
            </label>

            <label>
              How did the feather feedback feel? *
              <select name="featherFeeling" required>
                <option value="">Choose one</option>
                <option value="motivating">Motivating in a good way</option>
                <option value="neutral">Fair and neutral</option>
                <option value="ignored">I mostly ignored it</option>
                <option value="pressured">Pressuring</option>
                <option value="confusing">Confusing</option>
              </select>
            </label>

            <label>
              Did feathers make you want to replay? *
              <select name="replayIntent" required>
                <option value="">Choose one</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="already-replayed">I already replayed</option>
                <option value="did-not-finish">I did not finish a puzzle</option>
              </select>
            </label>

            <label>
              What did you think the paper-sky themes were? *
              <select name="themeUnderstanding" required>
                <option value="">Choose one</option>
                <option value="cosmetic">Optional cosmetic styles</option>
                <option value="paid">Paid content</option>
                <option value="power">Gameplay advantages</option>
                <option value="not-seen">I did not see them</option>
                <option value="unsure">Unsure</option>
              </select>
            </label>

            <label>
              Text readability *
              <select name="textReadability" required>
                <option value="">Choose one</option>
                <option value="easy">Easy to read</option>
                <option value="mostly-easy">Mostly easy</option>
                <option value="difficult">Difficult</option>
              </select>
            </label>

            <label>
              Motion comfort *
              <select name="motionComfort" required>
                <option value="">Choose one</option>
                <option value="comfortable">Comfortable</option>
                <option value="too-much">Too much motion</option>
                <option value="too-little">Too little feedback</option>
              </select>
            </label>

            <label class="visual-consent">
              <input name="criticalDefect" type="checkbox">
              <span>A defect or visual barrier seriously blocked play.</span>
            </label>

            <label>
              Describe the blocking problem, if any.
              <textarea name="criticalDefectDescription" rows="2"></textarea>
            </label>

            <label>
              Additional comments
              <textarea name="additionalComments" rows="3"></textarea>
            </label>

            <p class="visual-test-error" id="visual-survey-error"></p>

            <button class="primary-button full-width" type="submit">
              Save and end visual test
            </button>
          </form>
        </section>
      </div>

      <div class="visual-test-overlay" id="visual-test-complete" hidden>
        <section
          class="visual-test-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visual-complete-title"
        >
          <span class="visual-test-kicker">Session complete</span>
          <h2 id="visual-complete-title">Anonymous evidence saved</h2>
          <p id="visual-complete-summary"></p>
          <div class="visual-test-actions">
            <button
              class="visual-test-secondary"
              id="visual-download-session-button"
              type="button"
            >
              Download this session
            </button>
            <button
              class="primary-button"
              id="visual-next-participant-button"
              type="button"
            >
              Prepare next participant
            </button>
          </div>
        </section>
      </div>
    `
  );

  const toolButtons = document.querySelector(".tool-buttons");
  const aggregate = document.querySelector("#research-aggregate");

  if (toolButtons) {
    toolButtons.insertAdjacentHTML(
      "afterbegin",
      `
        <button
          class="secondary-button"
          id="launch-visual-test-button"
          type="button"
        >
          Launch visual/mastery test
        </button>
        <button
          class="secondary-button"
          id="export-visual-json-button"
          type="button"
        >
          Export visual-test JSON
        </button>
        <button
          class="secondary-button"
          id="export-visual-csv-button"
          type="button"
        >
          Export visual-test CSV
        </button>
      `
    );
  }

  if (aggregate) {
    aggregate.insertAdjacentHTML(
      "afterend",
      `<p id="visual-test-aggregate">
        No completed visual-test sessions saved.
      </p>`
    );
  }
}

function elements() {
  return {
    welcome: document.querySelector("#visual-test-welcome"),
    code: document.querySelector("#visual-participant-code"),
    segment: document.querySelector("#visual-participant-segment"),
    consent: document.querySelector("#visual-consent"),
    welcomeError: document.querySelector("#visual-welcome-error"),
    prepare: document.querySelector("#visual-prepare-button"),
    ready: document.querySelector("#visual-test-ready"),
    beginExposure: document.querySelector("#visual-begin-exposure-button"),
    recall: document.querySelector("#visual-test-recall"),
    recallForm: document.querySelector("#visual-recall-form"),
    recallError: document.querySelector("#visual-recall-error"),
    survey: document.querySelector("#visual-test-survey"),
    surveyForm: document.querySelector("#visual-survey-form"),
    surveyError: document.querySelector("#visual-survey-error"),
    ribbon: document.querySelector("#visual-test-ribbon"),
    ribbonCode: document.querySelector("#visual-test-code"),
    ribbonPhase: document.querySelector("#visual-test-phase"),
    end: document.querySelector("#visual-test-end-button"),
    complete: document.querySelector("#visual-test-complete"),
    completeSummary: document.querySelector("#visual-complete-summary"),
    downloadSession: document.querySelector("#visual-download-session-button"),
    nextParticipant: document.querySelector("#visual-next-participant-button"),
    launch: document.querySelector("#launch-visual-test-button"),
    exportJson: document.querySelector("#export-visual-json-button"),
    exportCsv: document.querySelector("#export-visual-csv-button"),
    aggregate: document.querySelector("#visual-test-aggregate")
  };
}

function wireInterface() {
  const el = elements();
  el.prepare?.addEventListener("click", prepareParticipant);
  el.beginExposure?.addEventListener("click", beginExposure);
  el.recallForm?.addEventListener("submit", submitRecall);
  el.end?.addEventListener("click", openFinalSurvey);
  el.surveyForm?.addEventListener("submit", completeTest);
  el.downloadSession?.addEventListener("click", downloadLatestSession);
  el.nextParticipant?.addEventListener("click", prepareNextParticipant);
  el.launch?.addEventListener("click", () => {
    globalThis.location.href =
      `${globalThis.location.pathname}?visualtest=1`;
  });
  el.exportJson?.addEventListener("click", exportAllJson);
  el.exportCsv?.addEventListener("click", exportAllCsv);

  globalThis.addEventListener("paperflock:event", (event) => {
    if (!state.captureGameEvents) {
      return;
    }
    const session = activeSession();
    if (!session || session.phase !== "play") {
      return;
    }
    replaceActiveSession(appendVisualEvent(session, event.detail));
  });
}

function prepareRequestedMode() {
  const pendingRaw = sessionStorage.getItem(PENDING_KEY);
  const el = elements();

  if (!pendingRaw) {
    el.welcome.hidden = false;
    el.code.focus();
    return;
  }

  sessionStorage.removeItem(PENDING_KEY);
  const pending = JSON.parse(pendingRaw);
  const session = createVisualSession({
    participantCode: pending.participantCode,
    segment: pending.segment,
    sessionId: createSessionId(),
    startedAt: new Date().toISOString(),
    deviceProfile: {
      viewportWidth: globalThis.innerWidth,
      viewportHeight: globalThis.innerHeight,
      pixelRatio: globalThis.devicePixelRatio,
      reducedMotion: globalThis.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      ).matches ?? false,
      userAgent: navigator.userAgent
    }
  });

  state.archive.sessions.push(session);
  state.activeSessionId = session.sessionId;
  saveArchive();
  el.ready.hidden = false;
  el.beginExposure.focus();
}

function prepareParticipant() {
  const el = elements();
  const participantCode = normalizeVisualParticipantCode(el.code.value);

  if (!isValidVisualParticipantCode(participantCode)) {
    el.welcomeError.textContent =
      "Use a 2–16 character anonymous code containing letters, numbers, hyphens, or underscores.";
    el.code.focus();
    return;
  }
  if (!el.consent.checked) {
    el.welcomeError.textContent =
      "Consent is required before this visual test can begin.";
    el.consent.focus();
    return;
  }
  if (
    state.archive.sessions.some(
      (session) => session.participantCode === participantCode
    )
  ) {
    el.welcomeError.textContent =
      "That anonymous code already exists on this device.";
    el.code.focus();
    return;
  }

  sessionStorage.setItem(
    PENDING_KEY,
    JSON.stringify({
      participantCode,
      segment: el.segment.value
    })
  );

  localStorage.removeItem(GAME_SAVE_KEY);
  localStorage.removeItem(STORAGE_KEYS.saveBackup);
  localStorage.removeItem(GAME_EVENT_KEY);
  globalThis.location.reload();
}

function beginExposure() {
  const el = elements();
  let session = activeSession();
  if (!session) {
    return;
  }

  session = startVisualExposure(session, new Date().toISOString());
  replaceActiveSession(session);
  el.ready.hidden = true;
  document.body.classList.add("visual-exposure-active");
  document.querySelector(".app-shell")?.setAttribute("inert", "");
  el.ribbon.hidden = true;

  state.exposureTimer = globalThis.setTimeout(() => {
    document.body.classList.remove("visual-exposure-active");
    document.querySelector(".app-shell")?.removeAttribute("inert");

    const current = activeSession();
    replaceActiveSession(
      completeVisualExposure(current, new Date().toISOString())
    );
    el.recall.hidden = false;
    el.recall
      .querySelector("select, textarea, input")
      ?.focus();
  }, 5000);
}

function formObject(form) {
  const data = new FormData(form);
  return Object.fromEntries(
    [...data.entries()].map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value
    ])
  );
}

function submitRecall(event) {
  event.preventDefault();
  const el = elements();
  const form = event.currentTarget;

  if (!form.reportValidity()) {
    el.recallError.textContent =
      "Please complete the required recall questions.";
    return;
  }

  const recall = formObject(form);
  const session = submitVisualRecall(
    activeSession(),
    recall,
    new Date().toISOString()
  );
  replaceActiveSession(session);

  el.recallError.textContent = "";
  el.recall.hidden = true;
  el.ribbon.hidden = false;
  el.ribbonCode.textContent = session.participantCode;
  el.ribbonPhase.textContent = "natural play";
  state.captureGameEvents = true;

  globalThis.dispatchEvent(
    new CustomEvent("paperflock:visual-play-started", {
      detail: {
        participantCode: session.participantCode
      }
    })
  );
}

function openFinalSurvey() {
  const el = elements();
  state.captureGameEvents = false;
  el.survey.hidden = false;
  el.survey
    .querySelector("select, textarea, input")
    ?.focus();
}

function completeTest(event) {
  event.preventDefault();
  const el = elements();
  const form = event.currentTarget;

  if (!form.reportValidity()) {
    el.surveyError.textContent =
      "Please complete all required final questions.";
    return;
  }

  const responses = formObject(form);
  responses.criticalDefect =
    form.elements.criticalDefect.checked;

  if (
    responses.criticalDefect &&
    !responses.criticalDefectDescription
  ) {
    el.surveyError.textContent =
      "Describe the blocking defect or visual barrier.";
    form.elements.criticalDefectDescription.focus();
    return;
  }

  const completed = completeVisualSession(activeSession(), {
    endedAt: new Date().toISOString(),
    responses
  });
  replaceActiveSession(completed);

  el.surveyError.textContent = "";
  el.survey.hidden = true;
  el.ribbon.hidden = true;
  el.completeSummary.textContent =
    `Session ${completed.participantCode} saved. ` +
    `Highest level completed: ` +
    `${completed.summary.highestCampaignLevelCompleted}. ` +
    `Voluntary replay: ` +
    `${completed.summary.voluntaryReplay ? "yes" : "no"}.`;
  el.complete.hidden = false;
}

function prepareNextParticipant() {
  localStorage.removeItem(GAME_SAVE_KEY);
  localStorage.removeItem(STORAGE_KEYS.saveBackup);
  localStorage.removeItem(GAME_EVENT_KEY);
  globalThis.location.href =
    `${globalThis.location.pathname}?visualtest=1`;
}

function updateToolSummary() {
  const el = elements();
  if (!el.aggregate) {
    return;
  }

  const aggregate = aggregateVisualSessions(state.archive.sessions);
  const evaluation = evaluateVisualReadiness(aggregate);
  el.aggregate.textContent =
    aggregate.completedSessions === 0
      ? "No completed visual-test sessions saved."
      : `${aggregate.completedSessions} completed visual session` +
        `${aggregate.completedSessions === 1 ? "" : "s"}. ` +
        `Current evidence decision: ${evaluation.decision}.`;
}

function downloadBlob(filename, type, content) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadLatestSession() {
  const session = [...state.archive.sessions]
    .reverse()
    .find((candidate) => candidate.status === "complete");
  if (!session) {
    return;
  }

  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-${session.participantCode}-visual.json`,
    "application/json",
    JSON.stringify(
      {
        buildVersion: BUILD_VERSION,
        exportedAt: new Date().toISOString(),
        session
      },
      null,
      2
    )
  );
}

function exportAllJson() {
  const aggregate = aggregateVisualSessions(state.archive.sessions);
  const evaluation = evaluateVisualReadiness(aggregate);

  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-visual-sessions.json`,
    "application/json",
    JSON.stringify(
      {
        buildVersion: BUILD_VERSION,
        exportedAt: new Date().toISOString(),
        aggregate,
        evaluation,
        sessions: state.archive.sessions
      },
      null,
      2
    )
  );
}

function exportAllCsv() {
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-visual-sessions.csv`,
    "text/csv;charset=utf-8",
    visualSessionsToCsv(state.archive.sessions)
  );
}
