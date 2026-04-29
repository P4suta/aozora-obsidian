import { describe, expect, it } from "vitest";
import { decodeAozoraBytes } from "../src/encoding";

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("decodeAozoraBytes", () => {
  it("strips the UTF-8 BOM and decodes the rest as UTF-8", () => {
    const payload = bytes(0xef, 0xbb, 0xbf, ...utf8("青空"));
    const result = decodeAozoraBytes(payload, "utf8");
    expect(result.text).toBe("青空");
    expect(result.encoding).toBe("utf8");
    expect(result.hadBom).toBe(true);
  });

  it("strips the UTF-16 LE BOM and decodes the rest as UTF-16 LE", () => {
    const text = "あい";
    const utf16le = bytes(0xff, 0xfe, 0x42, 0x30, 0x44, 0x30); // U+3042, U+3044 little-endian
    const result = decodeAozoraBytes(utf16le, "utf8");
    expect(result.text).toBe(text);
    expect(result.encoding).toBe("utf8");
    expect(result.hadBom).toBe(true);
  });

  it("strips the UTF-16 BE BOM and decodes the rest as UTF-16 BE", () => {
    const text = "あい";
    const utf16be = bytes(0xfe, 0xff, 0x30, 0x42, 0x30, 0x44);
    const result = decodeAozoraBytes(utf16be, "utf8");
    expect(result.text).toBe(text);
    expect(result.encoding).toBe("utf8");
    expect(result.hadBom).toBe(true);
  });

  it("falls back to UTF-8 when no BOM and defaultEncoding is utf8", () => {
    const result = decodeAozoraBytes(utf8("plain"), "utf8");
    expect(result.text).toBe("plain");
    expect(result.encoding).toBe("utf8");
    expect(result.hadBom).toBe(false);
  });

  it("falls back to Shift_JIS when no BOM and defaultEncoding is sjis", () => {
    // 'あい' in Shift_JIS: 0x82 0xa0 0x82 0xa2
    const sjisBytes = bytes(0x82, 0xa0, 0x82, 0xa2);
    const result = decodeAozoraBytes(sjisBytes, "sjis");
    expect(result.text).toBe("あい");
    expect(result.encoding).toBe("sjis");
    expect(result.hadBom).toBe(false);
  });

  it("treats a 1-byte buffer that happens to share a BOM prefix as plain", () => {
    // 0xef alone is not a complete UTF-8 BOM; should still decode.
    const result = decodeAozoraBytes(bytes(0xef), "utf8");
    expect(result.hadBom).toBe(false);
    expect(result.encoding).toBe("utf8");
  });

  it("returns empty text for empty input", () => {
    const result = decodeAozoraBytes(new Uint8Array(0), "utf8");
    expect(result.text).toBe("");
    expect(result.hadBom).toBe(false);
    expect(result.encoding).toBe("utf8");
  });
});
