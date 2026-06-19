#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  fileURLToPath
} from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const failures = [];
const passes = [];

function check(id, passed, message) {
  (passed ? passes : failures).push({ id, message });
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
const workflow = read(".github/workflows/static.yml");
const dependencyWorkflow =
  read(".github/workflows/dependency-review.yml");
const codeqlWorkflow =
  read(".github/workflows/codeql.yml");
const dependabot = read(".github/dependabot.yml");
const npmrc = read(".npmrc");
const index = read("index.html");
const resolvedUrls = Object.values(
  packageLock.packages ?? {}
)
  .map((entry) => entry?.resolved)
  .filter(Boolean);

check(
  "lockfile-version",
  packageLock.lockfileVersion === 3,
  "npm lockfile v3 is committed."
);
check(
  "lockfile-package-version",
  packageLock.packages?.[""]?.version === packageJson.version,
  "Lockfile root version matches package.json."
);
check(
  "public-npm-registry",
  npmrc.includes("registry=https://registry.npmjs.org/") &&
    resolvedUrls.length > 0 &&
    resolvedUrls.every((url) =>
      url.startsWith("https://registry.npmjs.org/")
    ) &&
    resolvedUrls.every((url) =>
      !url.includes("openai.org")
    ),
  "The lockfile uses only the public npm registry and contains no internal registry URLs."
);
check(
  "tmp-security-override",
  packageJson.overrides?.tmp === "0.2.7" &&
    packageLock.packages?.["node_modules/tmp"]?.version === "0.2.7",
  "The tmp 0.2.7 security override is locked."
);
check(
  "exact-dev-dependencies",
  Object.values(packageJson.devDependencies ?? {}).every(
    (value) => /^\d+\.\d+\.\d+$/.test(value)
  ),
  "Development dependency versions are exact."
);
check(
  "workflow-npm-ci",
  (workflow.match(/\bnpm ci\b/g) ?? []).length >= 2,
  "CI uses npm ci in static and browser jobs."
);
check(
  "workflow-npm-audit",
  /npm audit --audit-level=high/.test(workflow),
  "CI blocks high-severity dependency vulnerabilities."
);
check(
  "workflow-sbom",
  /npm sbom --sbom-format=cyclonedx/.test(workflow),
  "CI generates a CycloneDX SBOM."
);
check(
  "workflow-attestation",
  /uses: actions\/attest@v4/.test(workflow) &&
    /sbom-path:/.test(workflow),
  "CI creates provenance and SBOM attestations."
);
check(
  "dependency-review",
  /actions\/dependency-review-action@v4/.test(
    dependencyWorkflow
  ),
  "Pull requests use dependency review."
);
check(
  "dependabot-npm",
  /package-ecosystem: "npm"/.test(dependabot),
  "Dependabot monitors npm."
);
check(
  "dependabot-actions",
  /package-ecosystem: "github-actions"/.test(dependabot),
  "Dependabot monitors GitHub Actions."
);
check(
  "codeql-javascript",
  /javascript-typescript/.test(codeqlWorkflow) &&
    /github\/codeql-action\/analyze@v4/.test(codeqlWorkflow),
  "CodeQL analyzes JavaScript and TypeScript."
);
check(
  "quality-evidence-source-only",
  fs.existsSync(
    path.join(root, "src/production-release-ui.js")
  ) &&
    !/production-release-ui/.test(index),
  "Production evidence tooling remains available to CI but is not loaded for players."
);
check(
  "quality-schema",
  fs.existsSync(path.join(root, "quality-evidence.schema.json")),
  "Quality evidence schema exists."
);
check(
  "release-evidence-codeql-result",
  /needs:[\s\S]*codeql-quality/.test(workflow) &&
    /--codeql=\$\{\{ needs\.codeql-quality\.result == 'success' \}\}/.test(
      workflow
    ) &&
    !/--codeql=true/.test(workflow),
  "Release evidence derives CodeQL status from the completed CodeQL job."
);
check(
  "release-evidence-provenance-result",
  /provenance_created:/.test(workflow) &&
    /steps\.provenance\.outcome/.test(workflow) &&
    /--provenance=\$\{\{ needs\.static-quality\.outputs\.provenance_created \}\}/.test(
      workflow
    ) &&
    !/--provenance=true/.test(workflow),
  "Release evidence derives provenance status from the attestation step."
);

const result = {
  product: "Paper Flock",
  buildVersion: "1.4.2",
  passed: failures.length === 0,
  passCount: passes.length,
  failureCount: failures.length,
  passes,
  failures
};

console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) {
  process.exitCode = 1;
}
