import {
  PLAYER_STORAGE_KEYS,
  applyPlayerRestorePlan,
  clearPlayerData,
  createPlayerBackup,
  createPlayerRestorePlan,
  normalizePlayerSettings,
  validatePlayerBackup
} from "./settings-core.js";
import {
  STORAGE_KEYS
} from "./storage-player-core.js";

const BUILD_VERSION = "1.4.2";
const PUBLISHER = "Gamelo Studio";
const SUPPORT_EMAIL = "leincentes@gmail.com";

const state = {
  game: normalizePlayerSettings(),
  themes: [],
  selectedTheme: "dawn",
  accessibility: loadAccessibilityPreferences(),
  platform: {
    online: navigator.onLine,
    installed: false,
    installAvailable: false,
    updateAvailable: false
  },
  restoreFocus: null,
  activeSection: "game"
};

injectSettingsInterface();
wireSettingsInterface();
requestStates();

function loadAccessibilityPreferences() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.accessibility) || "{}"
    );
    return {
      textSize: ["standard", "large", "extra-large"].includes(
        parsed.textSize
      )
        ? parsed.textSize
        : "standard",
      contrast: parsed.contrast === "high" ? "high" : "auto",
      motion: parsed.motion === "reduced" ? "reduced" : "auto"
    };
  } catch {
    return {
      textSize: "standard",
      contrast: "auto",
      motion: "auto"
    };
  }
}

function injectSettingsInterface() {
  const entry =
    document.querySelector(".settings-entry") ??
    document.querySelector(".feedback-settings");

  if (entry) {
    entry.classList.add("settings-entry");
    entry.replaceChildren();

    const button = document.createElement("button");
    button.id = "settings-button";
    button.className = "settings-button";
    button.type = "button";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", "settings-page");
    button.innerHTML = `
      <span aria-hidden="true">⚙</span>
      <span>Settings</span>
    `;
    entry.append(button);
  }

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div
        class="settings-page"
        id="settings-page"
        hidden
      >
        <section
          class="settings-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <header class="settings-header">
            <div>
              <span class="settings-kicker">
                Paper Flock v${BUILD_VERSION}
              </span>
              <h2 id="settings-title">Settings</h2>
            </div>
            <button
              class="settings-close"
              id="settings-close-button"
              type="button"
              aria-label="Close settings"
            >
              ×
            </button>
          </header>

          <nav
            class="settings-tabs"
            aria-label="Settings sections"
          >
            <button type="button" data-settings-tab="game">
              Game
            </button>
            <button type="button" data-settings-tab="accessibility">
              Accessibility
            </button>
            <button type="button" data-settings-tab="data">
              Data
            </button>
            <button type="button" data-settings-tab="about">
              About
            </button>
          </nav>

          <div class="settings-content">
            <section
              class="settings-section"
              data-settings-section="game"
              aria-labelledby="settings-game-title"
            >
              <h3 id="settings-game-title">Game</h3>

              <label class="settings-row settings-toggle-row">
                <span>
                  <strong>Sound effects</strong>
                  <small>Birds, folds, hints, and completion sounds.</small>
                </span>
                <input
                  id="settings-sound"
                  type="checkbox"
                >
              </label>

              <label class="settings-row settings-toggle-row">
                <span>
                  <strong>Haptic feedback</strong>
                  <small>Short device vibrations when supported.</small>
                </span>
                <input
                  id="settings-haptics"
                  type="checkbox"
                >
              </label>

              <label class="settings-field">
                <span>
                  <strong>Visual effects</strong>
                  <small>Automatic adapts to motion and device capability.</small>
                </span>
                <select id="settings-effects">
                  <option value="auto">Automatic</option>
                  <option value="full">Full</option>
                  <option value="lite">Lite</option>
                  <option value="minimal">Minimal</option>
                </select>
              </label>

              <label class="settings-field">
                <span>
                  <strong>Paper theme</strong>
                  <small>More themes unlock as the journey continues.</small>
                </span>
                <select id="settings-theme"></select>
              </label>

              <button
                class="settings-action"
                id="settings-tutorial-button"
                type="button"
              >
                Replay how to play
              </button>
            </section>

            <section
              class="settings-section"
              data-settings-section="accessibility"
              aria-labelledby="settings-accessibility-title"
              hidden
            >
              <h3 id="settings-accessibility-title">
                Accessibility
              </h3>

              <label class="settings-field">
                <span>
                  <strong>Text size</strong>
                  <small>Applies across the game interface.</small>
                </span>
                <select id="settings-text-size">
                  <option value="standard">Standard</option>
                  <option value="large">Large</option>
                  <option value="extra-large">Extra large</option>
                </select>
              </label>

              <label class="settings-field">
                <span>
                  <strong>Contrast</strong>
                  <small>Automatic respects the device preference.</small>
                </span>
                <select id="settings-contrast">
                  <option value="auto">Automatic</option>
                  <option value="high">Always high</option>
                </select>
              </label>

              <label class="settings-field">
                <span>
                  <strong>Motion</strong>
                  <small>Reduced motion limits decorative animation.</small>
                </span>
                <select id="settings-motion">
                  <option value="auto">Automatic</option>
                  <option value="reduced">Reduced</option>
                </select>
              </label>

              <a
                class="settings-link"
                href="./accessibility.html"
              >
                Read the accessibility statement
              </a>
            </section>

            <section
              class="settings-section"
              data-settings-section="data"
              aria-labelledby="settings-data-title"
              hidden
            >
              <h3 id="settings-data-title">App and data</h3>

              <div
                class="settings-status-card"
                id="settings-connection-status"
              >
                Checking app status…
              </div>

              <div class="settings-action-grid">
                <button
                  class="settings-action"
                  id="settings-install-button"
                  type="button"
                  hidden
                >
                  Install app
                </button>
                <button
                  class="settings-action"
                  id="settings-update-button"
                  type="button"
                  hidden
                >
                  Install update
                </button>
                <button
                  class="settings-action"
                  id="settings-export-button"
                  type="button"
                >
                  Export progress backup
                </button>
                <button
                  class="settings-action"
                  id="settings-import-button"
                  type="button"
                >
                  Restore progress backup
                </button>
                <input
                  id="settings-import-input"
                  type="file"
                  accept="application/json,.json"
                  hidden
                >
              </div>

              <button
                class="settings-danger"
                id="settings-reset-button"
                type="button"
              >
                Reset all player data
              </button>

              <p class="settings-data-note">
                Progress, tutorial completion, and preferences stay on this
                device unless you export a backup.
              </p>
            </section>

            <section
              class="settings-section"
              data-settings-section="about"
              aria-labelledby="settings-about-title"
              hidden
            >
              <h3 id="settings-about-title">About</h3>

              <dl class="settings-about-list">
                <div>
                  <dt>Version</dt>
                  <dd>${BUILD_VERSION}</dd>
                </div>
                <div>
                  <dt>Publisher</dt>
                  <dd>${PUBLISHER}</dd>
                </div>
                <div>
                  <dt>Support</dt>
                  <dd>
                    <a href="mailto:${SUPPORT_EMAIL}">
                      ${SUPPORT_EMAIL}
                    </a>
                  </dd>
                </div>
              </dl>

              <div class="settings-link-grid">
                <a href="./privacy.html">Privacy</a>
                <a href="./terms.html">Terms</a>
                <a href="./support.html">Support</a>
                <a href="./release-notes.html">Release notes</a>
                <a href="./known-issues.html">Known issues</a>
                <a href="./credits.html">Credits</a>
              </div>
            </section>
          </div>

          <p
            class="settings-status"
            id="settings-status"
            role="status"
            aria-live="polite"
          ></p>
        </section>
      </div>
    `
  );
}

function elements() {
  return {
    open: document.querySelector("#settings-button"),
    page: document.querySelector("#settings-page"),
    panel: document.querySelector(".settings-panel"),
    close: document.querySelector("#settings-close-button"),
    tabs: [
      ...document.querySelectorAll("[data-settings-tab]")
    ],
    sections: [
      ...document.querySelectorAll("[data-settings-section]")
    ],
    sound: document.querySelector("#settings-sound"),
    haptics: document.querySelector("#settings-haptics"),
    effects: document.querySelector("#settings-effects"),
    theme: document.querySelector("#settings-theme"),
    tutorial: document.querySelector("#settings-tutorial-button"),
    textSize: document.querySelector("#settings-text-size"),
    contrast: document.querySelector("#settings-contrast"),
    motion: document.querySelector("#settings-motion"),
    connection: document.querySelector(
      "#settings-connection-status"
    ),
    install: document.querySelector("#settings-install-button"),
    update: document.querySelector("#settings-update-button"),
    exportButton: document.querySelector("#settings-export-button"),
    importButton: document.querySelector("#settings-import-button"),
    importInput: document.querySelector("#settings-import-input"),
    reset: document.querySelector("#settings-reset-button"),
    status: document.querySelector("#settings-status")
  };
}

function wireSettingsInterface() {
  const el = elements();

  el.open?.addEventListener("click", openSettings);
  el.close?.addEventListener("click", closeSettings);
  el.page?.addEventListener("click", (event) => {
    if (event.target === el.page) {
      closeSettings();
    }
  });

  for (const tab of el.tabs) {
    tab.addEventListener("click", () => {
      selectSection(tab.dataset.settingsTab);
    });
  }

  el.sound?.addEventListener("change", submitGameSettings);
  el.haptics?.addEventListener("change", submitGameSettings);
  el.effects?.addEventListener("change", submitGameSettings);
  el.theme?.addEventListener("change", submitGameSettings);

  el.textSize?.addEventListener(
    "change",
    submitAccessibilitySettings
  );
  el.contrast?.addEventListener(
    "change",
    submitAccessibilitySettings
  );
  el.motion?.addEventListener(
    "change",
    submitAccessibilitySettings
  );

  el.tutorial?.addEventListener("click", replayTutorial);
  el.install?.addEventListener("click", () => {
    globalThis.dispatchEvent(
      new CustomEvent("paperflock:install-request")
    );
  });
  el.update?.addEventListener("click", () => {
    globalThis.dispatchEvent(
      new CustomEvent("paperflock:update-request")
    );
  });

  el.exportButton?.addEventListener("click", exportBackup);
  el.importButton?.addEventListener(
    "click",
    () => el.importInput.click()
  );
  el.importInput?.addEventListener("change", restoreBackup);
  el.reset?.addEventListener("click", resetPlayerData);

  document.addEventListener("keydown", handleKeydown);

  globalThis.addEventListener(
    "paperflock:settings-state",
    (event) => {
      const detail = event.detail ?? {};
      state.game = normalizePlayerSettings(detail);
      state.themes = Array.isArray(detail.themes)
        ? detail.themes
        : [];
      state.selectedTheme =
        String(detail.selectedTheme ?? "dawn");
      renderGameSettings();
    }
  );

  globalThis.addEventListener(
    "paperflock:platform-state",
    (event) => {
      state.platform = {
        ...state.platform,
        ...(event.detail ?? {})
      };
      renderPlatformState();
    }
  );

  globalThis.addEventListener(
    "paperflock:accessibility-preferences-applied",
    (event) => {
      state.accessibility = {
        ...state.accessibility,
        ...(event.detail ?? {})
      };
      renderAccessibilitySettings();
    }
  );
}

function requestStates() {
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:settings-state-request")
  );
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:platform-state-request")
  );
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:accessibility-state-request")
  );
  renderAccessibilitySettings();
}

function openSettings() {
  const el = elements();
  state.restoreFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  requestStates();
  selectSection("game");
  el.page.hidden = false;
  document.body.classList.add("settings-open");
  requestAnimationFrame(() =>
    el.close.focus({ preventScroll: true })
  );
}

function closeSettings() {
  const el = elements();
  if (el.page.hidden) {
    return;
  }

  el.page.hidden = true;
  document.body.classList.remove("settings-open");

  if (state.restoreFocus?.isConnected) {
    requestAnimationFrame(() =>
      state.restoreFocus.focus({ preventScroll: true })
    );
  }
  state.restoreFocus = null;
}

function selectSection(sectionId) {
  state.activeSection = sectionId;
  const el = elements();

  for (const tab of el.tabs) {
    const active =
      tab.dataset.settingsTab === sectionId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-pressed", String(active));
  }
  for (const section of el.sections) {
    section.hidden =
      section.dataset.settingsSection !== sectionId;
  }
}

function renderGameSettings() {
  const el = elements();
  el.sound.checked = state.game.soundEnabled;
  el.haptics.checked = state.game.hapticsEnabled;
  el.effects.value = state.game.effectsPreference;

  el.theme.replaceChildren();
  for (const theme of state.themes) {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.unlocked
      ? theme.name
      : `${theme.name} — unlock after ${theme.requirement} levels`;
    option.disabled = !theme.unlocked;
    option.selected = theme.id === state.selectedTheme;
    el.theme.append(option);
  }
}

function submitGameSettings() {
  const el = elements();
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:settings-change", {
      detail: {
        soundEnabled: el.sound.checked,
        hapticsEnabled: el.haptics.checked,
        effectsPreference: el.effects.value,
        selectedTheme: el.theme.value
      }
    })
  );
  setStatus("Game settings saved.");
}

function renderAccessibilitySettings() {
  const el = elements();
  el.textSize.value =
    state.accessibility.textSize ?? "standard";
  el.contrast.value =
    state.accessibility.contrast ?? "auto";
  el.motion.value =
    state.accessibility.motion ?? "auto";
}

function submitAccessibilitySettings() {
  const el = elements();
  state.accessibility = {
    textSize: el.textSize.value,
    contrast: el.contrast.value,
    motion: el.motion.value,
    focusStyle: "strong"
  };

  localStorage.setItem(
    STORAGE_KEYS.accessibility,
    JSON.stringify({
      schemaVersion: 1,
      ...state.accessibility
    })
  );

  globalThis.dispatchEvent(
    new CustomEvent(
      "paperflock:accessibility-preferences-change",
      {
        detail: state.accessibility
      }
    )
  );

  setStatus("Accessibility settings saved.");
}

function renderPlatformState() {
  const el = elements();
  const parts = [
    state.platform.online ? "Online" : "Offline",
    state.platform.installed
      ? "Installed app"
      : "Browser mode"
  ];

  el.connection.textContent = parts.join(" · ");
  el.install.hidden =
    !state.platform.installAvailable ||
    state.platform.installed;
  el.update.hidden = !state.platform.updateAvailable;
}

function replayTutorial() {
  closeSettings();
  const replay = document.querySelector(
    "#tutorial-replay-button"
  );
  if (replay) {
    replay.click();
    return;
  }

  globalThis.dispatchEvent(
    new CustomEvent("paperflock:tutorial-reset")
  );
}

function currentStorageValues() {
  return Object.fromEntries(
    PLAYER_STORAGE_KEYS
      .map((key) => [key, localStorage.getItem(key)])
      .filter(([, value]) => typeof value === "string")
  );
}

function exportBackup() {
  const backup = createPlayerBackup({
    buildVersion: BUILD_VERSION,
    storageValues: currentStorageValues()
  });

  downloadJson(
    `paper-flock-v${BUILD_VERSION}-player-backup.json`,
    backup
  );
  setStatus("Player backup downloaded.");
}

async function restoreBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) {
    return;
  }

  try {
    const payload = JSON.parse(await file.text());
    const validation = validatePlayerBackup(payload);
    if (!validation.valid) {
      setStatus(validation.problems.join(" "));
      return;
    }

    const confirmed = globalThis.confirm(
      "Restore this Paper Flock backup? Current player progress and settings will be replaced."
    );
    if (!confirmed) {
      return;
    }

    const plan = createPlayerRestorePlan(
      currentStorageValues(),
      payload
    );
    applyPlayerRestorePlan(localStorage, plan);
    globalThis.location.reload();
  } catch {
    setStatus("The selected backup is not valid JSON.");
  }
}

function resetPlayerData() {
  const confirmed = globalThis.confirm(
    "Reset all Paper Flock progress, tutorial completion, and preferences on this device?"
  );
  if (!confirmed) {
    return;
  }

  clearPlayerData(localStorage);
  globalThis.location.reload();
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

function setStatus(message) {
  elements().status.textContent = message;
}

function handleKeydown(event) {
  const el = elements();
  if (el.page.hidden) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeSettings();
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const focusable = [
    ...el.panel.querySelectorAll(
      'button:not([disabled]):not([hidden]), ' +
      'select:not([disabled]), input:not([disabled]), ' +
      'a[href], textarea:not([disabled])'
    )
  ].filter(
    (node) =>
      !node.closest("[hidden]") &&
      node.getClientRects().length > 0
  );

  if (focusable.length === 0) {
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    document.activeElement === last
  ) {
    event.preventDefault();
    first.focus();
  }
}
