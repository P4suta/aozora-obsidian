/**
 * xxHash32 — fast non-cryptographic 32-bit hash.
 *
 * Used by `src/cache/lru.ts` to derive a key for the parsed-tree
 * LRU cache from the source-string content. Picked over FNV-1a or
 * djb2 for its better avalanche characteristics + better empirical
 * distribution on Japanese text (Aozora's input domain), at a small
 * implementation-size cost.
 *
 * Implementation reference: <https://github.com/Cyan4973/xxHash>
 * (BSD-2-Clause). The 32-bit variant is sufficient for an in-memory
 * LRU; collision probability at 4 entries is dominated by the cache
 * size itself, not the hash space.
 *
 * JS arithmetic note: `|0` and `Math.imul` are used to enforce
 * 32-bit signed wrap-around on add and multiply respectively. The
 * final `>>> 0` converts to unsigned for stable string output.
 */

const PRIME32_1 = 0x9e_37_79_b1 | 0;
const PRIME32_2 = 0x85_eb_ca_77 | 0;
const PRIME32_3 = 0xc2_b2_ae_3d | 0;
const PRIME32_4 = 0x27_d4_eb_2f | 0;
const PRIME32_5 = 0x16_56_67_b1 | 0;

function rotl32(x: number, r: number): number {
  return (x << r) | (x >>> (32 - r)) | 0;
}

function round32(acc: number, lane: number): number {
  let a = (acc + Math.imul(lane, PRIME32_2)) | 0;
  a = rotl32(a, 13);
  return Math.imul(a, PRIME32_1) | 0;
}

function readU32LE(input: Uint8Array, offset: number): number {
  // Callers gate every invocation on `offset + 4 <= input.length`,
  // so the four indexed reads never go out of bounds. The `?? 0`
  // fallbacks below are defensive — they ensure that an invariant
  // violation (caller bug regressing the bound check) yields a
  // deterministic 0 byte rather than NaN propagation through the
  // hash, keeping the failure mode bounded.
  /* istanbul ignore next -- defensive: bound-checked by every
     caller; the `?? 0` arms are dead under that invariant. */
  return (
    (input[offset] ?? 0) |
    ((input[offset + 1] ?? 0) << 8) |
    ((input[offset + 2] ?? 0) << 16) |
    ((input[offset + 3] ?? 0) << 24) |
    0
  );
}

/**
 * Compute xxHash32 over the bytes in `input`. `seed` defaults to 0.
 * Returns an unsigned 32-bit integer.
 */
export function xxhash32(input: Uint8Array, seed = 0): number {
  const length = input.length;
  let h: number;
  let i = 0;

  if (length >= 16) {
    let v1 = ((seed + PRIME32_1) | 0) + PRIME32_2;
    v1 |= 0;
    let v2 = (seed + PRIME32_2) | 0;
    let v3 = seed | 0;
    let v4 = (seed - PRIME32_1) | 0;

    while (i + 16 <= length) {
      v1 = round32(v1, readU32LE(input, i));
      v2 = round32(v2, readU32LE(input, i + 4));
      v3 = round32(v3, readU32LE(input, i + 8));
      v4 = round32(v4, readU32LE(input, i + 12));
      i += 16;
    }

    h = (rotl32(v1, 1) + rotl32(v2, 7) + rotl32(v3, 12) + rotl32(v4, 18)) | 0;
  } else {
    h = (seed + PRIME32_5) | 0;
  }

  h = (h + length) | 0;

  while (i + 4 <= length) {
    h = (h + Math.imul(readU32LE(input, i), PRIME32_3)) | 0;
    h = Math.imul(rotl32(h, 17), PRIME32_4) | 0;
    i += 4;
  }

  while (i < length) {
    // `i < length` invariant keeps `input[i]` in bounds; the
    // `?? 0` is defensive against an invariant-violation regression
    // and yields a deterministic byte rather than NaN.
    /* istanbul ignore next -- defensive: bound-checked by the loop
       condition; the nullish branch is dead under the invariant. */
    const byte = input[i] ?? 0;
    h = (h + Math.imul(byte, PRIME32_5)) | 0;
    h = Math.imul(rotl32(h, 11), PRIME32_1) | 0;
    i += 1;
  }

  // Avalanche.
  h = (h ^ (h >>> 15)) | 0;
  h = Math.imul(h, PRIME32_2) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, PRIME32_3) | 0;
  h = (h ^ (h >>> 16)) | 0;

  return h >>> 0;
}

/**
 * Convenience: hash the UTF-8 encoding of a JS string.
 *
 * The encoder allocation is per-call; for hot paths that hash many
 * strings, callers should cache the encoder themselves and call
 * `xxhash32(bytes)` directly.
 */
export function xxhash32String(s: string, seed = 0): number {
  const bytes = new TextEncoder().encode(s);
  return xxhash32(bytes, seed);
}
