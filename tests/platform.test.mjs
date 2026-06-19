import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MANAGED_STORAGE_KEYS,
  appendErrorRecord,
  createBackup,
  createDiagnostics,
  createRestorePlan,
  detectDisplayMode,
  formatBytes,
  isIosLike,
  isSecureAppContext,
  sanitizeErrorRecord,
  validateBackup
} from "../src/platform-core.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);

test("backup contains only managed Paper Flock storage keys", () => {
  const backup = createBackup({
    storageValues: {
      "paper-flock-save": '{"level":5}',
      "paper-flock-save-backup": '{"level":4}',
      "paper-flock-errors": "[]",
      "unrelated-secret": "must-not-export"
    }
  });

  assert.deepEqual(Object.keys(backup.storageValues).sort(), [
    "paper-flock-errors",
    "paper-flock-save",
    "paper-flock-save-backup"
  ]);
  assert.equal(validateBackup(backup).valid, true);
});

test("backup validation rejects arbitrary local-storage keys", () => {
  const backup = createBackup({
    storageValues: {
      "paper-flock-save": "{}"
    }
  });
  backup.storageValues["other-product"] = "bad";

  const result = validateBackup(backup);
  assert.equal(result.valid, false);
  assert.match(result.problems.join(" "), /Unsupported storage key/);
});

test("restore plan canonicalizes v0.12 backup keys", () => {
  const backup = {
    schemaVersion: 1,
    product: "Paper Flock",
    buildVersion: "0.12",
    exportedAt: "2026-06-19T00:00:00.000Z",
    storageValues: {
      "paper-flock-save-v12": '{"level":2}',
      "paper-flock-events-v12": "[]"
    }
  };
  const current = {
    "paper-flock-save": '{"level":1}',
    "paper-flock-research": '{"sessions":[]}'
  };

  const plan = createRestorePlan(current, backup);
  assert.equal(plan.valid, true);
  assert.deepEqual(plan.writes, {
    "paper-flock-save": '{"level":2}',
    "paper-flock-events": "[]"
  });
  assert.deepEqual(plan.removals, [
    "paper-flock-research"
  ]);
});

test("client error records remove URL query strings and remain bounded", () => {
  const sanitized = sanitizeErrorRecord({
    message: "Broken request",
    source: "https://example.test/app.js?token=private#section",
    stack: "at fn (https://example.test/app.js?token=private:2:4)"
  });
  assert.equal(sanitized.source, "https://example.test/app.js");
  assert.doesNotMatch(sanitized.stack, /token=private/);

  let records = [];
  for (let index = 0; index < 60; index += 1) {
    records = appendErrorRecord(records, {
      message: `Error ${index}`
    });
  }
  assert.equal(records.length, 50);
  assert.equal(records[0].message, "Error 10");
});

test("platform detection handles secure contexts and iPad desktop mode", () => {
  assert.equal(
    isSecureAppContext({
      protocol: "http:",
      hostname: "127.0.0.1"
    }),
    true
  );
  assert.equal(
    isSecureAppContext({
      protocol: "http:",
      hostname: "192.168.1.5"
    }),
    false
  );
  assert.equal(
    isIosLike({
      userAgent: "Mozilla/5.0",
      platform: "MacIntel",
      maxTouchPoints: 5
    }),
    true
  );
  assert.equal(
    detectDisplayMode({
      standaloneMedia: true,
      navigatorStandalone: false
    }),
    "standalone"
  );
});

test("diagnostics explicitly preserve the field-evidence release gate", () => {
  const diagnostics = createDiagnostics({
    storage: {
      usage: 1024,
      quota: 1024 * 1024
    }
  });
  assert.equal(diagnostics.closedAlphaApproved, false);
  assert.equal(
    diagnostics.releaseGate,
    "real-field-evidence-required"
  );
  assert.equal(formatBytes(1024), "1.0 KB");
});

test("manifest contains current installability and richer-install fields", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8")
  );

  assert.equal(manifest.id, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "portrait-primary");
  assert.ok(manifest.description.length > 30);
  assert.ok(
    manifest.icons.some((icon) => icon.sizes === "192x192")
  );
  assert.ok(
    manifest.icons.some((icon) => icon.sizes === "512x512")
  );
  assert.ok(manifest.screenshots.length >= 1);
});

test("every precached service-worker asset exists in the package", () => {
  const source = fs.readFileSync(
    path.join(root, "service-worker.js"),
    "utf8"
  );
  const match = source.match(
    /const APP_STATIC_RESOURCES = Object\.freeze\(\[([\s\S]*?)\]\);/
  );
  assert.ok(match, "Could not find service-worker asset list.");

  const assets = [...match[1].matchAll(/"([^"]+)"/g)]
    .map((item) => item[1])
    .filter((item) => item !== "./");

  for (const asset of assets) {
    const relative = asset.replace(/^\.\//, "");
    assert.equal(
      fs.existsSync(path.join(root, relative)),
      true,
      `Missing precached asset: ${relative}`
    );
  }
});

test("HTML loads the manifest and platform module", () => {
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );
  assert.match(html, /rel="manifest"/);
  assert.match(html, /src="\.\/src\/app-platform-ui\.js"/);
  assert.match(html, /src="\.\/src\/mobile-lifecycle-ui\.js"/);
  assert.match(html, /apple-mobile-web-app-capable/);
});

test("GitHub Pages workflow tests before deploying the static app", () => {
  const workflow = fs.readFileSync(
    path.join(root, ".github/workflows/static.yml"),
    "utf8"
  );
  assert.match(workflow, /npm test/);
  assert.match(workflow, /actions\/configure-pages@v6/);
  assert.match(workflow, /actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /actions\/deploy-pages@v5/);
});
