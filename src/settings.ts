import { type App, PluginSettingTab, Setting } from "obsidian";
import type AozoraPlugin from "./main";

export type WritingMode = "horizontal" | "vertical";
export type Encoding = "utf8" | "sjis";
export type GaijiFallback = "image" | "description" | "codepoint";

export interface AozoraSettings {
  writingMode: WritingMode;
  enableLivePreview: boolean;
  defaultEncoding: Encoding;
  gaijiFallback: GaijiFallback;
  detectAozoraTxt: boolean;
}

export const DEFAULT_SETTINGS: AozoraSettings = {
  writingMode: "horizontal",
  enableLivePreview: true,
  defaultEncoding: "utf8",
  gaijiFallback: "description",
  detectAozoraTxt: true,
};

export class AozoraSettingTab extends PluginSettingTab {
  private readonly plugin: AozoraPlugin;

  constructor(app: App, plugin: AozoraPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Aozora Bunko Notation" });

    new Setting(containerEl)
      .setName("Writing mode")
      .setDesc(
        "Default writing mode for rendered content. Vertical applies " +
          "`writing-mode: vertical-rl` plus tcy + bouten side-positioning.",
      )
      .addDropdown((dd) =>
        dd
          .addOption("horizontal", "Horizontal (横書き)")
          .addOption("vertical", "Vertical (縦書き)")
          .setValue(this.plugin.settings.writingMode)
          .onChange(async (v) => {
            this.plugin.settings.writingMode = v as WritingMode;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Live preview")
      .setDesc("Decorate aozora syntax in the live-preview editor as well.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.enableLivePreview).onChange(async (v) => {
          this.plugin.settings.enableLivePreview = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Default encoding")
      .setDesc("Encoding for plain `.txt` files when no BOM / heuristic match.")
      .addDropdown((dd) =>
        dd
          .addOption("utf8", "UTF-8")
          .addOption("sjis", "Shift_JIS (vintage Aozora .txt)")
          .setValue(this.plugin.settings.defaultEncoding)
          .onChange(async (v) => {
            this.plugin.settings.defaultEncoding = v as Encoding;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Detect Aozora .txt automatically")
      .setDesc("Treat any `.txt` file with a 底本：… header as aozora-format.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.detectAozoraTxt).onChange(async (v) => {
          this.plugin.settings.detectAozoraTxt = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Gaiji fallback")
      .setDesc("How to render JIS X 0213 / 第3水準 codepoints unsupported by the rendering font.")
      .addDropdown((dd) =>
        dd
          .addOption("image", "Show as image (PNG glyph)")
          .addOption("description", "Show description in 〔…〕 brackets")
          .addOption("codepoint", "Show codepoint (U+XXXX)")
          .setValue(this.plugin.settings.gaijiFallback)
          .onChange(async (v) => {
            this.plugin.settings.gaijiFallback = v as GaijiFallback;
            await this.plugin.saveSettings();
          }),
      );
  }
}
