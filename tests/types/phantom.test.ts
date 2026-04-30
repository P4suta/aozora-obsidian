import * as fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { type Phantom, tagPhantom, untagPhantom } from "../../src/types/phantom";

interface TokenLike {
  readonly start: number;
  readonly end: number;
}
type RubyOpenToken = Phantom<TokenLike, "RubyOpen">;
type BoutenOpenToken = Phantom<TokenLike, "BoutenOpen">;

describe("Phantom", () => {
  it("preserves the underlying value at runtime", () => {
    fc.assert(
      fc.property(fc.nat(), fc.nat(), (start, end) => {
        const t: TokenLike = { start, end };
        const tagged = tagPhantom<TokenLike, "RubyOpen">(t);
        expect(untagPhantom(tagged)).toBe(t);
        expect(untagPhantom(tagged).start).toBe(start);
        expect(untagPhantom(tagged).end).toBe(end);
      }),
    );
  });

  it("differentiates kinds at the type level", () => {
    const ruby = tagPhantom<TokenLike, "RubyOpen">({ start: 0, end: 1 });
    expectTypeOf(ruby).toEqualTypeOf<RubyOpenToken>();
    expectTypeOf(ruby).not.toEqualTypeOf<BoutenOpenToken>();
    expectTypeOf<RubyOpenToken>().not.toEqualTypeOf<BoutenOpenToken>();
  });

  it("is a structural superset of the underlying type", () => {
    const ruby = tagPhantom<TokenLike, "RubyOpen">({ start: 5, end: 7 });
    // Phantom-tagged value still has the underlying shape.
    expect(ruby.start).toBe(5);
    expect(ruby.end).toBe(7);
  });
});
