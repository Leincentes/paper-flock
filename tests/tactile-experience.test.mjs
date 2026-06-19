import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8"
);
const css = fs.readFileSync(
  new URL("../styles.css", import.meta.url),
  "utf8"
);
const ui = fs.readFileSync(
  new URL("../src/game-ui.js", import.meta.url),
  "utf8"
);

test("customer UI exposes sound and effects controls with labels", () => {
  assert.match(html, /id="sound-button"[\s\S]*Sound off/);
  assert.match(html, /id="effects-button"[\s\S]*Effects auto/);
  assert.match(html, /class="feedback-settings"/);
});

test("blocked paths receive source, trace, and blocker treatments", () => {
  assert.match(css, /\.cell\.blocked-source/);
  assert.match(css, /\.cell\.blocked-path-segment/);
  assert.match(css, /\.cell\.blocked-path-blocker/);
  assert.match(ui, /showBlockedPath/);
  assert.match(ui, /tracePath/);
});

test("tap acknowledgement is scheduled before move preview", () => {
  const handler = ui.slice(
    ui.indexOf("async function handleCellClick"),
    ui.indexOf("function completeLevel")
  );
  assert.ok(
    handler.indexOf("acknowledgeTap") <
      handler.indexOf("previewMove")
  );
});

test("lite and minimal effect modes reduce expensive visual work", () => {
  assert.match(css, /\[data-effects="lite"\][\s\S]*backdrop-filter: none/);
  assert.match(css, /\[data-effects="minimal"\][\s\S]*animation-duration: 1ms/);
  assert.match(css, /\[data-effects="minimal"\][\s\S]*box-shadow: none/);
});

test("adaptive onboarding and richer feedback are wired into gameplay", () => {
  assert.match(ui, /adaptivePuzzleInstruction/);
  assert.match(ui, /feedbackMessage/);
  assert.match(ui, /playFeedback\("fold"/);
  assert.match(ui, /vibrateFeedback\("deadlock"/);
});
