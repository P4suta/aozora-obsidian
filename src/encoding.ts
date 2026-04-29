import type { Encoding } from "./settings";

/**
 * Decoders for Aozora `.txt` byte buffers.
 *
 * Aozora Bunko maintains every public-domain text in two encodings:
 *   - UTF-8 (current preferred form, BOM-less by convention)
 *   - Shift_JIS (the original 8-bit encoding used by 青空文庫 since
 *     the late 1990s; many .txt files still ship as SJIS)
 *
 * UTF-16 is rare in the wild but trivially detectable via the BOM,
 * so we accept it transparently and report the result as "utf8" to
 * the caller — the only consumer (the renderer) cares about the
 * text content, not the original byte width.
 *
 * The TextDecoder API ships in every modern browser engine,
 * including Capacitor's WebView on Obsidian Mobile (iOS/Android),
 * so this module needs no platform-specific branch.
 */

const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;
const UTF16_LE_BOM = [0xff, 0xfe] as const;
const UTF16_BE_BOM = [0xfe, 0xff] as const;

export interface DecodeResult {
  readonly text: string;
  readonly encoding: Encoding;
  /** True if a Byte Order Mark drove the encoding choice. */
  readonly hadBom: boolean;
}

/**
 * Decode a byte buffer into Aozora source text.
 *
 * Detection order:
 *   1. UTF-8 BOM → utf-8
 *   2. UTF-16 LE / BE BOM → utf-16, normalised to utf8 in the result
 *   3. No BOM → fall back to the user's `defaultEncoding` setting
 *
 * Decoding uses `fatal: false` so a single corrupt byte is replaced
 * with U+FFFD rather than aborting the entire decode — vintage
 * Aozora .txt files occasionally include stray bytes from legacy
 * editor round-trips, and refusing to render them outright would
 * be more disruptive than tolerating a single replacement glyph.
 */
export function decodeAozoraBytes(bytes: Uint8Array, defaultEncoding: Encoding): DecodeResult {
  if (startsWith(bytes, UTF8_BOM)) {
    return decode(bytes.subarray(UTF8_BOM.length), "utf-8", "utf8", true);
  }
  if (startsWith(bytes, UTF16_LE_BOM)) {
    return decode(bytes.subarray(UTF16_LE_BOM.length), "utf-16le", "utf8", true);
  }
  if (startsWith(bytes, UTF16_BE_BOM)) {
    return decode(bytes.subarray(UTF16_BE_BOM.length), "utf-16be", "utf8", true);
  }
  if (defaultEncoding === "sjis") {
    return decode(bytes, "shift-jis", "sjis", false);
  }
  return decode(bytes, "utf-8", "utf8", false);
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return bytes.length >= prefix.length && prefix.every((value, index) => bytes[index] === value);
}

function decode(
  bytes: Uint8Array,
  decoder: string,
  encoding: Encoding,
  hadBom: boolean,
): DecodeResult {
  const td = new TextDecoder(decoder, { fatal: false });
  return { text: td.decode(bytes), encoding, hadBom };
}
