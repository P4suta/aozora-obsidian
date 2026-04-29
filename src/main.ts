import { Plugin } from "obsidian";
import { createAozoraCodeBlockProcessor } from "./processor";
import { type AozoraSettings, AozoraSettingTab, DEFAULT_SETTINGS } from "./settings";
import { AozoraParser } from "./wasm-loader";

export default class AozoraPlugin extends Plugin {
  settings!: AozoraSettings;
  private parser!: AozoraParser;

  override async onload(): Promise<void> {
    await this.loadSettings();
    this.parser = new AozoraParser(this);

    this.addSettingTab(new AozoraSettingTab(this.app, this));

    // Fenced code blocks tagged `aozora` get rewritten into rendered
    // HTML by the bundled WASM parser. ADR-0001 records the contract.
    this.registerMarkdownCodeBlockProcessor(
      "aozora",
      createAozoraCodeBlockProcessor({
        parser: this.parser,
        getSettings: () => this.settings,
      }),
    );
  }

  override onunload(): void {
    // Nothing to tear down — registerMarkdownCodeBlockProcessor is
    // released automatically when the plugin unloads. The WASM
    // module's exported memory is reclaimed by the JS GC once the
    // parser handle drops out of scope.
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<AozoraSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
