/**
 * Branded types — nominal type discrimination over structural-only
 * primitives in TypeScript.
 *
 * Mechanism: a phantom property keyed by a `unique symbol` (declared
 * but never materialised at runtime) tags the underlying primitive
 * so two structurally-identical values (e.g. `ByteOffset` and
 * `RowOffset`, both `number` at runtime) cannot be accidentally
 * interchanged at compile time. The brand is declaration-only;
 * runtime cost is zero.
 *
 * Usage:
 *   type ByteOffset = Brand<number, "ByteOffset">;
 *   const o = brand<number, "ByteOffset">(0);   // factory cast
 *   takesByteOffset(o);                          // type-safe pass
 *
 * The `brand` factory owns the unsafe-but-documented cast site.
 * Production code should prefer per-domain factories that wrap
 * `brand` (e.g. `byteOffsetOf(n: number): ByteOffset`) so the
 * domain-specific invariant lives next to the construction.
 */

declare const __brand: unique symbol;

export type Brand<T, K extends string> = T & { readonly [__brand]: K };

/**
 * Tag a primitive with a brand. Documented seam where unbranded
 * values become branded — call only inside a factory that owns the
 * domain invariant (e.g. "the input is a non-negative byte offset
 * into a UTF-8 source").
 */
export function brand<T, K extends string>(value: T): Brand<T, K> {
  return value as Brand<T, K>;
}

/**
 * Strip a brand for cases where the underlying primitive is needed
 * (e.g. arithmetic, JSON serialisation). Brand removal is always
 * safe — the runtime value is unchanged. Provided as a function so
 * call sites read intentionally rather than relying on implicit
 * widening.
 */
export function unbrand<T, K extends string>(branded: Brand<T, K>): T {
  return branded;
}
