export const STORAGE_SCHEMA_VERSION = 10;
export const ENVELOPE_VERSION = 1;

export const STORAGE_KEYS = Object.freeze({
  save: "paper-flock-save",
  saveBackup: "paper-flock-save-backup",
  events: "paper-flock-events",
  research: "paper-flock-research",
  visualResearch: "paper-flock-visual-research",
  visualPending: "paper-flock-visual-pending",
  tactileResearch: "paper-flock-tactile-research",
  tactilePending: "paper-flock-tactile-pending",
  errors: "paper-flock-errors",
  orientationDismissed: "paper-flock-orientation-dismissed",
  installCertification: "paper-flock-install-certification",
  mobileCertification: "paper-flock-mobile-certification-reports",
  betaDisclosure: "paper-flock-beta-disclosure",
  betaFeedback: "paper-flock-beta-feedback",
  betaOperations: "paper-flock-beta-operations",
  accessibility: "paper-flock-accessibility",
  accessibilityCertification:
    "paper-flock-accessibility-certification-reports",
  performanceHistory: "paper-flock-performance-history",
  releaseAcknowledgement: "paper-flock-release-acknowledgement",
  qualityEvidence: "paper-flock-quality-evidence",
  productionApproval: "paper-flock-production-approval"
});

export const LEGACY_STORAGE_KEYS = Object.freeze({
  save: Object.freeze([
    "paper-flock-save-v12",
    "paper-flock-save-v11",
    "paper-flock-save-v10",
    "paper-flock-save-v9",
    "paper-flock-save-v8",
    "paper-flock-save-v7",
    "paper-flock-save-v6"
  ]),
  events: Object.freeze([
    "paper-flock-events-v12",
    "paper-flock-events-v11",
    "paper-flock-events-v10",
    "paper-flock-events-v9",
    "paper-flock-events-v8",
    "paper-flock-events-v7",
    "paper-flock-events-v6"
  ]),
  research: Object.freeze([
    "paper-flock-research-v12",
    "paper-flock-research-v11",
    "paper-flock-research-v10",
    "paper-flock-research-v9",
    "paper-flock-research-v8",
    "paper-flock-research-v7"
  ]),
  visualResearch: Object.freeze([
    "paper-flock-visual-research-v12",
    "paper-flock-visual-research-v11",
    "paper-flock-visual-research-v10",
    "paper-flock-visual-research-v9",
    "paper-flock-visual-research-v8",
    "paper-flock-visual-research-v7"
  ]),
  tactileResearch: Object.freeze([
    "paper-flock-tactile-research-v12",
    "paper-flock-tactile-research-v11",
    "paper-flock-tactile-research-v10"
  ]),
  errors: Object.freeze([
    "paper-flock-errors-v12"
  ])
});

const EMPTY = -1;
const MIN_BOARD_SIZE = 3;
const MAX_BOARD_SIZE = 5;
const MAX_HISTORY = 100;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function fnv1a(value) {
  const text = String(value);
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createEnvelope(
  payload,
  {
    savedAt = new Date().toISOString(),
    envelopeVersion = ENVELOPE_VERSION
  } = {}
) {
  const payloadText = JSON.stringify(payload);
  return {
    envelopeVersion,
    savedAt: String(savedAt),
    checksum: fnv1a(payloadText),
    payload: clone(payload)
  };
}

export function parseEnvelope(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    return {
      valid: false,
      reason: "empty",
      payload: null
    };
  }

  try {
    const parsed = JSON.parse(raw);

    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.envelopeVersion === ENVELOPE_VERSION &&
      Object.prototype.hasOwnProperty.call(parsed, "payload")
    ) {
      const expected = fnv1a(JSON.stringify(parsed.payload));
      if (parsed.checksum !== expected) {
        return {
          valid: false,
          reason: "checksum",
          payload: null
        };
      }

      return {
        valid: true,
        reason: "envelope",
        payload: clone(parsed.payload),
        savedAt: String(parsed.savedAt ?? "")
      };
    }

    return {
      valid: true,
      reason: "plain-json",
      payload: parsed,
      savedAt: ""
    };
  } catch {
    return {
      valid: false,
      reason: "json",
      payload: null
    };
  }
}

function isCell(value) {
  return (
    Number.isInteger(value) &&
    value >= EMPTY &&
    value <= 3
  );
}

export function normalizeBoard(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const size = value.length;
  if (size < MIN_BOARD_SIZE || size > MAX_BOARD_SIZE) {
    return null;
  }

  const board = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== size) {
      return null;
    }
    if (!row.every(isCell)) {
      return null;
    }
    board.push([...row]);
  }

  return board;
}

function normalizeHistory(value, boardSize) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = [];
  for (const item of value.slice(-MAX_HISTORY)) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const board = normalizeBoard(item.board);
    if (!board || board.length !== boardSize) {
      continue;
    }

    normalized.push({
      board,
      moves: Math.max(0, Number(item.moves) || 0),
      deadlocked: Boolean(item.deadlocked)
    });
  }

  return normalized;
}

function normalizeCoordinate(value, boardSize) {
  if (
    !value ||
    !Number.isInteger(value.row) ||
    !Number.isInteger(value.col)
  ) {
    return null;
  }

  if (
    value.row < 0 ||
    value.col < 0 ||
    value.row >= boardSize ||
    value.col >= boardSize
  ) {
    return null;
  }

  return {
    row: value.row,
    col: value.col
  };
}

export function normalizeCheckpoint(
  value,
  {
    todayKey = null,
    maximumLevel = 20,
    unlockedLevel = maximumLevel
  } = {}
) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const mode = value.mode === "daily" ? "daily" : "campaign";
  const currentLevel = Math.max(
    1,
    Math.min(
      maximumLevel,
      Number.isInteger(value.currentLevel)
        ? value.currentLevel
        : 1
    )
  );

  if (mode === "campaign" && currentLevel > unlockedLevel) {
    return null;
  }

  const dailyDateKey =
    mode === "daily"
      ? String(value.dailyDateKey ?? "")
      : null;

  if (
    mode === "daily" &&
    (!dailyDateKey || (todayKey && dailyDateKey !== todayKey))
  ) {
    return null;
  }

  const board = normalizeBoard(value.board);
  const initialBoard = normalizeBoard(value.initialBoard);
  if (
    !board ||
    !initialBoard ||
    board.length !== initialBoard.length
  ) {
    return null;
  }

  const remainingBirds = board
    .flat()
    .filter((cell) => cell !== EMPTY)
    .length;
  if (remainingBirds === 0) {
    return null;
  }

  return {
    checkpointVersion: 1,
    savedAt: String(value.savedAt ?? ""),
    mode,
    currentLevel,
    dailyDateKey,
    board,
    initialBoard,
    history: normalizeHistory(value.history, board.length),
    moves: Math.max(0, Number(value.moves) || 0),
    hintedCell: normalizeCoordinate(
      value.hintedCell,
      board.length
    ),
    deadlocked: Boolean(value.deadlocked),
    hintsUsed: Math.max(0, Number(value.hintsUsed) || 0),
    restarts: Math.max(0, Number(value.restarts) || 0),
    deadlocks: Math.max(0, Number(value.deadlocks) || 0),
    undosUsed: Math.max(0, Number(value.undosUsed) || 0)
  };
}

function getFirstValue(storage, keys) {
  for (const key of keys) {
    const value = storage.getItem(key);
    if (typeof value === "string") {
      return {
        key,
        value
      };
    }
  }
  return null;
}

export function migrateSimpleStorageKey(
  storage,
  stableKey,
  legacyKeys = []
) {
  const existing = storage.getItem(stableKey);
  if (typeof existing === "string") {
    return {
      migrated: false,
      sourceKey: stableKey
    };
  }

  const legacy = getFirstValue(storage, legacyKeys);
  if (!legacy) {
    return {
      migrated: false,
      sourceKey: null
    };
  }

  storage.setItem(stableKey, legacy.value);
  return {
    migrated: true,
    sourceKey: legacy.key
  };
}

export function writeRecoverableJson(
  storage,
  payload,
  {
    primaryKey = STORAGE_KEYS.save,
    backupKey = STORAGE_KEYS.saveBackup,
    savedAt = new Date().toISOString()
  } = {}
) {
  const previous = storage.getItem(primaryKey);
  if (typeof previous === "string") {
    const parsedPrevious = parseEnvelope(previous);
    if (parsedPrevious.valid) {
      storage.setItem(backupKey, previous);
    }
  }

  const envelope = createEnvelope(payload, { savedAt });
  const serialized = JSON.stringify(envelope);
  storage.setItem(primaryKey, serialized);
  if (typeof storage.getItem(backupKey) !== "string") {
    storage.setItem(backupKey, serialized);
  }

  return {
    primaryKey,
    backupKey,
    checksum: envelope.checksum,
    savedAt: envelope.savedAt
  };
}

export function loadRecoverableJson(
  storage,
  {
    primaryKey = STORAGE_KEYS.save,
    backupKey = STORAGE_KEYS.saveBackup,
    legacyKeys = LEGACY_STORAGE_KEYS.save,
    defaultValue = {},
    normalize = (value) => value
  } = {}
) {
  const attempts = [
    {
      source: "primary",
      key: primaryKey,
      raw: storage.getItem(primaryKey)
    },
    {
      source: "backup",
      key: backupKey,
      raw: storage.getItem(backupKey)
    },
    ...legacyKeys.map((key) => ({
      source: "legacy",
      key,
      raw: storage.getItem(key)
    }))
  ];

  for (const attempt of attempts) {
    const parsed = parseEnvelope(attempt.raw);
    if (!parsed.valid) {
      continue;
    }

    const normalized = normalize(parsed.payload);
    if (normalized === null || normalized === undefined) {
      continue;
    }

    const needsRepair =
      attempt.source !== "primary" ||
      parsed.reason !== "envelope";

    if (needsRepair) {
      writeRecoverableJson(storage, normalized, {
        primaryKey,
        backupKey
      });
    }

    return {
      value: normalized,
      source: attempt.source,
      sourceKey: attempt.key,
      recovered: attempt.source === "backup",
      migrated: attempt.source === "legacy",
      repaired: needsRepair
    };
  }

  return {
    value: clone(defaultValue),
    source: "default",
    sourceKey: null,
    recovered: false,
    migrated: false,
    repaired: false
  };
}

export function migrateLegacyStorage(storage) {
  const migration = {
    save: false,
    events: false,
    research: false,
    visualResearch: false,
    tactileResearch: false,
    errors: false,
    sources: {}
  };

  const saveResult = loadRecoverableJson(storage, {
    defaultValue: null,
    normalize: (value) =>
      value && typeof value === "object"
        ? value
        : null
  });
  if (saveResult.migrated || saveResult.recovered || saveResult.repaired) {
    migration.save = true;
    migration.sources.save = saveResult.sourceKey;
  }

  const mappings = [
    ["events", STORAGE_KEYS.events, LEGACY_STORAGE_KEYS.events],
    ["research", STORAGE_KEYS.research, LEGACY_STORAGE_KEYS.research],
    [
      "visualResearch",
      STORAGE_KEYS.visualResearch,
      LEGACY_STORAGE_KEYS.visualResearch
    ],
    [
      "tactileResearch",
      STORAGE_KEYS.tactileResearch,
      LEGACY_STORAGE_KEYS.tactileResearch
    ],
    ["errors", STORAGE_KEYS.errors, LEGACY_STORAGE_KEYS.errors]
  ];

  for (const [name, stableKey, legacyKeys] of mappings) {
    const result = migrateSimpleStorageKey(
      storage,
      stableKey,
      legacyKeys
    );
    migration[name] = result.migrated;
    if (result.sourceKey) {
      migration.sources[name] = result.sourceKey;
    }
  }

  return migration;
}

export function storageHealth(storage) {
  const primary = parseEnvelope(storage.getItem(STORAGE_KEYS.save));
  const backup = parseEnvelope(
    storage.getItem(STORAGE_KEYS.saveBackup)
  );

  return {
    primaryValid: primary.valid,
    primaryReason: primary.reason,
    backupValid: backup.valid,
    backupReason: backup.reason,
    stableSavePresent:
      typeof storage.getItem(STORAGE_KEYS.save) === "string",
    legacySavePresent: LEGACY_STORAGE_KEYS.save.some(
      (key) => typeof storage.getItem(key) === "string"
    )
  };
}
