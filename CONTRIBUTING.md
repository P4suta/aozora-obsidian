# Contributing to aozora-obsidian

Thank you for considering a contribution.

## License agreement

The [existing license agreement](https://github.com/P4suta/aozora-obsidian/blob/420a52279454d33c1e1193a85c1621ba6ec751f5/CONTRIBUTING.md#licence-agreement) states:

```text
By submitting a contribution to this repository you agree that your contribution is offered under the project's dual licence — Apache-2.0 OR MIT, at the user's option.
```

## Issues and discussions

Use Issues for confirmed bugs, regressions, or concrete feature proposals.
Use Discussions for open-ended questions and design ideas.
Follow [`SECURITY.md`](./SECURITY.md) for security reports.

## Local development

The project runs development, lint, test, and build commands through Docker Compose and `just`.

Install Docker 24 or later, Docker Compose 2.20 or later, `just`, `lefthook`, and `typos` on the host.
Use an Obsidian installation with Developer mode for the development-vault smoke test.
Install `just`, `lefthook`, and `typos` with mise or Homebrew.
Run `just hooks` after cloning.

Cargo, wasm-pack, Bun, Node.js, TypeScript, Biome, and Vitest run inside the images.

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

The build expects the sibling `aozora` repository at `../aozora`, checked out next to this repository.
The parser supplies the `aozora-wasm` crate that `just wasm` compiles into `pkg/` and `aozora.wasm`.
The [parser integration decision](docs/adr/0001-bundle-aozora-as-wasm.md) records the bundle contract.

## Coding conventions

Use strict TypeScript with `exactOptionalPropertyTypes`.
Source code must avoid `any`.
Vendor declarations may use `any` when an upstream API requires a dynamic type.

Obsidian Mobile compatibility requires local reads through `vault.adapter`, without `fetch`, subprocesses, or HTTP access.
Use the CSS classes from `aozora-render`, such as `aozora-bouten`, `aozora-tcy`, and `aozora-gaiji`.
Fix lint findings without `// biome-ignore` or `// biome-disable`.

## Commit format

Use Conventional Commits with a required type, an optional scope, and optional `!` for breaking changes.
Allowed scopes are `processor`, `livepreview`, `settings`, `wasm`, `styles`, `manifest`, `docs`, `ci`, `build`, `infra`, and `deps`.

The `commit-msg` hook enforces the format.

## Pull request gates

Run `just ci` before opening a pull request.
The command runs Biome, TypeScript, the WebAssembly rebuild, the 100% coverage gate, the production bundle, and the WebAssembly presence check.
Load the production plugin in an Obsidian development vault and confirm the absence of console errors.
Use the smoke checklist in the [pull request template](.github/PULL_REQUEST_TEMPLATE.md).

Add or extend `tests/` for new features and keep configured coverage at 100%.
The coverage gate excludes integration modules `src/main.ts` and `src/livepreview.ts`.
Verify both modules in the development vault.
