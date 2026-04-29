import { type EditorState, type Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

/**
 * CodeMirror 6 ViewPlugin that decorates Aozora-Bunko sentinels in
 * the Live Preview / Source-mode editor.
 *
 * `registerMarkdownPostProcessor` only runs in Reading view, so a
 * Markdown-meme-app integration that ignores the edit pane leaves
 * users staring at raw `｜漢字《かんじ》` while they write. This
 * plugin hooks into Obsidian's CodeMirror instance via
 * `Plugin.registerEditorExtension` and renders ruby + bouten +
 * annotation + gaiji decorations inline.
 *
 * The decorations are recomputed on every doc / viewport / selection
 * change because they're cursor-aware: when the user's cursor (or
 * selection) overlaps a decorated range we drop the decoration so
 * the raw markup is editable. This is the same UX Obsidian's own
 * Live Preview applies to bold / italic / link syntax.
 *
 * The matchers stay in TypeScript (no WASM round-trip) — the cost of
 * 30 ns/byte WASM parsing is dwarfed by CodeMirror's per-update
 * decoration build budget, but cursor-touch transitions need to be
 * synchronous and round-tripping through the WASM heap on every
 * keystroke is wasteful for the 4 simplest patterns. Reading view
 * still uses the WASM renderer for the full grammar.
 */

const RUBY_PATTERN = /｜([^《\s]+)《([^》\n]+)》|([一-龯々〆ヶ]+)《([^》\n]+)》/gu;
const BOUTEN_PATTERN = /《《([^》\n]+)》》/gu;
const GAIJI_PATTERN = /※［＃[^］\n]*］/gu;
// Negative-lookbehind so the leading `※` of a gaiji isn't misclassified
// as a bare annotation.
const ANNOTATION_PATTERN = /(?<!※)［＃[^］\n]*］/gu;

class RubyWidget extends WidgetType {
  constructor(
    private readonly base: string,
    private readonly reading: string,
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const ruby = document.createElement("ruby");
    ruby.append(this.base);
    const rt = document.createElement("rt");
    rt.textContent = this.reading;
    ruby.append(rt);
    ruby.classList.add("aozora-livepreview-ruby");
    return ruby;
  }

  override eq(other: WidgetType): boolean {
    return (
      other instanceof RubyWidget && other.base === this.base && other.reading === this.reading
    );
  }
}

class GaijiWidget extends WidgetType {
  constructor(private readonly raw: string) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "aozora-gaiji aozora-livepreview-gaiji";
    span.textContent = this.raw;
    return span;
  }

  override eq(other: WidgetType): boolean {
    return other instanceof GaijiWidget && other.raw === this.raw;
  }
}

interface PendingDecoration {
  readonly from: number;
  readonly to: number;
  readonly deco: Decoration;
}

function selectionTouches(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}

function buildDecorations(view: EditorView): DecorationSet {
  const pending: PendingDecoration[] = [];
  const state = view.state;
  for (const range of view.visibleRanges) {
    const slice = state.sliceDoc(range.from, range.to);
    collectRuby(slice, range.from, state, pending);
    collectBouten(slice, range.from, state, pending);
    collectAnnotation(slice, range.from, state, pending);
    collectGaiji(slice, range.from, state, pending);
  }
  pending.sort((a, b) => a.from - b.from || a.to - b.to);
  const builder = new RangeSetBuilder<Decoration>();
  for (const item of pending) {
    builder.add(item.from, item.to, item.deco);
  }
  return builder.finish();
}

function collectRuby(
  slice: string,
  baseOffset: number,
  state: EditorState,
  pending: PendingDecoration[],
): void {
  for (const match of slice.matchAll(RUBY_PATTERN)) {
    const matchIndex = match.index ?? 0;
    const from = baseOffset + matchIndex;
    const to = from + match[0].length;
    if (selectionTouches(state, from, to)) {
      continue;
    }
    const baseText = match[1] ?? match[3] ?? "";
    const reading = match[2] ?? match[4] ?? "";
    pending.push({
      from,
      to,
      deco: Decoration.replace({ widget: new RubyWidget(baseText, reading) }),
    });
  }
}

function collectBouten(
  slice: string,
  baseOffset: number,
  state: EditorState,
  pending: PendingDecoration[],
): void {
  for (const match of slice.matchAll(BOUTEN_PATTERN)) {
    const matchIndex = match.index ?? 0;
    // Mark only the inner text; leave the `《《` / `》》` delimiters
    // visible so the user can edit them comfortably.
    const innerStart = baseOffset + matchIndex + 2;
    const innerEnd = innerStart + (match[1]?.length ?? 0);
    if (selectionTouches(state, innerStart - 2, innerEnd + 2)) {
      continue;
    }
    pending.push({
      from: innerStart,
      to: innerEnd,
      deco: Decoration.mark({ class: "aozora-bouten aozora-livepreview-mark" }),
    });
  }
}

function collectAnnotation(
  slice: string,
  baseOffset: number,
  state: EditorState,
  pending: PendingDecoration[],
): void {
  for (const match of slice.matchAll(ANNOTATION_PATTERN)) {
    const matchIndex = match.index ?? 0;
    const from = baseOffset + matchIndex;
    const to = from + match[0].length;
    if (selectionTouches(state, from, to)) {
      continue;
    }
    pending.push({
      from,
      to,
      deco: Decoration.mark({ class: "aozora-annotation aozora-livepreview-mark" }),
    });
  }
}

function collectGaiji(
  slice: string,
  baseOffset: number,
  state: EditorState,
  pending: PendingDecoration[],
): void {
  for (const match of slice.matchAll(GAIJI_PATTERN)) {
    const matchIndex = match.index ?? 0;
    const from = baseOffset + matchIndex;
    const to = from + match[0].length;
    if (selectionTouches(state, from, to)) {
      continue;
    }
    pending.push({
      from,
      to,
      deco: Decoration.replace({ widget: new GaijiWidget(match[0]) }),
    });
  }
}

class LivePreviewPlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildDecorations(view);
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = buildDecorations(update.view);
    }
  }
}

/** Returns the editor extension to pass to `Plugin.registerEditorExtension`. */
export function aozoraLivePreviewExtension(): Extension {
  return ViewPlugin.fromClass(LivePreviewPlugin, {
    decorations: (plugin) => plugin.decorations,
  });
}
