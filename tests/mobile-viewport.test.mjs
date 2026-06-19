import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  calculateMobileBoardSize,
  estimateFixedGameplayHeight,
  shouldLockGameplayViewport,
  viewportHeightClass
} from "../src/mobile-viewport-core.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);

test("mobile gameplay viewport locks on phones and standalone apps", () => {
  assert.equal(
    shouldLockGameplayViewport({
      width: 390,
      height: 844,
      isMobileLike: true
    }),
    true
  );
  assert.equal(
    shouldLockGameplayViewport({
      width: 700,
      height: 900,
      isStandalone: true
    }),
    true
  );
  assert.equal(
    shouldLockGameplayViewport({
      width: 1024,
      height: 768,
      isMobileLike: true
    }),
    false
  );
});

test("viewport lock can be forced for deterministic browser testing", () => {
  assert.equal(
    shouldLockGameplayViewport({
      width: 1200,
      height: 800,
      force: true
    }),
    true
  );
});

test("short viewports select compact layout classes", () => {
  assert.equal(viewportHeightClass(844), "normal");
  assert.equal(viewportHeightClass(650), "tight");
  assert.equal(viewportHeightClass(568), "critical");
});

test("board fitting respects width, height, minimum, and maximum", () => {
  assert.equal(
    calculateMobileBoardSize({
      viewportWidth: 390,
      viewportHeight: 844,
      horizontalChrome: 46,
      verticalChrome: 340
    }),
    344
  );
  assert.equal(
    calculateMobileBoardSize({
      viewportWidth: 430,
      viewportHeight: 1000,
      horizontalChrome: 40,
      verticalChrome: 300,
      maximum: 360
    }),
    360
  );
  assert.equal(
    calculateMobileBoardSize({
      viewportWidth: 320,
      viewportHeight: 480,
      horizontalChrome: 60,
      verticalChrome: 410,
      minimum: 138
    }),
    138
  );
});

test("fixed gameplay height estimate is deterministic", () => {
  assert.equal(
    estimateFixedGameplayHeight({
      hero: 40,
      hud: 55,
      lesson: 50,
      journey: 30,
      controls: 44,
      moreButton: 44,
      shellPadding: 16,
      cardPadding: 20,
      gaps: 30
    }),
    329
  );
});

test("runtime loads the mobile viewport controller", () => {
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );
  assert.match(
    html,
    /src="\.\/src\/mobile-viewport-ui\.js"/
  );
});

test("mobile viewport styles lock the page but keep menu content scrollable", () => {
  const css = fs.readFileSync(
    path.join(root, "styles.css"),
    "utf8"
  );
  assert.match(css, /html\.mobile-gameplay-lock/);
  assert.match(
    css,
    /\.mobile-game-menu-content[\s\S]*overflow-y:\s*auto/
  );
  assert.match(css, /overscroll-behavior:\s*none/);
  assert.match(css, /--mobile-viewport-height/);
  assert.match(css, /--mobile-board-size/);
});

test("service worker caches both viewport modules", () => {
  const worker = fs.readFileSync(
    path.join(root, "service-worker.js"),
    "utf8"
  );
  assert.match(worker, /\.\/src\/mobile-viewport-core\.js/);
  assert.match(worker, /\.\/src\/mobile-viewport-ui\.js/);
});
