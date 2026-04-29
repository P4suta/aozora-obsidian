# aozora-obsidian

An [Obsidian](https://obsidian.md/) plugin that renders **pure [Aozora
Bunko (青空文庫) notation](https://www.aozora.gr.jp/annotation/)** —
ruby (`｜漢字《かんじ》`), bouten, 縦中横, `［＃…］` annotations,
gaiji, 返り点 — inside the Obsidian preview pane and live-preview
editor.

This plugin treats `.txt` files (or `.md` files marked
`aozora: true` in front matter) as aozora-format input. For Markdown
with afm extensions see [`afm-obsidian`](https://github.com/P4suta/afm-obsidian).

## Status

Pre-alpha scaffolding.

## What this gives you (target)

- A markdown post-processor that walks paragraphs containing aozora
  sentinels (`｜…《…》`, `［＃…］`, `〔…〕`) and rewrites them into
  proper HTML at preview time.
- A live-preview decorator (CodeMirror 6 view plugin) for the edit
  pane.
- Optional `.txt` recognition: when a file's first line contains
  `底本：` (typical aozora preface), or when the file matches a
  user-configured glob, the plugin treats the entire file as aozora.
- A settings tab for: writing mode (horizontal / vertical), bouten
  style preset, gaiji fallback policy, encoding (UTF-8 / Shift_JIS).
- A bundled `aozora.wasm` so that no external binary is needed —
  identical behaviour on macOS, Windows, Linux, iOS, and Android.

## Existing prior art

[`k-quels/japanese-novel-ruby`](https://github.com/k-quels/japanese-novel-ruby)
is an Obsidian plugin that helps **insert** Japanese ruby and emphasis
markers. aozora-obsidian's scope is wider — full aozora-notation
rendering for the preview pane — but the projects are complementary;
authors who want both an inserter and a renderer can run them side by
side.

## Build

```sh
bun install
bun run build       # biome + tsc + esbuild + manifest schema check + WASM gate
bun run dev         # rebuild on change
bun run check       # biome + tsc, no writes
bun run lint        # biome lint only
```

### Bundling the WASM artefact

ADR-0001 says the plugin ships `main.js` + `manifest.json` + `styles.css` +
`aozora.wasm`. The first three come out of `bun run build`; the fourth has
to be produced upstream:

```sh
# In a clone of github.com/P4suta/aozora:
cargo install wasm-pack
rustup target add wasm32-unknown-unknown
wasm-pack build --target web --release crates/aozora-wasm
# Then:
cp pkg/aozora_wasm_bg.wasm /path/to/aozora-obsidian/aozora.wasm
```

`scripts/check-wasm.mjs` runs at the end of `bun run build`. **PoC stage**: a
missing `aozora.wasm` is downgraded to a warning, not an error, so the
TypeScript scaffolding can be built and reviewed independently of the
upstream WASM pipeline. Set `AOZORA_WASM_REQUIRED=1` to flip the gate to
hard-fail mode for release builds.

The plugin loads `aozora.wasm` from its install directory at runtime via
Obsidian's vault adapter — desktop and mobile alike. Until the upstream
`aozora-wasm` npm package is published, the WASM-side wasm-bindgen JS glue
is not yet bundled either; the post-processor falls back to rendering the
raw aozora source verbatim with a visible banner. See `src/wasm-loader.ts`
for the eventual replacement path.

## Compatibility

- Obsidian ≥ 1.5.
- aozora parser bundled as WASM (target: aozora v0.2 onwards).
- Desktop (macOS / Windows / Linux) AND mobile (iOS / Android). ADR-0001.

## Sibling projects

| Repo | Role |
|---|---|
| [`P4suta/aozora`](https://github.com/P4suta/aozora) | Aozora Bunko notation parser |
| [`P4suta/aozora-tools`](https://github.com/P4suta/aozora-tools) | Editor tooling |
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
