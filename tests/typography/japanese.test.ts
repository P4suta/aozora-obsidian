import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  applyHalfWidthPunctuation,
  isLineStartForbidden,
} from "../../src/typography/japanese";

describe("applyHalfWidthPunctuation", () => {
  it("returns the input unchanged when there is no punctuation", () => {
    expect(applyHalfWidthPunctuation("こんにちは")).toBe("こんにちは");
  });

  it("returns the empty string for empty input", () => {
    expect(applyHalfWidthPunctuation("")).toBe("");
  });

  it("leaves Japanese punctuation full-width when surrounded by Japanese", () => {
    const input = "あ、いう。";
    expect(applyHalfWidthPunctuation(input)).toBe(input);
  });

  it("halves 、 when adjacent to an ascii character (left)", () => {
    expect(applyHalfWidthPunctuation("hello、world")).toBe("hello, world");
  });

  it("halves 。 when adjacent to ascii (left)", () => {
    expect(applyHalfWidthPunctuation("end。X")).toBe("end. X");
  });

  it("halves 「」 when surrounded by ascii", () => {
    // Quotation marks abutting ascii on at least one side trigger
    // the half-width swap. The implementation uses curly-quote
    // ascii substitutes.
    const input = "abc「def」ghi";
    const out = applyHalfWidthPunctuation(input);
    expect(out).not.toBe(input);
  });

  it("is idempotent (a second application is a no-op)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 30, unit: fc.constantFrom("a", "あ", "、", "。", " ") }),
        (s) => {
          const once = applyHalfWidthPunctuation(s);
          const twice = applyHalfWidthPunctuation(once);
          expect(twice).toBe(once);
        },
      ),
    );
  });

  it("never returns a longer string than max possible (length-bounded property)", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (s) => {
        const out = applyHalfWidthPunctuation(s);
        // Each character maps to at most 2 characters (e.g. `、` → `, `).
        expect(out.length).toBeLessThanOrEqual(s.length * 2);
      }),
    );
  });
});

describe("isLineStartForbidden", () => {
  it.each([
    ["、", true],
    ["。", true],
    ["」", true],
    ["）", true],
    ["）", true],
    [")", true],
    ["あ", false],
    ["A", false],
    ["「", false],
    ["", false],
  ])("classifies %s correctly", (ch, expected) => {
    expect(isLineStartForbidden(ch)).toBe(expected);
  });

  it("the forbidden set is closed under self-test", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        // Property: every character either is or isn't in the set;
        // the function never throws.
        for (const ch of s) {
          expect(typeof isLineStartForbidden(ch)).toBe("boolean");
        }
      }),
    );
  });
});
