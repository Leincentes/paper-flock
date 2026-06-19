import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../src/game-ui.js", import.meta.url), "utf8");

test("modern build includes ambient scene and compact brand hierarchy", () => {
  assert.match(html, /class="ambient-scene"/);
  assert.match(html, /class="brand-eyebrow"/);
  assert.match(html, /class="brand-mark"/);
});

test("journey progress uses a real accessible progress rail", () => {
  assert.match(html, /role="progressbar"/);
  assert.match(html, /id="journey-progress-fill"/);
  assert.match(ui, /aria-valuenow/);
});

test("motion uses transform-based expressive animation", () => {
  assert.match(css, /@keyframes modern-cell-enter/);
  assert.match(css, /@keyframes modern-bird-escape/);
  assert.match(css, /cubic-bezier\(\.22, \.9, \.22, 1\)/);
});

test("reduced motion disables ambient and repeated movement", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.ambient-orb[\s\S]*display: none/);
  assert.match(css, /\.cell-enter[\s\S]*opacity: 1/);
});

test("modern controls retain visible labels and accessible button markup", () => {
  assert.match(html, /id="undo-button"[\s\S]*<span>Undo<\/span>/);
  assert.match(html, /id="hint-button"[\s\S]*<span>Hint<\/span>/);
  assert.match(html, /id="restart-button"[\s\S]*<span>Restart<\/span>/);
});
