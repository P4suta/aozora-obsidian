import { Compartment, type Extension } from "@codemirror/state";
import { type App, Plugin } from "obsidian";
import { createAozoraInlineProcessor } from "./inline-processor";
import { aozoraLivePreviewExtension } from "./livepreview";
import { createAozoraCodeBlockProcessor } from "./processor";
import { type AozoraSettings, AozoraSettingTab, DEFAULT_SETTINGS } from "./settings";
import { AozoraParser } from "./wasm-loader";

/**
 * Internal-API shapes used for surgical re-rendering and dynamic
 * extension toggling. Obsidian's public d.ts does not surface these
 * (workspace.iterateAllLeaves is public, but the editor's underlying
 * CodeMirror EditorView and the preview-mode rerender hook are not).
 *
 * Defining narrow structural types here keeps the cast points
 * documented and avoids `any`. If a future Obsidian API surfaces
 * official equivalents, the casts collapse to the public types.
 */
interface CmEditorView {
  readonly dispatch: (transaction: { effects: unknown }) => void;
}

interface InternalMarkdownView {
  readonly editor?: { readonly cm?: CmEditorView };
  readonly previewMode?: { readonly rerender: (full: boolean) => void };
}

interface InternalViewRegistry {
  readonly unregisterExtensions?: (extensions: readonly string[]) => void;
}

interface InternalApp extends App {
  readonly viewRegistry?: InternalViewRegistry;
}

export default class AozoraPlugin extends Plugin {
  settings!: AozoraSettings;
  private parser!: AozoraParser;
  private readonly livePreviewCompartment = new Compartment();
  private txtRegistered = false;

  override async onload(): Promise<void> {
    await this.loadSettings();
    this.parser = new AozoraParser(this);

    this.addSettingTab(new AozoraSettingTab(this.app, this));

    // Reading view: ` ```aozora ` fenced blocks.
    this.registerMarkdownCodeBlockProcessor(
      "aozora",
      createAozoraCodeBlockProcessor({
        parser: this.parser,
        getSettings: () => this.settings,
      }),
    );

    // Reading view: inline sentinels in paragraphs / headings / etc.
    this.registerMarkdownPostProcessor(createAozoraInlineProcessor({ parser: this.parser }));

    // Live Preview: CodeMirror 6 ViewPlugin via Compartment so the
    // extension can be toggled at runtime when settings change.
    this.registerEditorExtension(
      this.livePreviewCompartment.of(this.currentLivePreviewExtension()),
    );

    this.applyTxtRegistration();
  }

  override onunload(): void {
    if (this.txtRegistered) {
      this.unregisterTxtExtension();
      this.txtRegistered = false;
    }
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<AozoraSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Public entry for settings-tab `onChange` callbacks. Merges the
   * partial, persists, then re-wires the toggleable registrations
   * and forces a preview rerender so the new options take effect
   * immediately — without a plugin reload.
   */
  async updateSettings(partial: Partial<AozoraSettings>): Promise<void> {
    this.settings = { ...this.settings, ...partial };
    await this.saveSettings();
    this.applyLivePreviewToggle();
    this.applyTxtRegistration();
    this.rerenderAllPreviews();
  }

  private currentLivePreviewExtension(): Extension {
    return this.settings.enableLivePreview ? aozoraLivePreviewExtension() : [];
  }

  private applyLivePreviewToggle(): void {
    const next = this.currentLivePreviewExtension();
    this.app.workspace.iterateAllLeaves((leaf) => {
      const cm = (leaf.view as InternalMarkdownView).editor?.cm;
      if (cm !== undefined) {
        cm.dispatch({ effects: this.livePreviewCompartment.reconfigure(next) });
      }
    });
  }

  private applyTxtRegistration(): void {
    const desired = this.settings.detectAozoraTxt || this.settings.txtGlob.length > 0;
    if (desired && !this.txtRegistered) {
      this.registerExtensions(["txt"], "markdown");
      this.txtRegistered = true;
    } else if (!desired && this.txtRegistered) {
      this.unregisterTxtExtension();
      this.txtRegistered = false;
    }
  }

  private unregisterTxtExtension(): void {
    const registry = (this.app as InternalApp).viewRegistry;
    registry?.unregisterExtensions?.(["txt"]);
  }

  private rerenderAllPreviews(): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as InternalMarkdownView;
      view.previewMode?.rerender(true);
    });
  }
}
