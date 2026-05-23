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
    expect(applyHalfWidthPunctuation("hello、world")).toBe("hello,world");
  });

  it("halves 。 when adjacent to ascii (left)", () => {
    expect(applyHalfWidthPunctuation("end。X")).toBe("end.X");
  });

  it("only the punctuation directly adjacent to a letter/digit gets swapped (idempotent boundary)", () => {
    // Letter-only triggering: the leading `、` swaps because of
    // the leading `a`; the trailing `。` does NOT swap because its
    // neighbours are punctuation / boundary, not letter/digit.
    // This is what keeps the function idempotent — see
    // `isAsciiLetterOrDigit` and the swap-table preamble.
    expect(applyHalfWidthPunctuation("a、。")).toBe("a,。");
    expect(applyHalfWidthPunctuation("a,。")).toBe("a,。");
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

  it("never returns a longer string than the input (length-preserving property)", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (s) => {
        const out = applyHalfWidthPunctuation(s);
        // Single-char → single-char swap preserves length exactly.
        expect(out.length).toBe(s.length);
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
    // digit case exercises the third branch in `isAsciiLetterOrDigit`
    // (used by applyHalfWidthPunctuation; reused here as a smoke).
    ["0", false],
    ["9", false],
  ])("classifies %s correctly", (ch, expected) => {
    expect(isLineStartForbidden(ch)).toBe(expected);
  });

  it("digits trigger the half-width swap (covers the digit branch of isAsciiLetterOrDigit)", () => {
    expect(applyHalfWidthPunctuation("1、2")).toBe("1,2");
  });

  it("characters in the gap between letter ranges (0x3A-0x40) do NOT trigger swap", () => {
    // 0x3A ':' / 0x3F '?' sit between digits (0x30-0x39) and
    // uppercase letters (0x41-0x5A). They're ascii but not
    // letter-or-digit, so they must NOT count as ascii context for
    // the punctuation swap. Same for 0x5B-0x60 (gap between
    // uppercase and lowercase letters).
    expect(applyHalfWidthPunctuation(":、?")).toBe(":、?");
    expect(applyHalfWidthPunctuation("[、`")).toBe("[、`");
  });

  it("ascii beyond 0x7A is not letter-or-digit (covers the upper bound)", () => {
    // 0x7B '{' is one past 'z' (0x7A). Should NOT trigger.
    expect(applyHalfWidthPunctuation("{、}")).toBe("{、}");
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
