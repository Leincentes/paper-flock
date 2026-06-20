import {
  STORAGE_KEYS,
  storageHealth
} from "./storage-player-core.js";

const state = {
  hiddenAt: null,
  lastPersistAt: null,
  orientationDismissed:
    localStorage.getItem(STORAGE_KEYS.orientationDismissed) === "1"
};

injectLifecycleInterface();
wireLifecycle();
updateOrientationNotice();

function injectLifecycleInterface() {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <aside
        class="orientation-notice"
        id="orientation-notice"
        aria-live="polite"
        hidden
      >
        <span>
          <strong>Portrait works best.</strong>
          Rotate your phone for the clearest board.
        </span>
        <button id="orientation-dismiss-button" type="button">
          Continue
        </button>
      </aside>

      <div
        class="resume-toast"
        id="resume-toast"
        role="status"
        aria-live="polite"
        hidden
      >
        Puzzle restored.
      </div>
    `
  );
}

function elements() {
  return {
    orientation: document.querySelector("#orientation-notice"),
    dismissOrientation: document.querySelector(
      "#orientation-dismiss-button"
    ),
    resumeToast: document.querySelector("#resume-toast")
  };
}

function wireLifecycle() {
  const el = elements();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      state.hiddenAt = Date.now();
      persist("visibility-hidden");
      document.documentElement.classList.add("app-suspended");
      return;
    }

    document.documentElement.classList.remove("app-suspended");
    const hiddenDurationMs = state.hiddenAt
      ? Date.now() - state.hiddenAt
      : 0;
    dispatchResume("visibility-visible", false, hiddenDurationMs);

    if (hiddenDurationMs >= 3000) {
      showResumeToast(hiddenDurationMs);
    }
  });

  globalThis.addEventListener("pagehide", () => {
    persist("pagehide");
  });

  globalThis.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      dispatchResume("pageshow-bfcache", true, 0);
      showResumeToast(0);
    }
  });

  globalThis.addEventListener("beforeunload", () => {
    persist("beforeunload");
  });

  globalThis.addEventListener("orientationchange", updateOrientationNotice);
  globalThis.addEventListener("resize", updateOrientationNotice);

  el.dismissOrientation?.addEventListener("click", () => {
    state.orientationDismissed = true;
    localStorage.setItem(STORAGE_KEYS.orientationDismissed, "1");
    el.orientation.hidden = true;
  });
}

function persist(reason) {
  const now = Date.now();
  if (
    state.lastPersistAt !== null &&
    now - state.lastPersistAt < 150
  ) {
    return;
  }

  state.lastPersistAt = now;
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:persist-now", {
      detail: {
        reason,
        saveHealth: storageHealth(localStorage)
      }
    })
  );
}

function dispatchResume(reason, persisted, hiddenDurationMs) {
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:resume", {
      detail: {
        reason,
        persisted,
        hiddenDurationMs
      }
    })
  );
}

function updateOrientationNotice() {
  const el = elements();
  if (!el.orientation) {
    return;
  }

  const compactLandscape =
    globalThis.matchMedia?.(
      "(orientation: landscape) and (max-height: 520px)"
    ).matches ?? false;

  el.orientation.hidden =
    !compactLandscape || state.orientationDismissed;
}

function showResumeToast(hiddenDurationMs) {
  const el = elements();
  if (!el.resumeToast) {
    return;
  }

  el.resumeToast.textContent =
    hiddenDurationMs >= 3000
      ? "Puzzle restored where you left it."
      : "Puzzle restored.";
  el.resumeToast.hidden = false;
  globalThis.setTimeout(() => {
    el.resumeToast.hidden = true;
  }, 2200);
}
