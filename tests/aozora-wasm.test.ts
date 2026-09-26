import { describe, expect, it, vi } from "vitest";
import type { Document as RawDocument } from "aozora-wasm";
import { type AozoraDiagnostic, AozoraDocumentHandle } from "../src/aozora-wasm";

function fakeDocument(opts: {
  html?: string;
  serialized?: string;
  diagnostics?: readonly AozoraDiagnostic[];
  byteLen?: number;
}): RawDocument {
  return {
    toHtml: () => opts.html ?? "<p></p>",
    toSource: () => opts.serialized ?? "",
    diagnostics: () => opts.diagnostics ?? [],
    sourceByteLen: () => opts.byteLen ?? 0,
    free: () => {},
    [Symbol.dispose]: () => {},
  } as unknown as RawDocument;
}

describe("AozoraDocumentHandle", () => {
  it("returns toHtml via toHtml", () => {
    const handle = new AozoraDocumentHandle(fakeDocument({ html: "<p>hi</p>" }));
    expect(handle.toHtml()).toBe("<p>hi</p>");
  });

  it("returns toSource via serialize", () => {
    const handle = new AozoraDocumentHandle(fakeDocument({ serialized: "raw" }));
    expect(handle.serialize()).toBe("raw");
  });

  it("returns sourceByteLen via sourceByteLen", () => {
    const handle = new AozoraDocumentHandle(fakeDocument({ byteLen: 42 }));
    expect(handle.sourceByteLen()).toBe(42);
  });

  it("returns the typed diagnostics from wasm", () => {
    const diagnostics: readonly AozoraDiagnostic[] = [
      {
        kind: "source_contains_pua",
        severity: "warning",
        source: "source",
        span: { start: 1, end: 3 },
        codepoint: 0xe000,
      },
      {
        kind: "unclosed_bracket",
        severity: "error",
        source: "source",
        span: { start: 5, end: 7 },
      },
    ];
    const handle = new AozoraDocumentHandle(fakeDocument({ diagnostics }));
    const diags = handle.diagnostics();
    expect(diags).toBe(diagnostics);
  });

  it("calls inner.free exactly once across multiple disposes", () => {
    const free = vi.fn();
    const inner = fakeDocument({});
    Object.assign(inner, { free });
    const handle = new AozoraDocumentHandle(inner);
    handle.dispose();
    handle.dispose();
    expect(free).toHaveBeenCalledTimes(1);
  });

  it("throws on use-after-dispose for every accessor", () => {
    const handle = new AozoraDocumentHandle(fakeDocument({}));
    handle.dispose();
    expect(() => handle.toHtml()).toThrow(/disposed/);
    expect(() => handle.serialize()).toThrow(/disposed/);
    expect(() => handle.diagnostics()).toThrow(/disposed/);
    expect(() => handle.sourceByteLen()).toThrow(/disposed/);
  });
});
