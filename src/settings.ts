import { type App, PluginSettingTab, Setting } from "obsidian";
import type AozoraPlugin from "./main";
import type { Encoding, GaijiFallback, WritingMode } from "./schema/settings";

// Re-exports keep the public path stable for sibling modules that
// already imported types and DEFAULT_SETTINGS from "./settings".
// The actual definitions now live next to the zod schema in
// `src/schema/settings.ts` so the runtime validator and the static
// types are declared once and stay in lockstep.
export type { AozoraSettings, Encoding, GaijiFallback, WritingMode } from "./schema/settings";
export { DEFAULT_SETTINGS } from "./schema/settings";

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
          "writing-mode: vertical-rl plus tcy + bouten side-positioning.",
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("horizontal", "Horizontal (横書き)")
          .addOption("vertical", "Vertical (縦書き)")
          .setValue(this.plugin.settings.writingMode)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ writingMode: value as WritingMode });
          }),
      );

    new Setting(containerEl)
      .setName("Live preview")
      .setDesc("Decorate Aozora syntax in the live-preview editor as well.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableLivePreview).onChange(async (value) => {
          await this.plugin.updateSettings({ enableLivePreview: value });
        }),
      );

    new Setting(containerEl)
      .setName("Default encoding")
      .setDesc("Encoding for plain .txt files when no BOM / heuristic match.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("utf8", "UTF-8")
          .addOption("sjis", "Shift_JIS (vintage Aozora .txt)")
          .setValue(this.plugin.settings.defaultEncoding)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ defaultEncoding: value as Encoding });
          }),
      );

    new Setting(containerEl)
      .setName("Detect Aozora .txt automatically")
      .setDesc("Treat any .txt file with a 底本：… header as Aozora-format.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.detectAozoraTxt).onChange(async (value) => {
          await this.plugin.updateSettings({ detectAozoraTxt: value });
        }),
      );

    new Setting(containerEl)
      .setName("Aozora .txt globs")
      .setDesc(
        "Vault-relative glob patterns (one per line) that always force Aozora " +
          "rendering, regardless of the file content. e.g. 小説/**/*.txt",
      )
      .addTextArea((area) =>
        area
          .setPlaceholder("小説/**/*.txt")
          .setValue(this.plugin.settings.txtGlob.join("\n"))
          .onChange(async (value) => {
            const lines = value
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => line.length > 0);
            await this.plugin.updateSettings({ txtGlob: lines });
          }),
      );

    new Setting(containerEl)
      .setName("Gaiji fallback")
      .setDesc("How to render JIS X 0213 / 第3水準 codepoints unsupported by the rendering font.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("image", "Show as image (PNG glyph)")
          .addOption("description", "Show description in 〔…〕 brackets")
          .addOption("codepoint", "Show codepoint (U+XXXX)")
          .setValue(this.plugin.settings.gaijiFallback)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ gaijiFallback: value as GaijiFallback });
          }),
      );
  }
}
