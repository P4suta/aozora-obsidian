#!/usr/bin/env node
// scripts/check-wasm.mjs — post-build gate.
//
// ADR-0001 says the plugin ships `main.js` + `manifest.json` +
// `styles.css` + `aozora.wasm`. esbuild produces the first; the
// `aozora.wasm` artifact is built externally by
// `wasm-pack build --target web` against the `aozora-wasm` crate.
//
// This script asserts the artifact exists alongside `main.js` AFTER
// a production build. If it's missing, fail loudly so we never ship a
// non-functional plugin to a vault.
//
// PoC stage: the artifact is NOT yet produced upstream, so this gate
// is intentionally a WARNING (exit 0) rather than a hard failure. To
// flip to hard-fail mode for a release build, set `AOZORA_WASM_REQUIRED=1`.

import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const wasmPath = resolve(repoRoot, "aozora.wasm");
const required = process.env.AOZORA_WASM_REQUIRED === "1";

const TWO_MIB = 2 * 1024 * 1024;

if (!existsSync(wasmPath)) {
  const message =
    `aozora.wasm is missing at ${wasmPath}. ` +
    "Build it via `wasm-pack build --target web` in the aozora repo " +
    "and copy `pkg/aozora_wasm_bg.wasm` here as `aozora.wasm`. " +
    "ADR-0001 records the contract.";
  if (required) {
    console.error(`[check-wasm] FAIL: ${message}`);
    process.exit(1);
  }
  console.warn(`[check-wasm] WARN (PoC): ${message}`);
  process.exit(0);
}

const { size } = statSync(wasmPath);
console.info(`[check-wasm] OK: aozora.wasm present (${size} bytes)`);
if (size > TWO_MIB) {
  console.warn(
    `[check-wasm] bundle size ${size} bytes exceeds 2 MiB budget — ` +
      "consider `wasm-opt -Oz` or pruning unused features in aozora-wasm.",
  );
}
