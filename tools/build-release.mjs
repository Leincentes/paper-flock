#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  fileURLToPath
} from "node:url";
import {
  createReleaseMetadata,
  normalizeCanonicalUrl
} from "../src/release-core.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const dist = path.join(root, "dist");
const config = JSON.parse(
  fs.readFileSync(path.join(root, "app-config.json"), "utf8")
);
const buildInfo = JSON.parse(
  fs.readFileSync(path.join(root, "build-info.json"), "utf8")
);

const topLevelRuntime = Object.freeze([
  "index.html",
  "styles.css",
  "legal.css",
  "manifest.webmanifest",
  "service-worker.js",
  "known-issues.json",
  "release-notes.json",
  "privacy.html",
  "support.html",
  "release-notes.html",
  "known-issues.html",
  "accessibility.html",
  "terms.html",
  "credits.html",
  "404.html",
  "_headers"
]);

const playerModules = Object.freeze([
  "src/boot-guard.js",
  "src/tutorial-core.js",
  "src/tutorial-player-ui.js",
  "src/game-core.js",
  "src/campaign-core.js",
  "src/achievement-core.js",
  "src/game-player-ui.js",
  "src/progress-core.js",
  "src/experience-core.js",
  "src/mastery-core.js",
  "src/storage-player-core.js",
  "src/settings-core.js",
  "src/settings-ui.js",
  "src/journal-ui.js",
  "src/app-platform-ui.js",
  "src/mobile-lifecycle-ui.js",
  "src/mobile-viewport-core.js",
  "src/mobile-viewport-player-ui.js",
  "src/accessibility-core.js",
  "src/accessibility-ui.js",
  "src/public-pages-ui.js"
]);

const forbiddenProductionNames = Object.freeze([
  "research",
  "visual-test",
  "tactile-test",
  "field-test",
  "install-audit",
  "certification",
  "beta-operations",
  "performance-monitor",
  "quality-evidence",
  "production-release",
  "audit-package",
  "audit-deployment"
]);

fs.rmSync(dist, {
  recursive: true,
  force: true
});
fs.mkdirSync(dist, {
  recursive: true
});

for (const relative of topLevelRuntime) {
  copy(relative);
}
for (const relative of playerModules) {
  copy(relative);
}
copyDirectory("assets");

const publicConfig = {
  product: "Paper Flock",
  buildVersion: String(config.buildVersion),
  releaseChannel: "production",
  publisherName: String(config.publisherName),
  supportEmail: String(config.supportEmail),
  supportUrl: String(config.supportUrl ?? ""),
  repositoryUrl: String(config.repositoryUrl),
  canonicalUrl: String(config.canonicalUrl),
  analyticsEnabled: false,
  advertisingEnabled: false,
  automaticUploads: false,
  interactiveTutorialAvailable: true,
  mobileGameplayViewportLock: true,
  productionSettingsAvailable: true,
  campaignLevels: 40,
  campaignChapters: 2,
  chapterTwoAvailable: true,
  chapterTwoName: "Twilight Flock",
  chapterProgressAvailable: true,
  masteryGoalsAvailable: true,
  validatedDailyCampaignPool: true,
  achievementJournalAvailable: true,
  achievementCount: 20,
  lifetimePlayerStatistics: true,
  replayGoalRecommendation: true,
  streaksEnabled: false,
  expiringRewardsEnabled: false,
  soundDefaultEnabled: true
};

const publicBuildInfo = {
  product: "Paper Flock",
  buildVersion: String(buildInfo.buildVersion),
  releaseChannel: "production",
  serviceWorkerCacheVersion: String(
    buildInfo.serviceWorkerCacheVersion
  ),
  productionConfigurationValid: true,
  publisherName: String(buildInfo.publisherName),
  canonicalUrl: String(buildInfo.canonicalUrl),
  supportContactConfigured: true,
  interactiveFirstLaunchTutorial: true,
  mobileGameplayViewportLock: true,
  productionSettingsPage: true,
  campaignLevelCount: 40,
  campaignChapterCount: 2,
  twilightFlockChapter: true,
  levelSolverValidationConfigured: true,
  duplicateLevelDetectionConfigured: true,
  chapterProgressAndMastery: true,
  v12SaveMigration: true,
  achievementJournal: true,
  achievementCount: 20,
  playerStatisticsSchemaVersion: 1,
  saveSchemaVersion: 12,
  ethicalReplayGoals: true,
  productionRuntimeClean: true,
  internalToolsIncluded: false,
  soundDefaultEnabled: true
};

writeJson("app-config.json", publicConfig);
writeJson("build-info.json", publicBuildInfo);
writeJson("known-issues.json", {
  product: "Paper Flock",
  buildVersion: String(buildInfo.buildVersion),
  updatedAt: "2026-06-20",
  issues: [
    {
      id: "PF-LOCAL-ONLY",
      title: "Progress is stored on the current device and browser",
      severity: "medium",
      status: "open",
      workaround:
        "Use Settings → Data → Export progress backup before changing devices, browsers, or site domains."
    },
    {
      id: "PF-IOS-INSTALL",
      title: "iPhone and iPad installation uses Safari Add to Home Screen",
      severity: "low",
      status: "platform-limitation",
      workaround:
        "Open Paper Flock in Safari, then use Share → Add to Home Screen."
    },
    {
      id: "PF-MOBILE-BROWSER-CHROME",
      title: "Normal browser tabs may show browser navigation controls",
      severity: "low",
      status: "platform-limitation",
      workaround:
        "Install Paper Flock to the Home Screen for the most game-like display."
    },
    {
      id: "PF-TUTORIAL-EXISTING-PLAYERS",
      title: "Existing saved players are not interrupted by the tutorial",
      severity: "informational",
      status: "by-design",
      workaround:
        "Open Settings → Game → Replay how to play."
    },
    {
      id: "PF-SOUND-DEFAULT",
      title: "Sound defaults to on for new and reset player profiles",
      severity: "informational",
      status: "by-design",
      workaround:
        "Existing explicit choices are preserved. Sound can be disabled in Settings."
    }
  ]
});

writeJson("release-notes.json", {
  product: "Paper Flock",
  currentVersion: String(buildInfo.buildVersion),
  releases: [
    {
      version: "1.4.4",
      date: "2026-06-20",
      channel: "production-candidate",
      changes: [
        "Enabled sound by default for new players and confirmed progress resets.",
        "Preserved explicit sound-off preferences from existing saves.",
        "Added regression tests for sound defaults and preference persistence.",
        "Added a mechanics-based simulated-player study using the actual campaign boards.",
        "Kept gameplay rules, achievements, save schema 12, and player progression unchanged."
      ]
    },
    {
      version: "1.4",
      date: "2026-06-19",
      channel: "production",
      changes: [
        "Added an Achievement Journal with twenty permanent milestones.",
        "Added retroactive progress recognition for existing players.",
        "Added lifetime puzzle statistics inside the local recoverable save.",
        "Added a recommended next goal for campaign, mastery, or Daily Flock play.",
        "Added accessible unlock notifications and mobile Journal support.",
        "Kept streaks, expiring rewards, energy, and forced waiting disabled."
      ]
    },
    {
      version: "1.3",
      date: "2026-06-19",
      channel: "production",
      changes: [
        "Added Chapter 2: Twilight Flock with Levels 21–40.",
        "Added chapter progress, mastery goals, two paper themes, and solver-backed level validation.",
        "Preserved v1.2 progress and unlocked Level 21 for players who completed Level 20."
      ]
    },
    {
      version: "1.2",
      date: "2026-06-19",
      channel: "production",
      changes: [
        "Added the player-facing Settings page.",
        "Added sound, haptics, effects, themes, accessibility, backup, restore, and reset.",
        "Separated internal quality tools from the deployable player runtime."
      ]
    },
    {
      version: "1.1",
      date: "2026-06-19",
      channel: "production",
      changes: [
        "Added the first-launch interactive tutorial."
      ]
    },
    {
      version: "1.0",
      date: "2026-06-19",
      channel: "production",
      changes: [
        "Published Paper Flock under Gamelo Studio."
      ]
    }
  ]
});
fs.writeFileSync(path.join(dist, ".nojekyll"), "");

const canonicalUrl = normalizeCanonicalUrl(config.canonicalUrl);
if (!canonicalUrl) {
  throw new Error("A canonical HTTPS production URL is required.");
}

fs.writeFileSync(
  path.join(dist, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${canonicalUrl}sitemap.xml\n`
);

const pages = [
  "",
  "privacy.html",
  "terms.html",
  "support.html",
  "accessibility.html",
  "credits.html",
  "release-notes.html",
  "known-issues.html"
];
const urls = pages.map(
  (page) => `<url><loc>${canonicalUrl}${page}</loc></url>`
);
fs.writeFileSync(
  path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls.join("") +
    `</urlset>\n`
);

assertCleanProductionArtifact();

const files = listFiles(dist)
  .filter((file) =>
    !["asset-manifest.json", "release.json"].includes(
      path.basename(file)
    )
  )
  .map((absolute) => {
    const bytes = fs.readFileSync(absolute);
    return {
      path: path.relative(dist, absolute).replaceAll(path.sep, "/"),
      bytes: bytes.length,
      sha256: crypto
        .createHash("sha256")
        .update(bytes)
        .digest("hex")
    };
  })
  .sort((left, right) => left.path.localeCompare(right.path));

const release = createReleaseMetadata({
  buildVersion: buildInfo.buildVersion,
  releaseChannel: "production",
  commitSha: process.env.GITHUB_SHA ?? "",
  files
});

writeJson("asset-manifest.json", { files });
writeJson("release.json", release);

console.log(
  JSON.stringify(
    {
      dist,
      files: files.length,
      bytes: files.reduce(
        (sum, file) => sum + file.bytes,
        0
      ),
      production: true,
      internalToolsIncluded: false
    },
    null,
    2
  )
);

function assertCleanProductionArtifact() {
  const allFiles = listFiles(dist);
  const relativeFiles = allFiles.map(
    (file) =>
      path.relative(dist, file)
        .replaceAll(path.sep, "/")
        .toLowerCase()
  );

  for (const name of forbiddenProductionNames) {
    const leaked = relativeFiles.find(
      (relative) => relative.includes(name)
    );
    if (leaked) {
      throw new Error(
        `Internal testing resource leaked into production: ${leaked}`
      );
    }
  }

  const scanned = allFiles.filter(
    (file) =>
      [".html", ".js", ".json"].includes(
        path.extname(file)
      )
  );
  const forbiddenPatterns = [
    /prototype testing tools/i,
    /\?research=1/i,
    /\?visualtest=1/i,
    /\?tactiletest=1/i,
    /\?fieldtest=1/i,
    /\?mobilecert=1/i,
    /\?a11ycert=1/i,
    /[?&]viewportlock=1/i,
    /URLSearchParams\(globalThis\.location\.search\)/i,
    /quality-evidence/i,
    /production-release-ui/i,
    /accessibility-certification-ui/i,
    /mobile-certification-ui/i,
    /install-audit-ui/i,
    /visual-test-ui/i,
    /tactile-test-ui/i,
    /beta-operations-ui/i
  ];

  for (const file of scanned) {
    const text = fs.readFileSync(file, "utf8");
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(text)) {
        throw new Error(
          `Internal testing marker ${pattern} found in ` +
          path.relative(dist, file)
        );
      }
    }
  }
}

function writeJson(relative, payload) {
  fs.writeFileSync(
    path.join(dist, relative),
    `${JSON.stringify(payload, null, 2)}\n`
  );
}

function copy(relative) {
  const from = path.join(root, relative);
  const to = path.join(dist, relative);
  if (!fs.existsSync(from)) {
    throw new Error(`Missing production runtime file: ${relative}`);
  }
  fs.mkdirSync(path.dirname(to), {
    recursive: true
  });
  fs.copyFileSync(from, to);
}

function copyDirectory(relative) {
  const from = path.join(root, relative);
  const to = path.join(dist, relative);
  fs.cpSync(from, to, {
    recursive: true
  });
}

function listFiles(directory) {
  return fs.readdirSync(directory, {
    withFileTypes: true
  }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory()
      ? listFiles(absolute)
      : [absolute];
  });
}
