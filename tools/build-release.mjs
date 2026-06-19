#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createReleaseMetadata,
  normalizeCanonicalUrl
} from "../src/release-core.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const dist = path.join(root, "dist");
const config = JSON.parse(
  fs.readFileSync(path.join(root, "app-config.json"), "utf8")
);
const buildInfo = JSON.parse(
  fs.readFileSync(path.join(root, "build-info.json"), "utf8")
);

const topLevelRuntime = [
  "index.html",
  "styles.css",
  "legal.css",
  "manifest.webmanifest",
  "service-worker.js",
  "build-info.json",
  "app-config.json",
  "known-issues.json",
  "release-notes.json",
  "privacy.html",
  "support.html",
  "release-notes.html",
  "known-issues.html",
  "accessibility.html",
  "terms.html",
  "credits.html",
  "404.html",
  "_headers",
  "quality-evidence.schema.json"
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const relative of topLevelRuntime) {
  copy(relative);
}
copyDirectory("assets");
copyDirectory("src");
fs.writeFileSync(path.join(dist, ".nojekyll"), "");

const canonicalUrl = normalizeCanonicalUrl(config.canonicalUrl);
const production = config.releaseChannel === "production" && canonicalUrl;

fs.writeFileSync(
  path.join(dist, "robots.txt"),
  production
    ? `User-agent: *\nAllow: /\nSitemap: ${canonicalUrl}sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n"
);

if (production) {
  const pages = [
    "",
    "privacy.html",
    "terms.html",
    "support.html",
    "accessibility.html",
    "credits.html",
    "release-notes.html",
    "known-issues.html"
  ];
  const urls = pages.map(
    (page) => `<url><loc>${canonicalUrl}${page}</loc></url>`
  );
  fs.writeFileSync(
    path.join(dist, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
      urls.join("") +
      `</urlset>\n`
  );
}

const files = listFiles(dist)
  .filter((file) =>
    !["asset-manifest.json", "release.json"].includes(
      path.basename(file)
    )
  )
  .map((absolute) => {
    const bytes = fs.readFileSync(absolute);
    return {
      path: path.relative(dist, absolute).replaceAll(path.sep, "/"),
      bytes: bytes.length,
      sha256: crypto
        .createHash("sha256")
        .update(bytes)
        .digest("hex")
    };
  })
  .sort((left, right) => left.path.localeCompare(right.path));

const release = createReleaseMetadata({
  buildVersion: buildInfo.buildVersion,
  releaseChannel: config.releaseChannel,
  commitSha: process.env.GITHUB_SHA ?? "",
  files
});

fs.writeFileSync(
  path.join(dist, "asset-manifest.json"),
  `${JSON.stringify({ files }, null, 2)}\n`
);
fs.writeFileSync(
  path.join(dist, "release.json"),
  `${JSON.stringify(release, null, 2)}\n`
);

console.log(
  JSON.stringify(
    {
      dist,
      files: files.length,
      bytes: files.reduce((sum, file) => sum + file.bytes, 0),
      production: Boolean(production)
    },
    null,
    2
  )
);

function copy(relative) {
  const from = path.join(root, relative);
  const to = path.join(dist, relative);
  if (!fs.existsSync(from)) {
    throw new Error(`Missing runtime file: ${relative}`);
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDirectory(relative) {
  const from = path.join(root, relative);
  const to = path.join(dist, relative);
  fs.cpSync(from, to, { recursive: true });
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
