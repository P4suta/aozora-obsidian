import init, { Document } from "aozora-wasm";
import type { Plugin } from "obsidian";
import { AozoraDocumentHandle } from "./aozora-wasm";

/**
 * Loads the bundled `aozora.wasm` artifact from the plugin's install
 * directory via Obsidian's vault adapter, and exposes a parser facade.
 *
 * ADR-0001: the plugin ships `main.js` + `manifest.json` + `styles.css`
 * + `aozora.wasm`. The `.wasm` is loaded from disk through Obsidian's
 * platform-agnostic adapter so the same code path works on desktop
 * (Electron, fs-backed) and mobile (iOS / Android, capacitor-backed).
 * `fetch()` + `instantiateStreaming` would not — capacitor's WebView
 * has no HTTP origin to fetch the bundled artefact from.
 */
export class AozoraParser {
  private readonly plugin: Plugin;
  private readyPromise: Promise<void> | undefined;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /** Memoised WASM init. Returns a Promise; idempotent across calls. */
  ready(): Promise<void> {
    if (this.readyPromise === undefined) {
      this.readyPromise = this.instantiateWasm();
    }
    return this.readyPromise;
  }

  /** Parse aozora source and yield a disposable handle. */
  async parse(source: string): Promise<AozoraDocumentHandle> {
    await this.ready();
    return new AozoraDocumentHandle(new Document(source));
  }

  private async instantiateWasm(): Promise<void> {
    const bytes = await this.readWasmBytes();
    // The wasm-bindgen 0.2.x web glue accepts a BufferSource directly.
    // Hand it the bytes obtained via the vault adapter — no `fetch()`
    // call leaves the plugin, so capacitor's WebView (mobile) and
    // Electron (desktop) reach the same instantiation code path.
    await init(bytes);
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
          "Run `just wasm` in the plugin repo to rebuild it from the sibling " +
          "aozora crate, or install a release zip that bundles aozora.wasm. " +
          "See ADR-0001 + README.md.",
      );
    }
    const bytes = await adapter.readBinary(wasmPath);
    return new Uint8Array(bytes);
  }
}
