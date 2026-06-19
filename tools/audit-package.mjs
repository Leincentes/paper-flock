#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  fileURLToPath
} from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const passes = [];
const failures = [];

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function check(id, passed, message) {
  (passed ? passes : failures).push({
    id,
    message
  });
}

const html = read("index.html");
const css = read("styles.css");
const worker = read("service-worker.js");
const buildTool = read("tools/build-release.mjs");
const settingsUi = read("src/settings-ui.js");
const journalUi = read("src/journal-ui.js");
const achievementCore = read("src/achievement-core.js");
const playerGame = read("src/game-player-ui.js");
const appConfig = JSON.parse(read("app-config.json"));
const buildInfo = JSON.parse(read("build-info.json"));
const releaseNotes = JSON.parse(read("release-notes.json"));
const knownIssues = JSON.parse(read("known-issues.json"));

const requiredScripts = [
  "boot-guard.js",
  "tutorial-player-ui.js",
  "game-player-ui.js",
  "app-platform-ui.js",
  "mobile-lifecycle-ui.js",
  "mobile-viewport-player-ui.js",
  "accessibility-ui.js",
  "settings-ui.js",
  "journal-ui.js"
];

for (const script of requiredScripts) {
  check(
    `runtime-${script}`,
    html.includes(`./src/${script}`),
    `${script} is loaded by the player runtime.`
  );
}

const forbiddenRuntimeMarkers = [
  "visual-test-ui",
  "tactile-test-ui",
  "install-audit-ui",
  "mobile-certification-ui",
  "accessibility-certification-ui",
  "beta-operations-ui",
  "performance-monitor",
  "production-release-ui",
  "Prototype testing tools",
  "beta-feedback-button"
];

for (const marker of forbiddenRuntimeMarkers) {
  check(
    `runtime-excludes-${marker}`,
    !html.includes(marker),
    `Production HTML excludes ${marker}.`
  );
}

check(
  "production-runtime-marker",
  /name="paper-flock-runtime"[^>]+content="production"|content="production"[^>]+name="paper-flock-runtime"/i.test(
    html
  ),
  "HTML declares the production runtime."
);
check(
  "settings-page",
  /class="settings-page"/.test(settingsUi) &&
    /settings-sound/.test(settingsUi) &&
    /settings-haptics/.test(settingsUi) &&
    /settings-effects/.test(settingsUi) &&
    /settings-theme/.test(settingsUi),
  "Production Settings provides sound, haptics, effects, and themes."
);
check(
  "settings-accessibility",
  /settings-text-size/.test(settingsUi) &&
    /settings-contrast/.test(settingsUi) &&
    /settings-motion/.test(settingsUi),
  "Production Settings provides accessibility preferences."
);
check(
  "settings-data",
  /createPlayerBackup/.test(settingsUi) &&
    /validatePlayerBackup/.test(settingsUi) &&
    /clearPlayerData/.test(settingsUi),
  "Production Settings provides player backup, restore, and reset."
);
check(
  "settings-focus",
  /event\.key === "Escape"/.test(settingsUi) &&
    /event\.key !== "Tab"/.test(settingsUi),
  "Settings handles Escape and trapped Tab navigation."
);

check(
  "achievement-journal",
  /class="journal-page"/.test(journalUi) &&
    /journal-stat-grid/.test(journalUi) &&
    /achievement-grid/.test(journalUi) &&
    /journal-goal-button/.test(journalUi),
  "Production Achievement Journal provides goals, statistics, and milestones."
);
check(
  "achievement-domain",
  /ACHIEVEMENT_DEFINITIONS/.test(achievementCore) &&
    /recordPuzzleCompletion/.test(achievementCore) &&
    /recommendNextGoal/.test(achievementCore) &&
    /achievementCount/.test(buildTool),
  "Achievement and player-statistics domains are wired into the release."
);
check(
  "ethical-engagement",
  appConfig.streaksEnabled === false &&
    appConfig.expiringRewardsEnabled === false &&
    appConfig.achievementCount === 20,
  "Journal progression has no streak or expiring-reward pressure."
);
check(
  "player-game-no-research",
  !/researchActive|participantCode|\?research=1|research-core\.js/.test(
    playerGame
  ),
  "Player game runtime contains no research mode."
);
check(
  "service-worker-player-runtime",
  /game-player-ui\.js/.test(worker) &&
    /settings-ui\.js/.test(worker) &&
    /journal-ui\.js/.test(worker) &&
    /achievement-core\.js/.test(worker) &&
    /app-platform-ui\.js/.test(worker),
  "Service worker caches the player runtime."
);
check(
  "service-worker-no-internal-tools",
  !/visual-test|tactile-test|install-audit|certification|beta-operations|quality-evidence|production-release/.test(
    worker
  ),
  "Service worker excludes internal tooling."
);
check(
  "strict-build-allowlist",
  /const playerModules = Object\.freeze/.test(buildTool) &&
    !/copyDirectory\("src"\)/.test(buildTool) &&
    /assertCleanProductionArtifact/.test(buildTool),
  "Production build uses a strict player module allowlist."
);
check(
  "production-config",
  appConfig.releaseChannel === "production" &&
    appConfig.automaticUploads === false &&
    appConfig.analyticsEnabled === false &&
    appConfig.advertisingEnabled === false &&
    appConfig.internalToolsIncludedInProduction === false,
  "Production configuration is local-first and excludes internal tools."
);
check(
  "production-build-info",
  buildInfo.productionRuntimeClean === true &&
    buildInfo.internalToolsIncluded === false &&
    buildInfo.productionSettingsPage === true,
  "Build metadata records the clean production runtime."
);
check(
  "production-gate",
  buildInfo.productionApproved === false &&
    buildInfo.productionGate ===
      "v1.4.4-ci-evidence-import-and-final-human-signoff-required",
  "Production approval remains evidence- and sign-off-gated."
);
check(
  "release-notes-current",
  releaseNotes.currentVersion === "1.4.4",
  "Current release notes report v1.4.4."
);
check(
  "known-issues-current",
  knownIssues.buildVersion === "1.4.4",
  "Known-issues register reports v1.4.4."
);
check(
  "sound-default",
  appConfig.soundDefaultEnabled === true &&
    buildInfo.soundDefaultEnabled === true,
  "New and reset player profiles enable sound by default."
);
check(
  "settings-styles",
  /\.settings-page/.test(css) &&
    /\.settings-panel/.test(css) &&
    /\.settings-content[\s\S]*overflow-y:\s*auto/.test(css),
  "Settings has a production modal and internal scroll container."
);
check(
  "manifest",
  /rel="manifest"/.test(html),
  "Web App Manifest is linked."
);
check(
  "public-support",
  /privacy\.html/.test(html) &&
    /support\.html/.test(html) &&
    /terms\.html/.test(html) &&
    /accessibility\.html/.test(html),
  "Player-facing legal and support links are present."
);

for (const file of [
  "privacy.html",
  "support.html",
  "release-notes.html",
  "known-issues.html",
  "accessibility.html",
  "terms.html",
  "credits.html",
  "404.html",
  "legal.css",
  "_headers"
]) {
  check(
    `public-page-${file}`,
    fs.existsSync(path.join(root, file)),
    `${file} exists.`
  );
}

const result = {
  product: "Paper Flock",
  buildVersion: "1.4.4",
  passed: failures.length === 0,
  passCount: passes.length,
  failureCount: failures.length,
  passes,
  failures
};

console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) {
  process.exitCode = 1;
}
