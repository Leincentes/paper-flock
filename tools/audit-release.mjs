#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PERFORMANCE_BUDGETS
} from "../src/release-core.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const dist = path.join(root, "dist");
const manifestPath = path.join(dist, "asset-manifest.json");
const failures = [];

if (!fs.existsSync(manifestPath)) {
  throw new Error("Run npm run build before auditing the release.");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const expected = new Set(manifest.files.map((file) => file.path));
const actual = listFiles(dist)
  .map((file) =>
    path.relative(dist, file).replaceAll(path.sep, "/")
  )
  .filter((file) =>
    !["asset-manifest.json", "release.json"].includes(file)
  );

for (const file of manifest.files) {
  const absolute = path.join(dist, file.path);
  if (!fs.existsSync(absolute)) {
    failures.push(`Missing release file: ${file.path}`);
    continue;
  }

  const bytes = fs.readFileSync(absolute);
  const digest = crypto
    .createHash("sha256")
    .update(bytes)
    .digest("hex");

  if (bytes.length !== file.bytes) {
    failures.push(`Byte count changed: ${file.path}`);
  }
  if (digest !== file.sha256) {
    failures.push(`SHA-256 changed: ${file.path}`);
  }
}

for (const file of actual) {
  if (!expected.has(file)) {
    failures.push(`Unexpected release file: ${file}`);
  }
}

const sizes = {
  total: manifest.files.reduce(
    (sum, file) => sum + file.bytes,
    0
  ),
  javascript: manifest.files
    .filter((file) => file.path.endsWith(".js"))
    .reduce((sum, file) => sum + file.bytes, 0),
  stylesheets: manifest.files
    .filter((file) => file.path.endsWith(".css"))
    .reduce((sum, file) => sum + file.bytes, 0)
};

if (sizes.total > DEFAULT_PERFORMANCE_BUDGETS.totalRuntimeBytes) {
  failures.push(
    `Runtime size ${sizes.total} exceeds ${DEFAULT_PERFORMANCE_BUDGETS.totalRuntimeBytes}.`
  );
}
if (
  sizes.javascript >
  DEFAULT_PERFORMANCE_BUDGETS.javascriptBytes
) {
  failures.push(
    `JavaScript size ${sizes.javascript} exceeds ${DEFAULT_PERFORMANCE_BUDGETS.javascriptBytes}.`
  );
}
if (
  sizes.stylesheets >
  DEFAULT_PERFORMANCE_BUDGETS.stylesheetBytes
) {
  failures.push(
    `Stylesheet size ${sizes.stylesheets} exceeds ${DEFAULT_PERFORMANCE_BUDGETS.stylesheetBytes}.`
  );
}

for (const required of [
  "index.html",
  "404.html",
  "privacy.html",
  "terms.html",
  "support.html",
  "accessibility.html",
  "credits.html",
  "service-worker.js",
  "manifest.webmanifest",
  "_headers",
  "robots.txt"
]) {
  if (!actual.includes(required)) {
    failures.push(`Required release resource missing: ${required}`);
  }
}

const result = {
  product: "Paper Flock",
  buildVersion: "1.4.4",
  passed: failures.length === 0,
  failures,
  sizes,
  files: manifest.files.length
};

console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) {
  process.exitCode = 1;
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory()
        ? listFiles(absolute)
        : [absolute];
    });
}
