# aozora-obsidian task runner.
# Single entry point for every development / CI operation. Every
# target runs inside Docker Compose; never invoke bun, esbuild,
# wasm-pack, or vitest on the host directly.

set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-load := false

# --- internal helpers ---------------------------------------------------------

# Interactive dev container (TTY attached).
_dev := "docker compose run --rm dev"
# Non-interactive variant for CI-like invocations (no TTY).
_ci  := "docker compose run --rm --no-TTY ci"

# --- metadata -----------------------------------------------------------------

# Default: list every recipe.
default:
    @just --list --unsorted

# --- wasm artifact ------------------------------------------------------------

# Build aozora.wasm from the sibling aozora repo. Writes
# /workspace/aozora.wasm and /workspace/pkg/ on the host.
wasm:
    docker compose run --rm wasm

# --- node_modules ------------------------------------------------------------

# Install dependencies inside the dev container. Resolves
# `aozora-wasm` against the host-built ./pkg directory, so we depend
# on `wasm` to guarantee pkg/ exists before bun install runs.
# Updates bun.lock as needed.
install: wasm
    {{_dev}} bun install

# Frozen-lockfile install (CI mode). Fails if bun.lock is stale.
# Used by the GitHub Actions pipeline; locally prefer `just install`.
install-frozen: wasm
    {{_ci}} bun install --frozen-lockfile

# --- TypeScript / plugin build ------------------------------------------------

# Production bundle (biome + tsc + esbuild + check-wasm hard-fail).
# `install` transitively depends on `wasm`, so aozora.wasm + pkg/ are
# both in place before check-wasm runs.
build: install
    {{_ci}} bun run build

# Watch-mode dev build (esbuild watch). Iterate on `src/` and reload
# the plugin in your Obsidian dev vault.
dev: install
    {{_dev}} bun run dev

# Vitest with coverage gate (C1 100% branches per CLAUDE.md).
test: install
    {{_ci}} bun run test

# biome check + tsc --noEmit (no writes).
check: install
    {{_ci}} bun run check

# biome check --write + tsc --noEmit.
fix: install
    {{_dev}} bun run check:fix

# --- shell / inspection -------------------------------------------------------

# Drop into an interactive dev shell (bash inside dev container).
shell:
    {{_dev}} bash

# Run an arbitrary bun command inside dev. `just bun add foo` works.
bun *ARGS:
    {{_dev}} bun {{ARGS}}

# --- git hooks ----------------------------------------------------------------

# Install lefthook git hooks (pre-commit / commit-msg / pre-push).
# Idempotent — safe to re-run after lefthook.yml edits to refresh stubs.
# Requires lefthook on the host PATH (mise / homebrew / curl install).
hooks:
    lefthook install

# Remove lefthook git hook stubs from .git/hooks/.
hooks-uninstall:
    lefthook uninstall

# --- aggregate ----------------------------------------------------------------

# Local replica of the CI pipeline. Run before pushing.
ci: check wasm test build

# --- cleanup ------------------------------------------------------------------

# Remove host-side build artifacts (named volumes are preserved).
clean:
    rm -rf main.js main.js.map aozora.wasm pkg coverage dist

# Tear down all compose state (also wipes named volumes:
# node-modules, bun-cache, cargo-registry, cargo-target,
# wasm-pack-pkg). Run after toolchain bumps to force a cold rebuild.
nuke:
    docker compose down -v --remove-orphans
