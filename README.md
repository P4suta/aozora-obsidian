# aozora-obsidian

[![build](https://github.com/P4suta/aozora-obsidian/actions/workflows/build.yml/badge.svg)](https://github.com/P4suta/aozora-obsidian/actions/workflows/build.yml)

An [Obsidian](https://obsidian.md/) plugin that renders **pure [Aozora
Bunko (青空文庫) notation](https://www.aozora.gr.jp/annotation/)** —
ruby (`｜漢字《かんじ》`), bouten, 縦中横, `［＃…］` annotations,
gaiji, 返り点 — inside the Obsidian preview pane and live-preview
editor.

This plugin treats `.txt` files (or `.md` files marked
`aozora: true` in front matter) as aozora-format input. For Markdown
with afm extensions see [`afm-obsidian`](https://github.com/P4suta/afm-obsidian).

## Status

**Alpha.** Reading view + Live Preview rendering, `.txt`
auto-detection (`底本：` sniff + glob), UTF-8 / Shift_JIS / UTF-16
decoding, gaiji 3-mode (image / description / codepoint), and
settings-tab reactivity all implemented and unit-tested at C1 100%.
End-to-end mobile parity (iOS / Android Obsidian) is untested in
production.

## What this gives you

- A markdown post-processor that walks paragraphs, headings, list
  items, blockquotes, and table cells for aozora sentinels
  (`｜…《…》`, `［＃…］`, `〔…〕`, `※［＃…］`) and rewrites them into
  proper HTML at preview time.
- A live-preview decorator (CodeMirror 6 ViewPlugin) for the edit
  pane. Selection-aware: when the cursor overlaps a decorated range
  the raw markup becomes editable again.
- `.txt` recognition: when a file's first 4 KiB contain `底本：` (the
  canonical Aozora-Bunko bibliographic header), or when the file
  matches a user-configured glob, the plugin treats the entire file
  as aozora.
- A settings tab for: writing mode (horizontal / vertical), live
  preview toggle, default encoding (UTF-8 / Shift_JIS), gaiji
  fallback policy, automatic `.txt` detection, and glob list. Every
  toggle takes effect immediately — no plugin reload.
- A bundled `aozora.wasm` so that no external binary is needed —
  identical behaviour on macOS, Windows, Linux, iOS, and Android.

## Existing prior art

[`k-quels/japanese-novel-ruby`](https://github.com/k-quels/japanese-novel-ruby)
is an Obsidian plugin that helps **insert** Japanese ruby and emphasis
markers. aozora-obsidian's scope is wider — full aozora-notation
rendering for both panes — but the projects are complementary;
authors who want both an inserter and a renderer can run them side by
side.

## Install

### From a release zip (end users)

1. Download `aozora-obsidian-vX.Y.Z.zip` from
   [Releases](https://github.com/P4suta/aozora-obsidian/releases).
2. Extract into `<vault>/.obsidian/plugins/aozora/`.
3. Enable the plugin in Obsidian's community-plugin settings.

The release zip contains `main.js`, `manifest.json`, `styles.css`,
and `aozora.wasm` — no installation step besides the unzip.

### From source (contributors)

The project is Docker-first; cargo / wasm-pack / bun / node never
land on the host. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the
full setup. Quickstart:

```sh
git clone git@github.com:P4suta/aozora-obsidian.git
git clone git@github.com:P4suta/aozora.git ../aozora   # sibling repo
cd aozora-obsidian
just hooks           # one-time lefthook install
just build           # rebuilds aozora.wasm + main.js + check-wasm
ln -s "$PWD" "$OBSIDIAN_VAULT/.obsidian/plugins/aozora"
```

## Bundling the WASM artefact

ADR-0001 says the plugin ships `main.js` + `manifest.json` +
`styles.css` + `aozora.wasm`. The first three come out of `just
build`; the fourth is produced by `just wasm`, which runs inside the
Dockerfile's `wasm-builder` stage:

1. wasm-pack compiles `crates/aozora-wasm` from sibling `../aozora`
   to `wasm32-unknown-unknown`.
2. A fresh binaryen `wasm-opt -O3 --all-features` over the artefact.
   The bundled wasm-opt that wasm-pack ships is too old for Rust
   1.95's bulk-memory + sign-ext opcodes; aozora-wasm/Cargo.toml
   sets `wasm-opt = false` so we run binaryen ourselves.
3. The optimised `.wasm` lands at `aozora.wasm`, plus the
   wasm-bindgen JS glue at `pkg/`. `package.json` resolves
   `"aozora-wasm": "file:./pkg"`.

`scripts/check-wasm.mjs` runs as the last step of `just build`. It
asserts the artefact exists and stays under the 2 MiB bundle-size
budget. Set `AOZORA_WASM_REQUIRED=0` to downgrade missing-artefact
to a warning (CI keeps the default hard-fail).

The plugin loads `aozora.wasm` from its install directory at runtime
via Obsidian's vault adapter — desktop and mobile alike, no `fetch()`
involved (ADR-0001).

## Compatibility

- Obsidian ≥ 1.5.
- aozora parser bundled as WASM (target: aozora v0.2.5 onwards).
- Desktop (macOS / Windows / Linux) AND mobile (iOS / Android). ADR-0001.

## Sibling projects

| Repo | Role |
|---|---|
| [`P4suta/aozora`](https://github.com/P4suta/aozora) | Aozora Bunko notation parser + WASM driver |
| [`P4suta/aozora-tools`](https://github.com/P4suta/aozora-tools) | Editor tooling (formatter, LSP, tree-sitter) |
| [`P4suta/aozora-hugo`](https://github.com/P4suta/aozora-hugo) | Hugo module |
| [`P4suta/aozora-zola`](https://github.com/P4suta/aozora-zola) | Zola theme |
| **`P4suta/aozora-obsidian`** (this repo) | **Obsidian plugin** |
| `P4suta/aozora-logseq` | Logseq plugin |
| `P4suta/aozora-pandoc` | Pandoc Lua filter |
| `P4suta/aozora-typst` | Typst package |
| `P4suta/aozora-epub` | EPUB3 generator (parked) |
| [`P4suta/afm`](https://github.com/P4suta/afm) | Markdown dialect on top of aozora |

## Licence

Dual-licensed under [Apache-2.0](./LICENSE-APACHE) OR [MIT](./LICENSE-MIT).
See [`NOTICE`](./NOTICE) for third-party material.
