import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type AozoraNodeKind,
  AozoraNodeKindSchema,
  AozoraNodeViewListSchema,
  AozoraNodeViewSchema,
} from "../../src/wasm/node-schema";

const ALL_KINDS: readonly AozoraNodeKind[] = [
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
];

const kindArb = fc.constantFrom(...ALL_KINDS);
const nodeArb = fc.record({
  kind: kindArb,
  start: fc.nat(),
  end: fc.nat(),
});

describe("AozoraNodeKindSchema", () => {
  it("accepts every documented kind", () => {
    for (const kind of ALL_KINDS) {
      expect(AozoraNodeKindSchema.safeParse(kind).success).toBe(true);
    }
  });

  it("rejects an unrecognised kind string", () => {
    expect(AozoraNodeKindSchema.safeParse("novel-future-kind").success).toBe(false);
  });

  it("rejects a non-string", () => {
    expect(AozoraNodeKindSchema.safeParse(42).success).toBe(false);
  });
});

describe("AozoraNodeViewSchema", () => {
  it("accepts every shape the Rust emitter is allowed to produce", () => {
    fc.assert(
      fc.property(nodeArb, (n) => {
        expect(AozoraNodeViewSchema.safeParse(n).success).toBe(true);
      }),
    );
  });

  it("rejects negative offsets", () => {
    expect(
      AozoraNodeViewSchema.safeParse({ kind: "ruby", start: -1, end: 5 }).success,
    ).toBe(false);
    expect(
      AozoraNodeViewSchema.safeParse({ kind: "ruby", start: 0, end: -1 }).success,
    ).toBe(false);
  });

  it("rejects non-integer offsets", () => {
    expect(
      AozoraNodeViewSchema.safeParse({ kind: "ruby", start: 1.5, end: 5 }).success,
    ).toBe(false);
  });

  it("rejects unknown extra fields by stripping them (zod default)", () => {
    // zod's default is "strip extras and accept" — the parsed
    // result drops the extra field rather than rejecting outright.
    const parsed = AozoraNodeViewSchema.safeParse({
      kind: "ruby",
      start: 0,
      end: 5,
      somethingExtraneous: 123,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({ kind: "ruby", start: 0, end: 5 });
    }
  });
});

describe("AozoraNodeViewListSchema", () => {
  it("accepts an empty array (the no-aozora-content case)", () => {
    expect(AozoraNodeViewListSchema.safeParse([]).success).toBe(true);
  });

  it("accepts arbitrary-length valid arrays", () => {
    fc.assert(
      fc.property(fc.array(nodeArb), (xs) => {
        expect(AozoraNodeViewListSchema.safeParse(xs).success).toBe(true);
      }),
    );
  });

  it("rejects when even one entry is malformed", () => {
    fc.assert(
      fc.property(fc.array(nodeArb, { minLength: 1 }), fc.nat(), (xs, idx) => {
        const i = idx % xs.length;
        const corrupt = xs.map((x, j) => (j === i ? { kind: "garbage", start: 0, end: 0 } : x));
        expect(AozoraNodeViewListSchema.safeParse(corrupt).success).toBe(false);
      }),
    );
  });

  it("rejects when the top-level value is not an array", () => {
    expect(AozoraNodeViewListSchema.safeParse({ foo: 1 }).success).toBe(false);
    expect(AozoraNodeViewListSchema.safeParse("[]").success).toBe(false);
    expect(AozoraNodeViewListSchema.safeParse(null).success).toBe(false);
  });
});
