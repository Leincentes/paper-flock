import {
  PLAYER_STORAGE_KEYS,
  applyPlayerRestorePlanSafely,
  clearPlayerData,
  createPlayerBackup,
  createPlayerRestorePlan,
  normalizePlayerSettings,
  validatePlayerBackup
} from "./settings-core.js";
import {
  STORAGE_KEYS
} from "./storage-player-core.js";
import {
  normalizeOpeningPreference
} from "./opening-core.js";

const BUILD_VERSION = "1.6.0";
const PUBLISHER = "Gamelo Studio";
const SUPPORT_EMAIL = "leincentes@gmail.com";

const state = {
  game: normalizePlayerSettings(),
  themes: [],
  selectedTheme: "dawn",
  opening: normalizeOpeningPreference(),
  accessibility: loadAccessibilityPreferences(),
  platform: {
    online: navigator.onLine,
    installed: false,
    installAvailable: false,
    updateAvailable: false
  },
  activeSection: "game",
  diagnostics: {
    eventCount: 0,
    firstEventAt: null,
    lastEventAt: null,
    counts: {}
  }
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

              <label class="settings-row settings-toggle-row">
                <span>
                  <strong>Show studio opening on launch</strong>
                  <small>Replay the Gamelo Studio introduction each time the game starts.</small>
                </span>
                <input
                  id="settings-opening"
                  type="checkbox"
                >
              </label>

              <button
                class="settings-action"
                id="settings-opening-replay-button"
                type="button"
              >
                Replay studio opening
              </button>

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
                <button
                  class="settings-action"
                  id="settings-test-report-button"
                  type="button"
                >
                  Export tester report
                </button>
                <button
                  class="settings-action"
                  id="settings-clear-report-button"
                  type="button"
                >
                  Clear local test history
                </button>
              </div>

              <p
                class="settings-data-note"
                id="settings-diagnostic-summary"
              >
                No local test events recorded yet.
              </p>

              <button
                class="settings-danger"
                id="settings-reset-button"
                type="button"
              >
                Reset all player data
              </button>

              <p class="settings-data-note">
                Progress, tutorial completion, preferences, and the optional
                rolling test log stay on this device. Nothing is uploaded
                automatically.
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
    opening: document.querySelector("#settings-opening"),
    openingReplay: document.querySelector(
      "#settings-opening-replay-button"
    ),
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
    testReport: document.querySelector("#settings-test-report-button"),
    clearReport: document.querySelector("#settings-clear-report-button"),
    diagnosticSummary: document.querySelector(
      "#settings-diagnostic-summary"
    ),
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
  el.opening?.addEventListener(
    "change",
    submitOpeningPreference
  );
  el.openingReplay?.addEventListener(
    "click",
    replayOpening
  );

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
  el.testReport?.addEventListener("click", exportTesterReport);
  el.clearReport?.addEventListener("click", clearTesterReport);
  el.reset?.addEventListener("click", resetPlayerData);

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
    "paperflock:opening-state",
    (event) => {
      state.opening = normalizeOpeningPreference(
        event.detail ?? {}
      );
      renderOpeningPreference();
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

  globalThis.addEventListener(
    "paperflock:diagnostic-state",
    (event) => {
      state.diagnostics = {
        ...state.diagnostics,
        ...(event.detail ?? {})
      };
      renderDiagnosticState();
    }
  );
}

function requestStates() {
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:settings-state-request")
  );
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:opening-state-request")
  );
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:platform-state-request")
  );
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:accessibility-state-request")
  );
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:diagnostic-state-request")
  );
  renderAccessibilitySettings();
  renderDiagnosticState();
}

function openSettings() {
  const el = elements();

  requestStates();
  selectSection("game");
  el.page.hidden = false;
  document.body.classList.add("settings-open");
}

function closeSettings() {
  const el = elements();
  if (el.page.hidden) {
    return;
  }

  el.page.hidden = true;
  document.body.classList.remove("settings-open");
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
  renderOpeningPreference();

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

function renderOpeningPreference() {
  const control = elements().opening;
  if (control) {
    control.checked = state.opening.showOnLaunch;
  }
}

function submitOpeningPreference() {
  const showOnLaunch = elements().opening?.checked === true;
  state.opening = {
    ...state.opening,
    showOnLaunch
  };
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:opening-preference-change", {
      detail: { showOnLaunch }
    })
  );
  setStatus("Opening preference saved.");
}

function replayOpening() {
  closeSettings();
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:opening-replay")
  );
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
  recordDiagnostic("backup_export_requested", {
    storageKeyCount: Object.keys(backup.storageValues).length
  });
  setStatus("Player backup export requested.");
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
    applyPlayerRestorePlanSafely(localStorage, plan);
    recordDiagnostic("backup_restore_success", {
      encodedBytes: validation.encodedBytes
    });
    globalThis.location.reload();
  } catch (error) {
    recordDiagnostic("backup_restore_failed", {
      message: String(error?.message ?? "invalid backup").slice(0, 120)
    });
    setStatus(
      error instanceof SyntaxError
        ? "The selected backup is not valid JSON."
        : "The backup could not be restored. Existing progress was kept."
    );
  }
}

function exportTesterReport() {
  const report =
    globalThis.PaperFlockDiagnostics?.downloadReport?.();
  if (!report) {
    setStatus("The tester report is not available yet.");
    return;
  }
  setStatus(
    `Tester report export requested with ${report.diagnostics.eventCount} local events.`
  );
}

function clearTesterReport() {
  const confirmed = globalThis.confirm(
    "Clear the local tester event history? Player progress will not be changed."
  );
  if (!confirmed) {
    return;
  }

  globalThis.PaperFlockDiagnostics?.clear?.();
  setStatus("Local tester event history cleared.");
}

function renderDiagnosticState() {
  const el = elements();
  if (!el.diagnosticSummary) {
    return;
  }

  const count = Math.max(
    0,
    Number(state.diagnostics.eventCount) || 0
  );
  el.diagnosticSummary.textContent =
    count === 0
      ? "No local test events recorded yet."
      : `${count} privacy-safe test event${count === 1 ? "" : "s"} stored locally.`;
}

function recordDiagnostic(name, data = {}) {
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:diagnostic", {
      detail: { name, data }
    })
  );
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
  const content = JSON.stringify(payload, null, 2);
  if (globalThis.PaperFlockAndroid?.saveTextFile) {
    globalThis.PaperFlockAndroid.saveTextFile(filename, content);
    return;
  }

  const blob = new Blob(
    [content],
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
