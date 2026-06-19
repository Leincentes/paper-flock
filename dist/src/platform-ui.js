import {
  STORAGE_KEYS,
  migrateLegacyStorage,
  storageHealth
} from "./storage-core.js";

import {
  MANAGED_STORAGE_KEYS,
  PLATFORM_BUILD_VERSION,
  appendErrorRecord,
  createBackup,
  createDiagnostics,
  createRestorePlan,
  detectDisplayMode,
  isIosLike,
  isSecureAppContext,
  sanitizeErrorRecord,
  validateBackup
} from "./platform-core.js";

const ERROR_KEY = STORAGE_KEYS.errors;
const CACHE_PREFIX = "paper-flock-static-";

const storageMigration = migrateLegacyStorage(localStorage);

const state = {
  deferredInstallPrompt: null,
  registration: null,
  waitingWorker: null,
  errorRecords: loadErrorRecords(),
  secureContext: isSecureAppContext(globalThis.location)
};

injectPlatformInterface();
wirePlatformInterface();
captureClientErrors();
updateNetworkStatus();
initializePlatform();

function loadErrorRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ERROR_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.map(sanitizeErrorRecord).slice(-50)
      : [];
  } catch {
    return [];
  }
}

function saveErrorRecords() {
  localStorage.setItem(ERROR_KEY, JSON.stringify(state.errorRecords));
  updatePlatformSummary();
}

function recordClientError(record) {
  state.errorRecords = appendErrorRecord(state.errorRecords, record);
  saveErrorRecords();
}

function captureClientErrors() {
  globalThis.addEventListener("error", (event) => {
    recordClientError({
      type: "error",
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack
    });
  });

  globalThis.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    recordClientError({
      type: "unhandledrejection",
      message:
        reason instanceof Error
          ? reason.message
          : String(reason ?? "Unhandled promise rejection"),
      stack: reason instanceof Error ? reason.stack : ""
    });
  });
}

function injectPlatformInterface() {
  const hero = document.querySelector(".hero");
  hero?.insertAdjacentHTML(
    "afterend",
    `
      <aside class="platform-status" id="platform-status" hidden>
        <span class="platform-network" id="platform-network-status">
          Online
        </span>
        <button
          class="platform-action-button"
          id="platform-install-button"
          type="button"
          hidden
        >
          Install
        </button>
        <button
          class="platform-action-button platform-update-button"
          id="platform-update-button"
          type="button"
          hidden
        >
          Update ready
        </button>
      </aside>
    `
  );

  const toolBody = document.querySelector(".prototype-tools .tool-body");
  toolBody?.insertAdjacentHTML(
    "beforeend",
    `
      <section class="platform-tool-section" aria-labelledby="platform-tools-title">
        <h3 id="platform-tools-title">App, backup, and diagnostics</h3>
        <p id="platform-tool-summary">
          Build v${PLATFORM_BUILD_VERSION}. Closed alpha remains blocked until
          real field evidence passes.
        </p>
        <div class="tool-buttons">
          <button
            class="secondary-button"
            id="platform-backup-button"
            type="button"
          >
            Backup app data
          </button>
          <button
            class="secondary-button"
            id="platform-restore-button"
            type="button"
          >
            Restore app data
          </button>
          <button
            class="secondary-button"
            id="platform-diagnostics-button"
            type="button"
          >
            Export diagnostics
          </button>
          <button
            class="secondary-button"
            id="platform-clear-cache-button"
            type="button"
          >
            Refresh offline cache
          </button>
          <input
            id="platform-restore-input"
            type="file"
            accept="application/json,.json"
            hidden
          >
        </div>
        <p class="platform-tool-status" id="platform-tool-status" aria-live="polite"></p>
      </section>
    `
  );

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="platform-modal" id="platform-install-help" hidden>
        <section
          class="platform-modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="platform-install-title"
        >
          <span class="platform-modal-kicker">Install Paper Flock</span>
          <h2 id="platform-install-title">Add it to your Home Screen</h2>
          <div id="platform-install-instructions"></div>
          <button
            class="primary-button full-width"
            id="platform-install-close"
            type="button"
          >
            Done
          </button>
        </section>
      </div>
    `
  );
}

function elements() {
  return {
    status: document.querySelector("#platform-status"),
    network: document.querySelector("#platform-network-status"),
    install: document.querySelector("#platform-install-button"),
    update: document.querySelector("#platform-update-button"),
    backup: document.querySelector("#platform-backup-button"),
    restore: document.querySelector("#platform-restore-button"),
    restoreInput: document.querySelector("#platform-restore-input"),
    diagnostics: document.querySelector("#platform-diagnostics-button"),
    clearCache: document.querySelector("#platform-clear-cache-button"),
    toolSummary: document.querySelector("#platform-tool-summary"),
    toolStatus: document.querySelector("#platform-tool-status"),
    installHelp: document.querySelector("#platform-install-help"),
    installInstructions: document.querySelector(
      "#platform-install-instructions"
    ),
    installClose: document.querySelector("#platform-install-close")
  };
}

function wirePlatformInterface() {
  const el = elements();

  globalThis.addEventListener("online", updateNetworkStatus);
  globalThis.addEventListener("offline", updateNetworkStatus);

  globalThis.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    document.documentElement.dataset.installPromptAvailable = "true";
    globalThis.dispatchEvent(
      new CustomEvent("paperflock:install-prompt-available")
    );
    el.install.hidden = false;
    el.install.textContent = "Install";
    refreshStatusVisibility();
  });

  globalThis.addEventListener("appinstalled", () => {
    state.deferredInstallPrompt = null;
    el.install.hidden = true;
    setToolStatus("Paper Flock was installed.");
    refreshStatusVisibility();
  });

  el.install?.addEventListener("click", requestInstall);
  el.update?.addEventListener("click", applyWaitingUpdate);
  el.backup?.addEventListener("click", exportBackup);
  el.restore?.addEventListener("click", () => el.restoreInput.click());
  el.restoreInput?.addEventListener("change", restoreBackup);
  el.diagnostics?.addEventListener("click", exportDiagnostics);
  el.clearCache?.addEventListener("click", refreshOfflineCache);
  el.installClose?.addEventListener("click", closeInstallHelp);
  el.installHelp?.addEventListener("click", (event) => {
    if (event.target === el.installHelp) {
      closeInstallHelp();
    }
  });
}

async function initializePlatform() {
  configureManualInstall();

  if (!state.secureContext) {
    setToolStatus(
      "Offline installation needs HTTPS or localhost. The game still runs normally."
    );
    updatePlatformSummary();
    return;
  }

  if (!("serviceWorker" in navigator)) {
    setToolStatus("This browser does not support offline service workers.");
    updatePlatformSummary();
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "./service-worker.js",
      {
        scope: "./",
        type: "classic"
      }
    );
    state.registration = registration;
    inspectRegistration(registration);

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) {
        return;
      }
      worker.addEventListener("statechange", () => {
        if (
          worker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          state.waitingWorker = registration.waiting ?? worker;
          showUpdateReady();
        }
      });
    });

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => globalThis.location.reload()
    );

    await navigator.serviceWorker.ready;
    setToolStatus("Offline app shell is ready.");
  } catch (error) {
    recordClientError({
      type: "service-worker-registration",
      message: error.message,
      stack: error.stack
    });
    setToolStatus("Offline setup failed; normal online play still works.");
  }

  updatePlatformSummary();
}

function inspectRegistration(registration) {
  if (registration.waiting) {
    state.waitingWorker = registration.waiting;
    showUpdateReady();
  }
}

function showUpdateReady() {
  const el = elements();
  el.update.hidden = false;
  refreshStatusVisibility();
  setToolStatus(
    "A newer Paper Flock build is ready. Update after finishing the current puzzle."
  );
}

function applyWaitingUpdate() {
  if (!state.waitingWorker) {
    state.registration?.update();
    return;
  }
  state.waitingWorker.postMessage({ type: "SKIP_WAITING" });
}

function standaloneMode() {
  return detectDisplayMode({
    standaloneMedia:
      globalThis.matchMedia?.("(display-mode: standalone)").matches ?? false,
    navigatorStandalone: navigator.standalone === true
  });
}

function configureManualInstall() {
  const el = elements();
  if (standaloneMode() === "standalone") {
    el.install.hidden = true;
    return;
  }

  const ios = isIosLike({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints
  });

  if (ios) {
    el.install.hidden = false;
    el.install.textContent = "Add to Home Screen";
    refreshStatusVisibility();
  }
}

async function requestInstall() {
  if (state.deferredInstallPrompt) {
    const prompt = state.deferredInstallPrompt;
    state.deferredInstallPrompt = null;
    await prompt.prompt();
    await prompt.userChoice;
    elements().install.hidden = true;
    refreshStatusVisibility();
    return;
  }

  showInstallHelp();
}

function showInstallHelp() {
  const el = elements();
  const ios = isIosLike({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints
  });

  el.installInstructions.innerHTML = ios
    ? `
      <ol>
        <li>Open this page in Safari.</li>
        <li>Tap the Share button.</li>
        <li>Choose <strong>Add to Home Screen</strong>.</li>
        <li>Turn on <strong>Open as Web App</strong> when shown.</li>
        <li>Confirm <strong>Add</strong>.</li>
      </ol>
      <p>Your progress stays on this device.</p>
    `
    : `
      <p>
        Open the browser menu and choose <strong>Install app</strong> or
        <strong>Add to Home Screen</strong>. Installation is available only on
        HTTPS or localhost.
      </p>
    `;

  el.installHelp.hidden = false;
  el.installClose.focus();
}

function closeInstallHelp() {
  const el = elements();
  el.installHelp.hidden = true;
  el.install.focus();
}

function updateNetworkStatus() {
  const el = elements();
  const online = navigator.onLine;
  el.network.textContent = online ? "Online" : "Offline";
  el.network.classList.toggle("offline", !online);
  refreshStatusVisibility();
}

function refreshStatusVisibility() {
  const el = elements();
  const hasAction = !el.install.hidden || !el.update.hidden;
  el.status.hidden = navigator.onLine && !hasAction;
}

function readManagedValues() {
  return Object.fromEntries(
    MANAGED_STORAGE_KEYS.map((key) => [key, localStorage.getItem(key)])
  );
}

function exportBackup() {
  const backup = createBackup({
    buildVersion: PLATFORM_BUILD_VERSION,
    storageValues: readManagedValues()
  });
  downloadBlob(
    `paper-flock-v${PLATFORM_BUILD_VERSION}-backup-${dateStamp()}.json`,
    "application/json",
    JSON.stringify(backup, null, 2)
  );
  setToolStatus("Backup downloaded. Store it somewhere private.");
}

async function restoreBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) {
    return;
  }

  try {
    const payload = JSON.parse(await file.text());
    const validation = validateBackup(payload);
    if (!validation.valid) {
      throw new Error(validation.problems.join(" "));
    }

    const plan = createRestorePlan(readManagedValues(), payload);
    const confirmed = globalThis.confirm(
      "Replace this browser's Paper Flock progress and local test data with the selected backup?"
    );
    if (!confirmed) {
      return;
    }

    for (const key of plan.removals) {
      localStorage.removeItem(key);
    }
    for (const [key, value] of Object.entries(plan.writes)) {
      localStorage.setItem(key, value);
    }

    globalThis.location.reload();
  } catch (error) {
    recordClientError({
      type: "backup-restore",
      message: error.message,
      stack: error.stack
    });
    setToolStatus(`Restore failed: ${error.message}`);
  }
}

async function exportDiagnostics() {
  const estimate = navigator.storage?.estimate
    ? await navigator.storage.estimate()
    : {};
  const registration = state.registration;

  const diagnostics = createDiagnostics({
    buildVersion: PLATFORM_BUILD_VERSION,
    location: globalThis.location,
    navigatorInfo: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      maxTouchPoints: navigator.maxTouchPoints,
      onLine: navigator.onLine,
      reducedMotion:
        globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
        false
    },
    displayMode: standaloneMode(),
    serviceWorker: {
      supported: "serviceWorker" in navigator,
      controlled: Boolean(navigator.serviceWorker?.controller),
      active: Boolean(registration?.active),
      waiting: Boolean(registration?.waiting),
      scope: registration?.scope ?? ""
    },
    storage: estimate,
    errorRecords: state.errorRecords
  });
  diagnostics.saveIntegrity = storageHealth(localStorage);
  diagnostics.storageMigration = storageMigration;

  downloadBlob(
    `paper-flock-v${PLATFORM_BUILD_VERSION}-diagnostics-${dateStamp()}.json`,
    "application/json",
    JSON.stringify(diagnostics, null, 2)
  );
  setToolStatus("Diagnostics downloaded. No file was uploaded automatically.");
}

async function refreshOfflineCache() {
  try {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "CLEAR_CACHES"
      });
    } else if ("caches" in globalThis) {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX))
          .map((name) => caches.delete(name))
      );
    }

    await state.registration?.update();
    setToolStatus(
      "Offline cache refresh requested. Reload once while online."
    );
  } catch (error) {
    recordClientError({
      type: "cache-refresh",
      message: error.message,
      stack: error.stack
    });
    setToolStatus("Could not refresh the offline cache.");
  }
}

function updatePlatformSummary() {
  const el = elements();
  if (!el.toolSummary) {
    return;
  }

  const display = standaloneMode();
  const errorCount = state.errorRecords.length;
  el.toolSummary.textContent =
    `Build v${PLATFORM_BUILD_VERSION} · ${display} mode · ` +
    `${errorCount} local client error${errorCount === 1 ? "" : "s"} · ` +
    `${storageHealth(localStorage).primaryValid ? "save healthy" : "save recovery available"} · ` +
    "closed alpha blocked until real field evidence passes.";
}

function setToolStatus(message) {
  const el = elements();
  if (el.toolStatus) {
    el.toolStatus.textContent = message;
  }
}

function dateStamp() {
  return new Date().toISOString().replaceAll(":", "-").slice(0, 19);
}

function downloadBlob(filename, type, content) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
