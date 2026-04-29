// Test-runtime setup. happy-dom provides standard DOM but not the
// Obsidian-specific HTMLElement helpers (`createDiv`, `createEl`,
// `setText`, `addClass`, `empty`). The plugin's processors rely on
// those, so we polyfill the minimal subset here.

declare global {
  interface HTMLElement {
    createDiv(opts?: { cls?: string | readonly string[] }): HTMLDivElement;
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      opts?: { cls?: string | readonly string[]; text?: string },
    ): HTMLElementTagNameMap[K];
    createSpan(opts?: { cls?: string | readonly string[] }): HTMLSpanElement;
    setText(text: string): void;
    addClass(...classes: string[]): void;
    empty(): void;
  }
}

function applyClasses(target: HTMLElement, cls?: string | readonly string[]): void {
  if (cls === undefined) {
    return;
  }
  const classes = typeof cls === "string" ? [cls] : Array.from(cls);
  target.classList.add(...classes);
}

HTMLElement.prototype.createDiv = function (
  this: HTMLElement,
  opts?: { cls?: string | readonly string[] },
): HTMLDivElement {
  const div = document.createElement("div");
  applyClasses(div, opts?.cls);
  this.appendChild(div);
  return div;
};

HTMLElement.prototype.createEl = function <K extends keyof HTMLElementTagNameMap>(
  this: HTMLElement,
  tag: K,
  opts?: { cls?: string | readonly string[]; text?: string },
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  applyClasses(el, opts?.cls);
  if (opts?.text !== undefined) {
    el.textContent = opts.text;
  }
  this.appendChild(el);
  return el;
};

HTMLElement.prototype.createSpan = function (
  this: HTMLElement,
  opts?: { cls?: string | readonly string[] },
): HTMLSpanElement {
  return this.createEl("span", opts);
};

HTMLElement.prototype.setText = function (this: HTMLElement, text: string): void {
  this.textContent = text;
};

HTMLElement.prototype.addClass = function (this: HTMLElement, ...classes: string[]): void {
  this.classList.add(...classes);
};

HTMLElement.prototype.empty = function (this: HTMLElement): void {
  while (this.firstChild !== null) {
    this.firstChild.remove();
  }
};

export {};
