# Changelog

All notable changes to aozora-obsidian are recorded in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial repository scaffolding: plugin manifest, esbuild config,
  TypeScript stub for the markdown post-processor, ADR-0001 recording
  the WASM-bundle integration shape.
- PoC plugin: registers a markdown code-block processor for fenced
  ` ```aozora ` blocks, instantiates the bundled `aozora.wasm` via
  `WebAssembly.instantiate` against bytes read from the plugin install
  directory through Obsidian's vault adapter (desktop + mobile parity),
  exposes a settings panel with a horizontal/vertical writing-mode
  toggle that maps to `.aozora--horizontal` / `.aozora--vertical`
  classes on the rendered container, ships the CSS catalogue
  (`styles.css`) for ruby / 傍点 / 縦中横 / 字下げ. WASM artefact is
  not yet bundled; the post-processor falls back to verbatim source
  rendering with a visible banner until the upstream `aozora-wasm`
  npm package lands.
- Strict gate: Biome 2.x lint + format, `tsc --noEmit` against an
  industry-strict tsconfig (`exactOptionalPropertyTypes` +
  `noUncheckedIndexedAccess` + …), `_typos.toml` dictionary,
  `scripts/check-wasm.mjs` post-build artefact gate (warn-only at PoC
  stage, flips to hard-fail with `AOZORA_WASM_REQUIRED=1`),
  `scripts/validate-manifest.mjs` hand-rolled manifest schema check
  (Obsidian doesn't publish a JSON Schema — see the script for the
  field surface).
- CI: `.github/workflows/ci.yml` runs biome + tsc + esbuild + manifest
  validation + typos on every push and PR. `lefthook.yml` mirrors that
  set on pre-commit + pre-push, plus a 2 MiB combined bundle-size
  budget gate. `.github/dependabot.yml` groups weekly bumps for
  github-actions and npm. CODEOWNERS, ISSUE_TEMPLATE,
  PULL_REQUEST_TEMPLATE adapted to the Obsidian-plugin context.

[Unreleased]: https://github.com/P4suta/aozora-obsidian/compare/main...HEAD
