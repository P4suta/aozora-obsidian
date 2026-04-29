// Hand-rolled minimal stub of the Obsidian Plugin API surface used
// by aozora-obsidian. The real `obsidian` npm package only ships
// type declarations; its implementation lives inside the Obsidian
// Electron app, so unit tests need a stand-in.

export class Plugin {
  app: App;
  manifest: { id: string; dir?: string };
  data: unknown = null;

  constructor(app: App, manifest: { id: string; dir?: string }) {
    this.app = app;
    this.manifest = manifest;
  }

  registerMarkdownCodeBlockProcessor(_lang: string, _fn: unknown): void {}
  registerMarkdownPostProcessor(_fn: unknown): void {}
  registerEditorExtension(_ext: unknown): void {}
  registerExtensions(_exts: readonly string[], _viewType: string): void {}
  addSettingTab(_tab: unknown): void {}

  async loadData(): Promise<unknown> {
    return this.data;
  }

  async saveData(payload: unknown): Promise<void> {
    this.data = payload;
  }
}

export class PluginSettingTab {
  containerEl: HTMLElement;

  constructor(_app: App, _plugin: Plugin) {
    this.containerEl = document.createElement("div");
  }

  display(): void {}
  hide(): void {}
}

interface DropdownStub {
  addOption(value: string, label: string): DropdownStub;
  setValue(value: string): DropdownStub;
  onChange(handler: (value: string) => unknown): DropdownStub;
}

interface ToggleStub {
  setValue(value: boolean): ToggleStub;
  onChange(handler: (value: boolean) => unknown): ToggleStub;
}

interface TextAreaStub {
  setPlaceholder(value: string): TextAreaStub;
  setValue(value: string): TextAreaStub;
  onChange(handler: (value: string) => unknown): TextAreaStub;
}

/**
 * Test-only registry of `onChange` handlers captured during
 * `Setting` construction. Tests can drive the handlers directly
 * after `tab.display()` to exercise the plugin's settings reactivity
 * paths without standing up a full Obsidian runtime.
 *
 * Reset between tests with `__resetSettingHandlers()`.
 */
export const __settingHandlers: {
  readonly dropdown: ((value: string) => unknown)[];
  readonly toggle: ((value: boolean) => unknown)[];
  readonly textArea: ((value: string) => unknown)[];
} = {
  dropdown: [],
  toggle: [],
  textArea: [],
};

export function __resetSettingHandlers(): void {
  __settingHandlers.dropdown.length = 0;
  __settingHandlers.toggle.length = 0;
  __settingHandlers.textArea.length = 0;
}

function makeDropdownStub(): DropdownStub {
  const stub: DropdownStub = {
    addOption: () => stub,
    setValue: () => stub,
    onChange: (handler) => {
      __settingHandlers.dropdown.push(handler);
      return stub;
    },
  };
  return stub;
}

function makeToggleStub(): ToggleStub {
  const stub: ToggleStub = {
    setValue: () => stub,
    onChange: (handler) => {
      __settingHandlers.toggle.push(handler);
      return stub;
    },
  };
  return stub;
}

function makeTextAreaStub(): TextAreaStub {
  const stub: TextAreaStub = {
    setPlaceholder: () => stub,
    setValue: () => stub,
    onChange: (handler) => {
      __settingHandlers.textArea.push(handler);
      return stub;
    },
  };
  return stub;
}

export class Setting {
  constructor(public containerEl: HTMLElement) {}
  setName(_name: string): this {
    return this;
  }
  setDesc(_desc: string): this {
    return this;
  }
  addDropdown(cb: (dd: DropdownStub) => unknown): this {
    cb(makeDropdownStub());
    return this;
  }
  addToggle(cb: (tg: ToggleStub) => unknown): this {
    cb(makeToggleStub());
    return this;
  }
  addTextArea(cb: (ta: TextAreaStub) => unknown): this {
    cb(makeTextAreaStub());
    return this;
  }
}

export class MarkdownRenderChild {
  containerEl: HTMLElement;
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }
  onload(): void {}
  onunload(): void {}
}

export interface MarkdownPostProcessorContext {
  docId: string;
  sourcePath: string;
  frontmatter: unknown;
  addChild(child: MarkdownRenderChild): void;
  getSectionInfo(_el: HTMLElement): null;
}

export interface TFile {
  readonly path: string;
  readonly name: string;
  readonly extension: string;
}

export interface Vault {
  readonly adapter: {
    readBinary(path: string): Promise<ArrayBuffer>;
    exists(path: string): Promise<boolean>;
  };
}

export interface App {
  readonly vault: Vault;
  readonly workspace: {
    iterateAllLeaves(fn: (leaf: unknown) => void): void;
  };
}
