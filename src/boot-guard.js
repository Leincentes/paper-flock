const BUILD_VERSION = "0.21";
const READY_TIMEOUT_MS = 8000;
let ready = false;

injectRecoveryInterface();

globalThis.addEventListener("paperflock:ready", () => {
  ready = true;
  hideRecovery();
}, { once: true });

globalThis.setTimeout(() => {
  if (!ready) {
    showRecovery(
      "Paper Flock did not finish starting. Your local progress has not been deleted."
    );
  }
}, READY_TIMEOUT_MS);

globalThis.addEventListener("error", (event) => {
  if (!ready) {
    showRecovery(
      `A startup error occurred: ${String(event.message || "unknown error").slice(0, 180)}`
    );
  }
});

globalThis.addEventListener("unhandledrejection", () => {
  if (!ready) {
    showRecovery(
      "A startup task failed. Reload or export local recovery data."
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
              Reload app
            </button>
            <button
              class="secondary-button"
              id="boot-recovery-export"
              type="button"
            >
              Export local recovery data
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
    ?.addEventListener("click", () => globalThis.location.reload());

  document
    .querySelector("#boot-recovery-export")
    ?.addEventListener("click", exportRecoveryData);

  document
    .querySelector("#boot-recovery-cache")
    ?.addEventListener("click", refreshCache);
}

function showRecovery(message) {
  const overlay = document.querySelector("#boot-recovery");
  const text = document.querySelector("#boot-recovery-message");
  if (!overlay || !text) {
    return;
  }
  text.textContent = message;
  overlay.hidden = false;
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
    storageValues
  };
  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: "application/json" }
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download =
    `paper-flock-v${BUILD_VERSION}-startup-recovery.json`;
  link.click();
  URL.revokeObjectURL(link.href);
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
  } catch {
    status.textContent =
      "The app cache could not be refreshed automatically.";
  }
}
