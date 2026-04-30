import { defineLanguageFacet, foldNodeProp, indentNodeProp, Language } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { type SyntaxNode, type Tree } from "@lezer/common";
import { styleTags, tags as t } from "@lezer/highlight";
import type { AozoraNodeView } from "../wasm/node-schema";
import { buildAozoraTree } from "./aozora-parser";
import { aozoraNodeSet } from "./aozora-types";

/**
 * CodeMirror 6 `Language` for Aozora notation.
 *
 * Bridges three upstream pieces (Phase 5, E layer):
 *   - The Lezer `Tree` produced by `buildAozoraTree` (Phase 4) —
 *     itself folded from `AozoraDocumentHandle.nodes()` (Phase 2).
 *   - `@codemirror/language` `Language` infrastructure that gives
 *     us folding, indentation, and language-data hooks for free.
 *   - `@lezer/highlight` `styleTags` that map Lezer NodeType names
 *     to highlight tags — Obsidian's themes pick those up via the
 *     `HighlightStyle` registered on the editor.
 *
 * The `Language` is constructed against an in-memory Lezer Tree the
 * caller already produced (rather than parsing source text inline)
 * — Aozora's lex pipeline lives in WASM; the JS side only ever
 * folds an existing nodes() stream into a Tree. We therefore
 * subclass `Language` with a `parser` that returns the pre-built
 * tree on every call, ignoring the input.
 *
 * Phase 6 (reactivity) reconfigures the editor extension when
 * settings flip; this layer holds no settings of its own.
 */

const aozoraLanguageFacet = defineLanguageFacet({
  // Only one comment style needs declaration (block comments are
  // covered by `［＃...］` annotations); commentTokens is empty.
});

/**
 * Add `styleTags` and folding metadata to the Aozora node set.
 *
 * `styleTags` is keyed by NodeType name (PascalCase, see
 * `aozora-types.ts`). Tags chosen to mirror Obsidian's theme
 * conventions — `tags.literal` for ruby base, `tags.special` for
 * sentinel-bearing constructs, `tags.heading` for headings, etc.
 * Callers who want a custom palette compose a `HighlightStyle`
 * over these tags.
 */
const aozoraNodeSetWithMeta = aozoraNodeSet.extend(
  styleTags({
    Ruby: t.literal,
    Bouten: t.emphasis,
    DoubleRuby: t.emphasis,
    Gaiji: t.special(t.literal),
    TateChuYoko: t.literal,
    Indent: t.meta,
    AlignEnd: t.meta,
    Warichu: t.meta,
    Keigakomi: t.meta,
    PageBreak: t.meta,
    SectionBreak: t.meta,
    Heading: t.heading,
    HeadingHint: t.meta,
    Sashie: t.meta,
    Kaeriten: t.special(t.literal),
    Annotation: t.meta,
    Container: t.meta,
    ContainerOpen: t.meta,
    ContainerClose: t.meta,
    Unknown: t.invalid,
  }),
  foldNodeProp.add({
    Container: (node) => ({ from: node.from, to: node.to }),
    Heading: (node) => ({ from: node.from, to: node.to }),
  }),
  indentNodeProp.add({
    // Indent containers contribute one Aozora-level "step" to the
    // CodeMirror indent tracking; each Lezer fold-able container
    // counts as a +1 step. Concrete pixel offsets are the theme's
    // job (`indentUnit`); we just declare structure here.
    Container: (cx) => cx.baseIndent + cx.unit,
    Indent: (cx) => cx.baseIndent + cx.unit,
  }),
);

/**
 * Construct an Aozora `Language` against a pre-built Lezer Tree.
 *
 * `Language` ordinarily wraps a `Parser`; here we synthesise a
 * fixed-output parser that returns the supplied `tree` on every
 * call. CodeMirror's `Language` doesn't re-parse on every keystroke
 * for our integration pattern — Phase 6 will re-build the tree
 * (via `buildAozoraTree`) when the doc changes and reconfigure
 * the editor with a fresh `Language` instance.
 */
export function aozoraLanguage(tree: Tree): Language {
  return new Language(aozoraLanguageFacet, fixedTreeParser(tree), [], "aozora");
}

/**
 * Build the Aozora `Language` directly from a source + node-stream
 * pair. Convenience for callers that already have both (e.g.
 * Phase 6 reactive store: source from CodeMirror state, nodes()
 * from Phase 2 WASM handle).
 */
export function aozoraLanguageFromNodes(
  source: string,
  nodes: readonly AozoraNodeView[],
): { language: Language; tree: Tree; extension: Extension } {
  const tree = buildAozoraTree(source, nodes);
  // Re-build the NodeSet-with-meta into the tree by re-typing the
  // tree's nodes against the augmented NodeSet. Lezer's `Tree.build`
  // (used in Phase 4) attaches a NodeSet at construction, so the
  // existing tree already references `aozoraNodeSet`. Phase 5's
  // `aozoraNodeSetWithMeta` is `aozoraNodeSet.extend(...)` which
  // returns the SAME NodeType ids with additional NodeProp metadata
  // attached — `node.type.is(...)` and `NodeProp.foldNodeProp.get()`
  // queries work transparently because the props live in a side
  // table keyed by NodeType id.
  const language = aozoraLanguage(tree);
  return { language, tree, extension: language.extension };
}

/**
 * Synthesise a CodeMirror `Parser` that emits a fixed pre-built
 * tree. `Language`'s contract permits this — `parser.parse(input)`
 * returns a `Tree`; we just hand back the same one regardless of
 * input. The standard `LRParser`-driven flow does an actual parse
 * here; Aozora's parse already happened in WASM before we got
 * here, so this shortcut is the natural fit.
 */
function fixedTreeParser(tree: Tree): {
  parse: () => Tree;
  configure: (_: unknown) => { parse: () => Tree };
  hasWrappers: () => boolean;
  startParse: () => { advance: () => Tree; stoppedAt: null; parsedPos: number };
} {
  return {
    parse: () => tree,
    configure: (_) => fixedTreeParser(tree),
    hasWrappers: () => false,
    startParse: () => ({
      advance: () => tree,
      stoppedAt: null,
      parsedPos: tree.length,
    }),
  };
}

/**
 * Re-export used internally by tests + bench to assert NodeProp
 * attachment didn't drop on the .extend() round-trip.
 */
export const aozoraNodeSetForTests = aozoraNodeSetWithMeta;

/**
 * Walk a SyntaxNode subtree and yield each child in document order.
 * Helper for Phase 10 (Diagnostic UX) and Phase 14 (snapshot tests).
 */
export function* walkAozora(node: SyntaxNode): Generator<SyntaxNode> {
  yield node;
  let child = node.firstChild;
  while (child !== null) {
    yield* walkAozora(child);
    child = child.nextSibling;
  }
}
