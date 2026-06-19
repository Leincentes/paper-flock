import {
  STORAGE_KEYS,
  migrateLegacyStorage
} from "./storage-core.js";
import {
  aggregateTactileSessions,
  appendFrameSamples,
  appendTactileEvent,
  completeTactileSession,
  createTactileSession,
  evaluateTactileReadiness,
  isValidTactileParticipantCode,
  normalizeTactileParticipantCode,
  tactileSessionsToCsv
} from "./tactile-test-core.js";
import {
  aggregateFieldCoverage,
  evaluateFieldReadiness,
  extractTactileSessions,
  mergeImportedTactileSessions,
  nextParticipantRecommendations
} from "./field-test-core.js";

const BUILD_VERSION = "1.0";
const ARCHIVE_KEY = STORAGE_KEYS.tactileResearch;
const PENDING_KEY = STORAGE_KEYS.tactilePending;
const GAME_SAVE_KEY = STORAGE_KEYS.save;
const GAME_EVENT_KEY = STORAGE_KEYS.events;
const storageMigration = migrateLegacyStorage(localStorage);

const query = new URLSearchParams(globalThis.location.search);
const fieldRequested = query.get("fieldtest") === "1";
const moderatorRequested = query.get("tactiletest") === "1";
const requested = fieldRequested || moderatorRequested;

const state = {
  archive: loadArchive(),
  activeSessionId: null,
  captureEvents: false,
  frameHandle: null,
  lastFrameAt: null,
  pendingFrames: [],
  eventsSincePersist: 0,
  fieldMode: fieldRequested,
  fieldPhase: "idle",
  fieldPhaseStartedAt: null,
  fieldEscapesAfterSound: 0,
  fieldPromptedSound: false,
  fieldPromptedEffects: false,
  fieldSurveyReady: false,
  fieldTimer: null,
  fieldCoachAction: null
};

injectInterface();
configureModeCopy();
wireInterface();
updateAggregate();

if (requested) {
  prepareRequestedMode();
}

function createSessionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `tactile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  updateAggregate();
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

function replaceActiveSession(session, { persist = true } = {}) {
  const index = activeIndex();
  if (index < 0) {
    throw new Error("No active tactile session exists.");
  }
  state.archive.sessions[index] = session;
  if (persist) {
    saveArchive();
  }
}

function detectCapabilities() {
  const AudioContextClass =
    globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return {
    vibrate: typeof navigator.vibrate === "function",
    audioContext: Boolean(AudioContextClass),
    reducedMotion:
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
      false,
    deviceMemory: Number.isFinite(navigator.deviceMemory)
      ? navigator.deviceMemory
      : null,
    hardwareConcurrency: Number.isFinite(navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : null,
    saveData: Boolean(navigator.connection?.saveData),
    viewportWidth: globalThis.innerWidth,
    viewportHeight: globalThis.innerHeight,
    pixelRatio: globalThis.devicePixelRatio,
    userAgent: navigator.userAgent
  };
}

function injectInterface() {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <aside class="tactile-test-ribbon" id="tactile-test-ribbon" hidden>
        <span>
          Core-feel test:
          <strong id="tactile-test-code"></strong>
          <small id="tactile-test-device"></small>
        </span>
        <button id="tactile-test-end-button" type="button">End test</button>
      </aside>

      <aside class="field-test-coach" id="field-test-coach" hidden>
        <div>
          <span class="field-test-coach-kicker" id="field-test-coach-kicker">
            Self-guided field test
          </span>
          <strong id="field-test-coach-title">Play naturally</strong>
          <p id="field-test-coach-message">
            Explore the game in the way that feels natural.
          </p>
        </div>
        <div class="field-test-coach-actions">
          <button
            class="field-test-coach-secondary"
            id="field-test-coach-later"
            type="button"
          >
            Later
          </button>
          <button
            class="field-test-coach-primary"
            id="field-test-coach-action"
            type="button"
          >
            Continue
          </button>
        </div>
      </aside>

      <div class="tactile-test-overlay" id="tactile-test-welcome" hidden>
        <section
          class="tactile-test-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tactile-test-welcome-title"
        >
          <span class="tactile-test-kicker">Paper Flock v1.0</span>
          <h2 id="tactile-test-welcome-title">Real-device core-feel test</h2>
          <p id="tactile-test-welcome-copy">
            This mode records anonymous local interaction timing, frame samples,
            and end-of-session answers. Nothing is uploaded automatically.
          </p>

          <label>
            Anonymous participant code
            <input
              id="tactile-participant-code"
              type="text"
              maxlength="16"
              autocomplete="off"
              placeholder="Example: TF-01"
            >
          </label>

          <label>
            Broad participant segment
            <select id="tactile-participant-segment">
              <option value="casual-puzzle">Casual puzzle player</option>
              <option value="experienced-puzzle">Experienced puzzle player</option>
              <option value="casual-non-puzzle">Casual non-puzzle player</option>
              <option value="older-low-vision">Older or low-vision participant</option>
              <option value="motion-sound-sensitive">Motion, sound, or haptic sensitive</option>
              <option value="other">Other target player</option>
            </select>
          </label>

          <label>
            Device tier
            <select id="tactile-device-tier">
              <option value="low-end">Low-end or older phone</option>
              <option value="mid-range" selected>Mid-range phone</option>
              <option value="high-end">High-end phone</option>
              <option value="tablet">Tablet</option>
              <option value="desktop">Desktop for comparison only</option>
            </select>
          </label>

          <label class="tactile-consent">
            <input id="tactile-consent" type="checkbox">
            <span>
              I understand this is an unfinished prototype. Anonymous local
              interaction, performance, and survey data may be exported after
              the session. I may stop at any time.
            </span>
          </label>

          <p class="tactile-test-error" id="tactile-welcome-error"></p>

          <div class="tactile-test-actions">
            <a class="tactile-test-link" href="./">Return to normal play</a>
            <button
              class="primary-button"
              id="tactile-prepare-button"
              type="button"
            >
              Prepare clean test
            </button>
          </div>
        </section>
      </div>

      <div class="tactile-test-overlay" id="tactile-test-ready" hidden>
        <section
          class="tactile-test-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tactile-test-ready-title"
        >
          <span class="tactile-test-kicker">Device check</span>
          <h2 id="tactile-test-ready-title">Begin natural play</h2>
          <div class="tactile-capability-grid" id="tactile-capabilities"></div>
          <p id="tactile-test-ready-copy">
            Start with <strong>Sound off</strong> and <strong>Effects Auto</strong>.
            After a few moves, enable sound and compare it. Do not explain the
            blocked-path trace before the participant encounters it.
          </p>
          <button
            class="primary-button full-width"
            id="tactile-begin-button"
            type="button"
          >
            Begin core-feel session
          </button>
        </section>
      </div>

      <div class="tactile-test-overlay" id="tactile-test-survey" hidden>
        <section
          class="tactile-test-panel tactile-test-long-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tactile-survey-title"
        >
          <span class="tactile-test-kicker">After natural play</span>
          <h2 id="tactile-survey-title">Core-feel questions</h2>
          <p>Answer from the participant’s experience, not the moderator’s guess.</p>

          <form id="tactile-survey-form">
            <label>
              How immediate did the visible response feel after a tap? *
              <select name="tapResponse" required>
                <option value="">Choose one</option>
                <option value="immediate">Immediate</option>
                <option value="mostly-immediate">Mostly immediate</option>
                <option value="delayed">Noticeably delayed</option>
              </select>
            </label>

            <label>
              Could the participant explain why a bird was blocked? *
              <select name="blockedPathUnderstanding" required>
                <option value="">Choose one</option>
                <option value="correct">Correctly identified the blocking bird/path</option>
                <option value="partial">Partly understood</option>
                <option value="incorrect">Incorrect or still confused</option>
                <option value="not-encountered">No blocked move encountered</option>
              </select>
            </label>

            <label>
              When were rotating neighbors understood? *
              <select name="rotationUnderstanding" required>
                <option value="">Choose one</option>
                <option value="by-level-3">By Level 3 without moderator help</option>
                <option value="later">Learned later</option>
                <option value="unclear">Still unclear</option>
                <option value="not-reached">Did not reach Level 3</option>
              </select>
            </label>

            <label>
              Movement feedback rating *
              <select name="movementRating" required>
                <option value="">Choose 1–5</option>
                <option value="1">1 — Poor</option>
                <option value="2">2</option>
                <option value="3">3 — Acceptable</option>
                <option value="4">4</option>
                <option value="5">5 — Excellent</option>
              </select>
            </label>

            <label>
              How did enabled game sound feel? *
              <select name="soundFeeling" required>
                <option value="">Choose one</option>
                <option value="pleasant">Pleasant and fitting</option>
                <option value="neutral">Neutral or acceptable</option>
                <option value="annoying">Annoying or mismatched</option>
                <option value="too-quiet">Too quiet or hard to notice</option>
                <option value="not-tested">Sound was not tested</option>
              </select>
            </label>

            <label>
              How did haptic feedback feel? *
              <select name="hapticFeeling" required>
                <option value="">Choose one</option>
                <option value="pleasant">Pleasant and fitting</option>
                <option value="neutral">Neutral or acceptable</option>
                <option value="annoying">Annoying or excessive</option>
                <option value="too-weak">Too weak or hard to notice</option>
                <option value="not-tested">Unavailable or not tested</option>
              </select>
            </label>

            <label>
              Were repeated effects distracting? *
              <select name="effectsDistracting" required>
                <option value="">Choose one</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>

            <label>
              Was visible stutter observed? *
              <select name="stutterObserved" required>
                <option value="">Choose one</option>
                <option value="none">None</option>
                <option value="once">One isolated hitch</option>
                <option value="repeated">Repeated visible stutter</option>
              </select>
            </label>

            <label>
              Did the instructions repeat appropriately? *
              <select name="instructionRepetition" required>
                <option value="">Choose one</option>
                <option value="appropriate">Appropriate</option>
                <option value="repetitive">Too repetitive</option>
                <option value="too-little">Too little guidance</option>
              </select>
            </label>

            <label>
              Which moment felt most satisfying?
              <textarea name="mostSatisfying" rows="2"></textarea>
            </label>

            <label>
              Which moment felt least clear?
              <textarea name="leastClear" rows="2"></textarea>
            </label>

            <label class="tactile-consent">
              <input name="criticalDefect" type="checkbox">
              <span>A technical or accessibility issue seriously blocked play.</span>
            </label>

            <label>
              Describe the critical issue, if any.
              <textarea name="criticalDefectDescription" rows="2"></textarea>
            </label>

            <label>
              Additional comments
              <textarea name="additionalComments" rows="3"></textarea>
            </label>

            <p class="tactile-test-error" id="tactile-survey-error"></p>

            <button class="primary-button full-width" type="submit">
              Save and end session
            </button>
          </form>
        </section>
      </div>

      <div class="tactile-test-overlay" id="tactile-test-complete" hidden>
        <section
          class="tactile-test-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tactile-complete-title"
        >
          <span class="tactile-test-kicker">Session complete</span>
          <h2 id="tactile-complete-title">Anonymous evidence saved</h2>
          <p id="tactile-complete-summary"></p>
          <div class="tactile-test-actions">
            <button
              class="tactile-test-secondary"
              id="tactile-download-session-button"
              type="button"
            >
              Download this session
            </button>
            <button
              class="primary-button"
              id="tactile-next-participant-button"
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
          id="launch-field-test-button"
          type="button"
        >
          Launch self-guided field test
        </button>
        <button
          class="secondary-button"
          id="launch-tactile-test-button"
          type="button"
        >
          Launch moderated device test
        </button>
        <button
          class="secondary-button"
          id="copy-field-link-button"
          type="button"
        >
          Copy field-test link
        </button>
        <label class="secondary-button field-import-label">
          Import participant JSON
          <input
            id="import-tactile-json-input"
            type="file"
            accept="application/json,.json"
            multiple
            hidden
          >
        </label>
        <button
          class="secondary-button"
          id="export-tactile-json-button"
          type="button"
        >
          Export combined field JSON
        </button>
        <button
          class="secondary-button"
          id="export-tactile-csv-button"
          type="button"
        >
          Export core-feel CSV
        </button>
      `
    );
  }

  if (aggregate) {
    aggregate.insertAdjacentHTML(
      "afterend",
      `<p id="tactile-test-aggregate">
        No completed core-feel sessions saved.
      </p>
      <p id="field-test-coverage">
        Field-test recruitment coverage has not started.
      </p>
      <p id="field-test-import-status" aria-live="polite"></p>`
    );
  }
}

function elements() {
  return {
    welcome: document.querySelector("#tactile-test-welcome"),
    welcomeTitle: document.querySelector("#tactile-test-welcome-title"),
    welcomeCopy: document.querySelector("#tactile-test-welcome-copy"),
    code: document.querySelector("#tactile-participant-code"),
    segment: document.querySelector("#tactile-participant-segment"),
    deviceTier: document.querySelector("#tactile-device-tier"),
    consent: document.querySelector("#tactile-consent"),
    welcomeError: document.querySelector("#tactile-welcome-error"),
    prepare: document.querySelector("#tactile-prepare-button"),
    ready: document.querySelector("#tactile-test-ready"),
    readyTitle: document.querySelector("#tactile-test-ready-title"),
    readyCopy: document.querySelector("#tactile-test-ready-copy"),
    capabilities: document.querySelector("#tactile-capabilities"),
    begin: document.querySelector("#tactile-begin-button"),
    ribbon: document.querySelector("#tactile-test-ribbon"),
    ribbonCode: document.querySelector("#tactile-test-code"),
    ribbonDevice: document.querySelector("#tactile-test-device"),
    end: document.querySelector("#tactile-test-end-button"),
    coach: document.querySelector("#field-test-coach"),
    coachKicker: document.querySelector("#field-test-coach-kicker"),
    coachTitle: document.querySelector("#field-test-coach-title"),
    coachMessage: document.querySelector("#field-test-coach-message"),
    coachAction: document.querySelector("#field-test-coach-action"),
    coachLater: document.querySelector("#field-test-coach-later"),
    survey: document.querySelector("#tactile-test-survey"),
    surveyForm: document.querySelector("#tactile-survey-form"),
    surveyError: document.querySelector("#tactile-survey-error"),
    complete: document.querySelector("#tactile-test-complete"),
    completeSummary: document.querySelector("#tactile-complete-summary"),
    download: document.querySelector("#tactile-download-session-button"),
    next: document.querySelector("#tactile-next-participant-button"),
    launch: document.querySelector("#launch-tactile-test-button"),
    launchField: document.querySelector("#launch-field-test-button"),
    copyFieldLink: document.querySelector("#copy-field-link-button"),
    importJson: document.querySelector("#import-tactile-json-input"),
    exportJson: document.querySelector("#export-tactile-json-button"),
    exportCsv: document.querySelector("#export-tactile-csv-button"),
    aggregate: document.querySelector("#tactile-test-aggregate"),
    coverage: document.querySelector("#field-test-coverage"),
    importStatus: document.querySelector("#field-test-import-status")
  };
}

function wireInterface() {
  const el = elements();
  el.prepare?.addEventListener("click", prepareParticipant);
  el.begin?.addEventListener("click", beginSession);
  el.end?.addEventListener("click", openSurvey);
  el.coachAction?.addEventListener("click", handleFieldCoachAction);
  el.coachLater?.addEventListener("click", hideFieldCoach);
  el.surveyForm?.addEventListener("submit", completeSession);
  el.download?.addEventListener("click", downloadLatestSession);
  el.next?.addEventListener("click", prepareNextParticipant);
  el.launch?.addEventListener("click", () => {
    globalThis.location.href =
      `${globalThis.location.pathname}?tactiletest=1`;
  });
  el.launchField?.addEventListener("click", () => {
    globalThis.location.href =
      `${globalThis.location.pathname}?fieldtest=1`;
  });
  el.copyFieldLink?.addEventListener("click", copyFieldTestLink);
  el.importJson?.addEventListener("change", importParticipantFiles);
  el.exportJson?.addEventListener("click", exportAllJson);
  el.exportCsv?.addEventListener("click", exportAllCsv);

  globalThis.addEventListener("paperflock:event", (event) => {
    if (!state.captureEvents) {
      return;
    }
    const session = activeSession();
    if (!session) {
      return;
    }
    replaceActiveSession(
      appendTactileEvent(session, event.detail),
      { persist: false }
    );
    state.eventsSincePersist += 1;
    if (state.eventsSincePersist >= 20) {
      state.eventsSincePersist = 0;
      saveArchive();
    }
    if (state.fieldMode) {
      advanceFieldProtocol(event.detail);
    }
  });

  document.addEventListener("visibilitychange", () => {
    state.lastFrameAt = null;
  });

  globalThis.addEventListener(
    "paperflock:tactile-archive-updated",
    () => {
      state.archive = loadArchive();
      updateAggregate();
    }
  );
}


function configureModeCopy() {
  const el = elements();
  if (!state.fieldMode) {
    return;
  }

  if (el.welcomeTitle) {
    el.welcomeTitle.textContent = "Self-guided real-device field test";
  }
  if (el.welcomeCopy) {
    el.welcomeCopy.textContent =
      "This test guides the participant through natural play, sound, haptics, and performance checks. Anonymous results stay on this device until downloaded.";
  }
  if (el.readyTitle) {
    el.readyTitle.textContent = "Begin the self-guided session";
  }
  if (el.readyCopy) {
    el.readyCopy.innerHTML =
      "Start with <strong>Sound off</strong> and <strong>Effects Auto</strong>. Follow the small field-test prompts when they appear. Play naturally between prompts.";
  }
  if (el.begin) {
    el.begin.textContent = "Begin self-guided session";
  }
}

function appendFieldProtocolEvent(name, data = {}) {
  const session = activeSession();
  if (!session) {
    return;
  }
  replaceActiveSession(
    appendTactileEvent(session, {
      name,
      occurredAt: new Date().toISOString(),
      elapsedMs: Math.max(
        0,
        Date.now() - Date.parse(session.startedAt)
      ),
      mode: "field-test",
      ...data
    }),
    { persist: false }
  );
  state.eventsSincePersist += 1;
}

function showFieldCoach({
  kicker = "Self-guided field test",
  title,
  message,
  actionLabel,
  action,
  allowLater = true
}) {
  if (!state.fieldMode) {
    return;
  }
  const el = elements();
  el.coachKicker.textContent = kicker;
  el.coachTitle.textContent = title;
  el.coachMessage.textContent = message;
  el.coachAction.textContent = actionLabel;
  el.coachLater.hidden = !allowLater;
  state.fieldCoachAction = action;
  el.coach.hidden = false;
  el.coachAction.focus();
}

function hideFieldCoach() {
  const el = elements();
  el.coach.hidden = true;
  state.fieldCoachAction = null;
}

function handleFieldCoachAction() {
  const action = state.fieldCoachAction;
  hideFieldCoach();
  action?.();
}

function setFieldPhase(phase) {
  state.fieldPhase = phase;
  state.fieldPhaseStartedAt = Date.now();
  appendFieldProtocolEvent("field_phase_started", { phase });
}

function activeElapsedMs() {
  const session = activeSession();
  if (!session) {
    return 0;
  }
  const startedAt = Date.parse(session.startedAt);
  return Number.isFinite(startedAt)
    ? Math.max(0, Date.now() - startedAt)
    : 0;
}

function currentSessionEvents(name) {
  return (activeSession()?.events ?? []).filter(
    (event) => event.name === name
  );
}

function soundWasTested() {
  return currentSessionEvents("sound_preference_changed").some(
    (event) => event.enabled === true
  );
}

function lowEffectsWereObserved() {
  return (activeSession()?.events ?? []).some(
    (event) =>
      ["lite", "minimal"].includes(event.effectsMode) ||
      ["lite", "minimal"].includes(event.resolved)
  );
}

function fieldDeviceIsLowEnd() {
  return activeSession()?.deviceTier === "low-end";
}

function enableSoundForFieldTest() {
  const soundButton = document.querySelector("#sound-button");
  if (
    soundButton &&
    soundButton.getAttribute("aria-pressed") !== "true"
  ) {
    soundButton.click();
  }
  state.fieldEscapesAfterSound = 0;
  setFieldPhase("sound-play");
  appendFieldProtocolEvent("field_sound_test_started");
  showFieldCoach({
    kicker: "Sound and haptics",
    title: "Continue for a few moves",
    message:
      "Keep playing naturally with sound on. Notice whether the paper sounds and device vibration feel pleasant, neutral, or distracting.",
    actionLabel: "Continue playing",
    action: hideFieldCoach,
    allowLater: false
  });
}

function switchToLiteEffects() {
  const effectsButton = document.querySelector("#effects-button");
  if (!effectsButton) {
    return;
  }

  let attempts = 0;
  const advance = () => {
    const label = effectsButton.textContent.toLowerCase();
    if (
      label.includes("lite") ||
      label.includes("minimal") ||
      attempts >= 4
    ) {
      setFieldPhase("effects-play");
      appendFieldProtocolEvent("field_effects_comparison_started", {
        label: effectsButton.textContent.trim()
      });
      return;
    }
    attempts += 1;
    effectsButton.click();
    globalThis.setTimeout(advance, 60);
  };
  advance();
}

function promptSoundPhase() {
  if (
    state.fieldPromptedSound ||
    soundWasTested() ||
    !state.fieldMode
  ) {
    return;
  }
  state.fieldPromptedSound = true;
  setFieldPhase("sound-prompt");
  showFieldCoach({
    kicker: "Next check",
    title: "Try sound and haptics",
    message:
      "Turn sound on, then continue playing. The game will also use vibration when this device supports it.",
    actionLabel: "Turn sound on",
    action: enableSoundForFieldTest,
    allowLater: true
  });
}

function promptEffectsPhase() {
  if (
    state.fieldPromptedEffects ||
    lowEffectsWereObserved() ||
    !state.fieldMode
  ) {
    return;
  }
  state.fieldPromptedEffects = true;
  setFieldPhase("effects-prompt");
  showFieldCoach({
    kicker: "Low-end performance check",
    title: "Compare lighter effects",
    message:
      "Switch to Lite effects and continue for a few moves. Notice whether the game feels smoother without losing important feedback.",
    actionLabel: "Use Lite effects",
    action: switchToLiteEffects,
    allowLater: true
  });
}

function promptSurveyReady() {
  if (state.fieldSurveyReady || !state.fieldMode) {
    return;
  }
  state.fieldSurveyReady = true;
  setFieldPhase("survey-ready");
  showFieldCoach({
    kicker: "Field test complete",
    title: "Share your experience",
    message:
      "You have provided enough natural-play evidence. End the session and answer the final questions.",
    actionLabel: "Open final questions",
    action: openSurvey,
    allowLater: true
  });
}

function startFieldProtocolTimer() {
  stopFieldProtocolTimer();
  state.fieldTimer = globalThis.setInterval(() => {
    if (!state.captureEvents || !state.fieldMode) {
      return;
    }
    const elapsed = activeElapsedMs();

    if (
      !soundWasTested() &&
      elapsed >= 120000
    ) {
      promptSoundPhase();
      return;
    }

    if (
      fieldDeviceIsLowEnd() &&
      soundWasTested() &&
      !lowEffectsWereObserved() &&
      elapsed >= 240000
    ) {
      promptEffectsPhase();
      return;
    }

    if (
      elapsed >= 420000 &&
      soundWasTested() &&
      (!fieldDeviceIsLowEnd() || lowEffectsWereObserved())
    ) {
      promptSurveyReady();
    }
  }, 15000);
}

function stopFieldProtocolTimer() {
  if (state.fieldTimer !== null) {
    clearInterval(state.fieldTimer);
    state.fieldTimer = null;
  }
}

function advanceFieldProtocol(event) {
  if (!state.fieldMode || !state.captureEvents) {
    return;
  }

  if (
    event.name === "puzzle_complete" &&
    Number(event.level) >= 2 &&
    !soundWasTested()
  ) {
    promptSoundPhase();
  }

  if (
    state.fieldPhase === "sound-play" &&
    event.name === "bird_escape"
  ) {
    state.fieldEscapesAfterSound += 1;
    if (state.fieldEscapesAfterSound >= 5) {
      if (fieldDeviceIsLowEnd() && !lowEffectsWereObserved()) {
        promptEffectsPhase();
      } else {
        setFieldPhase("free-play");
      }
    }
  }

  if (
    ["effects-prompt", "effects-play"].includes(state.fieldPhase) &&
    event.name === "effects_preference_changed" &&
    ["lite", "minimal"].includes(event.resolved)
  ) {
    setFieldPhase("effects-play");
  }

  if (
    event.name === "puzzle_complete" &&
    Number(event.level) >= 5 &&
    soundWasTested() &&
    (!fieldDeviceIsLowEnd() || lowEffectsWereObserved())
  ) {
    promptSurveyReady();
  }
}

function copyFieldTestLink() {
  const el = elements();
  const url =
    `${globalThis.location.origin}${globalThis.location.pathname}` +
    "?fieldtest=1";

  navigator.clipboard?.writeText(url).then(
    () => {
      el.importStatus.textContent =
        "Field-test link copied to the clipboard.";
    },
    () => {
      el.importStatus.textContent =
        `Field-test link: ${url}`;
    }
  );
}

async function importParticipantFiles(event) {
  const el = elements();
  const files = [...(event.target.files ?? [])];
  if (files.length === 0) {
    return;
  }

  const imported = [];
  const fileErrors = [];

  for (const file of files) {
    try {
      const payload = JSON.parse(await file.text());
      imported.push(...extractTactileSessions(payload));
    } catch (error) {
      fileErrors.push(`${file.name}: invalid JSON`);
    }
  }

  const result = mergeImportedTactileSessions(
    state.archive.sessions,
    imported
  );
  state.archive.sessions = result.sessions;
  saveArchive();
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:tactile-archive-updated")
  );

  const messages = [];
  if (result.added.length > 0) {
    messages.push(
      `Imported ${result.added.length} session` +
      `${result.added.length === 1 ? "" : "s"}.`
    );
  }
  if (result.duplicates.length > 0) {
    messages.push(
      `Skipped ${result.duplicates.length} duplicate` +
      `${result.duplicates.length === 1 ? "" : "s"}.`
    );
  }
  if (result.rejected.length > 0 || fileErrors.length > 0) {
    messages.push(
      `Rejected ${result.rejected.length + fileErrors.length} invalid file or session record` +
      `${result.rejected.length + fileErrors.length === 1 ? "" : "s"}.`
    );
  }
  el.importStatus.textContent =
    messages.join(" ") || "No new sessions were imported.";
  event.target.value = "";
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
  const session = createTactileSession({
    participantCode: pending.participantCode,
    segment: pending.segment,
    deviceTier: pending.deviceTier,
    sessionId: createSessionId(),
    startedAt: new Date().toISOString(),
    capabilities: detectCapabilities()
  });

  state.archive.sessions.push(session);
  state.activeSessionId = session.sessionId;
  saveArchive();

  renderCapabilities(session.capabilities);
  el.ready.hidden = false;
  el.begin.focus();
}

function prepareParticipant() {
  const el = elements();
  const participantCode = normalizeTactileParticipantCode(el.code.value);

  if (!isValidTactileParticipantCode(participantCode)) {
    el.welcomeError.textContent =
      "Use a 2–16 character anonymous code containing letters, numbers, hyphens, or underscores.";
    el.code.focus();
    return;
  }
  if (!el.consent.checked) {
    el.welcomeError.textContent =
      "Consent is required before the device test begins.";
    el.consent.focus();
    return;
  }
  if (
    state.archive.sessions.some(
      (session) => session.participantCode === participantCode
    )
  ) {
    el.welcomeError.textContent =
      "That anonymous participant code already exists on this device.";
    el.code.focus();
    return;
  }

  sessionStorage.setItem(
    PENDING_KEY,
    JSON.stringify({
      participantCode,
      segment: el.segment.value,
      deviceTier: el.deviceTier.value
    })
  );
  localStorage.removeItem(GAME_SAVE_KEY);
  localStorage.removeItem(STORAGE_KEYS.saveBackup);
  localStorage.removeItem(GAME_EVENT_KEY);
  globalThis.location.reload();
}

function renderCapabilities(capabilities) {
  const el = elements();
  const cards = [
    ["Vibration", capabilities.vibrate ? "Available" : "Unavailable"],
    ["Web Audio", capabilities.audioContext ? "Available" : "Unavailable"],
    [
      "Motion preference",
      capabilities.reducedMotion ? "Reduced" : "Standard"
    ],
    [
      "Reported memory",
      capabilities.deviceMemory === null
        ? "Not reported"
        : `${capabilities.deviceMemory} GB`
    ],
    [
      "Logical CPU cores",
      capabilities.hardwareConcurrency === null
        ? "Not reported"
        : String(capabilities.hardwareConcurrency)
    ],
    ["Data saver", capabilities.saveData ? "On" : "Off"]
  ];

  el.capabilities.innerHTML = cards
    .map(
      ([label, value]) => `
        <div>
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `
    )
    .join("");
}

function beginSession() {
  const el = elements();
  const session = activeSession();
  if (!session) {
    return;
  }

  el.ready.hidden = true;
  el.ribbon.hidden = false;
  el.ribbonCode.textContent = session.participantCode;
  el.ribbonDevice.textContent = session.deviceTier;
  state.captureEvents = true;
  state.eventsSincePersist = 0;
  startFrameSampler();

  if (state.fieldMode) {
    setFieldPhase("natural-play");
    startFieldProtocolTimer();
    showFieldCoach({
      kicker: "Natural-play phase",
      title: "Play in your own way",
      message:
        "Explore the game naturally. Do not search for a perfect score. A small prompt will appear when it is time to test sound.",
      actionLabel: "Start playing",
      action: hideFieldCoach,
      allowLater: false
    });
  }
}

function startFrameSampler() {
  stopFrameSampler();
  state.lastFrameAt = null;
  state.pendingFrames = [];

  const sample = (timestamp) => {
    if (
      state.captureEvents &&
      document.visibilityState === "visible"
    ) {
      if (state.lastFrameAt !== null) {
        const delta = timestamp - state.lastFrameAt;
        if (delta > 0 && delta < 1000) {
          state.pendingFrames.push(Number(delta.toFixed(2)));
        }
      }
      state.lastFrameAt = timestamp;

      if (state.pendingFrames.length >= 120) {
        flushFrames();
      }
      state.frameHandle = requestAnimationFrame(sample);
    }
  };

  state.frameHandle = requestAnimationFrame(sample);
}

function flushFrames() {
  if (state.pendingFrames.length === 0 || !activeSession()) {
    return;
  }
  replaceActiveSession(
    appendFrameSamples(activeSession(), state.pendingFrames),
    { persist: false }
  );
  state.pendingFrames = [];
}

function stopFrameSampler() {
  if (state.frameHandle !== null) {
    cancelAnimationFrame(state.frameHandle);
    state.frameHandle = null;
  }
  flushFrames();
  state.lastFrameAt = null;
}

function openSurvey() {
  const el = elements();
  state.captureEvents = false;
  stopFrameSampler();
  stopFieldProtocolTimer();
  hideFieldCoach();
  appendFieldProtocolEvent("field_final_survey_opened", {
    selfGuided: state.fieldMode
  });
  saveArchive();
  el.survey.hidden = false;
  el.survey.querySelector("select, textarea, input")?.focus();
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

function completeSession(event) {
  event.preventDefault();
  const el = elements();
  const form = event.currentTarget;

  if (!form.reportValidity()) {
    el.surveyError.textContent =
      "Please complete every required question.";
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
      "Describe the technical or accessibility blocker.";
    form.elements.criticalDefectDescription.focus();
    return;
  }

  const completed = completeTactileSession(activeSession(), {
    endedAt: new Date().toISOString(),
    responses
  });
  replaceActiveSession(completed);

  state.captureEvents = false;
  el.surveyError.textContent = "";
  el.survey.hidden = true;
  el.ribbon.hidden = true;
  el.completeSummary.textContent =
    `Session ${completed.participantCode} saved. ` +
    `Median measured tap acknowledgement: ` +
    `${completed.summary.tapLatencyMedianMs ?? "not captured"} ms. ` +
    `Repeated measured stutter: ` +
    `${completed.summary.repeatedMeasuredStutter ? "yes" : "no"}. ` +
    `${state.fieldMode ? "Download this anonymous result and send it to the game creator." : ""}`;
  if (state.fieldMode) {
    el.download.textContent = "Download result to send";
    el.next.textContent = "Prepare another participant";
  }
  el.complete.hidden = false;
}

function prepareNextParticipant() {
  localStorage.removeItem(GAME_SAVE_KEY);
  localStorage.removeItem(STORAGE_KEYS.saveBackup);
  localStorage.removeItem(GAME_EVENT_KEY);
  globalThis.location.href =
    `${globalThis.location.pathname}` +
    `${state.fieldMode ? "?fieldtest=1" : "?tactiletest=1"}`;
}

function updateAggregate() {
  const el = elements();
  if (!el.aggregate) {
    return;
  }

  const tactileAggregate = aggregateTactileSessions(
    state.archive.sessions
  );
  const fieldEvaluation = evaluateFieldReadiness(
    state.archive.sessions
  );
  const coverage = aggregateFieldCoverage(
    state.archive.sessions
  );
  const recommendations = nextParticipantRecommendations(
    state.archive.sessions
  );

  el.aggregate.textContent =
    tactileAggregate.completedSessions === 0
      ? "No completed core-feel sessions saved."
      : `${tactileAggregate.completedSessions} completed core-feel session` +
        `${tactileAggregate.completedSessions === 1 ? "" : "s"}. ` +
        `Current evidence decision: ${fieldEvaluation.decision}.`;

  if (el.coverage) {
    const counts = coverage.counts;
    el.coverage.textContent =
      `Field coverage: ${counts.protocolCompleteSessions}/` +
      `${coverage.requirements.minimumProtocolCompleteSessions} protocol-complete, ` +
      `${counts.lowEndSessions} low-end, ` +
      `${counts.soundTestedSessions} sound-tested, ` +
      `${counts.hapticsTestedSessions} haptic-tested. ` +
      `Next: ${recommendations[0]}`;
  }
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
    `paper-flock-v${BUILD_VERSION}-${session.participantCode}-field-result.json`,
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
  const aggregate = aggregateTactileSessions(state.archive.sessions);
  const evaluation = evaluateTactileReadiness(aggregate);
  const fieldCoverage = aggregateFieldCoverage(
    state.archive.sessions
  );
  const fieldEvaluation = evaluateFieldReadiness(
    state.archive.sessions
  );
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-field-sessions.json`,
    "application/json",
    JSON.stringify(
      {
        buildVersion: BUILD_VERSION,
        exportedAt: new Date().toISOString(),
        aggregate,
        evaluation,
        fieldCoverage,
        fieldEvaluation,
        sessions: state.archive.sessions
      },
      null,
      2
    )
  );
}

function exportAllCsv() {
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-field-sessions.csv`,
    "text/csv;charset=utf-8",
    tactileSessionsToCsv(state.archive.sessions)
  );
}
