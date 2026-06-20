import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MAX_DIAGNOSTIC_EVENTS,
  createClosedTestReport,
  normalizeDiagnostics,
  recordDiagnosticEvent
} from "../src/diagnostics-core.js";
import {
  STORAGE_KEYS,
  createEnvelope
} from "../src/storage-player-core.js";
import {
  applyPlayerRestorePlanSafely,
  createPlayerBackup,
  createPlayerRestorePlan,
  validatePlayerBackup
} from "../src/settings-core.js";

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

test("diagnostics sanitize sensitive fields and message content", () => {
  const diagnostics = recordDiagnosticEvent(
    {},
    "page_error",
    {
      message:
        "Failed at https://example.com/private user@example.com",
      board: [[1, 2, 3]],
      raw: "secret",
      level: 11,
      nested: {
        filename: "private.json",
        safe: true
      }
    },
    {
      at: "2026-06-20T00:00:00.000Z",
      session: "session-one"
    }
  );

  const event = diagnostics.events[0];
  assert.equal(event.name, "page_error");
  assert.equal(event.detail.level, 11);
  assert.equal(event.detail.board, undefined);
  assert.equal(event.detail.raw, undefined);
  assert.equal(event.detail.nested.filename, undefined);
  assert.equal(event.detail.nested.safe, true);
  assert.match(event.detail.message, /\[url\]/);
  assert.match(event.detail.message, /\[email\]/);
});

test("diagnostics retain only the bounded rolling event window", () => {
  let diagnostics = {};
  for (let index = 0; index < MAX_DIAGNOSTIC_EVENTS + 20; index += 1) {
    diagnostics = recordDiagnosticEvent(
      diagnostics,
      "move",
      { index },
      {
        at: new Date(
          Date.UTC(2026, 5, 20, 0, 0, index)
        ).toISOString(),
        session: "session"
      }
    );
  }

  assert.equal(
    diagnostics.events.length,
    MAX_DIAGNOSTIC_EVENTS
  );
  assert.equal(diagnostics.events[0].detail.index, 20);
});

test("closed-test report contains summaries but no raw save", () => {
  const report = createClosedTestReport({
    buildVersion: "1.6.0",
    diagnostics: recordDiagnosticEvent(
      {},
      "puzzle_complete",
      { level: 3 }
    ),
    storageHealth: {
      primaryValid: true,
      primaryReason: "envelope",
      backupValid: true,
      backupReason: "envelope",
      stableSavePresent: true,
      legacySavePresent: false
    },
    progress: {
      currentLevel: 3,
      unlockedLevel: 4,
      completedLevels: 3,
      masteredLevels: 2,
      puzzleCompletions: 4,
      totalMoves: 18
    },
    runtime: {
      androidWrapper: true,
      online: false,
      installed: true,
      viewportWidth: 390,
      viewportHeight: 844,
      safeMode: false
    }
  });

  assert.equal(report.kind, "closed-test-report");
  assert.equal(report.runtime.platform, "android-wrapper");
  assert.equal(report.runtime.screenBucket, "phone");
  assert.equal(report.progress.completedLevels, 3);
  assert.equal(report.diagnostics.eventCount, 1);
  assert.equal("storageValues" in report, false);
  assert.equal("board" in report, false);
});

test("backup validation accepts a valid recovery copy", () => {
  const validBackup = JSON.stringify(
    createEnvelope({
      saveVersion: 12,
      currentLevel: 5
    })
  );
  const payload = createPlayerBackup({
    buildVersion: "1.6.0",
    storageValues: {
      [STORAGE_KEYS.save]: "{broken",
      [STORAGE_KEYS.saveBackup]: validBackup
    }
  });

  assert.equal(validatePlayerBackup(payload).valid, true);
});

test("safe restore rolls back when storage rejects a write", () => {
  const existing = JSON.stringify(
    createEnvelope({
      saveVersion: 12,
      currentLevel: 2
    })
  );
  const replacement = JSON.stringify(
    createEnvelope({
      saveVersion: 12,
      currentLevel: 8
    })
  );

  class FailingStorage extends MemoryStorage {
    setItem(key, value) {
      if (
        key === STORAGE_KEYS.saveBackup &&
        value === replacement
      ) {
        throw new Error("simulated quota failure");
      }
      super.setItem(key, value);
    }
  }

  const storage = new FailingStorage({
    [STORAGE_KEYS.save]: existing,
    [STORAGE_KEYS.saveBackup]: existing
  });
  const payload = createPlayerBackup({
    buildVersion: "1.6.0",
    storageValues: {
      [STORAGE_KEYS.save]: replacement,
      [STORAGE_KEYS.saveBackup]: replacement
    }
  });
  const plan = createPlayerRestorePlan(
    {
      [STORAGE_KEYS.save]: existing,
      [STORAGE_KEYS.saveBackup]: existing
    },
    payload
  );

  assert.throws(
    () => applyPlayerRestorePlanSafely(storage, plan),
    /simulated quota failure/
  );
  assert.equal(storage.getItem(STORAGE_KEYS.save), existing);
  assert.equal(storage.getItem(STORAGE_KEYS.saveBackup), existing);
});

test("production runtime exposes recovery and Android renderer handling", () => {
  const root = path.resolve(new URL("..", import.meta.url).pathname);
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );
  const boot = fs.readFileSync(
    path.join(root, "src/boot-guard.js"),
    "utf8"
  );
  const settings = fs.readFileSync(
    path.join(root, "src/settings-ui.js"),
    "utf8"
  );
  const android = fs.readFileSync(
    path.join(
      root,
      "android/app/src/main/java/com/gamelostudio/paperflock/MainActivity.java"
    ),
    "utf8"
  );

  assert.match(html, /src\/diagnostics-ui\.js/);
  assert.match(boot, /Start without changing progress/);
  assert.match(boot, /Restore recovery save/);
  assert.match(settings, /Export tester report/);
  assert.match(android, /onRenderProcessGone/);
  assert.match(android, /consumeDiagnosticEvent/);
});
