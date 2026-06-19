export function normalizeMoveMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized = {};
  for (const [key, moves] of Object.entries(value)) {
    if (Number.isInteger(moves) && moves > 0) {
      normalized[String(key)] = moves;
    }
  }
  return normalized;
}

export function updatePersonalBest(records, key, moves) {
  const normalized = normalizeMoveMap(records);
  const recordKey = String(key);
  const previousBest = normalized[recordKey] ?? null;
  const isNewBest =
    Number.isInteger(moves) &&
    moves > 0 &&
    (previousBest === null || moves < previousBest);

  if (isNewBest) {
    normalized[recordKey] = moves;
  }

  return {
    records: normalized,
    previousBest,
    best: normalized[recordKey] ?? previousBest,
    isNewBest
  };
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function hashText32(text) {
  let hash = 2166136261;
  for (const character of String(text)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function dailySeed(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) {
    throw new Error("Daily puzzle date must use YYYY-MM-DD.");
  }
  return hashText32(`paper-flock-daily:${dateKey}`);
}

export function isDailyUnlocked(unlockedLevel) {
  return Number(unlockedLevel) >= 6;
}

export function trimDailyRecords(records, maximumEntries = 31) {
  const normalized = normalizeMoveMap(records);
  return Object.fromEntries(
    Object.entries(normalized)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, maximumEntries)
  );
}
