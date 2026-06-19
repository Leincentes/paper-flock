import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
  createEnvelope,
  fnv1a,
  loadRecoverableJson,
  migrateLegacyStorage,
  normalizeBoard,
  normalizeCheckpoint,
  parseEnvelope,
  storageHealth,
  writeRecoverableJson
} from "../src/storage-core.js";

class MemoryStorage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test("save envelopes detect tampering", () => {
  const envelope = createEnvelope(
    { currentLevel: 5 },
    { savedAt: "2026-06-19T00:00:00.000Z" }
  );
  assert.equal(
    envelope.checksum,
    fnv1a(JSON.stringify(envelope.payload))
  );
  assert.equal(
    parseEnvelope(JSON.stringify(envelope)).valid,
    true
  );

  envelope.payload.currentLevel = 6;
  const tampered = parseEnvelope(JSON.stringify(envelope));
  assert.equal(tampered.valid, false);
  assert.equal(tampered.reason, "checksum");
});

test("recoverable save falls back to the last valid backup", () => {
  const storage = new MemoryStorage();
  writeRecoverableJson(storage, { currentLevel: 4 });
  writeRecoverableJson(storage, { currentLevel: 5 });

  storage.setItem(STORAGE_KEYS.save, "{broken");

  const result = loadRecoverableJson(storage, {
    defaultValue: {},
    normalize: (value) => value
  });

  assert.equal(result.source, "backup");
  assert.equal(result.recovered, true);
  assert.equal(result.value.currentLevel, 4);
  assert.equal(storageHealth(storage).primaryValid, true);
});

test("v0.12 save migrates to the stable key without deletion", () => {
  const legacyKey = LEGACY_STORAGE_KEYS.save[0];
  const storage = new MemoryStorage({
    [legacyKey]: JSON.stringify({
      currentLevel: 7,
      unlockedLevel: 8
    }),
    "paper-flock-events-v12": "[]"
  });

  const migration = migrateLegacyStorage(storage);
  const result = loadRecoverableJson(storage, {
    defaultValue: {},
    normalize: (value) => value
  });

  assert.equal(migration.save, true);
  assert.equal(result.value.currentLevel, 7);
  assert.equal(
    typeof storage.getItem(STORAGE_KEYS.save),
    "string"
  );
  assert.equal(
    storage.getItem(legacyKey) !== null,
    true,
    "Legacy data is retained for safe rollback."
  );
  assert.equal(storage.getItem(STORAGE_KEYS.events), "[]");
});

test("valid board and checkpoint are normalized for exact resume", () => {
  const board = [
    [-1, 0, -1],
    [1, 2, 3],
    [-1, -1, -1]
  ];

  assert.deepEqual(normalizeBoard(board), board);

  const checkpoint = normalizeCheckpoint(
    {
      mode: "campaign",
      currentLevel: 3,
      board,
      initialBoard: board,
      history: [
        {
          board,
          moves: 1,
          deadlocked: false
        }
      ],
      moves: 2,
      hintedCell: { row: 1, col: 1 },
      hintsUsed: 1,
      restarts: 0,
      deadlocks: 0,
      undosUsed: 0
    },
    {
      todayKey: "2026-06-19",
      maximumLevel: 20,
      unlockedLevel: 4
    }
  );

  assert.equal(checkpoint.currentLevel, 3);
  assert.equal(checkpoint.moves, 2);
  assert.deepEqual(checkpoint.hintedCell, {
    row: 1,
    col: 1
  });
  assert.equal(checkpoint.history.length, 1);
});

test("daily checkpoint expires when the local date changes", () => {
  const board = [
    [-1, 0, -1],
    [1, 2, 3],
    [-1, -1, -1]
  ];
  const checkpoint = normalizeCheckpoint(
    {
      mode: "daily",
      dailyDateKey: "2026-06-18",
      board,
      initialBoard: board
    },
    {
      todayKey: "2026-06-19",
      maximumLevel: 20,
      unlockedLevel: 20
    }
  );

  assert.equal(checkpoint, null);
});

test("completed checkpoint is not restored", () => {
  const empty = [
    [-1, -1, -1],
    [-1, -1, -1],
    [-1, -1, -1]
  ];

  assert.equal(
    normalizeCheckpoint(
      {
        mode: "campaign",
        currentLevel: 1,
        board: empty,
        initialBoard: empty
      },
      {
        unlockedLevel: 1
      }
    ),
    null
  );
});


test("first recoverable save creates a redundant backup", () => {
  const storage = new MemoryStorage();
  writeRecoverableJson(storage, { currentLevel: 1 });

  assert.equal(
    parseEnvelope(storage.getItem(STORAGE_KEYS.save)).valid,
    true
  );
  assert.equal(
    parseEnvelope(storage.getItem(STORAGE_KEYS.saveBackup)).valid,
    true
  );
});

test("participant test resets remove the stable save backup", () => {
  const root = path.resolve(new URL("..", import.meta.url).pathname);
  for (const relative of [
    "src/visual-test-ui.js",
    "src/tactile-test-ui.js"
  ]) {
    const source = fs.readFileSync(
      path.join(root, relative),
      "utf8"
    );
    assert.match(
      source,
      /localStorage\.removeItem\(STORAGE_KEYS\.saveBackup\)/
    );
  }
});


test("game startup restores a checkpoint before creating a fresh level", () => {
  const root = path.resolve(new URL("..", import.meta.url).pathname);
  const source = fs.readFileSync(
    path.join(root, "src/game-ui.js"),
    "utf8"
  );

  const restoreIndex = source.indexOf(
    "const restoredCheckpoint = restoreCheckpoint"
  );
  const freshIndex = source.indexOf(
    'startLevel(state.currentLevel, "initial_load")'
  );

  assert.ok(restoreIndex >= 0);
  assert.ok(freshIndex > restoreIndex);
  assert.match(source, /checkpoint: createCheckpoint\(\)/);
  assert.match(source, /paperflock:persist-now/);
  assert.match(source, /paperflock:resume/);
});

test("active modules use stable storage keys instead of build-number keys", () => {
  const root = path.resolve(new URL("..", import.meta.url).pathname);
  for (const relative of [
    "src/game-ui.js",
    "src/platform-ui.js",
    "src/visual-test-ui.js",
    "src/tactile-test-ui.js"
  ]) {
    const source = fs.readFileSync(
      path.join(root, relative),
      "utf8"
    );
    assert.doesNotMatch(
      source,
      /paper-flock-(save|events|research|errors)-v13/
    );
  }
});

test("mobile lifecycle module and touch safety styles ship", () => {
  const root = path.resolve(new URL("..", import.meta.url).pathname);
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );
  const css = fs.readFileSync(
    path.join(root, "styles.css"),
    "utf8"
  );

  assert.match(
    html,
    /src="\.\/src\/mobile-lifecycle-ui\.js"/
  );
  assert.match(css, /overscroll-behavior: none/);
  assert.match(css, /touch-action: manipulation/);
  assert.match(
    css,
    /orientation: landscape[\s\S]*max-height: 520px/
  );
  assert.match(css, /\.app-suspended \*/);
});
