import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  achievementSummary,
  createJournalSnapshot,
  evaluateAchievements,
  markAchievementsSeen,
  normalizeAchievementState,
  normalizePlayerStats,
  recommendNextGoal,
  reconcileAchievementState,
  recordLaunch,
  recordPuzzleCompletion
} from "../src/achievement-core.js";

const root = path.resolve(
  new URL("..", import.meta.url).pathname
);

test("legacy saves receive inferred statistics without losing progress", () => {
  const stats = normalizePlayerStats(
    {},
    {
      completedLevels: [1, 2, 3],
      bestFeathers: {
        1: 3,
        2: 2,
        3: 3
      },
      dailyFeathers: {
        "2026-06-18": 2,
        "2026-06-19": 3
      },
      now: "2026-06-19T00:00:00.000Z"
    }
  );

  assert.equal(stats.campaignCompletions, 3);
  assert.equal(stats.dailyCompletions, 2);
  assert.equal(stats.puzzleCompletions, 5);
  assert.equal(stats.cleanCompletions, 3);
  assert.equal(stats.firstPlayedAt, "2026-06-19T00:00:00.000Z");
});

test("launch and puzzle completion statistics are cumulative", () => {
  let stats = recordLaunch(
    normalizePlayerStats({}),
    "2026-06-19T01:00:00.000Z"
  );
  stats = recordPuzzleCompletion(
    stats,
    {
      mode: "campaign",
      moves: 14,
      hintsUsed: 1,
      restarts: 2,
      deadlocks: 1,
      undosUsed: 3,
      feathers: 2,
      now: "2026-06-19T01:10:00.000Z"
    }
  );
  stats = recordPuzzleCompletion(
    stats,
    {
      mode: "daily",
      moves: 9,
      feathers: 3,
      now: "2026-06-19T01:20:00.000Z"
    }
  );

  assert.equal(stats.launches, 1);
  assert.equal(stats.puzzleCompletions, 2);
  assert.equal(stats.campaignCompletions, 1);
  assert.equal(stats.dailyCompletions, 1);
  assert.equal(stats.cleanCompletions, 1);
  assert.equal(stats.totalMoves, 23);
  assert.equal(stats.totalHints, 1);
  assert.equal(stats.totalRestarts, 2);
  assert.equal(stats.totalDeadlocks, 1);
  assert.equal(stats.totalUndos, 3);
});

test("achievement evaluation is retroactive and transparent", () => {
  const achievements = evaluateAchievements({
    completedLevels: Array.from(
      { length: 21 },
      (_, index) => index + 1
    ),
    bestFeathers: Object.fromEntries(
      Array.from(
        { length: 10 },
        (_, index) => [String(index + 1), 3]
      )
    ),
    dailyFeathers: {
      "2026-06-17": 2,
      "2026-06-18": 3
    },
    playerStats: {
      cleanCompletions: 10
    },
    unlockedThemeCount: 5
  });

  const byId = Object.fromEntries(
    achievements.map((item) => [item.id, item])
  );

  assert.equal(byId["chapter-one"].unlocked, true);
  assert.equal(byId["twilight-arrival"].unlocked, true);
  assert.equal(byId["mastery-ten"].unlocked, true);
  assert.equal(byId["daily-seven"].unlocked, false);
  assert.equal(byId["five-skies"].unlocked, true);
  assert.equal(byId["all-skies"].unlocked, false);
  assert.equal(byId["daily-seven"].current, 2);
  assert.equal(byId["daily-seven"].target, 7);
});

test("achievement state records unlock time and unseen status", () => {
  const result = reconcileAchievementState(
    {
      completedLevels: [1, 2, 3, 4, 5],
      bestFeathers: {
        1: 3
      },
      unlockedThemeCount: 2
    },
    {},
    "2026-06-19T02:00:00.000Z"
  );

  assert.ok(result.newlyUnlocked.length >= 3);
  assert.equal(
    result.state.unlocked["first-flight"],
    "2026-06-19T02:00:00.000Z"
  );

  const summary = achievementSummary(
    {
      completedLevels: [1, 2, 3, 4, 5],
      bestFeathers: {
        1: 3
      },
      unlockedThemeCount: 2
    },
    result.state
  );
  assert.ok(summary.unseen > 0);

  const seen = markAchievementsSeen(result.state);
  assert.equal(
    seen.seen.length,
    Object.keys(seen.unlocked).length
  );
});

test("unknown achievement IDs are removed during normalization", () => {
  const normalized = normalizeAchievementState({
    unlocked: {
      "first-flight": "2026-06-19T00:00:00.000Z",
      "not-real": "2026-06-19T00:00:00.000Z"
    },
    seen: ["first-flight", "not-real"]
  });

  assert.deepEqual(
    Object.keys(normalized.unlocked),
    ["first-flight"]
  );
  assert.deepEqual(normalized.seen, ["first-flight"]);
});

test("next goal prefers campaign progress, then mastery, then Daily Flock", () => {
  const campaign = recommendNextGoal({
    completedLevels: [1, 2, 3],
    unlockedLevel: 4
  });
  assert.equal(campaign.kind, "campaign");
  assert.equal(campaign.level, 4);

  const mastery = recommendNextGoal({
    completedLevels: Array.from(
      { length: 40 },
      (_, index) => index + 1
    ),
    bestFeathers: Object.fromEntries(
      Array.from(
        { length: 40 },
        (_, index) => [
          String(index + 1),
          index === 11 ? 2 : 3
        ]
      )
    ),
    unlockedLevel: 40
  });
  assert.equal(mastery.kind, "mastery");
  assert.equal(mastery.level, 12);

  const daily = recommendNextGoal({
    completedLevels: Array.from(
      { length: 40 },
      (_, index) => index + 1
    ),
    bestFeathers: Object.fromEntries(
      Array.from(
        { length: 40 },
        (_, index) => [String(index + 1), 3]
      )
    ),
    unlockedLevel: 40,
    todayKey: "2026-06-19"
  });
  assert.equal(daily.kind, "daily");
});

test("journal snapshot contains twenty achievements and ethical goal metadata", () => {
  const snapshot = createJournalSnapshot({
    completedLevels: [1, 2, 3],
    bestFeathers: {
      1: 3
    },
    unlockedThemeCount: 2,
    unlockedLevel: 4,
    todayKey: "2026-06-19"
  });

  assert.equal(snapshot.achievements.length, 20);
  assert.equal(snapshot.categories.length, 4);
  assert.equal(snapshot.recommendation.kind, "campaign");
  assert.equal(snapshot.summary.total, 20);
});

test("production runtime loads and caches the Achievement Journal", () => {
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );
  const worker = fs.readFileSync(
    path.join(root, "service-worker.js"),
    "utf8"
  );
  const build = fs.readFileSync(
    path.join(root, "tools/build-release.mjs"),
    "utf8"
  );

  assert.match(html, /src="\.\/src\/journal-ui\.js"/);
  assert.match(worker, /\.\/src\/achievement-core\.js/);
  assert.match(worker, /\.\/src\/journal-ui\.js/);
  assert.match(build, /src\/achievement-core\.js/);
  assert.match(build, /src\/journal-ui\.js/);
  assert.match(build, /achievementCount:\s*20/);
});

test("player journal explicitly avoids streaks and expiring rewards", () => {
  const config = JSON.parse(
    fs.readFileSync(
      path.join(root, "app-config.json"),
      "utf8"
    )
  );
  const ui = fs.readFileSync(
    path.join(root, "src/journal-ui.js"),
    "utf8"
  );

  assert.equal(config.streaksEnabled, false);
  assert.equal(config.expiringRewardsEnabled, false);
  assert.match(ui, /No streaks or expiring rewards/);
  assert.doesNotMatch(ui, /countdown|claim now|limited time/i);
});
