import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PLAYER_STORAGE_KEYS,
  applyPlayerRestorePlan,
  clearPlayerData,
  createPlayerBackup,
  createPlayerRestorePlan,
  normalizePlayerSettings,
  validatePlayerBackup
} from "../src/settings-core.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);

class MemoryStorage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
  }

  getItem(key) {
    return this.values.has(key)
      ? this.values.get(key)
      : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test("player settings normalize sound, haptics, and effects", () => {
  assert.deepEqual(
    normalizePlayerSettings({
      soundEnabled: true,
      hapticsEnabled: false,
      effectsPreference: "lite"
    }),
    {
      schemaVersion: 1,
      soundEnabled: true,
      hapticsEnabled: false,
      effectsPreference: "lite"
    }
  );

  assert.equal(
    normalizePlayerSettings({
      effectsPreference: "unsupported"
    }).effectsPreference,
    "auto"
  );
});

test("player backup contains only player-facing storage keys", () => {
  const values = Object.fromEntries(
    PLAYER_STORAGE_KEYS.map(
      (key, index) => [key, `value-${index}`]
    )
  );
  values["paper-flock-quality-evidence"] = "internal";
  values["paper-flock-research"] = "internal";

  const backup = createPlayerBackup({
    buildVersion: "1.2",
    exportedAt: "2026-06-19T00:00:00.000Z",
    storageValues: values
  });

  assert.deepEqual(
    Object.keys(backup.storageValues).sort(),
    [...PLAYER_STORAGE_KEYS].sort()
  );
  assert.equal(
    backup.storageValues["paper-flock-quality-evidence"],
    undefined
  );
  assert.equal(
    validatePlayerBackup(backup).valid,
    true
  );
});

test("player backup validation rejects internal or unknown data", () => {
  const backup = createPlayerBackup({
    storageValues: {}
  });
  backup.storageValues["paper-flock-research"] = "not allowed";

  const validation = validatePlayerBackup(backup);
  assert.equal(validation.valid, false);
  assert.match(
    validation.problems.join(" "),
    /Unsupported player-data key/
  );
});

test("restore plan replaces player data without touching unrelated storage", () => {
  const storage = new MemoryStorage({
    [PLAYER_STORAGE_KEYS[0]]: "old-save",
    "unrelated-key": "keep"
  });
  const backup = createPlayerBackup({
    storageValues: {
      [PLAYER_STORAGE_KEYS[0]]: "new-save",
      [PLAYER_STORAGE_KEYS[2]]: "accessibility"
    }
  });
  const plan = createPlayerRestorePlan(
    Object.fromEntries(storage.values),
    backup
  );

  applyPlayerRestorePlan(storage, plan);
  assert.equal(
    storage.getItem(PLAYER_STORAGE_KEYS[0]),
    "new-save"
  );
  assert.equal(
    storage.getItem(PLAYER_STORAGE_KEYS[2]),
    "accessibility"
  );
  assert.equal(storage.getItem("unrelated-key"), "keep");
});

test("clear player data preserves unrelated application storage", () => {
  const storage = new MemoryStorage({
    ...Object.fromEntries(
      PLAYER_STORAGE_KEYS.map((key) => [key, "value"])
    ),
    "unrelated-key": "keep"
  });

  clearPlayerData(storage);

  for (const key of PLAYER_STORAGE_KEYS) {
    assert.equal(storage.getItem(key), null);
  }
  assert.equal(storage.getItem("unrelated-key"), "keep");
});

test("production index loads only player-facing runtime modules", () => {
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );

  for (const module of [
    "boot-guard.js",
    "tutorial-player-ui.js",
    "game-player-ui.js",
    "app-platform-ui.js",
    "mobile-lifecycle-ui.js",
    "mobile-viewport-player-ui.js",
    "accessibility-ui.js",
    "settings-ui.js"
  ]) {
    assert.equal(
      html.includes(`./src/${module}`),
      true,
      `${module} should be loaded`
    );
  }

  for (const marker of [
    "visual-test-ui",
    "tactile-test-ui",
    "install-audit-ui",
    "mobile-certification-ui",
    "accessibility-certification-ui",
    "beta-operations-ui",
    "production-release-ui",
    "performance-monitor",
    "Prototype testing tools"
  ]) {
    assert.doesNotMatch(html, new RegExp(marker, "i"));
  }
});

test("production player modules contain no diagnostic query switches", () => {
  for (const file of [
    "src/tutorial-player-ui.js",
    "src/mobile-viewport-player-ui.js",
    "src/game-player-ui.js"
  ]) {
    const source = fs.readFileSync(
      path.join(root, file),
      "utf8"
    );
    assert.doesNotMatch(source, /URLSearchParams/);
    assert.doesNotMatch(
      source,
      /researchRequested|viewportlock|a11ycert|mobilecert/
    );
  }
});

test("player service worker and storage omit internal tooling", () => {
  const worker = fs.readFileSync(
    path.join(root, "service-worker.js"),
    "utf8"
  );
  const storage = fs.readFileSync(
    path.join(root, "src/storage-player-core.js"),
    "utf8"
  );

  for (const marker of [
    "paper-flock-research",
    "research-core.js",
    "visual-test",
    "tactile-test",
    "certification",
    "quality-evidence",
    "production-release"
  ]) {
    assert.doesNotMatch(worker, new RegExp(marker, "i"));
    assert.doesNotMatch(storage, new RegExp(marker, "i"));
  }
});

test("release builder uses an explicit player allowlist", () => {
  const build = fs.readFileSync(
    path.join(root, "tools/build-release.mjs"),
    "utf8"
  );

  assert.match(build, /const playerModules = Object\.freeze/);
  assert.doesNotMatch(build, /copyDirectory\("src"\)/);
  assert.match(build, /assertCleanProductionArtifact/);
  assert.match(build, /internalToolsIncluded: false/);
});
