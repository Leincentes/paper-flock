#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const failures = [];
const passes = [];

function record(name, passed, detail) {
  (passed ? passes : failures).push({ name, detail });
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

const htmlFiles = [
  "index.html",
  "privacy.html",
  "support.html",
  "release-notes.html",
  "known-issues.html",
  "accessibility.html",
  "terms.html",
  "credits.html",
  "404.html"
];

for (const file of htmlFiles) {
  const html = read(file);
  record(
    `${file}-language`,
    /<html\s+lang="en"/i.test(html),
    "Page declares an English document language."
  );
  record(
    `${file}-title`,
    /<title>[^<]+<\/title>/i.test(html),
    "Page has a non-empty title."
  );
  record(
    `${file}-main`,
    /<main(?:\s|>)/i.test(html),
    "Page has a main landmark."
  );
  record(
    `${file}-csp`,
    /http-equiv="Content-Security-Policy"/i.test(html) &&
      /default-src 'self'/i.test(html) &&
      /object-src 'none'/i.test(html) &&
      /base-uri 'none'/i.test(html),
    "Page has a self-only CSP with objects and base URLs disabled."
  );
  record(
    `${file}-referrer`,
    /<meta[^>]+(?:name="referrer"[^>]+content="no-referrer"|content="no-referrer"[^>]+name="referrer")/i.test(html),
    "Page uses a no-referrer policy."
  );

  const inlineScripts = [
    ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi)
  ];
  record(
    `${file}-no-inline-script`,
    inlineScripts.length === 0,
    "Page contains no inline executable script."
  );
}

const index = read("index.html");
record(
  "skip-link",
  /class="skip-link"/i.test(index) ||
    /src="\.\/src\/accessibility-ui\.js"/i.test(index),
  "Skip navigation is supplied by the accessibility module."
);
record(
  "accessibility-module",
  /src="\.\/src\/accessibility-ui\.js"/i.test(index),
  "Accessibility runtime module is loaded."
);
record(
  "accessibility-page-link",
  /href="\.\/accessibility\.html"/i.test(index),
  "Accessibility statement is linked."
);

const css = read("styles.css");
record(
  "focus-visible",
  /:focus-visible/.test(css) &&
    /outline:\s*[34]px/.test(css),
  "Strong visible focus treatment exists."
);
record(
  "forced-colors",
  /@media \(forced-colors: active\)/.test(css),
  "Forced-colors support exists."
);
record(
  "text-scaling",
  /data-text-size="large"/.test(css) &&
    /data-text-size="extra-large"/.test(css),
  "User-selectable text scaling exists."
);
record(
  "reduced-motion",
  /data-accessibility-motion="reduced"/.test(css),
  "User-selectable reduced motion exists."
);
record(
  "touch-target",
  /min-height:\s*44px/.test(css) &&
    /min-width:\s*44px/.test(css),
  "Interactive control rules include 44px targets."
);

const runtimeFiles = [
  ...fs.readdirSync(path.join(root, "src"))
    .filter((name) => name.endsWith(".js"))
    .map((name) => `src/${name}`),
  "service-worker.js"
];
const dangerousPatterns = [
  [/\beval\s*\(/, "eval"],
  [/\bnew\s+Function\s*\(/, "new Function"],
  [/document\.write\s*\(/, "document.write"]
];

for (const file of runtimeFiles) {
  const source = read(file);
  for (const [pattern, label] of dangerousPatterns) {
    record(
      `${file}-no-${label.replaceAll(" ", "-")}`,
      !pattern.test(source),
      `${file} does not use ${label}.`
    );
  }
}

const publicPages = read("src/public-pages-ui.js");
record(
  "public-pages-no-innerhtml",
  !/\.innerHTML\s*=/.test(publicPages),
  "Public configuration pages build dynamic content with DOM APIs."
);

const packageJson = JSON.parse(read("package.json"));
record(
  "no-runtime-dependencies",
  !packageJson.dependencies ||
    Object.keys(packageJson.dependencies).length === 0,
  "Runtime has no third-party package dependencies."
);

const result = {
  product: "Paper Flock",
  buildVersion: "1.4.4",
  generatedAt: new Date().toISOString(),
  passes,
  failures,
  passed: failures.length === 0
};

console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) {
  process.exitCode = 1;
}
