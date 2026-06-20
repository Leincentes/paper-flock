import {
  STORAGE_KEYS,
  parseEnvelope
} from "./storage-player-core.js";

const BUILD_VERSION = "1.6.0";
const READY_TIMEOUT_MS = 8000;
const SAFE_MODE_KEY = "paper-flock-safe-start";
let ready = false;

function writeSafeMode(value) {
  try {
    if (value) {
      sessionStorage.setItem(SAFE_MODE_KEY, "1");
    } else {
      sessionStorage.removeItem(SAFE_MODE_KEY);
    }
  } catch {
    // Safe-start state is optional when session storage is unavailable.
  }
}

injectRecoveryInterface();

globalThis.addEventListener("paperflock:ready", () => {
  ready = true;
  hideRecovery();
}, { once: true });

globalThis.setTimeout(() => {
  if (!ready) {
    showRecovery(
      "Paper Flock did not finish starting. Your local progress has not been deleted.",
      "startup_timeout"
    );
  }
}, READY_TIMEOUT_MS);

globalThis.addEventListener("error", (event) => {
  if (!ready) {
    showRecovery(
      `A startup error occurred: ${String(
        event.message || "unknown error"
      ).slice(0, 180)}`,
      "startup_error"
    );
  }
});

globalThis.addEventListener("unhandledrejection", (event) => {
  if (!ready) {
    showRecovery(
      "A startup task failed. Retry, restore the recovery save, or start temporarily without changing progress.",
      "startup_rejection",
      {
        message: String(
          event.reason?.message ?? event.reason ?? "unknown rejection"
        ).slice(0, 160)
      }
    );
  }
});

function injectRecoveryInterface() {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="boot-recovery" id="boot-recovery" hidden>
        <section
          class="boot-recovery-panel"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="boot-recovery-title"
          aria-describedby="boot-recovery-message"
        >
          <span class="boot-recovery-kicker">
            Paper Flock v${BUILD_VERSION}
          </span>
          <h2 id="boot-recovery-title">Startup recovery</h2>
          <p id="boot-recovery-message">
            Paper Flock is taking longer than expected to start.
          </p>
          <div class="boot-recovery-actions">
            <button
              class="primary-button"
              id="boot-recovery-reload"
              type="button"
            >
              Retry startup
            </button>
            <button
              class="secondary-button"
              id="boot-recovery-restore"
              type="button"
            >
              Restore recovery save
            </button>
            <button
              class="secondary-button"
              id="boot-recovery-safe"
              type="button"
            >
              Start without changing progress
            </button>
            <button
              class="secondary-button"
              id="boot-recovery-report"
              type="button"
            >
              Export tester report
            </button>
            <button
              class="secondary-button"
              id="boot-recovery-export"
              type="button"
            >
              Export raw recovery data
            </button>
            <button
              class="secondary-button"
              id="boot-recovery-cache"
              type="button"
            >
              Refresh app cache
            </button>
          </div>
          <p class="boot-recovery-status" id="boot-recovery-status"></p>
        </section>
      </div>
    `
  );

  document
    .querySelector("#boot-recovery-reload")
    ?.addEventListener("click", retryStartup);

  document
    .querySelector("#boot-recovery-restore")
    ?.addEventListener("click", restoreRecoverySave);

  document
    .querySelector("#boot-recovery-safe")
    ?.addEventListener("click", startSafeMode);

  document
    .querySelector("#boot-recovery-report")
    ?.addEventListener("click", exportTesterReport);

  document
    .querySelector("#boot-recovery-export")
    ?.addEventListener("click", exportRecoveryData);

  document
    .querySelector("#boot-recovery-cache")
    ?.addEventListener("click", refreshCache);
}

function showRecovery(message, reason = "startup_recovery", data = {}) {
  const overlay = document.querySelector("#boot-recovery");
  const text = document.querySelector("#boot-recovery-message");
  if (!overlay || !text) {
    return;
  }

  text.textContent = message;
  overlay.hidden = false;
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:startup-recovery", {
      detail: {
        reason,
        ...data
      }
    })
  );
  document
    .querySelector("#boot-recovery-reload")
    ?.focus();
}

function hideRecovery() {
  const overlay = document.querySelector("#boot-recovery");
  if (overlay) {
    overlay.hidden = true;
  }
}

function retryStartup() {
  writeSafeMode(false);
  globalThis.location.reload();
}

function restoreRecoverySave() {
  const status = document.querySelector("#boot-recovery-status");
  const raw = localStorage.getItem(STORAGE_KEYS.saveBackup);
  const parsed = parseEnvelope(raw);

  if (!parsed.valid || typeof raw !== "string") {
    status.textContent =
      "No valid recovery save is available. Export recovery data before trying other options.";
    emitDiagnostic("recovery_save_unavailable", {
      reason: parsed.reason
    });
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEYS.save, raw);
    writeSafeMode(false);
    emitDiagnostic("recovery_save_restored", {
      savedAt: parsed.savedAt || "unknown"
    });
    status.textContent = "Recovery save restored. Restarting…";
    globalThis.setTimeout(() => globalThis.location.reload(), 100);
  } catch {
    status.textContent =
      "The recovery save could not be restored. Existing data was not deleted.";
    emitDiagnostic("recovery_save_restore_failed");
  }
}

function startSafeMode() {
  writeSafeMode(true);
  emitDiagnostic("safe_start_requested");
  globalThis.location.reload();
}

function exportTesterReport() {
  const report =
    globalThis.PaperFlockDiagnostics?.downloadReport?.();
  const status = document.querySelector("#boot-recovery-status");
  status.textContent = report
    ? "Tester report export requested."
    : "Tester report is not available. Use raw recovery export instead.";
}

function exportRecoveryData() {
  const storageValues = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("paper-flock")) {
      storageValues[key] = localStorage.getItem(key);
    }
  }

  const payload = {
    product: "Paper Flock",
    buildVersion: BUILD_VERSION,
    exportedAt: new Date().toISOString(),
    kind: "startup-recovery",
    warning:
      "Contains raw local Paper Flock data. Share only with a trusted tester or developer.",
    storageValues
  };
  const content = JSON.stringify(payload, null, 2);
  const filename =
    `paper-flock-v${BUILD_VERSION}-startup-recovery.json`;

  if (globalThis.PaperFlockAndroid?.saveTextFile) {
    globalThis.PaperFlockAndroid.saveTextFile(filename, content);
    emitDiagnostic("raw_recovery_export_requested", {
      platform: "android-wrapper"
    });
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
  emitDiagnostic("raw_recovery_export_requested", {
    platform: "web"
  });
}

async function refreshCache() {
  const status = document.querySelector("#boot-recovery-status");
  try {
    if ("serviceWorker" in navigator) {
      const registrations =
        await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.update();
      }
    }
    if ("caches" in globalThis) {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) =>
            name.startsWith("paper-flock-static-")
          )
          .map((name) => caches.delete(name))
      );
    }
    status.textContent =
      "App cache refreshed. Reload while connected to the internet.";
    emitDiagnostic("app_cache_refresh_success");
  } catch {
    status.textContent =
      "The app cache could not be refreshed automatically.";
    emitDiagnostic("app_cache_refresh_failed");
  }
}

function emitDiagnostic(name, data = {}) {
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:diagnostic", {
      detail: { name, data }
    })
  );
}
