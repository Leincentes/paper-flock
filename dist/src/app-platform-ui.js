const BUILD_VERSION = "1.2";
const state = {
  deferredPrompt: null,
  registration: null,
  waitingWorker: null,
  installed:
    globalThis.matchMedia?.("(display-mode: standalone)").matches === true ||
    navigator.standalone === true,
  online: navigator.onLine,
  reloading: false
};

initialize();

async function initialize() {
  wireEvents();
  await registerServiceWorker();
  emitState();
}

function wireEvents() {
  globalThis.addEventListener("online", () => {
    state.online = true;
    emitState();
  });
  globalThis.addEventListener("offline", () => {
    state.online = false;
    emitState();
  });

  globalThis.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    emitState();
  });

  globalThis.addEventListener("appinstalled", () => {
    state.deferredPrompt = null;
    state.installed = true;
    emitState();
  });

  navigator.serviceWorker?.addEventListener(
    "controllerchange",
    () => {
      if (state.reloading) {
        return;
      }
      state.reloading = true;
      globalThis.location.reload();
    }
  );

  globalThis.addEventListener(
    "paperflock:platform-state-request",
    emitState
  );
  globalThis.addEventListener(
    "paperflock:install-request",
    installApp
  );
  globalThis.addEventListener(
    "paperflock:update-request",
    applyUpdate
  );
}

async function registerServiceWorker() {
  if (
    !("serviceWorker" in navigator) ||
    !globalThis.isSecureContext
  ) {
    emitState();
    return;
  }

  try {
    state.registration = await navigator.serviceWorker.register(
      "./service-worker.js",
      { scope: "./" }
    );

    if (state.registration.waiting) {
      state.waitingWorker = state.registration.waiting;
    }

    state.registration.addEventListener("updatefound", () => {
      const worker = state.registration.installing;
      worker?.addEventListener("statechange", () => {
        if (
          worker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          state.waitingWorker =
            state.registration.waiting ?? worker;
          emitState();
        }
      });
    });

    await state.registration.update();
  } catch {
    // The game remains playable without installation support.
  }

  emitState();
}

async function installApp() {
  if (!state.deferredPrompt) {
    emitState();
    return;
  }

  const prompt = state.deferredPrompt;
  state.deferredPrompt = null;
  await prompt.prompt();

  try {
    const choice = await prompt.userChoice;
    state.installed = choice?.outcome === "accepted";
  } catch {
    // Some browsers do not expose a userChoice result.
  }

  emitState();
}

function applyUpdate() {
  state.waitingWorker?.postMessage({
    type: "SKIP_WAITING"
  });
}

function emitState() {
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:platform-state", {
      detail: {
        buildVersion: BUILD_VERSION,
        online: state.online,
        installed: state.installed,
        installAvailable: Boolean(state.deferredPrompt),
        updateAvailable: Boolean(state.waitingWorker)
      }
    })
  );
}
