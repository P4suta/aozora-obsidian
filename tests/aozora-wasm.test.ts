import { describe, expect, it, vi } from "vitest";
import type { Document as RawDocument } from "aozora-wasm";
import { AozoraDocumentHandle } from "../src/aozora-wasm";

function fakeDocument(opts: {
  html?: string;
  serialized?: string;
  diagnostics?: string;
  byteLen?: number;
}): RawDocument {
  return {
    to_html: () => opts.html ?? "<p></p>",
    serialize: () => opts.serialized ?? "",
    diagnostics_json: () => opts.diagnostics ?? "[]",
    source_byte_len: () => opts.byteLen ?? 0,
    free: () => {},
    [Symbol.dispose]: () => {},
  } as unknown as RawDocument;
}

describe("AozoraDocumentHandle", () => {
  it("returns to_html via toHtml", () => {
    const handle = new AozoraDocumentHandle(fakeDocument({ html: "<p>hi</p>" }));
    expect(handle.toHtml()).toBe("<p>hi</p>");
  });

  it("returns serialize via serialize", () => {
    const handle = new AozoraDocumentHandle(fakeDocument({ serialized: "raw" }));
    expect(handle.serialize()).toBe("raw");
  });

  it("returns sourceByteLen via source_byte_len", () => {
    const handle = new AozoraDocumentHandle(fakeDocument({ byteLen: 42 }));
    expect(handle.sourceByteLen()).toBe(42);
  });

  it("parses diagnostics JSON into camelCase entries", () => {
    const json = JSON.stringify([
      { kind: "source_contains_pua", span_start: 1, span_end: 3, codepoint: "" },
      { kind: "unclosed_bracket", span_start: 5, span_end: 7 },
    ]);
    const handle = new AozoraDocumentHandle(fakeDocument({ diagnostics: json }));
    const diags = handle.diagnostics();
    expect(diags).toHaveLength(2);
    expect(diags[0]).toEqual({
      kind: "source_contains_pua",
      spanStart: 1,
      spanEnd: 3,
      codepoint: "",
    });
    expect(diags[1]).toEqual({
      kind: "unclosed_bracket",
      spanStart: 5,
      spanEnd: 7,
      codepoint: undefined,
    });
  });

  it("falls back to 'unknown' for unknown diagnostic kinds", () => {
    const json = JSON.stringify([{ kind: "novel-future-kind", span_start: 0, span_end: 0 }]);
    const handle = new AozoraDocumentHandle(fakeDocument({ diagnostics: json }));
    expect(handle.diagnostics()[0]?.kind).toBe("unknown");
  });

  it("returns empty array when diagnostics_json is malformed JSON", () => {
    const handle = new AozoraDocumentHandle(fakeDocument({ diagnostics: "{not json" }));
    expect(handle.diagnostics()).toEqual([]);
  });

  it("returns empty array when diagnostics_json is not an array", () => {
    const handle = new AozoraDocumentHandle(fakeDocument({ diagnostics: '{"foo":1}' }));
    expect(handle.diagnostics()).toEqual([]);
  });

  it("returns 'unknown' for malformed entries (non-object)", () => {
    const json = JSON.stringify([null, 42, "string"]);
    const handle = new AozoraDocumentHandle(fakeDocument({ diagnostics: json }));
    const diags = handle.diagnostics();
    expect(diags).toHaveLength(3);
    for (const diag of diags) {
      expect(diag.kind).toBe("unknown");
      expect(diag.spanStart).toBe(0);
      expect(diag.spanEnd).toBe(0);
    }
  });

  it("handles missing span_start / span_end fields by zero-filling", () => {
    const json = JSON.stringify([{ kind: "unclosed_bracket" }]);
    const handle = new AozoraDocumentHandle(fakeDocument({ diagnostics: json }));
    const diag = handle.diagnostics()[0];
    expect(diag).toEqual({
      kind: "unclosed_bracket",
      spanStart: 0,
      spanEnd: 0,
      codepoint: undefined,
    });
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
