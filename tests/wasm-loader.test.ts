import type { Plugin } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { AozoraParser } from "../src/wasm-loader";

vi.mock("aozora-wasm", () => {
  class FakeDocument {
    constructor(private readonly source: string) {}
    to_html(): string {
      return `<p>${this.source}</p>`;
    }
    serialize(): string {
      return this.source;
    }
    diagnostics_json(): string {
      return "[]";
    }
    source_byte_len(): number {
      return this.source.length;
    }
    free(): void {}
    [Symbol.dispose](): void {}
  }
  return {
    default: vi.fn().mockResolvedValue({}),
    Document: FakeDocument,
  };
});

function fakePlugin(options: {
  manifestDir?: string | undefined;
  exists?: boolean;
  bytes?: ArrayBuffer;
}): Plugin {
  const stub = {
    manifest: { id: "aozora", dir: options.manifestDir },
    app: {
      vault: {
        adapter: {
          exists: vi.fn().mockResolvedValue(options.exists ?? true),
          readBinary: vi.fn().mockResolvedValue(options.bytes ?? new ArrayBuffer(8)),
        },
      },
    },
  };
  return stub as unknown as Plugin;
}

describe("AozoraParser", () => {
  it("memoises ready() across calls", async () => {
    const plugin = fakePlugin({ manifestDir: "/plugin", bytes: new ArrayBuffer(4) });
    const parser = new AozoraParser(plugin);
    const a = parser.ready();
    const b = parser.ready();
    expect(a).toBe(b);
    await a;
  });

  it("parses source and returns a disposable handle", async () => {
    const plugin = fakePlugin({ manifestDir: "/plugin", bytes: new ArrayBuffer(4) });
    const parser = new AozoraParser(plugin);
    const handle = await parser.parse("hi");
    expect(handle.toHtml()).toBe("<p>hi</p>");
    handle.dispose();
  });

  it("throws when manifest.dir is undefined", async () => {
    const plugin = fakePlugin({ manifestDir: undefined });
    const parser = new AozoraParser(plugin);
    await expect(parser.ready()).rejects.toThrow(/manifest\.dir is undefined/);
  });

  it("throws when aozora.wasm is missing on disk", async () => {
    const plugin = fakePlugin({ manifestDir: "/plugin", exists: false });
    const parser = new AozoraParser(plugin);
    await expect(parser.ready()).rejects.toThrow(/aozora\.wasm missing/);
  });

  it("reads the wasm bytes through vault.adapter.readBinary", async () => {
    const buffer = new ArrayBuffer(16);
    const plugin = fakePlugin({ manifestDir: "/plugin", bytes: buffer });
    const parser = new AozoraParser(plugin);
    await parser.ready();
    const adapter = plugin.app.vault.adapter as unknown as {
      readBinary: ReturnType<typeof vi.fn>;
    };
    expect(adapter.readBinary).toHaveBeenCalledWith("/plugin/aozora.wasm");
  });
});
