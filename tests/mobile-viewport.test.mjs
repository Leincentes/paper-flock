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
    /src="\.\/src\/mobile-viewport-player-ui\.js"/
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
  assert.match(worker, /\.\/src\/mobile-viewport-player-ui\.js/);
});


test("mobile primary controls form one touch-friendly action bar", () => {
  const runtime = fs.readFileSync(
    path.join(root, "src/mobile-viewport-player-ui.js"),
    "utf8"
  );
  const css = fs.readFileSync(
    path.join(root, "styles.css"),
    "utf8"
  );

  assert.match(
    runtime,
    /controls\?\.insertAdjacentHTML\(\s*"beforeend"/
  );
  assert.match(
    css,
    /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/
  );
  assert.match(
    css,
    /html\.mobile-gameplay-lock \.control-button,[\s\S]*?min-height:\s*48px/
  );
  assert.doesNotMatch(
    css,
    /html\.mobile-height-critical \.control-button,[\s\S]{0,180}?min-height:\s*38px;\s*\/\* v1\.5/
  );
});

test("mobile game menu groups utilities and closes after an action", () => {
  const runtime = fs.readFileSync(
    path.join(root, "src/mobile-viewport-player-ui.js"),
    "utf8"
  );

  assert.match(runtime, /MOBILE_MENU_SECTIONS/);
  assert.match(runtime, /mobile-game-menu-section-heading/);
  assert.match(runtime, /el\.content\?\.addEventListener\("click", handleMenuAction\)/);
  assert.match(runtime, /queueMicrotask\(closeMenu\)/);
  assert.match(runtime, /data-modal-close/);
});

test("mobile overlays remain above the utility drawer and inside the viewport", () => {
  const css = fs.readFileSync(
    path.join(root, "styles.css"),
    "utf8"
  );

  assert.match(
    css,
    /html\.mobile-gameplay-lock \.level-map-overlay,[\s\S]*?z-index:\s*150/
  );
  assert.match(
    css,
    /html\.mobile-gameplay-lock \.level-map-panel[\s\S]*?height:\s*100%/
  );
  assert.match(
    css,
    /html\.mobile-gameplay-lock \.level-map-panel[\s\S]*?max-height:\s*100%/
  );
  assert.match(
    css,
    /\.map-bottom-close[\s\S]*?position:\s*sticky/
  );
});

test("compact landscape uses a dedicated board and two-column control rail", () => {
  const css = fs.readFileSync(
    path.join(root, "styles.css"),
    "utf8"
  );
  const runtime = fs.readFileSync(
    path.join(root, "src/mobile-viewport-player-ui.js"),
    "utf8"
  );

  assert.match(
    css,
    /@media \(orientation: landscape\) and \(max-height: 520px\)[\s\S]*?grid-template-areas:[\s\S]*?"board hud"[\s\S]*?"board controls"/
  );
  assert.match(
    css,
    /@media \(orientation: landscape\) and \(max-height: 520px\)[\s\S]*?\.controls[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );
  assert.match(runtime, /function compactLandscape\(viewport\)/);
  assert.match(runtime, /sideRail \+ 36/);
});

test("mobile dialogs and secondary actions keep 44-pixel touch targets", () => {
  const css = fs.readFileSync(
    path.join(root, "styles.css"),
    "utf8"
  );

  for (const selector of [
    "\\.settings-tabs button",
    "\\.journal-next-goal button",
    "\\.journal-filters button",
    "\\.orientation-notice button"
  ]) {
    assert.match(
      css,
      new RegExp(`${selector}[\\s\\S]*?min-height:\\s*44px`)
    );
  }
});
