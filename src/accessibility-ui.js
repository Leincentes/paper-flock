import {
  eventAnnouncement,
  nextGridCell,
  normalizeAccessibilityPreferences,
  resolveAccessibilityPreferences
} from "./accessibility-core.js";
import {
  STORAGE_KEYS
} from "./storage-player-core.js";

const BUILD_VERSION = "1.2";
const state = {
  preferences: loadPreferences(),
  activeDialog: null,
  restoreFocus: null,
  inertedElements: []
};

injectAccessibilityInterface();
wireAccessibilityInterface();
applyPreferences();
initializeBoardNavigation();
initializeDialogManagement();
initializeAnnouncements();


function emitAccessibilityPreferences() {
  const resolved = resolveAccessibilityPreferences(
    state.preferences,
    systemPreferences()
  );

  globalThis.dispatchEvent(
    new CustomEvent(
      "paperflock:accessibility-preferences-applied",
      {
        detail: {
          ...state.preferences,
          effectiveContrast: resolved.effectiveContrast,
          effectiveMotion: resolved.effectiveMotion,
          forcedColors: resolved.forcedColors
        }
      }
    )
  );
}

globalThis.addEventListener(
  "paperflock:accessibility-preferences-change",
  (event) => {
    state.preferences = normalizeAccessibilityPreferences({
      ...state.preferences,
      ...(event.detail ?? {})
    });
    savePreferences();
    applyPreferences();
  }
);

globalThis.addEventListener(
  "paperflock:accessibility-state-request",
  emitAccessibilityPreferences
);

function loadPreferences() {
  try {
    return normalizeAccessibilityPreferences(
      JSON.parse(
        localStorage.getItem(STORAGE_KEYS.accessibility) || "{}"
      )
    );
  } catch {
    return normalizeAccessibilityPreferences();
  }
}

function savePreferences() {
  localStorage.setItem(
    STORAGE_KEYS.accessibility,
    JSON.stringify(state.preferences)
  );
}

function systemPreferences() {
  return {
    prefersReducedMotion:
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
      false,
    prefersMoreContrast:
      globalThis.matchMedia?.("(prefers-contrast: more)").matches ??
      false,
    forcedColors:
      globalThis.matchMedia?.("(forced-colors: active)").matches ??
      false
  };
}

function injectAccessibilityInterface() {
  document.body.insertAdjacentHTML(
    "afterbegin",
    `
      <a class="skip-link" href="#board">Skip to puzzle board</a>
      <div
        class="sr-only"
        id="accessibility-live-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      ></div>
    `
  );

  const footerNav = document.querySelector(".app-footer nav");
  footerNav?.insertAdjacentHTML(
    "beforeend",
    `
      <button
        id="accessibility-settings-button"
        type="button"
        hidden
      >
        Accessibility settings
      </button>
    `
  );

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div
        class="accessibility-modal"
        id="accessibility-settings"
        hidden
      >
        <section
          class="accessibility-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="accessibility-settings-title"
        >
          <header class="accessibility-panel-header">
            <div>
              <span class="accessibility-kicker">Paper Flock v${BUILD_VERSION}</span>
              <h2 id="accessibility-settings-title">
                Accessibility settings
              </h2>
            </div>
            <button
              class="accessibility-close"
              id="accessibility-settings-close"
              type="button"
              aria-label="Close accessibility settings"
            >
              ×
            </button>
          </header>

          <p>
            These settings stay on this device and apply throughout the game.
          </p>

          <form id="accessibility-settings-form">
            <fieldset>
              <legend>Text size</legend>
              <label>
                <input type="radio" name="textSize" value="standard">
                Standard
              </label>
              <label>
                <input type="radio" name="textSize" value="large">
                Large
              </label>
              <label>
                <input type="radio" name="textSize" value="extra-large">
                Extra large
              </label>
            </fieldset>

            <fieldset>
              <legend>Contrast</legend>
              <label>
                <input type="radio" name="contrast" value="auto">
                Follow device preference
              </label>
              <label>
                <input type="radio" name="contrast" value="high">
                Always use higher contrast
              </label>
            </fieldset>

            <fieldset>
              <legend>Motion</legend>
              <label>
                <input type="radio" name="motion" value="auto">
                Follow device preference
              </label>
              <label>
                <input type="radio" name="motion" value="reduced">
                Reduce decorative motion
              </label>
            </fieldset>

            <div class="accessibility-actions">
              <button
                class="secondary-button"
                id="accessibility-reset-button"
                type="button"
              >
                Reset settings
              </button>
              <button class="primary-button" type="submit">
                Save settings
              </button>
            </div>

            <p
              class="accessibility-status"
              id="accessibility-settings-status"
              aria-live="polite"
            ></p>
          </form>
        </section>
      </div>
    `
  );

  const board = document.querySelector("#board");
  board?.setAttribute("tabindex", "-1");
  board?.setAttribute(
    "aria-describedby",
    "message board-keyboard-instructions"
  );
  board?.insertAdjacentHTML(
    "beforebegin",
    `
      <p class="sr-only" id="board-keyboard-instructions">
        Use Tab to enter the bird controls. Arrow keys move between birds.
        Press Enter or Space to attempt an escape.
      </p>
    `
  );
}

function elements() {
  return {
    open: document.querySelector("#accessibility-settings-button"),
    modal: document.querySelector("#accessibility-settings"),
    close: document.querySelector("#accessibility-settings-close"),
    form: document.querySelector("#accessibility-settings-form"),
    reset: document.querySelector("#accessibility-reset-button"),
    status: document.querySelector("#accessibility-settings-status"),
    live: document.querySelector("#accessibility-live-region"),
    board: document.querySelector("#board")
  };
}

function wireAccessibilityInterface() {
  const el = elements();

  el.open?.addEventListener("click", openSettings);
  el.close?.addEventListener("click", closeSettings);
  el.modal?.addEventListener("click", (event) => {
    if (event.target === el.modal) {
      closeSettings();
    }
  });
  el.form?.addEventListener("submit", saveSettings);
  el.reset?.addEventListener("click", resetSettings);

  for (const query of [
    "(prefers-reduced-motion: reduce)",
    "(prefers-contrast: more)",
    "(forced-colors: active)"
  ]) {
    globalThis.matchMedia?.(query).addEventListener?.(
      "change",
      applyPreferences
    );
  }
}

function openSettings() {
  hydrateSettingsForm();
  elements().modal.hidden = false;
}

function closeSettings() {
  elements().modal.hidden = true;
}

function hydrateSettingsForm() {
  const form = elements().form;
  if (!form) {
    return;
  }

  for (const [key, value] of Object.entries(state.preferences)) {
    const control = form.querySelector(
      `[name="${key}"][value="${value}"]`
    );
    if (control) {
      control.checked = true;
    }
  }
}

function saveSettings(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.preferences = normalizeAccessibilityPreferences({
    textSize: data.get("textSize"),
    contrast: data.get("contrast"),
    motion: data.get("motion")
  });
  savePreferences();
  applyPreferences();
  elements().status.textContent = "Accessibility settings saved.";
  announce("Accessibility settings saved.");
}

function resetSettings() {
  state.preferences = normalizeAccessibilityPreferences();
  savePreferences();
  hydrateSettingsForm();
  applyPreferences();
  elements().status.textContent =
    "Accessibility settings reset to device defaults.";
  announce("Accessibility settings reset.");
}

function applyPreferences() {
  const resolved = resolveAccessibilityPreferences(
    state.preferences,
    systemPreferences()
  );
  const root = document.documentElement;

  root.dataset.textSize = resolved.textSize;
  root.dataset.accessibilityContrast = resolved.effectiveContrast;
  root.dataset.accessibilityMotion = resolved.effectiveMotion;
  root.dataset.forcedColors =
    resolved.forcedColors ? "active" : "inactive";
  emitAccessibilityPreferences();
}

function initializeBoardNavigation() {
  const board = elements().board;
  board?.addEventListener("keydown", (event) => {
    if (
      ![
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End"
      ].includes(event.key)
    ) {
      return;
    }

    const currentButton = event.target.closest(".cell:not(:disabled)");
    if (!currentButton) {
      return;
    }

    const buttons = [...board.querySelectorAll(".cell:not(:disabled)")];
    const model = buttons.map((button) => ({
      row: Number(button.dataset.row),
      col: Number(button.dataset.col),
      disabled: button.disabled
    }));
    const target = nextGridCell(
      model,
      {
        row: Number(currentButton.dataset.row),
        col: Number(currentButton.dataset.col)
      },
      event.key
    );

    const nextButton = buttons.find(
      (button) =>
        Number(button.dataset.row) === target?.row &&
        Number(button.dataset.col) === target?.col
    );

    if (nextButton && nextButton !== currentButton) {
      event.preventDefault();
      nextButton.focus();
    }
  });
}

function initializeAnnouncements() {
  globalThis.addEventListener("paperflock:event", (event) => {
    const message = eventAnnouncement(event.detail);
    if (message) {
      announce(message);
    }
  });
}

function announce(message) {
  const live = elements().live;
  if (!live) {
    return;
  }

  live.textContent = "";
  globalThis.setTimeout(() => {
    live.textContent = message;
  }, 20);
}

function initializeDialogManagement() {
  const observer = new MutationObserver(refreshActiveDialog);
  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "class", "style"],
    childList: true
  });

  document.addEventListener("keydown", handleDialogKeydown, true);
  refreshActiveDialog();
}

function visibleDialogs() {
  return [...document.querySelectorAll(
    '[role="dialog"][aria-modal="true"]'
  )].filter((dialog) => {
    if (dialog.closest("[hidden]")) {
      return false;
    }
    const style = globalThis.getComputedStyle(dialog);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

function refreshActiveDialog() {
  const dialogs = visibleDialogs();
  const next = dialogs.at(-1) ?? null;

  if (next === state.activeDialog) {
    return;
  }

  releaseDialog();
  if (next) {
    activateDialog(next);
  }
}

function activateDialog(dialog) {
  state.activeDialog = dialog;
  state.restoreFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  state.inertedElements = inertOutside(dialog);

  requestAnimationFrame(() => {
    const first = focusableElements(dialog)[0];
    if (first) {
      first.focus({ preventScroll: true });
    } else {
      dialog.tabIndex = -1;
      dialog.focus({ preventScroll: true });
    }
  });
}

function releaseDialog() {
  for (const entry of state.inertedElements) {
    if (!entry.wasInert) {
      entry.element.removeAttribute("inert");
    }
  }
  state.inertedElements = [];

  const restore = state.restoreFocus;
  state.activeDialog = null;
  state.restoreFocus = null;

  if (
    restore &&
    restore.isConnected &&
    !restore.closest("[hidden]")
  ) {
    requestAnimationFrame(() => {
      restore.focus({ preventScroll: true });
    });
  }
}

function inertOutside(dialog) {
  const changed = [];
  let current = dialog;

  while (current && current !== document.body) {
    const parent = current.parentElement;
    if (!parent) {
      break;
    }

    for (const sibling of parent.children) {
      if (sibling === current || sibling.contains(current)) {
        continue;
      }
      changed.push({
        element: sibling,
        wasInert: sibling.hasAttribute("inert")
      });
      sibling.setAttribute("inert", "");
    }

    current = parent;
  }

  return changed;
}

function focusableElements(container) {
  return [...container.querySelectorAll(
    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => {
    if (element.closest("[hidden]")) {
      return false;
    }
    const style = globalThis.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

function handleDialogKeydown(event) {
  const dialog = state.activeDialog;
  if (!dialog) {
    return;
  }

  if (event.key === "Escape") {
    const close = dialog.querySelector(
      [
        "[data-modal-close]",
        '[aria-label^="Close"]',
        ".close-map-button",
        ".map-bottom-close",
        ".accessibility-close",
        "#daily-decline-button"
      ].join(",")
    );
    if (close) {
      event.preventDefault();
      close.click();
    }
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const focusable = focusableElements(dialog);
  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
