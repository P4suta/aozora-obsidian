/**
 * Phantom types — zero-cost type-level kind tags.
 *
 * Distinct from `Brand` (in ./brand.ts) by intent: Brand
 * discriminates two structurally-identical primitives (e.g.
 * `ByteOffset` vs `RowOffset`, both `number`). Phantom tags a
 * structure whose shape is otherwise identical with the kind it
 * represents — used for example to mark a `TokenStream` as carrying
 * tokens of kind `RubyOpen` versus `BoutenOpen` even though both
 * stream types share the same iterator shape.
 *
 * Unlike `Brand`, a Phantom kind tag is **not** required to be a
 * string literal — sometimes it's an existing type alias, a union,
 * or a class identity, and the structural distinguishability is the
 * whole point.
 *
 * Used by:
 *   - Phase 3 token stream API to carry TokenKind through generics.
 *   - Phase 7 Result chains to tag effect handlers.
 */

declare const __phantom: unique symbol;

export type Phantom<T, K> = T & { readonly [__phantom]: K };

/**
 * Tag a value with a phantom kind. Documented seam — call only at
 * a boundary where the kind invariant has been established.
 */
export function tagPhantom<T, K>(value: T): Phantom<T, K> {
  return value as Phantom<T, K>;
}

/**
 * Strip a phantom tag for cases where structural equality is
 * needed. Always safe at runtime; provided as a function so call
 * sites read intentionally.
 */
export function untagPhantom<T, K>(value: Phantom<T, K>): T {
  return value;
}
