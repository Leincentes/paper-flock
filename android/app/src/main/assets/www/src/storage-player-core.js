export const STORAGE_SCHEMA_VERSION = 12;
export const ENVELOPE_VERSION = 1;

export const STORAGE_KEYS = Object.freeze({
  save: "paper-flock-save",
  saveBackup: "paper-flock-save-backup",
  orientationDismissed: "paper-flock-orientation-dismissed",
  accessibility: "paper-flock-accessibility",
  tutorial: "paper-flock-tutorial"
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
  const clonedPayload = clone(payload);
  return {
    envelopeVersion,
    savedAt: String(savedAt),
    checksum: fnv1a(JSON.stringify(clonedPayload)),
    payload: clonedPayload
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

  const envelope = createEnvelope(payload, {
    savedAt
  });
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
  const result = loadRecoverableJson(storage, {
    defaultValue: null,
    normalize: (value) =>
      value && typeof value === "object"
        ? value
        : null
  });

  return {
    save:
      result.migrated ||
      result.recovered ||
      result.repaired,
    sourceKey: result.sourceKey
  };
}

export function storageHealth(storage) {
  const primary = parseEnvelope(
    storage.getItem(STORAGE_KEYS.save)
  );
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
