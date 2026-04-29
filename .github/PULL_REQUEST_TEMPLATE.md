## Summary

<!-- One or two sentences: what this PR changes and why. -->

## Type of change

- [ ] Bug fix
- [ ] New feature (post-processor, settings, live-preview decorator, …)
- [ ] Refactor (no behaviour change)
- [ ] Documentation / ADR
- [ ] CI / dev tooling / dependency bump
- [ ] `aozora-wasm` artefact bump (sibling aozora repo tag pin)

## Affected surface

- [ ] `src/processor.ts` / `src/inline-processor.ts`
- [ ] `src/livepreview.ts`
- [ ] `src/wasm-loader.ts` / `src/aozora-wasm.ts`
- [ ] `src/encoding.ts` / `src/txt-detector.ts`
- [ ] `src/settings.ts` / `src/main.ts`
- [ ] `styles.css`
- [ ] `manifest.json`
- [ ] CI / Dockerfile / Justfile / lefthook
- [ ] `tests/`

## Checklist

- [ ] `just ci` passes locally (biome + tsc + wasm rebuild + vitest C1
  100% gate + esbuild prod + check-wasm hard-fail).
- [ ] **Mobile parity** — no Node-side APIs (`fs`, `child_process`,
  `path`, `os`, `fetch` of remote URLs, …) sneak into `src/**`.
  ADR-0001.
- [ ] **Bundle size budget** — `aozora.wasm` + `main.js` combined stays
  under 2 MiB (the `bundle-budget` lefthook pre-push hook enforces it).
- [ ] **Coverage stays at 100%** for the modules under the `vitest`
  C1 gate (everything except `src/main.ts` and `src/livepreview.ts`).
- [ ] Plugin loads inside Obsidian Desktop and Obsidian Mobile without
  console errors against a real vault. Smoke-tested both Reading view
  and Live Preview for the touched feature area.
- [ ] Updated `CHANGELOG.md` under `[Unreleased]` (or stated why no
  entry is needed).
- [ ] Commit messages follow Conventional Commits (the
  `commit-msg` lefthook hook enforces).
- [ ] If bumping the `aozora-wasm` artefact: matched the version to a
  released `aozora` repo tag, ran `just wasm` to regenerate
  `aozora.wasm`, and called out the unlocked parser features in the
  changelog.

## How to test

<!-- Reviewer-facing repro steps. For rendering work, include a sample
` ```aozora ` block + the expected HTML output. For settings work,
include the toggle path and the visual difference it produces. For
Live Preview decorator work, include the cursor positions where the
decoration drops. -->
