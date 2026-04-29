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

Prerequisites:
- **bun** ≥ 1.3 (managed via `mise use -g bun@latest`).
- **lefthook** (managed via mise; run `lefthook install` once after clone).
- **typos** (managed via mise).
- An Obsidian installation with Developer mode enabled.

```sh
bun install
bun run dev          # esbuild watch mode
bun run check        # biome + tsc, no writes
bun run check:fix    # biome write + tsc
bun run build        # production build + WASM gate + manifest validation
```

Symlink the plugin folder into your vault:

```sh
ln -s "$PWD" "$OBSIDIAN_VAULT/.obsidian/plugins/aozora"
```

For the WASM artefact (`aozora.wasm`), see the README's **Bundling the WASM
artefact** section. PoC builds tolerate a missing artefact and fall back to
verbatim source rendering inside a visible banner.

## Coding conventions

- **TypeScript strict mode.** No `any` outside vendor declaration files.
- **No fetch / spawn at runtime.** Mobile compatibility means no
  subprocesses. The aozora parser ships as bundled WASM (ADR-0001).
- **CSS** uses the class catalogue emitted by `aozora-render`.

## Conventional Commits

Allowed scopes: `processor`, `livepreview`, `settings`, `wasm`,
`styles`, `manifest`, `docs`, `ci`.

## Pull request gates

- `npm run typecheck && npm run lint && npm test` all green.
- Plugin loads inside Obsidian without console errors on the example
  vault under `tests/fixtures/`.
