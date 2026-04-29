# 0002. Run every dev / CI command inside Docker

- Status: accepted
- Date: 2026-04-30
- Deciders: @P4suta
- Tags: infra, build, CI

## Context

The plugin needs two completely separate toolchains:

  * Rust 1.95 + wasm-pack + binaryen — builds `aozora.wasm` from the
    sibling `aozora` crate's `aozora-wasm` driver.
  * Bun + Node + biome + TypeScript + Vitest — bundles the plugin
    and runs the lint / test / build gate.

Add lefthook + just + lockfile-frozen installs across N contributor
machines + CI runners and the host-toolchain combinatorics blow up.
The sibling aozora repository already adopted Docker for the same
reason.

Three options were considered:

1. **Host install** — cargo via rustup + bun via mise + lefthook +
   typos + binaryen via apt. Initial setup ~30 min. Toolchain drift
   between contributors becomes a class of bugs.
2. **Mixed (some host, some container)** — cargo / wasm-pack on the
   host, bun / vitest in an image. Cuts the toolchain surface area
   in half but adds a host / container split that hurts onboarding.
3. **Everything in Docker, just-wrapped** — multi-stage Dockerfile +
   docker-compose for service composition + Justfile for ergonomic
   entrypoints. Host carries only docker / just / git / lefthook.

## Decision

Adopt option 3. Mirrors the sibling aozora repository's policy
exactly.

## Consequences

Easier:

- **Day-1 onboarding** — `git clone` + `just hooks` + `just build`
  is enough; no rustup / cargo / wasm-pack / bun / node install on
  the host.
- **CI parity** — GitHub Actions runs `just ci`. Identical bytes to
  a local `just ci`. No "works-on-my-machine" drift.
- **Toolchain pin location** — Dockerfile ARG values are the single
  source of truth (`RUST_VERSION` / `BUN_VERSION` /
  `WASM_PACK_VERSION` / `JUST_VERSION`). Bumping any toolchain is
  one diff in one file.
- **Sibling-repo build** — `docker-compose.yml`'s
  `additional_contexts: aozora: ../aozora` joins the sibling repo
  into the `wasm-builder` stage without filesystem trickery or git
  submodules.

Harder:

- **Per-command overhead** — every `just check` spins up a
  short-lived container (2–5 s on a warm Docker daemon). Justified
  by the toolchain stability gain.
- **Initial image build** — 5–10 minutes on a cold runner (cargo
  install of wasm-pack dominates). Cached for subsequent CI runs
  and contributor sessions; group runs amortise the cost.
- **lefthook lives on the host** — git hooks are a host-process
  concern, so lefthook itself is the one binary contributors install
  outside the image (mise / homebrew / curl). Acceptable because
  every hook body invokes `just <recipe>`, so the actual work still
  happens in the container.

## Alternatives considered

- **Host install** — rejected. Combinatorics + drift + onboarding
  cost.
- **Mixed (host cargo, container bun)** — rejected. Splits the
  toolchain story without simplifying it; "where does X run" becomes
  a per-command question.

## References

- [`Dockerfile`](../../Dockerfile)
- [`docker-compose.yml`](../../docker-compose.yml)
- [`Justfile`](../../Justfile)
- [`lefthook.yml`](../../lefthook.yml)
- Sibling [aozora repo's `Dockerfile`](https://github.com/P4suta/aozora/blob/main/Dockerfile)
  for the parallel decision.
