import type { Document as RawDocument } from "aozora-wasm";
import type { MarkdownPostProcessorContext } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { AozoraDocumentHandle } from "../src/aozora-wasm";
import { createAozoraInlineProcessor } from "../src/inline-processor";
import type { AozoraParser } from "../src/wasm-loader";

function fakeRawDocument(html: string): RawDocument {
  return {
    to_html: () => html,
    serialize: () => "",
    diagnostics_json: () => "[]",
    source_byte_len: () => 0,
    free: () => {},
    [Symbol.dispose]: () => {},
  } as unknown as RawDocument;
}

function fakeParser(htmlFor: (source: string) => string): AozoraParser {
  return {
    ready: () => Promise.resolve(),
    parse: async (source: string) => new AozoraDocumentHandle(fakeRawDocument(htmlFor(source))),
  } as unknown as AozoraParser;
}

function ctxStub(): MarkdownPostProcessorContext {
  return {
    docId: "d",
    sourcePath: "p",
    frontmatter: null,
    addChild: vi.fn(),
    getSectionInfo: () => null,
  } as MarkdownPostProcessorContext;
}

describe("createAozoraInlineProcessor", () => {
  it("replaces text nodes containing sentinels with the rendered fragment", async () => {
    const processor = createAozoraInlineProcessor({
      parser: fakeParser(() => "<p><ruby>漢字<rt>かんじ</rt></ruby></p>"),
    });
    const el = document.createElement("div");
    el.innerHTML = "<p>本文｜漢字《かんじ》です</p>";
    await processor(el, ctxStub());
    expect(el.innerHTML).toContain("<ruby>漢字<rt>かんじ</rt></ruby>");
  });

  it("leaves paragraphs without sentinels untouched", async () => {
    const parserMock = vi.fn();
    const processor = createAozoraInlineProcessor({
      parser: {
        ready: () => Promise.resolve(),
        parse: parserMock,
      } as unknown as AozoraParser,
    });
    const el = document.createElement("div");
    el.innerHTML = "<p>plain text without markers</p>";
    const before = el.innerHTML;
    await processor(el, ctxStub());
    expect(el.innerHTML).toBe(before);
    expect(parserMock).not.toHaveBeenCalled();
  });

  it("returns early when the host element has no targeted blocks", async () => {
    const ctx = ctxStub();
    const processor = createAozoraInlineProcessor({
      parser: fakeParser(() => "should-never-be-called"),
    });
    const el = document.createElement("div");
    el.innerHTML = "<a href='#'>link with ｜x《y》</a>";
    const before = el.innerHTML;
    await processor(el, ctx);
    expect(el.innerHTML).toBe(before);
    expect(ctx.addChild).not.toHaveBeenCalled();
  });

  it("processes table cells as targeted blocks", async () => {
    const processor = createAozoraInlineProcessor({
      parser: fakeParser(() => "<p>RENDERED</p>"),
    });
    const el = document.createElement("div");
    el.innerHTML = "<table><tr><td>｜文《fumi》</td></tr></table>";
    await processor(el, ctxStub());
    expect(el.querySelector("td")?.textContent).toBe("RENDERED");
  });

  it("registers a render child via ctx.addChild", async () => {
    const ctx = ctxStub();
    const processor = createAozoraInlineProcessor({
      parser: fakeParser(() => "<p>x</p>"),
    });
    const el = document.createElement("div");
    el.innerHTML = "<p>｜漢《かん》</p>";
    await processor(el, ctx);
    expect(ctx.addChild).toHaveBeenCalledTimes(1);
  });

  it("preserves surrounding markup while replacing only the matching text node", async () => {
    const processor = createAozoraInlineProcessor({
      parser: fakeParser(() => "<p><ruby>漢<rt>かん</rt></ruby></p>"),
    });
    const el = document.createElement("div");
    el.innerHTML =
      '<p>before <a href="https://example.com">link</a> ｜漢《かん》 after</p>';
    await processor(el, ctxStub());
    expect(el.querySelector("a")?.getAttribute("href")).toBe("https://example.com");
    expect(el.querySelector("ruby")?.textContent).toContain("かん");
  });

  it("falls through stripOuterParagraph when WASM HTML lacks an outer <p>", async () => {
    const processor = createAozoraInlineProcessor({
      parser: fakeParser(() => "<div data-marker>direct</div>"),
    });
    const el = document.createElement("div");
    el.innerHTML = "<p>｜x《y》</p>";
    await processor(el, ctxStub());
    expect(el.querySelector("[data-marker]")).not.toBeNull();
  });
});
