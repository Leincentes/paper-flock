#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  fileURLToPath
} from "node:url";
import {
  createQualityEvidence
} from "../src/quality-evidence-core.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const output = argument("output") ??
  path.join(root, "quality-evidence.json");
const releaseArchive = argument("release-archive") ??
  path.join(
    root,
    "release-bundle",
    "paper-flock-v1.2-release.zip"
  );

if (!fs.existsSync(releaseArchive)) {
  throw new Error(
    `Release archive does not exist: ${releaseArchive}`
  );
}

const digest = crypto
  .createHash("sha256")
  .update(fs.readFileSync(releaseArchive))
  .digest("hex");

const evidence = createQualityEvidence({
  buildVersion: "1.2",
  commitSha:
    process.env.GITHUB_SHA ??
    argument("commit-sha") ??
    "",
  repository:
    process.env.GITHUB_REPOSITORY ??
    argument("repository") ??
    "",
  workflowRunId:
    process.env.GITHUB_RUN_ID ??
    argument("run-id") ??
    "",
  workflowRunUrl:
    process.env.GITHUB_SERVER_URL &&
    process.env.GITHUB_REPOSITORY &&
    process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : "",
  releaseDigest: digest,
  checks: {
    unitTestsPassed: flag("unit-tests"),
    packageAuditPassed: flag("package-audit"),
    dependencyAuditPassed: flag("dependency-audit"),
    releaseAuditPassed: flag("release-audit"),
    browserTestsPassed: flag("browser-tests"),
    lighthousePassed: flag("lighthouse"),
    codeqlPassed: flag("codeql"),
    deploymentAuditPassed: flag("deployment-audit"),
    sbomCreated: flag("sbom"),
    provenanceCreated: flag("provenance")
  }
});

fs.mkdirSync(path.dirname(output), {
  recursive: true
});
fs.writeFileSync(
  output,
  `${JSON.stringify({ evidence }, null, 2)}\n`
);
console.log(output);

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

function flag(name) {
  const value =
    argument(name) ??
    process.env[
      `QUALITY_${name.replaceAll("-", "_").toUpperCase()}`
    ];
  return value === "true";
}
