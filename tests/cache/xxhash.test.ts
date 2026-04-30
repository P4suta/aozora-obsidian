import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { xxhash32, xxhash32String } from "../../src/cache/xxhash";

describe("xxhash32", () => {
  it("hashes the empty input deterministically", () => {
    const h = xxhash32(new Uint8Array(0));
    // Reference value from upstream xxHash32("", seed=0): 0x02CC5D05.
    expect(h).toBe(0x02_cc_5d_05);
  });

  it("matches the upstream reference for the canonical 'abc' input", () => {
    const h = xxhash32(new TextEncoder().encode("abc"));
    // Reference: xxhash32("abc", seed=0) = 0x32D153FF
    expect(h).toBe(0x32_d1_53_ff);
  });

  it("returns an unsigned 32-bit integer", () => {
    fc.assert(
      fc.property(fc.uint8Array(), (bytes) => {
        const h = xxhash32(bytes);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(0xff_ff_ff_ff);
        expect(Number.isInteger(h)).toBe(true);
      }),
    );
  });

  it("is deterministic for the same (input, seed)", () => {
    fc.assert(
      fc.property(fc.uint8Array(), fc.integer({ min: 0, max: 0xff_ff_ff }), (bytes, seed) => {
        const a = xxhash32(bytes, seed);
        const b = xxhash32(bytes, seed);
        expect(a).toBe(b);
      }),
    );
  });

  it("changes meaningfully on a single-bit input flip (avalanche sanity)", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 4, maxLength: 64 }),
        fc.nat({ max: 31 }),
        (bytes, bit) => {
          const flipped = new Uint8Array(bytes);
          const byteIdx = (bit / 8) | 0;
          const bitIdx = bit % 8;
          if (byteIdx < flipped.length) {
            flipped[byteIdx] = (flipped[byteIdx] ?? 0) ^ (1 << bitIdx);
          }
          // Differ in the hash result for any non-degenerate input.
          if (flipped.length > 0) {
            expect(xxhash32(flipped)).not.toBe(xxhash32(bytes));
          }
        },
      ),
    );
  });

  it("seeds change the hash deterministically", () => {
    const a = xxhash32(new TextEncoder().encode("hello"), 0);
    const b = xxhash32(new TextEncoder().encode("hello"), 1);
    expect(a).not.toBe(b);
  });

  it("handles inputs that span every code path: < 16, == 16, mid-loop, tail", () => {
    // < 16 bytes (skip the four-lane round)
    expect(xxhash32(new Uint8Array(7))).not.toBeUndefined();
    // exactly 16 bytes (one lane round, zero tail)
    expect(xxhash32(new Uint8Array(16))).not.toBeUndefined();
    // > 16 with a 4-byte tail
    expect(xxhash32(new Uint8Array(20))).not.toBeUndefined();
    // > 16 with a 1-byte trailing remainder
    expect(xxhash32(new Uint8Array(17))).not.toBeUndefined();
  });
});

describe("xxhash32String", () => {
  it("matches xxhash32 over the same UTF-8 bytes", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(xxhash32String(s)).toBe(xxhash32(new TextEncoder().encode(s)));
      }),
    );
  });
});
