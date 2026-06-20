export const DIAGNOSTICS_SCHEMA_VERSION = 1;
export const MAX_DIAGNOSTIC_EVENTS = 200;
export const MAX_DIAGNOSTIC_AGE_DAYS = 30;

const BLOCKED_DETAIL_KEYS = new Set([
  "email",
  "name",
  "filename",
  "path",
  "url",
  "content",
  "storage",
  "storagevalues",
  "raw",
  "board",
  "history",
  "checkpoint",
  "userid",
  "deviceid",
  "advertisingid",
  "datekey"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, maximum = 160) {
  return String(value ?? "")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/file:\/\/\S+/gi, "[local-path]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function safeNumber(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function sanitizeValue(value, depth = 0) {
  if (depth > 2 || value === null || value === undefined) {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return safeNumber(value);
  }
  if (typeof value === "string") {
    return cleanText(value);
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 12)
      .map((item) => sanitizeValue(item, depth + 1))
      .filter((item) => item !== null);
  }
  if (typeof value === "object") {
    const result = {};
    for (const [key, item] of Object.entries(value).slice(0, 20)) {
      const normalizedKey = cleanText(key, 48);
      if (
        !normalizedKey ||
        BLOCKED_DETAIL_KEYS.has(normalizedKey.toLowerCase())
      ) {
        continue;
      }
      const sanitized = sanitizeValue(item, depth + 1);
      if (sanitized !== null) {
        result[normalizedKey] = sanitized;
      }
    }
    return result;
  }
  return null;
}

function validTimestamp(value) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : null;
}

export function normalizeDiagnosticEvent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const name = cleanText(value.name, 64)
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "_");
  const at = validTimestamp(value.at);
  if (!name || !at) {
    return null;
  }

  return {
    at,
    name,
    session: cleanText(value.session, 72),
    detail: sanitizeValue(value.detail) ?? {}
  };
}

export function normalizeDiagnostics(value, {
  now = Date.now()
} = {}) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  const cutoff =
    now - MAX_DIAGNOSTIC_AGE_DAYS * 24 * 60 * 60 * 1000;
  const events = Array.isArray(source.events)
    ? source.events
        .map(normalizeDiagnosticEvent)
        .filter(Boolean)
        .filter((event) => Date.parse(event.at) >= cutoff)
        .slice(-MAX_DIAGNOSTIC_EVENTS)
    : [];

  return {
    schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
    createdAt:
      validTimestamp(source.createdAt) ??
      new Date(now).toISOString(),
    updatedAt:
      validTimestamp(source.updatedAt) ??
      new Date(now).toISOString(),
    events
  };
}

export function recordDiagnosticEvent(
  diagnostics,
  name,
  detail = {},
  {
    at = new Date().toISOString(),
    session = ""
  } = {}
) {
  const normalized = normalizeDiagnostics(diagnostics);
  const event = normalizeDiagnosticEvent({
    at,
    name,
    session,
    detail
  });

  if (!event) {
    return normalized;
  }

  return {
    ...normalized,
    updatedAt: event.at,
    events: [
      ...normalized.events,
      event
    ].slice(-MAX_DIAGNOSTIC_EVENTS)
  };
}

export function summarizeDiagnostics(diagnostics) {
  const normalized = normalizeDiagnostics(diagnostics);
  const counts = {};

  for (const event of normalized.events) {
    counts[event.name] = (counts[event.name] ?? 0) + 1;
  }

  return {
    eventCount: normalized.events.length,
    firstEventAt: normalized.events[0]?.at ?? null,
    lastEventAt:
      normalized.events[normalized.events.length - 1]?.at ?? null,
    counts
  };
}

function screenBucket(width, height) {
  const shortest = Math.min(
    Number(width) || 0,
    Number(height) || 0
  );
  if (shortest < 360) {
    return "compact";
  }
  if (shortest < 600) {
    return "phone";
  }
  return "large-screen";
}

export function createClosedTestReport({
  buildVersion,
  diagnostics,
  storageHealth,
  progress = {},
  runtime = {},
  exportedAt = new Date().toISOString()
} = {}) {
  const normalized = normalizeDiagnostics(diagnostics);
  const summary = summarizeDiagnostics(normalized);

  return {
    schemaVersion: 1,
    product: "Paper Flock",
    kind: "closed-test-report",
    buildVersion: cleanText(buildVersion, 24),
    exportedAt: String(exportedAt),
    privacy:
      "Generated locally and shared only when the player chooses. " +
      "Contains no account, advertising ID, contacts, location, raw save, " +
      "puzzle board, or backup content.",
    runtime: {
      platform:
        runtime.androidWrapper === true
          ? "android-wrapper"
          : "web",
      online: runtime.online !== false,
      installed: runtime.installed === true,
      screenBucket: screenBucket(
        runtime.viewportWidth,
        runtime.viewportHeight
      ),
      orientation:
        Number(runtime.viewportWidth) > Number(runtime.viewportHeight)
          ? "landscape"
          : "portrait",
      safeMode: runtime.safeMode === true
    },
    storageHealth: {
      primaryValid: storageHealth?.primaryValid === true,
      primaryReason: cleanText(
        storageHealth?.primaryReason ?? "unknown",
        32
      ),
      backupValid: storageHealth?.backupValid === true,
      backupReason: cleanText(
        storageHealth?.backupReason ?? "unknown",
        32
      ),
      stableSavePresent:
        storageHealth?.stableSavePresent === true,
      legacySavePresent:
        storageHealth?.legacySavePresent === true
    },
    progress: {
      currentLevel: Math.max(1, Number(progress.currentLevel) || 1),
      unlockedLevel: Math.max(1, Number(progress.unlockedLevel) || 1),
      completedLevels: Math.max(
        0,
        Number(progress.completedLevels) || 0
      ),
      masteredLevels: Math.max(
        0,
        Number(progress.masteredLevels) || 0
      ),
      puzzleCompletions: Math.max(
        0,
        Number(progress.puzzleCompletions) || 0
      ),
      totalMoves: Math.max(0, Number(progress.totalMoves) || 0),
      totalHints: Math.max(0, Number(progress.totalHints) || 0),
      totalRestarts: Math.max(
        0,
        Number(progress.totalRestarts) || 0
      ),
      totalUndos: Math.max(0, Number(progress.totalUndos) || 0)
    },
    diagnostics: {
      ...summary,
      events: clone(normalized.events)
    }
  };
}
