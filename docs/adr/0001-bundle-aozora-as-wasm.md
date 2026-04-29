# 0001. Bundle aozora as WASM rather than spawning the CLI

- Status: accepted
- Date: 2026-04-29
- Deciders: @P4suta
- Tags: architecture, integration, mobile

## Context

aozora — the pure Aozora Bunko notation parser — is implemented in
Rust and ships an `aozora` CLI plus an `aozora-wasm` crate (compiled
to `wasm32-unknown-unknown`).

Obsidian runs as an Electron app on desktop, but it also ships an
identical-feature mobile app on iOS and Android. Mobile platforms have
hard restrictions on subprocess spawning and dynamic code download.

Three integration shapes were considered:

1. **Spawn the `aozora` binary** — relies on the user installing the
   `aozora` CLI on their `$PATH`. Works on macOS / Linux / Windows
   desktop. Fails outright on iOS and Android.
2. **HTTP backend** — call out to a hosted aozora rendering service.
   Needs a server, breaks offline use, and raises privacy concerns
   for vault contents.
3. **Bundled WASM** — compile `aozora-wasm` to
   `wasm32-unknown-unknown`, ship the `.wasm` artefact alongside the
   plugin's `main.js`, load it via `WebAssembly.instantiate` at
   plugin load.

## Decision

Adopt option 3: bundle aozora as WASM. The plugin ships `main.js`,
`manifest.json`, `styles.css`, and `aozora.wasm`. No external binary,
no network calls.

## Consequences

Easier:
- **Identical behaviour across platforms** — desktop, iOS, Android
  all run the same parser bytes.
- **Offline-first** — Obsidian's core promise stays intact.
- **No installation friction.**

Harder:
- **Bundle size.** Expected at 1–2 MiB compressed; monitor in CI.
- **Synchronous loading.** The post-processor must defer rendering
  until `await this.parser.ready`. Mirrors Mermaid / KaTeX patterns.
- **Upstream tracking.** Tag-pin the `aozora-wasm` crate at a
  versioned release; bumps require a manual rebuild.

## Alternatives considered

- **Spawn CLI** — rejected. Mobile parity is non-negotiable.
- **HTTP backend** — rejected. Breaks offline use.

## References

- aozora-wasm crate:
  <https://github.com/P4suta/aozora/tree/main/crates/aozora-wasm>
- Obsidian plugin API: <https://docs.obsidian.md/Plugins/Plugin>
- Obsidian mobile constraints:
  <https://docs.obsidian.md/Plugins/Getting+started/Mobile+development>
