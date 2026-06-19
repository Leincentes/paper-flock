#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateProductionConfiguration
} from "../src/release-core.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const config = JSON.parse(
  fs.readFileSync(path.join(root, "app-config.json"), "utf8")
);
const result = validateProductionConfiguration(config);

console.log(JSON.stringify(result, null, 2));
if (!result.valid) {
  process.exitCode = 1;
}
