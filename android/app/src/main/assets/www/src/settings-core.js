import {
  STORAGE_KEYS,
  parseEnvelope,
  storageHealth
} from "./storage-player-core.js";

export const SETTINGS_SCHEMA_VERSION = 1;
export const PLAYER_BACKUP_SCHEMA_VERSION = 1;
export const MAX_PLAYER_BACKUP_BYTES = 2 * 1024 * 1024;

export const PLAYER_STORAGE_KEYS = Object.freeze([
  STORAGE_KEYS.save,
  STORAGE_KEYS.saveBackup,
  STORAGE_KEYS.accessibility,
  STORAGE_KEYS.tutorial,
  STORAGE_KEYS.opening,
  STORAGE_KEYS.orientationDismissed,
  STORAGE_KEYS.remix,
  STORAGE_KEYS.remixBackup
]);

export const PLAYER_RESET_STORAGE_KEYS = Object.freeze([
  ...PLAYER_STORAGE_KEYS,
  STORAGE_KEYS.diagnostics
]);

export const DEFAULT_PLAYER_SETTINGS = Object.freeze({
  soundEnabled: true,
  hapticsEnabled: true,
  effectsPreference: "auto"
});

const EFFECTS = new Set([
  "auto",
  "full",
  "lite",
  "minimal"
]);

export function normalizePlayerSettings(value = {}) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    soundEnabled: source.soundEnabled !== false,
    hapticsEnabled: source.hapticsEnabled !== false,
    effectsPreference: EFFECTS.has(source.effectsPreference)
      ? source.effectsPreference
      : "auto"
  };
}

export function createPlayerBackup({
  buildVersion = "1.6.0",
  exportedAt = new Date().toISOString(),
  storageValues = {}
} = {}) {
  const values = {};

  for (const key of PLAYER_STORAGE_KEYS) {
    const value = storageValues[key];
    if (typeof value === "string") {
      values[key] = value;
    }
  }

  return {
    schemaVersion: PLAYER_BACKUP_SCHEMA_VERSION,
    product: "Paper Flock",
    kind: "player-backup",
    buildVersion: String(buildVersion),
    exportedAt: String(exportedAt),
    storageValues: values
  };
}

export function validatePlayerBackup(payload) {
  const problems = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      valid: false,
      problems: ["Backup must be a JSON object."],
      encodedBytes: 0
    };
  }

  if (payload.product !== "Paper Flock") {
    problems.push("Backup product is not Paper Flock.");
  }
  if (payload.kind !== "player-backup") {
    problems.push("Backup type is not a player backup.");
  }
  if (payload.schemaVersion !== PLAYER_BACKUP_SCHEMA_VERSION) {
    problems.push("Unsupported player-backup version.");
  }
  if (
    !payload.storageValues ||
    typeof payload.storageValues !== "object" ||
    Array.isArray(payload.storageValues)
  ) {
    problems.push("Backup storage values are missing.");
  } else {
    for (const [key, value] of Object.entries(payload.storageValues)) {
      if (!PLAYER_STORAGE_KEYS.includes(key)) {
        problems.push(`Unsupported player-data key: ${key}`);
      }
      if (typeof value !== "string") {
        problems.push(`Player-data value for ${key} must be text.`);
      }
    }

    const primary = payload.storageValues[STORAGE_KEYS.save];
    const backup = payload.storageValues[STORAGE_KEYS.saveBackup];
    const primaryResult =
      typeof primary === "string" ? parseEnvelope(primary) : null;
    const backupResult =
      typeof backup === "string" ? parseEnvelope(backup) : null;

    if (!primaryResult?.valid && !backupResult?.valid) {
      problems.push(
        "Backup must contain at least one valid Paper Flock save envelope."
      );
    }
  }

  const encodedBytes = new TextEncoder().encode(
    JSON.stringify(payload)
  ).length;
  if (encodedBytes > MAX_PLAYER_BACKUP_BYTES) {
    problems.push("Player backup exceeds the supported 2 MB limit.");
  }

  return {
    valid: problems.length === 0,
    problems,
    encodedBytes
  };
}

export function createPlayerRestorePlan(currentValues = {}, payload) {
  const validation = validatePlayerBackup(payload);
  if (!validation.valid) {
    return {
      valid: false,
      problems: validation.problems,
      writes: {},
      removals: []
    };
  }

  const writes = {};
  for (const key of PLAYER_STORAGE_KEYS) {
    const value = payload.storageValues[key];
    if (typeof value === "string") {
      writes[key] = value;
    }
  }

  return {
    valid: true,
    problems: [],
    writes,
    removals: PLAYER_STORAGE_KEYS.filter(
      (key) =>
        Object.prototype.hasOwnProperty.call(currentValues, key) &&
        !Object.prototype.hasOwnProperty.call(writes, key)
    )
  };
}

export function applyPlayerRestorePlan(storage, plan) {
  if (!plan?.valid) {
    throw new Error("A valid player restore plan is required.");
  }

  for (const key of plan.removals) {
    storage.removeItem(key);
  }
  for (const [key, value] of Object.entries(plan.writes)) {
    storage.setItem(key, value);
  }

  return {
    writes: Object.keys(plan.writes).length,
    removals: plan.removals.length
  };
}

export function applyPlayerRestorePlanSafely(storage, plan) {
  if (!plan?.valid) {
    throw new Error("A valid player restore plan is required.");
  }

  const snapshot = Object.fromEntries(
    PLAYER_RESET_STORAGE_KEYS.map((key) => [
      key,
      storage.getItem(key)
    ])
  );

  try {
    const result = applyPlayerRestorePlan(storage, plan);
    const health = storageHealth(storage);
    if (!health.primaryValid && !health.backupValid) {
      throw new Error(
        "Restored data did not contain a recoverable save."
      );
    }
    return {
      ...result,
      rolledBack: false,
      storageHealth: health
    };
  } catch (error) {
    for (const key of PLAYER_RESET_STORAGE_KEYS) {
      const value = snapshot[key];
      if (typeof value === "string") {
        storage.setItem(key, value);
      } else {
        storage.removeItem(key);
      }
    }
    throw error;
  }
}

export function clearPlayerData(storage) {
  for (const key of PLAYER_RESET_STORAGE_KEYS) {
    storage.removeItem(key);
  }
}
