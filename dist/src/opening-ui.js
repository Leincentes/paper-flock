import {
  markOpeningSeen,
  normalizeOpeningPreference,
  setOpeningLaunchPreference,
  shouldShowOpening
} from "./opening-core.js";
import {
  STORAGE_KEYS
} from "./storage-player-core.js";

const state = {
  preference: loadPreference(),
  active: false,
  replay: false
};

const overlay = document.querySelector("#opening-screen");
const beginButton = document.querySelector("#opening-begin-button");
const skipButton = document.querySelector("#opening-skip-button");

wireOpening();
initializeOpening();

function loadPreference() {
  try {
    return normalizeOpeningPreference(
      JSON.parse(
        localStorage.getItem(STORAGE_KEYS.opening) || "{}"
      )
    );
  } catch {
    return normalizeOpeningPreference();
  }
}

function savePreference() {
  try {
    localStorage.setItem(
      STORAGE_KEYS.opening,
      JSON.stringify(state.preference)
    );
  } catch {
    // The opening remains usable when storage is unavailable.
  }
}

function hasExistingSave() {
  try {
    return (
      localStorage.getItem(STORAGE_KEYS.save) !== null ||
      localStorage.getItem(STORAGE_KEYS.saveBackup) !== null
    );
  } catch {
    return false;
  }
}

function initializeOpening() {
  if (
    shouldShowOpening({
      preference: state.preference,
      hasExistingSave: hasExistingSave()
    })
  ) {
    openOpening();
    return;
  }

  emitState();
}

function wireOpening() {
  beginButton?.addEventListener("click", () => {
    finishOpening("begin");
  });
  skipButton?.addEventListener("click", () => {
    finishOpening("skip");
  });

  overlay?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finishOpening("escape");
    }
  });

  globalThis.addEventListener(
    "paperflock:opening-replay",
    () => openOpening({ replay: true })
  );

  globalThis.addEventListener(
    "paperflock:opening-preference-change",
    (event) => {
      state.preference = setOpeningLaunchPreference(
        state.preference,
        event.detail?.showOnLaunch
      );
      savePreference();
      emitState();
    }
  );

  globalThis.addEventListener(
    "paperflock:opening-state-request",
    emitState
  );
}

function openOpening({ replay = false } = {}) {
  if (!overlay || state.active) {
    return;
  }

  state.active = true;
  state.replay = replay;
  document.body.classList.add("opening-active");
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");

  emitState();

  requestAnimationFrame(() => {
    beginButton?.focus({ preventScroll: true });
  });
}

function finishOpening(reason) {
  if (!overlay || !state.active) {
    return;
  }

  state.preference = markOpeningSeen(state.preference);
  savePreference();
  state.active = false;
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("opening-active");

  const replay = state.replay;
  state.replay = false;
  emitState();

  globalThis.dispatchEvent(
    new CustomEvent("paperflock:opening-finished", {
      detail: {
        reason,
        replay,
        showOnLaunch: state.preference.showOnLaunch
      }
    })
  );

  if (replay) {
    requestAnimationFrame(() => {
      document.querySelector("#settings-button")?.focus({
        preventScroll: true
      });
    });
  }
}

function emitState() {
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:opening-state", {
      detail: {
        ...state.preference,
        active: state.active
      }
    })
  );
}
