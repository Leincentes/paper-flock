import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS
} from "./storage-core.js";

export const PLATFORM_BUILD_VERSION = "1.2";
export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export const MAX_ERROR_RECORDS = 50;

export const MANAGED_STORAGE_KEYS = Object.freeze([
  STORAGE_KEYS.save,
  STORAGE_KEYS.saveBackup,
  STORAGE_KEYS.events,
  STORAGE_KEYS.research,
  STORAGE_KEYS.visualResearch,
  STORAGE_KEYS.tactileResearch,
  STORAGE_KEYS.errors,
  STORAGE_KEYS.installCertification,
  STORAGE_KEYS.mobileCertification,
  STORAGE_KEYS.betaDisclosure,
  STORAGE_KEYS.betaFeedback,
  STORAGE_KEYS.betaOperations,
  STORAGE_KEYS.accessibility,
  STORAGE_KEYS.accessibilityCertification,
  STORAGE_KEYS.performanceHistory,
  STORAGE_KEYS.releaseAcknowledgement,
  STORAGE_KEYS.qualityEvidence,
  STORAGE_KEYS.productionApproval,
  STORAGE_KEYS.tutorial
]);

const LEGACY_TO_STABLE = Object.freeze(
  Object.fromEntries([
    ...LEGACY_STORAGE_KEYS.save.map((key) => [key, STORAGE_KEYS.save]),
    ...LEGACY_STORAGE_KEYS.events.map((key) => [key, STORAGE_KEYS.events]),
    ...LEGACY_STORAGE_KEYS.research.map((key) => [key, STORAGE_KEYS.research]),
    ...LEGACY_STORAGE_KEYS.visualResearch.map(
      (key) => [key, STORAGE_KEYS.visualResearch]
    ),
    ...LEGACY_STORAGE_KEYS.tactileResearch.map(
      (key) => [key, STORAGE_KEYS.tactileResearch]
    ),
    ...LEGACY_STORAGE_KEYS.errors.map((key) => [key, STORAGE_KEYS.errors])
  ])
);

const ACCEPTED_BACKUP_KEYS = Object.freeze([
  ...MANAGED_STORAGE_KEYS,
  ...Object.keys(LEGACY_TO_STABLE)
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Unknown";
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function isLocalDevelopment(locationLike = {}) {
  const hostname = String(locationLike.hostname ?? "");
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

export function isSecureAppContext(locationLike = {}) {
  return (
    String(locationLike.protocol ?? "") === "https:" ||
    isLocalDevelopment(locationLike)
  );
}

export function isIosLike({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0
} = {}) {
  const ua = String(userAgent);
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (String(platform) === "MacIntel" && Number(maxTouchPoints) > 1)
  );
}

export function isAndroidLike({ userAgent = "" } = {}) {
  return /Android/i.test(String(userAgent));
}

export function detectDisplayMode({
  standaloneMedia = false,
  navigatorStandalone = false
} = {}) {
  return standaloneMedia || navigatorStandalone
    ? "standalone"
    : "browser";
}

export function sanitizeSource(value) {
  const source = String(value ?? "").trim();
  if (!source) {
    return "";
  }

  try {
    const url = new URL(source, "https://paper-flock.invalid/");
    return `${url.origin}${url.pathname}`;
  } catch {
    return source.split("?")[0].split("#")[0].slice(0, 300);
  }
}

export function sanitizeErrorRecord(record = {}) {
  const message = String(
    record.message ?? record.reason ?? "Unknown client error"
  )
    .replace(/\s+/g, " ")
    .slice(0, 500);

  const stack = String(record.stack ?? "")
    .replace(/https?:\/\/[^\s)]+/g, (url) => sanitizeSource(url))
    .slice(0, 2500);

  return {
    occurredAt: String(
      record.occurredAt ?? new Date().toISOString()
    ),
    type: String(record.type ?? "error").slice(0, 40),
    message,
    source: sanitizeSource(record.source),
    line: Number.isFinite(record.line) ? Number(record.line) : null,
    column: Number.isFinite(record.column) ? Number(record.column) : null,
    stack
  };
}

export function appendErrorRecord(
  records = [],
  record,
  maximum = MAX_ERROR_RECORDS
) {
  return [
    ...records.map(sanitizeErrorRecord),
    sanitizeErrorRecord(record)
  ].slice(-maximum);
}

export function createBackup({
  buildVersion = PLATFORM_BUILD_VERSION,
  exportedAt = new Date().toISOString(),
  storageValues = {}
} = {}) {
  const values = {};

  for (const key of MANAGED_STORAGE_KEYS) {
    const value = storageValues[key];
    if (typeof value === "string") {
      values[key] = value;
    }
  }

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    product: "Paper Flock",
    buildVersion: String(buildVersion),
    exportedAt: String(exportedAt),
    storageValues: values
  };
}

export function validateBackup(payload) {
  const problems = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      valid: false,
      problems: ["Backup must be a JSON object."]
    };
  }

  if (payload.product !== "Paper Flock") {
    problems.push("Backup product is not Paper Flock.");
  }

  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    problems.push("Unsupported backup schema version.");
  }

  if (
    !payload.storageValues ||
    typeof payload.storageValues !== "object" ||
    Array.isArray(payload.storageValues)
  ) {
    problems.push("Backup storage values are missing.");
  } else {
    for (const [key, value] of Object.entries(payload.storageValues)) {
      if (!ACCEPTED_BACKUP_KEYS.includes(key)) {
        problems.push(`Unsupported storage key: ${key}`);
      }
      if (typeof value !== "string") {
        problems.push(`Storage value for ${key} must be a string.`);
      }
    }
  }

  const encodedBytes = new TextEncoder().encode(
    JSON.stringify(payload)
  ).length;
  if (encodedBytes > MAX_BACKUP_BYTES) {
    problems.push("Backup is larger than the supported 5 MB limit.");
  }

  return {
    valid: problems.length === 0,
    problems,
    encodedBytes
  };
}


function canonicalizeStorageValues(storageValues = {}) {
  const canonical = {};

  for (const [key, value] of Object.entries(storageValues)) {
    if (typeof value !== "string") {
      continue;
    }

    const targetKey = LEGACY_TO_STABLE[key] ?? key;
    const isStable = MANAGED_STORAGE_KEYS.includes(key);
    if (
      !Object.prototype.hasOwnProperty.call(canonical, targetKey) ||
      isStable
    ) {
      canonical[targetKey] = value;
    }
  }

  return canonical;
}

export function createRestorePlan(currentValues = {}, payload) {
  const validation = validateBackup(payload);
  if (!validation.valid) {
    return {
      valid: false,
      problems: validation.problems,
      writes: {},
      removals: []
    };
  }

  const writes = canonicalizeStorageValues(
    payload.storageValues
  );
  const removals = MANAGED_STORAGE_KEYS.filter(
    (key) =>
      Object.prototype.hasOwnProperty.call(currentValues, key) &&
      !Object.prototype.hasOwnProperty.call(writes, key)
  );

  return {
    valid: true,
    problems: [],
    writes,
    removals
  };
}

export function createDiagnostics({
  buildVersion = PLATFORM_BUILD_VERSION,
  generatedAt = new Date().toISOString(),
  location = {},
  navigatorInfo = {},
  displayMode = "browser",
  serviceWorker = {},
  storage = {},
  errorRecords = []
} = {}) {
  return {
    product: "Paper Flock",
    buildVersion: String(buildVersion),
    generatedAt: String(generatedAt),
    releaseChannel: "field-test",
    closedAlphaApproved: false,
    releaseGate: "real-field-evidence-required",
    page: {
      protocol: String(location.protocol ?? ""),
      hostname: String(location.hostname ?? ""),
      path: String(location.pathname ?? "")
    },
    environment: {
      displayMode,
      userAgent: String(navigatorInfo.userAgent ?? ""),
      language: String(navigatorInfo.language ?? ""),
      platform: String(navigatorInfo.platform ?? ""),
      logicalProcessors: Number(navigatorInfo.hardwareConcurrency) || null,
      deviceMemoryGb: Number(navigatorInfo.deviceMemory) || null,
      maxTouchPoints: Number(navigatorInfo.maxTouchPoints) || 0,
      online: navigatorInfo.onLine !== false,
      reducedMotion: Boolean(navigatorInfo.reducedMotion)
    },
    serviceWorker: clone(serviceWorker),
    storage: {
      usageBytes: Number(storage.usage) || 0,
      quotaBytes: Number(storage.quota) || 0,
      usageLabel: formatBytes(storage.usage),
      quotaLabel: formatBytes(storage.quota)
    },
    clientErrors: errorRecords.map(sanitizeErrorRecord)
  };
}
