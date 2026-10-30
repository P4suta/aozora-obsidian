# Aozora-obsidian

Render Aozora Bunko notation in Obsidian.

## Installation

```sh
# No prebuilt release is available yet; build from source.
# Requires Docker 24+, Docker Compose 2.20+, and just.
git clone https://github.com/P4suta/aozora-obsidian.git
git clone https://github.com/P4suta/aozora.git
cd aozora-obsidian
just build
export OBSIDIAN_VAULT=/path/to/vault
mkdir -p "$OBSIDIAN_VAULT/.obsidian/plugins"
ln -s "$PWD" "$OBSIDIAN_VAULT/.obsidian/plugins/aozora"
```

## Usage

```aozora
｜漢字《かんじ》
```

## Documentation

[Read the documentation](docs/README.md).

## License

Licensed under the [Apache License, Version 2.0](LICENSE-APACHE) or the [Massachusetts Institute of Technology (MIT) license](LICENSE-MIT), at your option.
