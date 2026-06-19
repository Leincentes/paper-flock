import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

test("player startup DOM contract includes every required element", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const runtime = fs.readFileSync(
    path.join(root, "src/game-player-ui.js"),
    "utf8"
  );

  const optionalSelectors = new Set([
    "#sound-button",
    "#effects-button"
  ]);
  const selectors = [
    ...runtime.matchAll(
      /\w+:\s*document\.querySelector\("(?<selector>#[^"]+)"\)/g
    )
  ].map((match) => match.groups.selector);

  for (const selector of selectors) {
    if (optionalSelectors.has(selector)) {
      continue;
    }
    const id = selector.slice(1);
    assert.match(
      html,
      new RegExp(`id=["']${id}["']`),
      `Missing required startup element ${selector}`
    );
  }
});

test("mastery goal HUD element exists and startup writes are defensive", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const runtime = fs.readFileSync(
    path.join(root, "src/game-player-ui.js"),
    "utf8"
  );

  assert.match(html, /id=["']mastery-goal["']/);
  assert.match(html, /class=["'][^"']*mastery-goal[^"']*["']/);
  assert.match(runtime, /if \(elements\.masteryGoal\)/);
});
