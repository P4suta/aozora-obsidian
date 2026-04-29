import type { TFile, Vault } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { detectAozoraTxt, type TxtDetectorDeps } from "../src/txt-detector";

function fakeFile(path: string): TFile {
  const segments = path.split("/");
  const name = segments[segments.length - 1] ?? path;
  const dot = name.lastIndexOf(".");
  return {
    path,
    name,
    extension: dot >= 0 ? name.slice(dot + 1) : "",
  };
}

function depsWithBytes(bytes: ArrayBuffer): TxtDetectorDeps {
  return {
    vault: {
      adapter: {
        readBinary: vi.fn().mockResolvedValue(bytes),
        exists: vi.fn().mockResolvedValue(true),
      },
    } as unknown as Vault,
    defaultEncoding: "utf8",
  };
}

function utf8Bytes(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

describe("detectAozoraTxt", () => {
  it("returns glob-match when path matches a configured glob", async () => {
    const result = await detectAozoraTxt(
      fakeFile("小説/aaa.txt"),
      ["小説/**/*.txt"],
      depsWithBytes(utf8Bytes("")),
    );
    expect(result).toEqual({ isAozora: true, reason: "glob-match" });
  });

  it("returns header-marker when 底本：is in the first 4 KiB", async () => {
    const result = await detectAozoraTxt(
      fakeFile("note.txt"),
      [],
      depsWithBytes(utf8Bytes("body\n底本：『青空文庫』\n")),
    );
    expect(result).toEqual({ isAozora: true, reason: "header-marker" });
  });

  it("returns no-match when neither glob nor header marker hit", async () => {
    const result = await detectAozoraTxt(
      fakeFile("note.txt"),
      [],
      depsWithBytes(utf8Bytes("ordinary text without any aozora marker")),
    );
    expect(result).toEqual({ isAozora: false, reason: "no-match" });
  });

  it("only sniffs the first 4 KiB — markers past that are missed by design", async () => {
    const filler = "x".repeat(5000);
    const text = `${filler}底本：late\n`;
    const result = await detectAozoraTxt(
      fakeFile("note.txt"),
      [],
      depsWithBytes(utf8Bytes(text)),
    );
    expect(result.isAozora).toBe(false);
  });

  it("respects defaultEncoding when sniffing payloads — sjis fallback", async () => {
    // SJIS-encoded "あい" — does NOT contain the 底本 marker, so the
    // expected outcome is "no-match" via the sjis decoder, proving
    // the encoding path is reachable. (The encoding itself is
    // exhaustively unit-tested in encoding.test.ts.)
    const sjis = new Uint8Array([0x82, 0xa0, 0x82, 0xa2]).buffer as ArrayBuffer;
    const result = await detectAozoraTxt(fakeFile("legacy.txt"), [], {
      vault: {
        adapter: {
          readBinary: vi.fn().mockResolvedValue(sjis),
          exists: vi.fn().mockResolvedValue(true),
        },
      } as unknown as Vault,
      defaultEncoding: "sjis",
    });
    expect(result).toEqual({ isAozora: false, reason: "no-match" });
  });
});
