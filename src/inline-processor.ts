import { type MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import type { AozoraParser } from "./wasm-loader";

/**
 * Reading-view post-processor that walks paragraphs / headings /
 * list items / table cells / blockquotes for Aozora-Bunko inline
 * sentinels (`｜…《…》`, `［＃…］`, `〔…〕`, `※［＃…］`, `《《…》》`)
 * and rewrites the matching text nodes with the WASM renderer's
 * output.
 *
 * We walk text nodes (not whole elements) so existing inline HTML
 * — Markdown links, inline code, embedded math — is left intact.
 *
 * The SENTINEL_PATTERN screening is intentionally over-permissive:
 * it picks any text containing the structural delimiters, then
 * lets the WASM parser decide what to do. The parse cost is
 * 33 ns/byte (linear) so a false positive on, say, a stray `《`
 * costs microseconds.
 */

const SENTINEL_PATTERN = /[｜《※]|［＃|〔/u;
const TARGETED_BLOCK_SELECTOR = "p, li, blockquote, h1, h2, h3, h4, h5, h6, td, th";
const OUTER_PARAGRAPH_PATTERN = /^<p>([\s\S]*)<\/p>$/;

export interface AozoraInlineDeps {
  readonly parser: AozoraParser;
}

export function createAozoraInlineProcessor(
  deps: AozoraInlineDeps,
): (el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void> {
  return async (el, ctx) => {
    const blocks = el.querySelectorAll<HTMLElement>(TARGETED_BLOCK_SELECTOR);
    if (blocks.length === 0) {
      return;
    }
    ctx.addChild(new AozoraInlineRenderChild(el));
    for (const block of Array.from(blocks)) {
      await transformInline(block, deps.parser);
    }
  };
}

class AozoraInlineRenderChild extends MarkdownRenderChild {}

async function transformInline(element: HTMLElement, parser: AozoraParser): Promise<void> {
  const textNodes = collectAozoraTextNodes(element);
  for (const node of textNodes) {
    const handle = await parser.parse(node.data);
    try {
      const inlineHtml = stripOuterParagraph(handle.toHtml());
      const fragment = document.createRange().createContextualFragment(inlineHtml);
      node.replaceWith(fragment);
    } finally {
      handle.dispose();
    }
  }
}

function collectAozoraTextNodes(root: Node): Text[] {
  const matches: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current !== null) {
    const text = current as Text;
    if (SENTINEL_PATTERN.test(text.data)) {
      matches.push(text);
    }
    current = walker.nextNode();
  }
  return matches;
}

function stripOuterParagraph(html: string): string {
  const trimmed = html.trim();
  const wrapper = OUTER_PARAGRAPH_PATTERN.exec(trimmed);
  return wrapper?.[1] ?? trimmed;
}
