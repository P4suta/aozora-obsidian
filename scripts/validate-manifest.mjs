#!/usr/bin/env node
// scripts/validate-manifest.mjs — manifest.json schema check.
//
// Obsidian does not publish a JSON Schema for plugin manifests; their
// docs at https://docs.obsidian.md/Reference/Manifest enumerate the
// required and optional fields. We codify that surface here as a
// hand-rolled validator so CI catches manifest regressions without
// pulling in a JSON Schema dependency.
//
// Required: id, name, version, minAppVersion, description, author.
// Recommended optional: authorUrl, isDesktopOnly, fundingUrl.
//
// version + minAppVersion must be SemVer-shaped strings.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const manifestPath = resolve(repoRoot, "manifest.json");

const REQUIRED_STRING_FIELDS = ["id", "name", "version", "minAppVersion", "description", "author"];
const OPTIONAL_STRING_FIELDS = ["authorUrl", "fundingUrl", "helpUrl"];
const OPTIONAL_BOOLEAN_FIELDS = ["isDesktopOnly"];

const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/;

const errors = [];

let raw;
try {
  raw = readFileSync(manifestPath, "utf8");
} catch (err) {
  console.error(`[validate-manifest] cannot read ${manifestPath}: ${err.message}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(raw);
} catch (err) {
  console.error(`[validate-manifest] manifest.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
  console.error("[validate-manifest] manifest.json must be a JSON object");
  process.exit(1);
}

for (const field of REQUIRED_STRING_FIELDS) {
  const v = manifest[field];
  if (typeof v !== "string" || v.length === 0) {
    errors.push(`required field \`${field}\` must be a non-empty string`);
  }
}

for (const field of OPTIONAL_STRING_FIELDS) {
  if (field in manifest && typeof manifest[field] !== "string") {
    errors.push(`optional field \`${field}\` must be a string when present`);
  }
}

for (const field of OPTIONAL_BOOLEAN_FIELDS) {
  if (field in manifest && typeof manifest[field] !== "boolean") {
    errors.push(`optional field \`${field}\` must be a boolean when present`);
  }
}

if (typeof manifest.version === "string" && !SEMVER_RE.test(manifest.version)) {
  errors.push(`\`version\` (${manifest.version}) is not a valid SemVer string`);
}
if (typeof manifest.minAppVersion === "string" && !SEMVER_RE.test(manifest.minAppVersion)) {
  errors.push(`\`minAppVersion\` (${manifest.minAppVersion}) is not a valid SemVer string`);
}

// id: lowercase, alphanum + dash only. Obsidian rejects uppercase /
// underscore IDs at install time.
if (typeof manifest.id === "string" && !/^[a-z0-9][a-z0-9-]*$/.test(manifest.id)) {
  errors.push(`\`id\` (${manifest.id}) must match /^[a-z0-9][a-z0-9-]*$/`);
}

// Mobile parity (ADR-0001): the plugin MUST NOT be desktop-only.
if (manifest.isDesktopOnly === true) {
  errors.push(
    "isDesktopOnly: true contradicts ADR-0001 (mobile parity is the whole point of the WASM choice)",
  );
}

if (errors.length > 0) {
  console.error("[validate-manifest] FAIL");
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}

console.info(
  `[validate-manifest] OK: manifest.json validates (${manifest.id} v${manifest.version})`,
);
