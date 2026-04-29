import type { Plugin } from "obsidian";
import { AozoraDocumentHandle, type AozoraWasmModule } from "./aozora-wasm";

/**
 * Loads the bundled `aozora.wasm` artifact from the plugin's install
 * directory via Obsidian's vault adapter, and exposes a parser facade.
 *
 * ADR-0001: the plugin ships `main.js` + `manifest.json` + `styles.css`
 * + `aozora.wasm`. The `.wasm` is loaded from disk through Obsidian's
 * platform-agnostic adapter so the same code path works on desktop
 * (Electron, fs-backed) and mobile (iOS / Android, capacitor-backed).
 *
 * The artifact is NOT bundled into `main.js` because:
 *   1. Embedding ~1-2 MiB of base64 bloats the JS bundle and hurts
 *      cold-start (parse cost > fetch cost on mobile).
 *   2. wasm-bindgen's `--target web` glue expects to fetch the .wasm
 *      separately — we keep parity with that pattern.
 *
 * ## PoC stub vs real artifact
 *
 * As of PoC the `.wasm` artifact does NOT yet exist (the
 * `aozora-wasm` crate is gated behind `cfg(target_arch = "wasm32")`
 * and the upstream pipeline that produces a published `pkg/` is not
 * wired). `loadParser` will therefore THROW when the artifact is
 * missing. `scripts/check-wasm.mjs` enforces this at build time —
 * the build fails loudly rather than producing a half-broken bundle.
 *
 * When the real `aozora-wasm` npm package becomes available, the
 * `instantiateWasm` body below collapses to:
 *
 *     import init, { Document } from "aozora-wasm";
 *     await init();
 *     return { Document };
 */
export class AozoraParser {
  private readonly plugin: Plugin;
  private modulePromise: Promise<AozoraWasmModule> | undefined;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Returns the parser's WASM module, instantiating it on first call.
   * Subsequent calls return the cached promise.
   */
  ready(): Promise<AozoraWasmModule> {
    if (this.modulePromise === undefined) {
      this.modulePromise = this.instantiateWasm();
    }
    return this.modulePromise;
  }

  /** Convenience: parse `source` and yield a disposable handle. */
  async parse(source: string): Promise<AozoraDocumentHandle> {
    const mod = await this.ready();
    return new AozoraDocumentHandle(new mod.Document(source));
  }

  private async instantiateWasm(): Promise<AozoraWasmModule> {
    const bytes = await this.readWasmBytes();

    // wasm-bindgen's web glue needs an `__wbindgen_placeholder__`
    // import object populated with the JS-side helpers. Without the
    // real glue we cannot wire those up, so this is the explicit
    // failure point that signals "drop the real `aozora-wasm` npm
    // package in here".
    //
    // Using `WebAssembly.instantiate` directly (NOT
    // `instantiateStreaming`) because Obsidian's vault adapter hands
    // us bytes, not a `Response`. `instantiateStreaming` would need
    // a `fetch()` against a server-served URL, which mobile vaults
    // don't have.
    const importObject: WebAssembly.Imports = {};
    // `WebAssembly.instantiate` is overloaded: (BufferSource, …) →
    // WebAssemblyInstantiatedSource, (Module, …) → Instance.
    // TypeScript's lib.dom resolves the second overload first when
    // the BufferSource is a typed Uint8Array, so we narrow the input
    // to ArrayBuffer to force the source-style return.
    const result: WebAssembly.WebAssemblyInstantiatedSource = await WebAssembly.instantiate(
      bytes.buffer as ArrayBuffer,
      importObject,
    );

    // The wasm-bindgen-generated JS module re-exports the typed
    // `Document` constructor. Until that module is available, we
    // construct a minimal facade over the raw exports — this
    // intentionally throws the moment anyone tries to use it,
    // because the typed constructor cannot be reconstructed without
    // the bindgen glue. The build-time WASM presence check
    // (`scripts/check-wasm.mjs`) catches the missing-artifact case
    // before users hit this path; if the glue itself is missing,
    // surface that loudly rather than silently rendering nothing.
    const wasmExports: WebAssembly.Exports = result.instance.exports;
    if (!("memory" in wasmExports)) {
      throw new Error(
        "aozora.wasm loaded but does not expose `memory` — " +
          "the artifact must be built with `wasm-pack build --target web`. " +
          "See ADR-0001 and scripts/check-wasm.mjs.",
      );
    }
    // The eventual real implementation returns:
    //   return { Document: bound.Document satisfies AozoraDocumentCtor };
    // For now we surface the missing-glue case loudly instead of
    // silently rendering nothing.
    throw new Error(
      "aozora.wasm: wasm-bindgen JS glue is not yet bundled. " +
        "PoC stage: install the published `aozora-wasm` npm package " +
        'and replace src/wasm-loader.ts\'s instantiateWasm() with `import init, { Document } from "aozora-wasm"`. ' +
        "Until then, the markdown post-processor falls back to " +
        "rendering the raw aozora source verbatim. See ADR-0001.",
    );
  }

  /**
   * Read `aozora.wasm` from the plugin install directory. Works on
   * desktop and mobile because we go through Obsidian's adapter
   * rather than `fs` / `fetch` directly.
   */
  private async readWasmBytes(): Promise<Uint8Array> {
    const manifestDir = this.plugin.manifest.dir;
    if (manifestDir === undefined) {
      throw new Error(
        "Cannot locate plugin install directory — manifest.dir is undefined. " +
          "Is the plugin installed correctly?",
      );
    }
    const wasmPath = `${manifestDir}/aozora.wasm`;
    const adapter = this.plugin.app.vault.adapter;

    if (!(await adapter.exists(wasmPath))) {
      throw new Error(
        `aozora.wasm missing at ${wasmPath}. ` +
          "Build the parser via `wasm-pack build --target web` in the " +
          "aozora repo and copy `pkg/aozora_wasm_bg.wasm` to this plugin's " +
          "install dir as `aozora.wasm`. See ADR-0001 + README.md.",
      );
    }
    const bytes = await adapter.readBinary(wasmPath);
    return new Uint8Array(bytes);
  }
}
