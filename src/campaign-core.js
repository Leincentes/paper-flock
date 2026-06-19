export const MAX_CAMPAIGN_LEVEL = 40;
export const LEVELS_PER_CHAPTER = 20;
export const MAX_CAMPAIGN_FEATHERS =
  MAX_CAMPAIGN_LEVEL * 3;

export const CHAPTERS = Object.freeze([
  Object.freeze({
    id: "first-flight",
    number: 1,
    name: "The First Flight",
    shortName: "First Flight",
    startLevel: 1,
    endLevel: 20,
    atmosphere: "dawn-journey",
    description:
      "Learn the folds, cross the paper sky, and free the first flock.",
    acts: Object.freeze([
      Object.freeze({
        name: "Dawn Flight",
        startLevel: 1,
        endLevel: 5
      }),
      Object.freeze({
        name: "Meadow Crossing",
        startLevel: 6,
        endLevel: 10
      }),
      Object.freeze({
        name: "Twilight Fold",
        startLevel: 11,
        endLevel: 15
      }),
      Object.freeze({
        name: "Lantern Sky",
        startLevel: 16,
        endLevel: 20
      })
    ])
  }),
  Object.freeze({
    id: "twilight-flock",
    number: 2,
    name: "Twilight Flock",
    shortName: "Twilight Flock",
    startLevel: 21,
    endLevel: 40,
    atmosphere: "twilight-flock",
    description:
      "Return at dusk for longer rotation chains and quieter, deeper planning.",
    acts: Object.freeze([
      Object.freeze({
        name: "Evening Arrival",
        startLevel: 21,
        endLevel: 25
      }),
      Object.freeze({
        name: "Moonlit Turns",
        startLevel: 26,
        endLevel: 30
      }),
      Object.freeze({
        name: "Inked Constellations",
        startLevel: 31,
        endLevel: 35
      }),
      Object.freeze({
        name: "Midnight Mastery",
        startLevel: 36,
        endLevel: 40
      })
    ])
  })
]);

function normalizedLevel(levelNumber) {
  return Math.max(
    1,
    Math.min(
      MAX_CAMPAIGN_LEVEL,
      Number(levelNumber) || 1
    )
  );
}

function normalizedCompletedLevels(value = []) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.filter(
        (level) =>
          Number.isInteger(level) &&
          level >= 1 &&
          level <= MAX_CAMPAIGN_LEVEL
      )
    )
  ].sort((left, right) => left - right);
}

export function chapterForLevel(levelNumber) {
  const level = normalizedLevel(levelNumber);
  return (
    CHAPTERS.find(
      (chapter) =>
        level >= chapter.startLevel &&
        level <= chapter.endLevel
    ) ?? CHAPTERS[0]
  );
}

export function actForLevel(levelNumber) {
  const level = normalizedLevel(levelNumber);
  const chapter = chapterForLevel(level);
  return (
    chapter.acts.find(
      (act) =>
        level >= act.startLevel &&
        level <= act.endLevel
    ) ?? chapter.acts[0]
  );
}

export function chapterProgress(
  completedLevels = [],
  levelNumber = 1
) {
  const chapter = chapterForLevel(levelNumber);
  const completed = normalizedCompletedLevels(
    completedLevels
  ).filter(
    (level) =>
      level >= chapter.startLevel &&
      level <= chapter.endLevel
  ).length;
  const total =
    chapter.endLevel - chapter.startLevel + 1;

  return {
    chapter,
    completed,
    total,
    percent: Math.round((completed / total) * 100),
    remaining: Math.max(0, total - completed)
  };
}

export function campaignProgress(completedLevels = []) {
  const completed = normalizedCompletedLevels(
    completedLevels
  ).length;

  return {
    completed,
    total: MAX_CAMPAIGN_LEVEL,
    percent: Math.round(
      (completed / MAX_CAMPAIGN_LEVEL) * 100
    )
  };
}

export function chapterMastery(
  featherRecords = {},
  levelNumber = 1
) {
  const chapter = chapterForLevel(levelNumber);
  let perfectLevels = 0;
  let feathers = 0;

  for (
    let level = chapter.startLevel;
    level <= chapter.endLevel;
    level += 1
  ) {
    const value = Number(
      featherRecords?.[String(level)] ?? 0
    );
    if (value === 3) {
      perfectLevels += 1;
    }
    if (Number.isInteger(value) && value >= 1 && value <= 3) {
      feathers += value;
    }
  }

  const totalLevels =
    chapter.endLevel - chapter.startLevel + 1;
  return {
    chapter,
    perfectLevels,
    totalLevels,
    feathers,
    maximumFeathers: totalLevels * 3,
    percent: Math.round(
      (feathers / (totalLevels * 3)) * 100
    )
  };
}

export function masteryGoalForLevel(levelNumber) {
  const level = normalizedLevel(levelNumber);

  if (level <= 5) {
    return "Learn the flight rule and finish the flock.";
  }
  if (level <= 20) {
    return "Mastery: finish without a hint, restart, or dead end.";
  }
  if (level <= 25) {
    return "Twilight warm-up: clear the flock without using a hint.";
  }
  if (level <= 34) {
    return "Moonlit mastery: earn three feathers with a clean flight.";
  }

  return "Midnight mastery: earn three feathers and preserve every escape lane.";
}

export function isChapterFinale(levelNumber) {
  const level = normalizedLevel(levelNumber);
  return CHAPTERS.some(
    (chapter) => chapter.endLevel === level
  );
}

export function isCampaignFinale(levelNumber) {
  return normalizedLevel(levelNumber) ===
    MAX_CAMPAIGN_LEVEL;
}

export function migrateUnlockedLevel({
  unlockedLevel = 1,
  completedLevels = []
} = {}) {
  const completed = normalizedCompletedLevels(
    completedLevels
  );
  let migrated = Math.max(
    1,
    Math.min(
      MAX_CAMPAIGN_LEVEL,
      Number(unlockedLevel) || 1
    )
  );

  // v1.2 ended at Level 20. Players who completed it should enter
  // Chapter 2 without replaying or clearing storage.
  if (completed.includes(20)) {
    migrated = Math.max(migrated, 21);
  }

  const highestCompleted =
    completed.length > 0
      ? completed.at(-1)
      : 0;
  if (highestCompleted > 0) {
    migrated = Math.max(
      migrated,
      Math.min(
        MAX_CAMPAIGN_LEVEL,
        highestCompleted + 1
      )
    );
  }

  return migrated;
}
