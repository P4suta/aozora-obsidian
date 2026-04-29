import type { Document as RawDocument } from "aozora-wasm";
import type { MarkdownPostProcessorContext } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { AozoraDocumentHandle } from "../src/aozora-wasm";
import { createAozoraCodeBlockProcessor } from "../src/processor";
import type { AozoraSettings } from "../src/settings";
import type { AozoraParser } from "../src/wasm-loader";

function fakeRawDocument(html: string, diagnosticsJson = "[]"): RawDocument {
  return {
    to_html: () => html,
    serialize: () => "",
    diagnostics_json: () => diagnosticsJson,
    source_byte_len: () => 0,
    free: () => {},
    [Symbol.dispose]: () => {},
  } as unknown as RawDocument;
}

function fakeParser(html: string, diagnosticsJson = "[]"): AozoraParser {
  const inner = {
    ready: () => Promise.resolve(),
    parse: async () => new AozoraDocumentHandle(fakeRawDocument(html, diagnosticsJson)),
  };
  return inner as unknown as AozoraParser;
}

function settings(overrides: Partial<AozoraSettings> = {}): AozoraSettings {
  return {
    writingMode: "horizontal",
    enableLivePreview: true,
    defaultEncoding: "utf8",
    gaijiFallback: "description",
    detectAozoraTxt: true,
    txtGlob: [],
    ...overrides,
  };
}

const ctxStub = (): MarkdownPostProcessorContext =>
  ({
    docId: "d",
    sourcePath: "p",
    frontmatter: null,
    addChild: vi.fn(),
    getSectionInfo: () => null,
  }) as MarkdownPostProcessorContext;

describe("createAozoraCodeBlockProcessor", () => {
  it("wraps WASM HTML inside an aozora horizontal container", async () => {
    const processor = createAozoraCodeBlockProcessor({
      parser: fakeParser("<p>hello</p>"),
      getSettings: () => settings(),
    });
    const el = document.createElement("div");
    await processor("source", el, ctxStub());
    const container = el.firstElementChild as HTMLElement;
    expect(container.classList.contains("aozora")).toBe(true);
    expect(container.classList.contains("aozora--horizontal")).toBe(true);
    expect(container.innerHTML).toContain("<p>hello</p>");
    expect(container.dataset.aozoraGaijiMode).toBe("description");
  });

  it("flips to vertical class when the writingMode setting is vertical", async () => {
    const processor = createAozoraCodeBlockProcessor({
      parser: fakeParser("<p>v</p>"),
      getSettings: () => settings({ writingMode: "vertical", gaijiFallback: "codepoint" }),
    });
    const el = document.createElement("div");
    await processor("v", el, ctxStub());
    const container = el.firstElementChild as HTMLElement;
    expect(container.classList.contains("aozora--vertical")).toBe(true);
    expect(container.dataset.aozoraGaijiMode).toBe("codepoint");
  });

  it("appends a diagnostics note when the WASM reports them", async () => {
    const diagnosticsJson = JSON.stringify([
      { kind: "unclosed_bracket", span_start: 0, span_end: 1 },
    ]);
    const processor = createAozoraCodeBlockProcessor({
      parser: fakeParser("<p>x</p>", diagnosticsJson),
      getSettings: () => settings(),
    });
    const el = document.createElement("div");
    await processor("src", el, ctxStub());
    expect(el.querySelector(".aozora-diagnostics")?.textContent).toMatch(/1 diagnostic/);
  });

  it("falls back to verbatim output when the parser rejects", async () => {
    const failingParser = {
      ready: () => Promise.resolve(),
      parse: () => Promise.reject(new Error("wasm load failed")),
    } as unknown as AozoraParser;
    const processor = createAozoraCodeBlockProcessor({
      parser: failingParser,
      getSettings: () => settings(),
    });
    const el = document.createElement("div");
    await processor("ｿｰｽ", el, ctxStub());
    const container = el.firstElementChild as HTMLElement;
    expect(container.classList.contains("aozora--fallback")).toBe(true);
    expect(container.querySelector("pre")?.textContent).toBe("ｿｰｽ");
    expect(container.querySelector(".aozora-fallback-banner")?.textContent).toMatch(
      /aozora renderer unavailable/,
    );
  });

  it("renders fallback banner with non-Error rejection messages", async () => {
    const failingParser = {
      ready: () => Promise.resolve(),
      parse: () => Promise.reject("string-error"),
    } as unknown as AozoraParser;
    const processor = createAozoraCodeBlockProcessor({
      parser: failingParser,
      getSettings: () => settings(),
    });
    const el = document.createElement("div");
    await processor("body", el, ctxStub());
    expect(el.querySelector(".aozora-fallback-banner")?.textContent).toContain("string-error");
  });
});
