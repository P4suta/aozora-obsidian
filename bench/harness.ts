// Shared harness for `bench/*.bench.ts`: stands up a fake Obsidian
// Plugin pointing at the on-disk `aozora.wasm`, then exposes an
// initialised `AozoraParser` ready to be exercised inside `bench()`.
//
// Self-contained: bench/ is a peer of tests/ and src/, with its own
// minimal Plugin / App / Vault stubs inlined here. We deliberately
// don't share `tests/__mocks__/obsidian.ts` because the test mock
// captures `setting onChange` handlers that bench does not need, and
// pulling it in would force `tests/` into the bench tsconfig include.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Plugin } from "obsidian";
import { AozoraParser } from "../src/wasm-loader";

/**
 * Read the bundled `aozora.wasm` from disk once at module load.
 * Each call to `readBinary` slices a fresh ArrayBuffer view so
 * wasm-bindgen's consume-once contract holds across iterations.
 */
const wasmBytes = readFileSync(resolve(import.meta.dirname, "..", "aozora.wasm"));

/**
 * Construct a Plugin instance whose `vault.adapter.readBinary`
 * returns the bundled wasm and `manifest.dir` is set so
 * `wasm-loader.ts:53-60` can locate the artefact.
 *
 * The bench harness sits at the system boundary; the cast through
 * `unknown` is the documented seam where runtime-less Obsidian types
 * meet the harness-provided implementation. Production code goes
 * through Obsidian's real Plugin instance and never enters this path.
 */
function buildBenchPlugin(): Plugin {
  const adapter = {
    async readBinary(path: string): Promise<ArrayBuffer> {
      if (!path.endsWith("aozora.wasm")) {
        throw new Error(`bench harness: unexpected readBinary path ${path}`);
      }
      return wasmBytes.buffer.slice(
        wasmBytes.byteOffset,
        wasmBytes.byteOffset + wasmBytes.byteLength,
      );
    },
    async exists(_path: string): Promise<boolean> {
      return true;
    },
  };

  const stub = {
    manifest: { id: "aozora", dir: "/aozora-stub" },
    app: {
      vault: { adapter },
      workspace: {
        iterateAllLeaves(_fn: (leaf: unknown) => void): void {},
      },
    },
  };

  return stub as unknown as Plugin;
}

/**
 * Initialise an `AozoraParser` ready for use inside `bench(...)`
 * blocks. The returned parser has already paid the WASM init cost,
 * so subsequent `parse()` calls measure pure parse + render work.
 */
export async function makeReadyParser(): Promise<AozoraParser> {
  const plugin = buildBenchPlugin();
  const parser = new AozoraParser(plugin);
  await parser.ready();
  return parser;
}

/**
 * Same as above but also returns a fresh, un-initialised parser
 * factory. Useful for benches that measure cold-init latency
 * separately from steady-state parse cost.
 */
export function makeColdParserFactory(): () => AozoraParser {
  return () => new AozoraParser(buildBenchPlugin());
}
