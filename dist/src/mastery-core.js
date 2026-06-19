export const THEMES = Object.freeze([
  Object.freeze({
    id: "dawn",
    name: "Dawn Paper",
    requirement: 0,
    description: "Warm coral paper beneath a quiet morning sky."
  }),
  Object.freeze({
    id: "meadow",
    name: "Meadow Fold",
    requirement: 5,
    description: "Fresh green and teal paper inspired by a garden."
  }),
  Object.freeze({
    id: "twilight",
    name: "Twilight Ink",
    requirement: 10,
    description: "Lavender paper against a deep violet evening."
  }),
  Object.freeze({
    id: "festival",
    name: "Lantern Night",
    requirement: 15,
    description: "Gold, plum, and vermilion inspired by paper lanterns."
  }),
  Object.freeze({
    id: "aurora",
    name: "Aurora Flight",
    requirement: 20,
    description: "Cool luminous paper for completing the first journey."
  }),
  Object.freeze({
    id: "moonlit",
    name: "Moonlit Wash",
    requirement: 25,
    description: "Indigo, silver, and violet paper from the Twilight Flock."
  }),
  Object.freeze({
    id: "midnight",
    name: "Midnight Crown",
    requirement: 40,
    description: "A deep luminous sky for completing both chapters."
  })
]);

export function normalizeFeatherMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized = {};
  for (const [key, feathers] of Object.entries(value)) {
    if (Number.isInteger(feathers) && feathers >= 1 && feathers <= 3) {
      normalized[String(key)] = feathers;
    }
  }
  return normalized;
}

export function calculateFeathers({
  completed = true,
  hintsUsed = 0,
  restarts = 0,
  deadlocks = 0
} = {}) {
  if (!completed) {
    return 0;
  }

  let feathers = 1;
  if (Number(hintsUsed) === 0) {
    feathers += 1;
  }
  if (
    Number(hintsUsed) === 0 &&
    Number(restarts) === 0 &&
    Number(deadlocks) === 0
  ) {
    feathers += 1;
  }
  return feathers;
}

export function currentFeatherPotential({
  hintsUsed = 0,
  restarts = 0,
  deadlocks = 0
} = {}) {
  return calculateFeathers({
    completed: true,
    hintsUsed,
    restarts,
    deadlocks
  });
}

export function updateFeatherRecord(records, key, feathers) {
  const normalized = normalizeFeatherMap(records);
  const recordKey = String(key);
  const previousBest = normalized[recordKey] ?? 0;
  const valid = Number.isInteger(feathers) && feathers >= 1 && feathers <= 3;
  const improved = valid && feathers > previousBest;

  if (improved) {
    normalized[recordKey] = feathers;
  }

  return {
    records: normalized,
    previousBest,
    best: normalized[recordKey] ?? previousBest,
    improved
  };
}

export function totalFeathers(records) {
  return Object.values(normalizeFeatherMap(records)).reduce(
    (total, value) => total + value,
    0
  );
}

export function unlockedThemes(completedLevels = []) {
  const count = new Set(
    completedLevels.filter(
      (level) => Number.isInteger(level) && level >= 1 && level <= 40
    )
  ).size;

  return THEMES.filter((theme) => count >= theme.requirement);
}

export function isThemeUnlocked(themeId, completedLevels = []) {
  return unlockedThemes(completedLevels).some((theme) => theme.id === themeId);
}

export function nextThemeUnlock(completedLevels = []) {
  const unlocked = new Set(
    unlockedThemes(completedLevels).map((theme) => theme.id)
  );
  return THEMES.find((theme) => !unlocked.has(theme.id)) ?? null;
}

export function trimFeatherRecords(records, maximumEntries = 31) {
  const normalized = normalizeFeatherMap(records);
  return Object.fromEntries(
    Object.entries(normalized)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, maximumEntries)
  );
}

export function featherText(count) {
  const value = Math.max(0, Math.min(3, Number(count) || 0));
  return `${"◆".repeat(value)}${"◇".repeat(3 - value)}`;
}
