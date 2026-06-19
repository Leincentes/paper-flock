import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  eventAnnouncement,
  nextGridCell,
  normalizeAccessibilityPreferences,
  resolveAccessibilityPreferences
} from "../src/accessibility-core.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);

test("accessibility preferences reject unknown values", () => {
  assert.deepEqual(
    normalizeAccessibilityPreferences({
      textSize: "huge",
      contrast: "neon",
      motion: "fast"
    }),
    {
      schemaVersion: 1,
      textSize: "standard",
      contrast: "auto",
      motion: "auto",
      focusStyle: "strong"
    }
  );
});

test("system preferences can elevate contrast and reduce motion", () => {
  const resolved = resolveAccessibilityPreferences(
    {
      textSize: "large",
      contrast: "auto",
      motion: "auto"
    },
    {
      prefersMoreContrast: true,
      prefersReducedMotion: true,
      forcedColors: true
    }
  );

  assert.equal(resolved.textSize, "large");
  assert.equal(resolved.effectiveContrast, "high");
  assert.equal(resolved.effectiveMotion, "reduced");
  assert.equal(resolved.forcedColors, true);
});

test("grid navigation moves to the nearest enabled bird", () => {
  const cells = [
    { row: 0, col: 0 },
    { row: 0, col: 2 },
    { row: 1, col: 0 },
    { row: 2, col: 0, disabled: true },
    { row: 2, col: 2 }
  ];

  assert.deepEqual(
    nextGridCell(cells, { row: 0, col: 0 }, "ArrowRight"),
    { row: 0, col: 2, disabled: false }
  );
  assert.deepEqual(
    nextGridCell(cells, { row: 0, col: 0 }, "ArrowDown"),
    { row: 1, col: 0, disabled: false }
  );
  assert.deepEqual(
    nextGridCell(cells, { row: 1, col: 0 }, "ArrowDown"),
    { row: 1, col: 0, disabled: false }
  );
  assert.deepEqual(
    nextGridCell(cells, { row: 1, col: 0 }, "End"),
    { row: 2, col: 2, disabled: false }
  );
});

test("important game events have concise live announcements", () => {
  assert.match(
    eventAnnouncement({
      name: "puzzle_complete",
      level: 3,
      feathersEarned: 2
    }),
    /2 of 3 feathers/
  );
  assert.match(
    eventAnnouncement({ name: "blocked_tap" }),
    /blocked/
  );
  assert.equal(
    eventAnnouncement({ name: "unrelated_event" }),
    ""
  );
});

test("runtime loads accessibility settings and public statement", () => {
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );
  assert.match(html, /src="\.\/src\/accessibility-ui\.js"/);
  assert.match(html, /href="\.\/accessibility\.html"/);
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /name="referrer" content="no-referrer"/);
});

test("public pages contain no inline executable scripts", () => {
  for (const file of [
    "privacy.html",
    "support.html",
    "release-notes.html",
    "known-issues.html",
    "accessibility.html"
  ]) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(
      html,
      /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i,
      `${file} has inline script`
    );
  }
});

test("styles include focus, text, contrast, motion, and forced-color support", () => {
  const css = fs.readFileSync(
    path.join(root, "styles.css"),
    "utf8"
  );
  assert.match(css, /:focus-visible/);
  assert.match(css, /data-text-size="extra-large"/);
  assert.match(css, /data-accessibility-contrast="high"/);
  assert.match(css, /data-accessibility-motion="reduced"/);
  assert.match(css, /@media \(forced-colors: active\)/);
});

test("security audit tool is wired into package verification", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  );
  assert.match(
    packageJson.scripts.verify,
    /audit:hardening/
  );
});
