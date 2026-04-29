# Contributing to aozora-obsidian

Thank you for considering a contribution.

## Licence agreement

By submitting a contribution to this repository you agree that your
contribution is offered under the project's dual licence — Apache-2.0
OR MIT, at the user's option.

## Issues vs discussions

- Use **Issues** for confirmed bugs, regressions, or concrete feature
  proposals.
- Use **Discussions** for open-ended questions and design ideas.

Security issues do not go in either — see [`SECURITY.md`](./SECURITY.md).

## Local development

The project is Docker-first: every dev / lint / test / build command
runs inside the multi-stage Dockerfile via `just`. Host prerequisites:

- **docker** ≥ 24 + **docker compose** v2.20+
- **just** (managed via mise / homebrew / curl)
- **lefthook** (managed via mise / homebrew; run `just hooks` once
  after clone to wire the gate)
- **typos** — host-level spell-checker, called by the pre-commit
  hook so feedback is sub-second (mise: `mise use -g typos@latest`,
  homebrew: `brew install typos-cli`)
- An Obsidian installation with Developer mode enabled (for end-to-end
  smoke testing)

That's it. Cargo / wasm-pack / bun / node / TypeScript / biome /
vitest all live inside the image.

```sh
just hooks           # install lefthook git hooks (one-time)
just wasm            # rebuild aozora.wasm from sibling ../aozora
just install         # bun install (depends on wasm so pkg/ resolves)
just dev             # esbuild watch
just check           # biome + tsc, no writes
just fix             # biome write + tsc
just test            # vitest with C1 100% coverage gate
just build           # full production build (wasm + esbuild + check-wasm)
just ci              # local replica of the GitHub Actions pipeline
just shell           # interactive bash inside the dev container
```

Symlink the plugin folder into your vault for end-to-end testing:

```sh
ln -s "$PWD" "$OBSIDIAN_VAULT/.obsidian/plugins/aozora"
```

The build expects the sibling `aozora` repository at `../aozora`
(checked out next to this repo). It supplies the `aozora-wasm` crate
that `just wasm` compiles into `pkg/` + `aozora.wasm`. See the
README's **Bundling the WASM artefact** section for the contract.

## Coding conventions

- **TypeScript strict** + `exactOptionalPropertyTypes`. No `any` in
  source code; vendor declaration files may use it where the upstream
  surface is intrinsically dynamic.
- **No fetch / spawn at runtime.** Mobile compatibility (ADR-0001)
  rules out subprocesses and HTTP. Bytes-on-disk via `vault.adapter`
  only.
- **CSS** uses the class catalogue emitted by `aozora-render`
  (`aozora-bouten`, `aozora-tcy`, `aozora-gaiji`, …) — sibling plugins
  share the same prefix.
- **No `// biome-ignore` / `// biome-disable`.** Lint rules exist for
  a reason; restructure the code or rename the symbol instead.

## Conventional Commits

Type required, scope optional, breaking-`!` optional. Allowed scopes:
`processor`, `livepreview`, `settings`, `wasm`, `styles`, `manifest`,
`docs`, `ci`, `build`, `infra`, `deps`.

The `commit-msg` hook enforces the format.

## Pull request gates

- `just ci` green (biome + tsc + wasm rebuild + vitest C1 100% +
  esbuild + check-wasm hard-fail).
- Plugin loads inside Obsidian without console errors. Use the dev
  vault smoke checklist in the PR template (planned).
- For new features, add or extend tests under `tests/` — coverage
  must stay at 100% for non-integration modules (main.ts and
  livepreview.ts are excluded; they're verified end-to-end in the
  dev vault).
