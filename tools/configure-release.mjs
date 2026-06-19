#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const configPath = path.join(root, "app-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

function arg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

const email = arg("support-email");
const url = arg("support-url");
const repository = arg("repository-url");
const canonicalUrl = arg("canonical-url");
const publisherName = arg("publisher-name");
const releaseChannel = arg("release-channel");

if (email !== null) {
  config.supportEmail = email.trim();
}
if (url !== null) {
  config.supportUrl = url.trim();
}
if (repository !== null) {
  config.repositoryUrl = repository.trim();
}
if (canonicalUrl !== null) {
  config.canonicalUrl = canonicalUrl.trim();
}
if (publisherName !== null) {
  config.publisherName = publisherName.trim();
}
if (releaseChannel !== null) {
  config.releaseChannel = releaseChannel.trim();
}

fs.writeFileSync(
  configPath,
  `${JSON.stringify(config, null, 2)}\n`
);

console.log(
  JSON.stringify(
    {
      configured: Boolean(config.supportEmail || config.supportUrl),
      supportEmail: config.supportEmail,
      supportUrl: config.supportUrl,
      repositoryUrl: config.repositoryUrl,
      canonicalUrl: config.canonicalUrl,
      publisherName: config.publisherName,
      releaseChannel: config.releaseChannel
    },
    null,
    2
  )
);
