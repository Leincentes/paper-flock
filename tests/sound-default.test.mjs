import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_PLAYER_SETTINGS,
  normalizePlayerSettings
} from "../src/settings-core.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);

test("new player settings enable sound by default", () => {
  assert.equal(DEFAULT_PLAYER_SETTINGS.soundEnabled, true);
  assert.equal(normalizePlayerSettings({}).soundEnabled, true);
  assert.equal(
    normalizePlayerSettings({ soundEnabled: undefined }).soundEnabled,
    true
  );
});

test("an explicit existing sound-off preference is preserved", () => {
  assert.equal(
    normalizePlayerSettings({ soundEnabled: false }).soundEnabled,
    false
  );
});

test("player and research runtimes use the sound-on default", () => {
  for (const file of [
    "src/game-player-ui.js",
    "src/game-ui.js"
  ]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(source, /soundEnabled:\s*true/);
    assert.match(source, /soundEnabled:\s*value\.soundEnabled\s*!==\s*false/);
    assert.match(
      source,
      /state\.soundEnabled\s*=\s*parsed\.soundEnabled\s*!==\s*false/
    );
    assert.doesNotMatch(source, /state\.soundEnabled\s*=\s*false/);
  }
});
