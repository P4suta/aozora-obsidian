import * as fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { type Brand, brand, unbrand } from "../../src/types/brand";

type ByteOffset = Brand<number, "ByteOffset">;
type RowOffset = Brand<number, "RowOffset">;

describe("Brand", () => {
  it("preserves the underlying primitive at runtime", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        const b = brand<number, "ByteOffset">(n);
        expect(unbrand(b)).toBe(n);
      }),
    );
  });

  it("yields the same identity on `===`", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const b = brand<string, "Marker">(s);
        // Reference equality: branding is purely declaration-level.
        expect(unbrand(b)).toBe(s);
      }),
    );
  });

  it("rejects cross-brand assignment at the type level", () => {
    const a = brand<number, "ByteOffset">(0);
    expectTypeOf(a).toEqualTypeOf<ByteOffset>();
    expectTypeOf(a).not.toEqualTypeOf<RowOffset>();
    expectTypeOf<ByteOffset>().not.toEqualTypeOf<number>();
    expectTypeOf<ByteOffset>().not.toEqualTypeOf<RowOffset>();
  });

  it("permits use of the underlying type's operations after unbrand", () => {
    const a = brand<number, "ByteOffset">(10);
    const b = brand<number, "ByteOffset">(20);
    expect(unbrand(a) + unbrand(b)).toBe(30);
  });
});
