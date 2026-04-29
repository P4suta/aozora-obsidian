# syntax=docker/dockerfile:1.7
# aozora-obsidian dev / build / wasm container.
#
# Two toolchains coexist:
#   * Rust 1.95 + wasm-pack + binaryen — produces `aozora.wasm` from
#     the sibling `aozora` crate (its `crates/aozora-wasm` driver,
#     compiled `wasm32-unknown-unknown` and run through a fresh
#     `wasm-opt -O3`).
#   * Bun + Node — bundles the TypeScript plugin source (esbuild) and
#     runs the test / lint / typecheck gate (vitest + biome + tsc).
#
# Multi-stage so the runtime images stay lean:
#   wasm-toolchain → wasm-builder → wasm-output
#   bun-base → deps → dev
#                  → ci
#
# `aozora` is supplied to BuildKit as an additional build context
# (see docker-compose.yml's `additional_contexts: aozora: ../aozora`).
# `docker buildx build --build-context aozora=../aozora` works on the
# CLI too.

ARG RUST_VERSION=1.95.0
ARG BUN_VERSION=1.2.23
ARG WASM_PACK_VERSION=0.14.0
ARG JUST_VERSION=1.36.0
# Upstream binaryen — Debian Bookworm's apt binaryen lags far enough
# behind that wasm-opt rejects Rust 1.95's bulk-memory + sign-ext
# opcodes even with `--all-features`. Pulling the prebuilt release
# from the WebAssembly/binaryen GitHub releases keeps us current.
ARG BINARYEN_VERSION=129

##############################################################################
# Stage: wasm-toolchain — Rust + wasm-pack + binaryen + system deps
##############################################################################
FROM rust:${RUST_VERSION}-bookworm AS wasm-toolchain

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        pkg-config \
        libssl-dev \
        clang \
        mold \
        curl \
        git \
        ca-certificates

# Install upstream binaryen (wasm-opt + friends) at a known-current
# version. Replaces apt's stale binaryen; required for Rust 1.95's
# bulk-memory + sign-ext opcodes.
ARG BINARYEN_VERSION
RUN curl -fsSL \
    "https://github.com/WebAssembly/binaryen/releases/download/version_${BINARYEN_VERSION}/binaryen-version_${BINARYEN_VERSION}-x86_64-linux.tar.gz" \
    | tar -xzC /usr/local --strip-components=1 \
    && wasm-opt --version

RUN rustup target add wasm32-unknown-unknown

ARG WASM_PACK_VERSION
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    cargo install --locked --root /usr/local --version ${WASM_PACK_VERSION} wasm-pack

WORKDIR /aozora

##############################################################################
# Stage: wasm-builder — produce aozora.wasm from the sibling aozora repo
##############################################################################
FROM wasm-toolchain AS wasm-builder

# Pull in the sibling aozora repo from the additional build context.
COPY --from=aozora . /aozora

# wasm-pack writes pkg/ next to the crate; we then run a fresh
# binaryen wasm-opt over the artifact (the wasm-pack-bundled wasm-opt
# is bypassed via aozora-wasm/Cargo.toml's `wasm-opt = false`).
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    --mount=type=cache,target=/aozora/target,sharing=locked \
    wasm-pack build --target web --release crates/aozora-wasm && \
    mkdir -p /out && \
    wasm-opt -O3 --all-features --enable-bulk-memory-opt \
        crates/aozora-wasm/pkg/aozora_wasm_bg.wasm \
        -o /out/aozora.wasm && \
    cp -r crates/aozora-wasm/pkg /out/pkg

##############################################################################
# Stage: wasm-output — file-only image consumed by `docker buildx --output`
##############################################################################
FROM scratch AS wasm-output

COPY --from=wasm-builder /out/aozora.wasm /aozora.wasm
COPY --from=wasm-builder /out/pkg /pkg

##############################################################################
# Stage: bun-base — Bun image + just + git
##############################################################################
FROM oven/bun:${BUN_VERSION}-debian AS bun-base

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        git \
        curl \
        ca-certificates \
        xz-utils

ARG JUST_VERSION
RUN curl -fsSL https://just.systems/install.sh \
    | bash -s -- --to /usr/local/bin --tag ${JUST_VERSION}

# `safe.directory` is set via docker-compose env so git operations
# inside the container don't reject the bind-mounted /workspace as
# "dubious ownership" (host UID ≠ container UID).
WORKDIR /workspace

##############################################################################
# Stage: dev — interactive development (esbuild watch, vitest, shell)
##############################################################################
FROM bun-base AS dev

# `bun install` runs at runtime (not at image-build time) so that
# `file:./pkg` resolves against the bind-mounted workspace which
# only exists at `docker compose run` time. node_modules is held in a
# named volume so the install is amortised across runs. See
# `just install` in the Justfile for the canonical entry point.

ENV NODE_ENV=development

CMD ["bash"]

##############################################################################
# Stage: ci — production build / typecheck / test gate
##############################################################################
FROM bun-base AS ci

ENV NODE_ENV=production \
    AOZORA_WASM_REQUIRED=1 \
    CI=true

CMD ["bash"]
