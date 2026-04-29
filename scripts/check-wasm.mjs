#!/usr/bin/env node
// scripts/check-wasm.mjs — post-build gate.
//
// ADR-0001: the plugin ships `main.js` + `manifest.json` +
// `styles.css` + `aozora.wasm`. esbuild produces the first; the
// `aozora.wasm` artefact is built externally by
// `wasm-pack build --target web` against the `aozora-wasm` crate.
// `just wasm` runs that build via the Docker `wasm` service.
//
// This script asserts the artefact exists alongside `main.js` and
// stays under the 2 MiB bundle-size budget. A missing or oversized
// artefact fails the build hard so we never ship a non-functional
// plugin to a vault.
//
// Set AOZORA_WASM_REQUIRED=0 to downgrade both checks to warnings
// (e.g. on a PR review machine that hasn't run `just wasm` yet).

import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const wasmPath = resolve(repoRoot, "aozora.wasm");
const required = process.env.AOZORA_WASM_REQUIRED !== "0";

const TWO_MIB = 2 * 1024 * 1024;

function fail(message) {
  if (required) {
    console.error(`[check-wasm] FAIL: ${message}`);
    process.exit(1);
  }
  console.warn(`[check-wasm] WARN: ${message}`);
}

if (!existsSync(wasmPath)) {
  fail(
    `aozora.wasm is missing at ${wasmPath}. ` +
      "Run `just wasm` to rebuild it from the sibling aozora repo, " +
      "or fetch the artefact from a release zip. ADR-0001 records the contract.",
  );
  process.exit(0);
}

const { size } = statSync(wasmPath);
console.info(`[check-wasm] OK: aozora.wasm present (${size} bytes)`);

if (size > TWO_MIB) {
  fail(
    `aozora.wasm is ${size} bytes (> ${TWO_MIB} byte / 2 MiB budget). ` +
      "ADR-0001 sets the bundle-size cap; either prune unused features in " +
      "aozora-wasm or relax the cap explicitly with a workspace-level decision.",
  );
}
