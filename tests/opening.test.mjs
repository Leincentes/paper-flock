import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  markOpeningSeen,
  normalizeOpeningPreference,
  setOpeningLaunchPreference,
  shouldShowOpening
} from "../src/opening-core.js";
import {
  PLAYER_STORAGE_KEYS
} from "../src/settings-core.js";
import {
  STORAGE_KEYS
} from "../src/storage-player-core.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);

test("new players see the studio opening without interrupting existing saves", () => {
  assert.equal(
    shouldShowOpening({
      preference: {},
      hasExistingSave: false
    }),
    true
  );
  assert.equal(
    shouldShowOpening({
      preference: {},
      hasExistingSave: true
    }),
    false
  );
  assert.equal(
    shouldShowOpening({
      preference: { seen: true },
      hasExistingSave: false
    }),
    false
  );
});

test("players can choose to show or replay the opening", () => {
  const seen = markOpeningSeen({});
  assert.equal(seen.seen, true);
  assert.equal(
    shouldShowOpening({
      preference: seen,
      force: true
    }),
    true
  );

  const repeat = setOpeningLaunchPreference(seen, true);
  assert.equal(repeat.showOnLaunch, true);
  assert.equal(
    shouldShowOpening({
      preference: repeat,
      hasExistingSave: true
    }),
    true
  );
});

test("opening preferences normalize invalid data safely", () => {
  assert.deepEqual(
    normalizeOpeningPreference({
      seen: "yes",
      showOnLaunch: 1
    }),
    {
      schemaVersion: 1,
      seen: false,
      showOnLaunch: false
    }
  );
});

test("opening preference is included in backup and reset storage", () => {
  assert.equal(
    STORAGE_KEYS.opening,
    "paper-flock-opening"
  );
  assert.equal(
    PLAYER_STORAGE_KEYS.includes(STORAGE_KEYS.opening),
    true
  );
});

test("production runtime includes the approved Gamelo Studio opening", () => {
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );
  const css = fs.readFileSync(
    path.join(root, "styles.css"),
    "utf8"
  );
  const worker = fs.readFileSync(
    path.join(root, "service-worker.js"),
    "utf8"
  );
  const settings = fs.readFileSync(
    path.join(root, "src/settings-ui.js"),
    "utf8"
  );

  assert.match(html, /Gamelo Studio presents/);
  assert.match(html, /Created and published by Gamelo Studio/);
  assert.match(html, /Begin the Flight/);
  assert.match(html, /opening-skip-button/);
  assert.ok(
    html.indexOf("./src/opening-ui.js") <
      html.indexOf("./src/tutorial-player-ui.js")
  );

  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /html\[data-accessibility-motion="reduced"\] \.opening-mark/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(worker, /\.\/src\/opening-core\.js/);
  assert.match(worker, /\.\/src\/opening-ui\.js/);
  assert.match(settings, /Show studio opening on launch/);
  assert.match(settings, /Replay studio opening/);
});

test("tutorial waits until the opening is dismissed", () => {
  const tutorial = fs.readFileSync(
    path.join(root, "src/tutorial-player-ui.js"),
    "utf8"
  );

  assert.match(
    tutorial,
    /classList\.contains\("opening-active"\)/
  );
  assert.match(
    tutorial,
    /paperflock:opening-finished/
  );
});
