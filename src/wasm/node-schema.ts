import * as z from "zod";

/**
 * Wire schema for the JSON emitted by `aozora::Document::nodes_json`
 * (a single-source-of-truth `aozora_node_kind_str` lives in the
 * Rust side at `aozora/crates/aozora-wasm/src/lib.rs`).
 *
 * Each entry tags one source-byte span with the `AozoraNode`
 * discriminant in camelCase. The schema constrains `kind` to the
 * 19 strings the Rust helper emits, with the `unknown` fall-through
 * preserved so a forward-compatible `non_exhaustive` upstream
 * doesn't break the JS boundary.
 *
 * `start` / `end` arrive as `u32` byte offsets into the source.
 * Both are non-negative integers; we don't yet brand them as
 * `ByteOffset` (Phase 1) at this layer because the schema is the
 * boundary translator — branding is the consumer's job (Phase 4
 * Lezer Tree builder will brand on intake).
 */

export const AozoraNodeKindSchema = z.enum([
  "ruby",
  "bouten",
  "tateChuYoko",
  "gaiji",
  "indent",
  "alignEnd",
  "warichu",
  "keigakomi",
  "pageBreak",
  "sectionBreak",
  "heading",
  "headingHint",
  "sashie",
  "kaeriten",
  "annotation",
  "doubleRuby",
  "container",
  "containerOpen",
  "containerClose",
  "unknown",
]);

export type AozoraNodeKind = z.infer<typeof AozoraNodeKindSchema>;

export const AozoraNodeViewSchema = z.object({
  kind: AozoraNodeKindSchema,
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

export type AozoraNodeView = z.infer<typeof AozoraNodeViewSchema>;

export const AozoraNodeViewListSchema = z.array(AozoraNodeViewSchema);
