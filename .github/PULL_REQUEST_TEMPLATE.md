## Summary

<!-- One or two sentences: what this PR changes and why. -->

## Type of change

- [ ] Bug fix
- [ ] New feature (post-processor behaviour, settings, live-preview decoration, …)
- [ ] Refactor (no behaviour change)
- [ ] Documentation / ADR
- [ ] CI / developer tooling
- [ ] `aozora-wasm` artefact bump

## Affected surface

- [ ] `src/processor.ts`
- [ ] `src/wasm-loader.ts`
- [ ] `src/settings.ts`
- [ ] `src/main.ts`
- [ ] `styles.css`
- [ ] `manifest.json`
- [ ] CI / repo plumbing

## Checklist

- [ ] `bun run check` passes locally (Biome lint + format + `tsc --noEmit`).
- [ ] `bun run build` produces `main.js` and `scripts/check-wasm.mjs` warns / passes as expected.
- [ ] `bun run validate-manifest` is clean (`manifest.json` shape stays valid).
- [ ] **Mobile parity** — no Node-side APIs (`fs`, `child_process`, `path`, `os`, …) sneak into `src/**`. ADR-0001.
- [ ] **Bundle size budget** — the `main.js` artefact stays under 250 KiB compressed; the bundled `aozora.wasm` stays under 2 MiB (lefthook pre-push warns above the threshold).
- [ ] Plugin loads inside Obsidian Desktop AND Obsidian Mobile without console errors against the example vault under `tests/fixtures/` (note: WASM artefact may be missing in PoC builds — fallback rendering should remain visible).
- [ ] Updated `CHANGELOG.md` under `[Unreleased]` (or stated why it doesn't need a changelog entry).
- [ ] Commit messages follow Conventional Commits (lefthook commit-msg hook enforces).
- [ ] If bumping the `aozora-wasm` artefact: aligned the version with the matching `aozora` repo tag, regenerated `aozora.wasm`, and called out which parser features unlocked in the changelog.

## How to test

<!-- Reviewer-facing repro steps. For rendering work, include a sample
` ```aozora ` block + the expected HTML output. For settings work,
include the toggle path and the visual difference it produces. -->
