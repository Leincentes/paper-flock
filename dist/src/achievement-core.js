export const PLAYER_STATS_SCHEMA_VERSION = 1;
export const ACHIEVEMENT_STATE_SCHEMA_VERSION = 1;

export const DEFAULT_PLAYER_STATS = Object.freeze({
  schemaVersion: PLAYER_STATS_SCHEMA_VERSION,
  firstPlayedAt: "",
  lastPlayedAt: "",
  launches: 0,
  puzzleCompletions: 0,
  campaignCompletions: 0,
  dailyCompletions: 0,
  cleanCompletions: 0,
  totalMoves: 0,
  totalHints: 0,
  totalRestarts: 0,
  totalDeadlocks: 0,
  totalUndos: 0
});

export const DEFAULT_ACHIEVEMENT_STATE = Object.freeze({
  schemaVersion: ACHIEVEMENT_STATE_SCHEMA_VERSION,
  unlocked: Object.freeze({}),
  seen: Object.freeze([])
});

const ACHIEVEMENT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "first-flight",
    category: "journey",
    title: "First Flight",
    description: "Complete your first campaign flock.",
    icon: "◇",
    target: 1,
    metric: "campaignCompleted"
  }),
  Object.freeze({
    id: "dawn-five",
    category: "journey",
    title: "Dawn Traveler",
    description: "Complete five campaign levels.",
    icon: "☀",
    target: 5,
    metric: "campaignCompleted"
  }),
  Object.freeze({
    id: "ten-flocks",
    category: "journey",
    title: "Paper Pathfinder",
    description: "Complete ten campaign levels.",
    icon: "⌁",
    target: 10,
    metric: "campaignCompleted"
  }),
  Object.freeze({
    id: "chapter-one",
    category: "journey",
    title: "First Journey",
    description: "Complete The First Flight.",
    icon: "✦",
    target: 20,
    metric: "campaignCompleted"
  }),
  Object.freeze({
    id: "twilight-arrival",
    category: "journey",
    title: "Into Twilight",
    description: "Complete your first Twilight Flock level.",
    icon: "☾",
    target: 21,
    metric: "highestCompleted"
  }),
  Object.freeze({
    id: "twilight-complete",
    category: "journey",
    title: "Twilight Ascension",
    description: "Complete all forty campaign levels.",
    icon: "✧",
    target: 40,
    metric: "campaignCompleted"
  }),
  Object.freeze({
    id: "first-mastery",
    category: "mastery",
    title: "Clean Flight",
    description: "Earn three feathers on one campaign level.",
    icon: "♢",
    target: 1,
    metric: "masteredLevels"
  }),
  Object.freeze({
    id: "mastery-ten",
    category: "mastery",
    title: "Steady Wings",
    description: "Master ten campaign levels.",
    icon: "❖",
    target: 10,
    metric: "masteredLevels"
  }),
  Object.freeze({
    id: "mastery-twenty",
    category: "mastery",
    title: "Chapter Master",
    description: "Master twenty campaign levels.",
    icon: "✺",
    target: 20,
    metric: "masteredLevels"
  }),
  Object.freeze({
    id: "mastery-forty",
    category: "mastery",
    title: "Perfect Flock",
    description: "Master every campaign level.",
    icon: "✹",
    target: 40,
    metric: "masteredLevels"
  }),
  Object.freeze({
    id: "feathers-thirty",
    category: "mastery",
    title: "Thirty Feathers",
    description: "Collect thirty campaign feathers.",
    icon: "Ⅲ",
    target: 30,
    metric: "campaignFeathers"
  }),
  Object.freeze({
    id: "feathers-sixty",
    category: "mastery",
    title: "Silver Flock",
    description: "Collect sixty campaign feathers.",
    icon: "Ⅵ",
    target: 60,
    metric: "campaignFeathers"
  }),
  Object.freeze({
    id: "feathers-ninety",
    category: "mastery",
    title: "Moonlit Flock",
    description: "Collect ninety campaign feathers.",
    icon: "Ⅸ",
    target: 90,
    metric: "campaignFeathers"
  }),
  Object.freeze({
    id: "feathers-all",
    category: "mastery",
    title: "Every Feather",
    description: "Collect all 120 campaign feathers.",
    icon: "Ⅻ",
    target: 120,
    metric: "campaignFeathers"
  }),
  Object.freeze({
    id: "daily-first",
    category: "daily",
    title: "A Different Sky",
    description: "Complete one optional Daily Flock.",
    icon: "◌",
    target: 1,
    metric: "dailyCompleted"
  }),
  Object.freeze({
    id: "daily-seven",
    category: "daily",
    title: "Seven Paper Skies",
    description: "Complete seven different Daily Flocks.",
    icon: "◐",
    target: 7,
    metric: "dailyCompleted"
  }),
  Object.freeze({
    id: "daily-twenty",
    category: "daily",
    title: "Daily Wanderer",
    description: "Complete twenty different Daily Flocks.",
    icon: "◉",
    target: 20,
    metric: "dailyCompleted"
  }),
  Object.freeze({
    id: "clean-ten",
    category: "mastery",
    title: "Calm Precision",
    description: "Finish ten puzzles with three feathers.",
    icon: "≈",
    target: 10,
    metric: "cleanCompletions"
  }),
  Object.freeze({
    id: "five-skies",
    category: "collection",
    title: "Paper Collector",
    description: "Unlock five paper themes.",
    icon: "▧",
    target: 5,
    metric: "unlockedThemes"
  }),
  Object.freeze({
    id: "all-skies",
    category: "collection",
    title: "Keeper of the Skies",
    description: "Unlock every paper theme.",
    icon: "▦",
    target: 7,
    metric: "unlockedThemes"
  })
]);

export const ACHIEVEMENT_CATEGORIES = Object.freeze([
  Object.freeze({
    id: "journey",
    name: "Journey",
    description: "Campaign milestones and chapter completion."
  }),
  Object.freeze({
    id: "mastery",
    name: "Mastery",
    description: "Three-feather flights and long-term precision."
  }),
  Object.freeze({
    id: "daily",
    name: "Daily Flock",
    description: "Optional different-day puzzle completions."
  }),
  Object.freeze({
    id: "collection",
    name: "Collection",
    description: "Paper skies earned through normal progression."
  })
]);

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.floor(number)
    : 0;
}

function uniqueCampaignLevels(value = []) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.filter(
        (level) =>
          Number.isInteger(level) &&
          level >= 1 &&
          level <= 40
      )
    )
  ].sort((left, right) => left - right);
}

function normalizedFeatherMap(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    const feathers = finiteNonNegative(raw);
    if (feathers >= 1 && feathers <= 3) {
      result[String(key)] = feathers;
    }
  }
  return result;
}

export function normalizePlayerStats(
  value = {},
  {
    completedLevels = [],
    bestFeathers = {},
    dailyFeathers = {},
    now = new Date().toISOString()
  } = {}
) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  const completed = uniqueCampaignLevels(completedLevels);
  const campaignRecords = normalizedFeatherMap(bestFeathers);
  const dailyRecords = normalizedFeatherMap(dailyFeathers);
  const inferredCampaignCompletions = completed.length;
  const inferredDailyCompletions = Object.keys(dailyRecords).length;
  const inferredCleanCompletions =
    Object.values(campaignRecords).filter((value) => value === 3).length +
    Object.values(dailyRecords).filter((value) => value === 3).length;

  return {
    schemaVersion: PLAYER_STATS_SCHEMA_VERSION,
    firstPlayedAt:
      typeof source.firstPlayedAt === "string" &&
      source.firstPlayedAt
        ? source.firstPlayedAt
        : now,
    lastPlayedAt:
      typeof source.lastPlayedAt === "string" &&
      source.lastPlayedAt
        ? source.lastPlayedAt
        : now,
    launches: finiteNonNegative(source.launches),
    puzzleCompletions: Math.max(
      finiteNonNegative(source.puzzleCompletions),
      inferredCampaignCompletions + inferredDailyCompletions
    ),
    campaignCompletions: Math.max(
      finiteNonNegative(source.campaignCompletions),
      inferredCampaignCompletions
    ),
    dailyCompletions: Math.max(
      finiteNonNegative(source.dailyCompletions),
      inferredDailyCompletions
    ),
    cleanCompletions: Math.max(
      finiteNonNegative(source.cleanCompletions),
      inferredCleanCompletions
    ),
    totalMoves: finiteNonNegative(source.totalMoves),
    totalHints: finiteNonNegative(source.totalHints),
    totalRestarts: finiteNonNegative(source.totalRestarts),
    totalDeadlocks: finiteNonNegative(source.totalDeadlocks),
    totalUndos: finiteNonNegative(source.totalUndos)
  };
}

export function recordLaunch(
  stats,
  now = new Date().toISOString()
) {
  const normalized = normalizePlayerStats(stats, { now });
  return {
    ...normalized,
    launches: normalized.launches + 1,
    lastPlayedAt: now
  };
}

export function recordPuzzleCompletion(
  stats,
  {
    mode = "campaign",
    moves = 0,
    hintsUsed = 0,
    restarts = 0,
    deadlocks = 0,
    undosUsed = 0,
    feathers = 0,
    now = new Date().toISOString()
  } = {}
) {
  const normalized = normalizePlayerStats(stats, { now });
  const campaign = mode !== "daily";

  return {
    ...normalized,
    lastPlayedAt: now,
    puzzleCompletions: normalized.puzzleCompletions + 1,
    campaignCompletions:
      normalized.campaignCompletions + (campaign ? 1 : 0),
    dailyCompletions:
      normalized.dailyCompletions + (campaign ? 0 : 1),
    cleanCompletions:
      normalized.cleanCompletions + (Number(feathers) === 3 ? 1 : 0),
    totalMoves:
      normalized.totalMoves + finiteNonNegative(moves),
    totalHints:
      normalized.totalHints + finiteNonNegative(hintsUsed),
    totalRestarts:
      normalized.totalRestarts + finiteNonNegative(restarts),
    totalDeadlocks:
      normalized.totalDeadlocks + finiteNonNegative(deadlocks),
    totalUndos:
      normalized.totalUndos + finiteNonNegative(undosUsed)
  };
}

export function normalizeAchievementState(value = {}) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  const unlocked = {};
  const validIds = new Set(
    ACHIEVEMENT_DEFINITIONS.map((item) => item.id)
  );

  if (
    source.unlocked &&
    typeof source.unlocked === "object" &&
    !Array.isArray(source.unlocked)
  ) {
    for (const [id, unlockedAt] of Object.entries(source.unlocked)) {
      if (validIds.has(id) && typeof unlockedAt === "string") {
        unlocked[id] = unlockedAt;
      }
    }
  }

  const seen = Array.isArray(source.seen)
    ? [
        ...new Set(
          source.seen.filter((id) => validIds.has(id))
        )
      ]
    : [];

  return {
    schemaVersion: ACHIEVEMENT_STATE_SCHEMA_VERSION,
    unlocked,
    seen
  };
}

export function achievementMetrics({
  completedLevels = [],
  bestFeathers = {},
  dailyFeathers = {},
  playerStats = {},
  unlockedThemeCount = 1
} = {}) {
  const completed = uniqueCampaignLevels(completedLevels);
  const campaignRecords = normalizedFeatherMap(bestFeathers);
  const dailyRecords = normalizedFeatherMap(dailyFeathers);
  const stats = normalizePlayerStats(playerStats, {
    completedLevels: completed,
    bestFeathers: campaignRecords,
    dailyFeathers: dailyRecords
  });

  return {
    campaignCompleted: completed.length,
    highestCompleted:
      completed.length > 0 ? completed.at(-1) : 0,
    masteredLevels:
      Object.values(campaignRecords).filter(
        (value) => value === 3
      ).length,
    campaignFeathers:
      Object.values(campaignRecords).reduce(
        (sum, value) => sum + value,
        0
      ),
    dailyCompleted: Object.keys(dailyRecords).length,
    cleanCompletions: Math.max(
      stats.cleanCompletions,
      Object.values(campaignRecords).filter(
        (value) => value === 3
      ).length +
        Object.values(dailyRecords).filter(
          (value) => value === 3
        ).length
    ),
    unlockedThemes: finiteNonNegative(unlockedThemeCount)
  };
}

export function evaluateAchievements(snapshot = {}) {
  const metrics = achievementMetrics(snapshot);

  return ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const current = Math.min(
      definition.target,
      finiteNonNegative(metrics[definition.metric])
    );
    const unlocked = current >= definition.target;

    return {
      ...definition,
      current,
      unlocked,
      percent: Math.round(
        (current / definition.target) * 100
      )
    };
  });
}

export function reconcileAchievementState(
  snapshot,
  state = DEFAULT_ACHIEVEMENT_STATE,
  now = new Date().toISOString()
) {
  const normalized = normalizeAchievementState(state);
  const evaluated = evaluateAchievements(snapshot);
  const unlocked = { ...normalized.unlocked };
  const newlyUnlocked = [];

  for (const achievement of evaluated) {
    if (
      achievement.unlocked &&
      !Object.prototype.hasOwnProperty.call(
        unlocked,
        achievement.id
      )
    ) {
      unlocked[achievement.id] = now;
      newlyUnlocked.push({
        ...achievement,
        unlockedAt: now
      });
    }
  }

  return {
    state: {
      schemaVersion: ACHIEVEMENT_STATE_SCHEMA_VERSION,
      unlocked,
      seen: normalized.seen.filter((id) =>
        Object.prototype.hasOwnProperty.call(unlocked, id)
      )
    },
    achievements: evaluated.map((achievement) => ({
      ...achievement,
      unlockedAt: unlocked[achievement.id] ?? null,
      seen: normalized.seen.includes(achievement.id)
    })),
    newlyUnlocked
  };
}

export function markAchievementsSeen(state) {
  const normalized = normalizeAchievementState(state);
  return {
    ...normalized,
    seen: Object.keys(normalized.unlocked)
  };
}

export function achievementSummary(snapshot, state) {
  const reconciled = reconcileAchievementState(snapshot, state);
  const unlocked = reconciled.achievements.filter(
    (item) => item.unlocked
  ).length;
  const unseen = reconciled.achievements.filter(
    (item) => item.unlocked && !item.seen
  ).length;

  return {
    unlocked,
    total: ACHIEVEMENT_DEFINITIONS.length,
    unseen,
    percent: Math.round(
      (unlocked / ACHIEVEMENT_DEFINITIONS.length) * 100
    )
  };
}

export function recommendNextGoal({
  completedLevels = [],
  bestFeathers = {},
  dailyFeathers = {},
  unlockedLevel = 1,
  todayKey = ""
} = {}) {
  const completed = uniqueCampaignLevels(completedLevels);
  const completedSet = new Set(completed);
  const campaignRecords = normalizedFeatherMap(bestFeathers);
  const maximumUnlocked = Math.max(
    1,
    Math.min(40, finiteNonNegative(unlockedLevel) || 1)
  );

  for (let level = 1; level <= maximumUnlocked; level += 1) {
    if (!completedSet.has(level)) {
      return {
        kind: "campaign",
        title: `Continue Level ${level}`,
        description:
          "Complete the next open flock to continue the journey.",
        actionLabel: `Play Level ${level}`,
        level
      };
    }
  }

  if (completed.length < 40) {
    return {
      kind: "campaign",
      title: `Continue Level ${maximumUnlocked}`,
      description:
        "The next campaign flock is ready when you are.",
      actionLabel: `Play Level ${maximumUnlocked}`,
      level: maximumUnlocked
    };
  }

  for (let level = 1; level <= 40; level += 1) {
    if (Number(campaignRecords[String(level)] ?? 0) < 3) {
      return {
        kind: "mastery",
        title: `Master Level ${level}`,
        description:
          "Replay this flock and finish without a hint, restart, or dead end.",
        actionLabel: `Replay Level ${level}`,
        level
      };
    }
  }

  const dailyRecords = normalizedFeatherMap(dailyFeathers);
  if (!todayKey || !dailyRecords[todayKey]) {
    return {
      kind: "daily",
      title: "Try Today’s Daily Flock",
      description:
        "Play one optional solver-validated flock with no streak or timer.",
      actionLabel: "Open Daily Flock",
      level: null
    };
  }

  return {
    kind: "complete",
    title: "Every Goal Complete",
    description:
      "All campaign levels are mastered and today’s Daily Flock is complete.",
    actionLabel: "Review achievements",
    level: null
  };
}

export function createJournalSnapshot({
  completedLevels = [],
  bestFeathers = {},
  dailyFeathers = {},
  playerStats = {},
  achievementState = {},
  unlockedThemeCount = 1,
  unlockedLevel = 1,
  todayKey = ""
} = {}) {
  const stats = normalizePlayerStats(playerStats, {
    completedLevels,
    bestFeathers,
    dailyFeathers
  });
  const achievementInput = {
    completedLevels,
    bestFeathers,
    dailyFeathers,
    playerStats: stats,
    unlockedThemeCount
  };
  const reconciled = reconcileAchievementState(
    achievementInput,
    achievementState
  );
  const metrics = achievementMetrics(achievementInput);

  return {
    stats,
    metrics,
    achievementState: reconciled.state,
    achievements: reconciled.achievements,
    summary: achievementSummary(
      achievementInput,
      reconciled.state
    ),
    recommendation: recommendNextGoal({
      completedLevels,
      bestFeathers,
      dailyFeathers,
      unlockedLevel,
      todayKey
    }),
    categories: ACHIEVEMENT_CATEGORIES
  };
}
