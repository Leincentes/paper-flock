import {
  createClosedTestReport,
  normalizeDiagnostics,
  recordDiagnosticEvent,
  summarizeDiagnostics
} from "./diagnostics-core.js";
import {
  STORAGE_KEYS,
  parseEnvelope,
  storageHealth
} from "./storage-player-core.js";

const BUILD_VERSION = "1.6.0";
const SAFE_MODE_KEY = "paper-flock-safe-start";
const SESSION_KEY = "paper-flock-diagnostic-session";

function readSession(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Session metadata is optional.
  }
}

function removeSession(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Session metadata is optional.
  }
}

let diagnostics = loadDiagnostics();
const session = getSessionId();

exposeApi();
wireDiagnostics();
consumeNativeDiagnostic();
showSafeModeNotice();
record("app_module_loaded", {
  buildVersion: BUILD_VERSION
});

function getSessionId() {
  const current = readSession(SESSION_KEY);
  if (current) {
    return current;
  }

  const created = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  writeSession(SESSION_KEY, created);
  return created;
}

function loadDiagnostics() {
  try {
    return normalizeDiagnostics(
      JSON.parse(
        localStorage.getItem(STORAGE_KEYS.diagnostics) || "{}"
      )
    );
  } catch {
    return normalizeDiagnostics({});
  }
}

function persistDiagnostics() {
  try {
    localStorage.setItem(
      STORAGE_KEYS.diagnostics,
      JSON.stringify(diagnostics)
    );
  } catch {
    // Diagnostics must never block gameplay when storage is unavailable.
  }
}

function record(name, detail = {}) {
  diagnostics = recordDiagnosticEvent(
    diagnostics,
    name,
    detail,
    { session }
  );
  persistDiagnostics();
  emitState();
}

function clear() {
  diagnostics = normalizeDiagnostics({});
  try {
    localStorage.removeItem(STORAGE_KEYS.diagnostics);
  } catch {
    // Clearing diagnostics is best effort.
  }
  emitState();
}

function snapshot() {
  return normalizeDiagnostics(diagnostics);
}

function emitState() {
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:diagnostic-state", {
      detail: summarizeDiagnostics(diagnostics)
    })
  );
}

function progressSnapshot() {
  const primary = parseEnvelope(
    localStorage.getItem(STORAGE_KEYS.save)
  );
  const backup = parseEnvelope(
    localStorage.getItem(STORAGE_KEYS.saveBackup)
  );
  const payload =
    primary.valid && primary.payload
      ? primary.payload
      : backup.valid && backup.payload
        ? backup.payload
        : {};
  const bestFeathers =
    payload.bestFeathers &&
    typeof payload.bestFeathers === "object"
      ? payload.bestFeathers
      : {};
  const stats =
    payload.playerStats &&
    typeof payload.playerStats === "object"
      ? payload.playerStats
      : {};

  return {
    currentLevel: payload.currentLevel,
    unlockedLevel: payload.unlockedLevel,
    completedLevels: Array.isArray(payload.completedLevels)
      ? payload.completedLevels.length
      : 0,
    masteredLevels: Object.values(bestFeathers)
      .filter((value) => Number(value) >= 3)
      .length,
    puzzleCompletions: stats.puzzleCompletions,
    totalMoves: stats.totalMoves,
    totalHints: stats.totalHints,
    totalRestarts: stats.totalRestarts,
    totalUndos: stats.totalUndos
  };
}

function createReport() {
  return createClosedTestReport({
    buildVersion: BUILD_VERSION,
    diagnostics,
    storageHealth: storageHealth(localStorage),
    progress: progressSnapshot(),
    runtime: {
      androidWrapper:
        navigator.userAgent.includes("PaperFlockAndroid/"),
      online: navigator.onLine,
      installed:
        navigator.userAgent.includes("PaperFlockAndroid/") ||
        globalThis.matchMedia?.("(display-mode: standalone)")
          .matches === true ||
        navigator.standalone === true,
      viewportWidth: globalThis.innerWidth,
      viewportHeight: globalThis.innerHeight,
      safeMode: readSession(SAFE_MODE_KEY) === "1"
    }
  });
}

function downloadReport() {
  const report = createReport();
  const content = JSON.stringify(report, null, 2);
  const filename =
    `paper-flock-v${BUILD_VERSION}-closed-test-report.json`;

  if (globalThis.PaperFlockAndroid?.saveTextFile) {
    globalThis.PaperFlockAndroid.saveTextFile(filename, content);
    record("test_report_export_requested", {
      platform: "android-wrapper"
    });
    return report;
  }

  const blob = new Blob([content], {
    type: "application/json"
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  record("test_report_export_requested", {
    platform: "web"
  });
  return report;
}

function exposeApi() {
  Object.defineProperty(globalThis, "PaperFlockDiagnostics", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      record,
      clear,
      snapshot,
      createReport,
      downloadReport,
      summary: () => summarizeDiagnostics(diagnostics)
    })
  });
}

function wireDiagnostics() {
  globalThis.addEventListener(
    "paperflock:diagnostic",
    (event) => {
      const detail = event.detail ?? {};
      record(detail.name ?? "unknown_event", detail.data ?? {});
    }
  );

  globalThis.addEventListener("paperflock:ready", () => {
    record("startup_success", {
      safeMode: readSession(SAFE_MODE_KEY) === "1"
    });
  });

  globalThis.addEventListener(
    "paperflock:startup-recovery",
    (event) => {
      record("startup_recovery_shown", event.detail ?? {});
    }
  );

  globalThis.addEventListener(
    "paperflock:diagnostic-state-request",
    emitState
  );

  globalThis.addEventListener("error", (event) => {
    record("page_error", {
      message: String(event.message ?? "unknown error").slice(0, 160)
    });
  });

  globalThis.addEventListener("unhandledrejection", (event) => {
    record("unhandled_rejection", {
      message: String(
        event.reason?.message ?? event.reason ?? "unknown rejection"
      ).slice(0, 160)
    });
  });
}

function consumeNativeDiagnostic() {
  try {
    const name =
      globalThis.PaperFlockAndroid?.consumeDiagnosticEvent?.();
    if (name) {
      record(String(name), {
        source: "android-wrapper"
      });
    }
  } catch {
    // Older wrappers do not provide this optional bridge method.
  }
}

function showSafeModeNotice() {
  if (readSession(SAFE_MODE_KEY) !== "1") {
    return;
  }

  const notice = document.createElement("aside");
  notice.className = "safe-mode-notice";
  notice.setAttribute("role", "status");

  const text = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = "Safe start is active. ";
  text.append(
    strong,
    "Progress is loaded temporarily and will not overwrite your saved game."
  );

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Exit safe start";
  button.addEventListener("click", () => {
    removeSession(SAFE_MODE_KEY);
    globalThis.location.reload();
  });

  notice.append(text, button);
  document.body.append(notice);
}
