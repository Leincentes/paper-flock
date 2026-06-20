import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const read = (relative) =>
  fs.readFileSync(path.join(root, relative), "utf8");

const productionFiles = [
  "index.html",
  "src/boot-guard.js",
  "src/opening-ui.js",
  "src/tutorial-player-ui.js",
  "src/game-player-ui.js",
  "src/app-platform-ui.js",
  "src/mobile-lifecycle-ui.js",
  "src/mobile-viewport-player-ui.js",
  "src/accessibility-ui.js",
  "src/settings-ui.js",
  "src/journal-ui.js"
];

const combined = productionFiles.map(read).join("\n");
const css = read("styles.css");
const e2e = read("e2e/production.spec.mjs");
const failures = [];
const checks = [];

function check(name, condition, detail) {
  checks.push({
    name,
    passed: Boolean(condition),
    detail
  });
  if (!condition) {
    failures.push(`${name}: ${detail}`);
  }
}

const buttonIds = [
  ...combined.matchAll(/<button\b[\s\S]*?\bid=["']([^"']+)["'][\s\S]*?>/gi)
].map((match) => match[1]);

for (const match of combined.matchAll(/\.id\s*=\s*["']([^"']+)["']/g)) {
  buttonIds.push(match[1]);
}

const requiredButtons = [
  "undo-button",
  "hint-button",
  "restart-button",
  "mobile-game-menu-button",
  "previous-button",
  "next-button",
  "open-map-button",
  "daily-button",
  "settings-button",
  "journal-button",
  "settings-close-button",
  "journal-close-button",
  "close-map-button",
  "close-map-bottom-button",
  "daily-decline-button",
  "daily-confirm-button",
  "replay-button",
  "continue-button",
  "opening-skip-button",
  "opening-begin-button",
  "tutorial-skip-button",
  "tutorial-continue-button",
  "orientation-dismiss-button"
];

for (const id of requiredButtons) {
  check(
    `production control #${id} exists`,
    combined.includes(`id="${id}"`) ||
      combined.includes(`.id = "${id}"`) ||
      combined.includes(`.id="${id}"`),
    "Missing from the production HTML or injected production UI."
  );
}

for (const id of new Set(buttonIds)) {
  check(
    `production control #${id} is referenced`,
    combined.split(id).length - 1 >= 2,
    "The control is declared but no runtime reference was found."
  );
}

check(
  "studio opening fits mobile viewports",
  /\.opening-screen[\s\S]*?min-height:\s*100dvh/.test(css) &&
    /\.opening-panel[\s\S]*?width:\s*min\(100%,\s*520px\)/.test(css) &&
    /@media \(max-height: 620px\)/.test(css),
  "The opening must remain usable on short portrait and landscape screens."
);

check(
  "studio opening controls meet touch-target minimum",
  /\.opening-skip[\s\S]*?min-height:\s*44px/.test(css) &&
    /\.opening-begin[\s\S]*?min-height:\s*52px/.test(css),
  "Opening controls must meet the mobile touch-target requirement."
);

check(
  "mobile More is part of the primary controls",
  /controls\?\.insertAdjacentHTML\(\s*"beforeend"/.test(combined),
  "More must share the bottom action bar instead of consuming a separate row."
);

check(
  "mobile menu actions dismiss the drawer",
  /el\.content\?\.addEventListener\("click", handleMenuAction\)/.test(combined) &&
    /queueMicrotask\(closeMenu\)/.test(combined),
  "Level map, Daily Flock, Settings, Journal, and navigation must not remain behind the drawer."
);

check(
  "mobile layout uses named grid areas",
  /grid-template-areas:\s*"hud"[\s\S]*?"controls"/.test(css),
  "Named areas prevent hidden rows from stretching controls on short screens."
);

check(
  "portrait action bar has four equal columns",
  /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/.test(css),
  "Undo, Hint, Restart, and More should remain in one row."
);

check(
  "mobile controls meet touch-target minimum",
  /html\.mobile-gameplay-lock \.control-button,[\s\S]*?min-height:\s*48px/.test(css) &&
    /button:not\(\.cell\),[\s\S]*?min-height:\s*44px/.test(css),
  "Primary controls should be at least 48px and secondary controls at least 44px."
);

check(
  "compact landscape has dedicated layout",
  /@media \(orientation: landscape\) and \(max-height: 520px\)[\s\S]*?"board hud"[\s\S]*?"board controls"/.test(css),
  "Landscape must keep the board and controls visible without stretching."
);

check(
  "level map is contained above the drawer",
  /html\.mobile-gameplay-lock \.level-map-overlay,[\s\S]*?z-index:\s*150/.test(css) &&
    /html\.mobile-gameplay-lock \.level-map-panel[\s\S]*?max-height:\s*100%/.test(css),
  "The map must not remain hidden under More or extend beyond the visual viewport."
);

check(
  "settings and Journal scroll internally",
  /\.settings-content[\s\S]*?overflow-y:\s*auto/.test(css) &&
    /\.journal-content[\s\S]*?overflow-y:\s*auto/.test(css),
  "Long mobile dialogs must not scroll the gameplay page."
);

check(
  "mobile E2E coverage checks controls",
  e2e.includes("mobile controls stay in one touch-friendly action bar"),
  "Missing mobile action-bar regression test."
);

check(
  "mobile E2E coverage checks menu-to-map navigation",
  e2e.includes(
    "mobile menu actions reveal gameplay surfaces instead of staying above them"
  ),
  "Missing regression coverage for the drawer stacking bug."
);

check(
  "mobile E2E coverage checks touch targets",
  e2e.includes("mobile utility surfaces expose 44-pixel touch targets"),
  "Missing touch-target regression coverage."
);

check(
  "mobile E2E coverage checks compact landscape",
  e2e.includes(
    "compact landscape keeps a large board and non-stretched controls"
  ),
  "Missing landscape regression coverage."
);

const report = {
  product: "Paper Flock",
  audit: "mobile-ui",
  generatedAt: new Date().toISOString(),
  checks,
  passed: failures.length === 0,
  failures
};

const output = path.join(root, "MOBILE-UI-AUDIT.json");
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);

if (failures.length > 0) {
  console.error("Mobile UI audit failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Mobile UI audit passed (${checks.length} checks, ` +
  `${new Set(buttonIds).size} production controls inspected).`
);
