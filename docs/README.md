# Aozora-obsidian

Aozora-obsidian renders Aozora Bunko notation in Obsidian's Reading view and Live Preview.

## Status

The plugin is alpha.
The project hasn't tested end-to-end mobile parity in production.
No prebuilt GitHub release is available.

## Supported input

Use an `aozora` fenced code block for a passage, or write Aozora notation such as `｜漢字《かんじ》` in a Markdown paragraph.
Reading view processes fenced blocks and inline notation.
Live Preview decorates Aozora notation while you edit.
Enabling `.txt` detection or adding a glob registers all `.txt` files as Markdown.
The plugin doesn't apply marker matching, glob filtering, or its encoding setting to those files.
Settings control writing direction and character fallback.

## Build and install from source

The plugin requires Obsidian 1.5.0 or later.
The build requires Docker 24 or later, Docker Compose 2.20 or later, and `just`.
It also requires the `aozora` parser repository beside this checkout.
The build uses Docker for the Rust, WebAssembly, Bun, and Node toolchains.

Clone both repositories into the same parent directory, then build the plugin:

```sh
git clone https://github.com/P4suta/aozora-obsidian.git
git clone https://github.com/P4suta/aozora.git
cd aozora-obsidian
just build
```

The plugin uses `main.js`, `manifest.json`, `styles.css`, and `aozora.wasm`.
Set `OBSIDIAN_VAULT` to your vault path and link the checkout into the plugin directory:

```sh
export OBSIDIAN_VAULT=/path/to/vault
mkdir -p "$OBSIDIAN_VAULT/.obsidian/plugins"
ln -s "$PWD" "$OBSIDIAN_VAULT/.obsidian/plugins/aozora"
```

On Windows, create a directory junction at `.obsidian/plugins/aozora` that targets this checkout.
Enable the plugin in Obsidian's community-plugin settings.

## Example

Add a fenced block to a note to render a ruby annotation in Reading view:

```aozora
｜漢字《かんじ》
```

## Development and design

See [contributor guidance](../CONTRIBUTING.md) for the Docker-based development commands.
See [ADR-0001](adr/0001-bundle-aozora-as-wasm.md) for the parser integration decision.
See [ADR-0002](adr/0002-docker-first-development.md) for the development environment.
The parser source and its third-party attributions are in the [aozora repository](https://github.com/P4suta/aozora).

## License and attributions

The project is dual-licensed under [`Apache-2.0`](../LICENSE-APACHE) or [`MIT`](../LICENSE-MIT), at your option.
See the [NOTICE](../NOTICE) for third-party material and source attributions.
