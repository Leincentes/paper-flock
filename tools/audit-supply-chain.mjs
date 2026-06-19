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
const index = read("index.html");

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
  "quality-evidence-runtime",
  /src="\.\/src\/production-release-ui\.js"/.test(index),
  "Production evidence center is loaded."
);
check(
  "quality-schema",
  fs.existsSync(path.join(root, "quality-evidence.schema.json")),
  "Quality evidence schema exists."
);

const result = {
  product: "Paper Flock",
  buildVersion: "1.0",
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
