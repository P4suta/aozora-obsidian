// Re-exports + plugin-side wrapper around the wasm-bindgen-generated
// `aozora-wasm` package.
//
// The package itself is the wasm-bindgen JS glue + .d.ts emitted by
// `wasm-pack build --target web --release crates/aozora-wasm` from
// the sibling `aozora` repository. `just wasm` (or
// `docker compose run --rm wasm`) writes the output under ./pkg/ in
// this repo; `package.json` resolves the import via
// `"aozora-wasm": "file:./pkg"`.
//
// AozoraDocumentHandle wraps the raw wasm-bindgen Document with a
// disposed-flag so accidental use-after-free surfaces as a JS Error
// rather than a WASM trap. The wire JSON shape produced by
// `aozora::diagnostics_json_view` uses snake_case field names; we
// convert to camelCase here at the boundary so the rest of the
// plugin sees idiomatic TypeScript.

import type { Document as RawDocument } from "aozora-wasm";
import { type AozoraNodeView, AozoraNodeViewListSchema } from "./wasm/node-schema";

/** Plugin-side projection of `aozora::Diagnostic`. camelCase. */
interface AozoraDiagnostic {
  readonly kind:
    | "source_contains_pua"
    | "unclosed_bracket"
    | "unmatched_close"
    | "residual_annotation_marker"
    | "unregistered_sentinel"
    | "registry_out_of_order"
    | "registry_position_mismatch"
    | "unknown";
  readonly spanStart: number;
  readonly spanEnd: number;
  readonly codepoint?: string | undefined;
}

function isAozoraDiagnosticKind(value: unknown): value is AozoraDiagnostic["kind"] {
  return (
    value === "source_contains_pua" ||
    value === "unclosed_bracket" ||
    value === "unmatched_close" ||
    value === "residual_annotation_marker" ||
    value === "unregistered_sentinel" ||
    value === "registry_out_of_order" ||
    value === "registry_position_mismatch" ||
    value === "unknown"
  );
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === "number" ? value : 0;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function parseDiagnostic(raw: unknown): AozoraDiagnostic {
  if (raw === null || typeof raw !== "object") {
    return { kind: "unknown", spanStart: 0, spanEnd: 0 };
  }
  const record = raw as Record<string, unknown>;
  const kindRaw = record.kind;
  const kind = isAozoraDiagnosticKind(kindRaw) ? kindRaw : "unknown";
  return {
    kind,
    spanStart: readNumber(record, "span_start"),
    spanEnd: readNumber(record, "span_end"),
    codepoint: readString(record, "codepoint"),
  };
}

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
    return this.inner.to_html();
  }

  serialize(): string {
    this.assertLive();
    return this.inner.serialize();
  }

  diagnostics(): readonly AozoraDiagnostic[] {
    this.assertLive();
    const json = this.inner.diagnostics_json();
    try {
      const parsed: unknown = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map(parseDiagnostic);
    } catch {
      return [];
    }
  }

  /**
   * Classified Aozora-node spans, one entry per source-byte range.
   *
   * Wraps `Document::nodes_json` (Rust side, aozora workspace). The
   * raw wire JSON is validated through `AozoraNodeViewListSchema`
   * before reaching the plugin so a forward-compat upstream change
   * surfaces as a `Result.err` rather than silent corruption.
   *
   * Phase 4 (Lezer Tree builder) and Phase 10 (in-line diagnostic
   * decorator) consume this stream — see
   * `docs/architecture-refresh/00-current-naive-points.md` §0.4
   * for the upstream-vs-TS responsibility split.
   *
   * Returns the empty list when the wire JSON is unparseable; a
   * future Phase 7 promotion will return `Result<readonly
   * AozoraNodeView[], NodeStreamError>` once the Effect layer
   * lands.
   */
  nodes(): readonly AozoraNodeView[] {
    this.assertLive();
    const json = this.inner.nodes_json();
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return [];
    }
    const parsed = AozoraNodeViewListSchema.safeParse(raw);
    return parsed.success ? parsed.data : [];
  }

  sourceByteLen(): number {
    this.assertLive();
    return this.inner.source_byte_len();
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
