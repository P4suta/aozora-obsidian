import type { App } from "obsidian";
import { __resetSettingHandlers, __settingHandlers } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type AozoraPlugin from "../src/main";
import { type AozoraSettings, AozoraSettingTab, DEFAULT_SETTINGS } from "../src/settings";

interface FakePlugin {
  app: App;
  settings: AozoraSettings;
  updateSettings: ReturnType<typeof vi.fn>;
}

function makePlugin(): FakePlugin {
  const plugin: FakePlugin = {
    app: {} as App,
    settings: { ...DEFAULT_SETTINGS },
    updateSettings: vi.fn(async (partial: Partial<AozoraSettings>) => {
      Object.assign(plugin.settings, partial);
    }),
  };
  return plugin;
}

beforeEach(() => {
  __resetSettingHandlers();
});

describe("AozoraSettingTab", () => {
  it("renders settings UI without throwing", () => {
    const plugin = makePlugin();
    const tab = new AozoraSettingTab({} as App, plugin as unknown as AozoraPlugin);
    tab.display();
    expect(tab.containerEl.querySelector("h2")?.textContent).toBe("Aozora Bunko Notation");
  });

  it("captures four dropdown handlers (writing mode + encoding + gaiji)", () => {
    const plugin = makePlugin();
    const tab = new AozoraSettingTab({} as App, plugin as unknown as AozoraPlugin);
    tab.display();
    // writingMode, defaultEncoding, gaijiFallback = 3 dropdowns
    expect(__settingHandlers.dropdown.length).toBe(3);
  });

  it("captures two toggle handlers (live preview + detect txt)", () => {
    const plugin = makePlugin();
    const tab = new AozoraSettingTab({} as App, plugin as unknown as AozoraPlugin);
    tab.display();
    expect(__settingHandlers.toggle.length).toBe(2);
  });

  it("captures one textarea handler (txtGlob)", () => {
    const plugin = makePlugin();
    const tab = new AozoraSettingTab({} as App, plugin as unknown as AozoraPlugin);
    tab.display();
    expect(__settingHandlers.textArea.length).toBe(1);
  });

  it("forwards writingMode dropdown changes to plugin.updateSettings", async () => {
    const plugin = makePlugin();
    const tab = new AozoraSettingTab({} as App, plugin as unknown as AozoraPlugin);
    tab.display();
    const writingModeHandler = __settingHandlers.dropdown[0];
    expect(writingModeHandler).toBeDefined();
    await writingModeHandler?.("vertical");
    expect(plugin.updateSettings).toHaveBeenCalledWith({ writingMode: "vertical" });
  });

  it("forwards defaultEncoding dropdown changes", async () => {
    const plugin = makePlugin();
    const tab = new AozoraSettingTab({} as App, plugin as unknown as AozoraPlugin);
    tab.display();
    const encodingHandler = __settingHandlers.dropdown[1];
    await encodingHandler?.("sjis");
    expect(plugin.updateSettings).toHaveBeenCalledWith({ defaultEncoding: "sjis" });
  });

  it("forwards gaijiFallback dropdown changes", async () => {
    const plugin = makePlugin();
    const tab = new AozoraSettingTab({} as App, plugin as unknown as AozoraPlugin);
    tab.display();
    const gaijiHandler = __settingHandlers.dropdown[2];
    await gaijiHandler?.("codepoint");
    expect(plugin.updateSettings).toHaveBeenCalledWith({ gaijiFallback: "codepoint" });
  });

  it("forwards toggle changes for enableLivePreview and detectAozoraTxt", async () => {
    const plugin = makePlugin();
    const tab = new AozoraSettingTab({} as App, plugin as unknown as AozoraPlugin);
    tab.display();
    await __settingHandlers.toggle[0]?.(false);
    await __settingHandlers.toggle[1]?.(false);
    expect(plugin.updateSettings).toHaveBeenCalledWith({ enableLivePreview: false });
    expect(plugin.updateSettings).toHaveBeenCalledWith({ detectAozoraTxt: false });
  });

  it("normalises txtGlob textarea by trimming and dropping empty lines", async () => {
    const plugin = makePlugin();
    const tab = new AozoraSettingTab({} as App, plugin as unknown as AozoraPlugin);
    tab.display();
    await __settingHandlers.textArea[0]?.("  小説/**/*.txt  \n\n  古典/*.txt\n");
    expect(plugin.updateSettings).toHaveBeenCalledWith({
      txtGlob: ["小説/**/*.txt", "古典/*.txt"],
    });
  });

  it("clears the container on every display() call", () => {
    const plugin = makePlugin();
    const tab = new AozoraSettingTab({} as App, plugin as unknown as AozoraPlugin);
    tab.display();
    const firstChildCount = tab.containerEl.children.length;
    tab.display();
    // Idempotent: second display() should not double-render.
    expect(tab.containerEl.children.length).toBe(firstChildCount);
  });
});
