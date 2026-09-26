// Re-exports and the plugin-side wrapper around the wasm-bindgen-generated `aozora-wasm` package.
//
// The package itself is the wasm-bindgen JS glue and declarations emitted by `wasm-pack build --target web --release crates/aozora-wasm` from the sibling `aozora` repository.
// `just wasm` writes the output under `./pkg/`, and `package.json` resolves the import through `"aozora-wasm": "file:./pkg"`.
//
// AozoraDocumentHandle wraps the raw wasm-bindgen Document with a disposed flag so accidental use-after-free surfaces as a JavaScript Error rather than a WASM trap.

export type { Diagnostic as AozoraDiagnostic, InitInput, InitOutput } from "aozora-wasm";
export { Document, default as init } from "aozora-wasm";

import type { Diagnostic as AozoraDiagnostic, Document as RawDocument } from "aozora-wasm";

/**
 * Plugin-side wrapper around a parsed document. Adds disposal
 * tracking on top of the raw wasm-bindgen Document so accidental
 * use-after-free surfaces as a JS Error instead of a WASM trap.
 */
export class AozoraDocumentHandle {
  private inner: RawDocument;
  private disposed = false;

  constructor(inner: RawDocument) {
    this.inner = inner;
  }

  toHtml(): string {
    this.assertLive();
    return this.inner.toHtml();
  }

  serialize(): string {
    this.assertLive();
    return this.inner.toSource();
  }

  diagnostics(): readonly AozoraDiagnostic[] {
    this.assertLive();
    return this.inner.diagnostics();
  }

  sourceByteLen(): number {
    this.assertLive();
    return this.inner.sourceByteLen();
  }

  dispose(): void {
    if (!this.disposed) {
      this.inner.free();
      this.disposed = true;
    }
  }

  private assertLive(): void {
    if (this.disposed) {
      throw new Error("AozoraDocumentHandle has been disposed");
    }
  }
}
