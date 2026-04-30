# 0008. Defer WASM section split + SIMD opt-in; current bundle is well under cap

- Status: accepted (deferred)
- Date: 2026-04-30
- Deciders: @P4suta
- Tags: bundle-size, wasm, simd, refresh-phase-12
- See also: [0001 — bundle aozora as WASM](./0001-bundle-aozora-as-wasm.md), [0003 — Architectural Refresh discipline](./0003-architecture-refresh-bench-first.md)

## Context

ADR 0001 caps the plugin distribution at **2 MiB** combined (`main.js` + `aozora.wasm`). Phase 12 of the Architectural Refresh round was scoped to:

1. Section-split `aozora.wasm` into `aozora-core.wasm` + `aozora-gaiji.wasm` + `aozora-encoding.wasm`, with per-section lazy load via the Plugin's `vault.adapter.readBinary` path (ADR 0001 §"Bundled WASM").
2. Opt into WASM SIMD (`v128`) via `wasm-pack`'s `-Ctarget-feature=+simd128`, falling back to portable scalar on Capacitor WebView builds that don't expose SIMD.
3. Apply `wasm-opt -Oz` (size-priority) per-section instead of the current uniform `-O3` (speed-priority).

The bench-first gate (ADR 0003 §1) requires evidence that a section split is needed. The reuse-first gate (§2) requires checking what the current bundle size is.

## Measurement

Current bundle (latest `just wasm` from this round):

| Artefact | Bytes | Bytes (KiB) |
|---|---:|---:|
| `aozora.wasm` | 985 475 | 962 KiB |
| `main.js` (production esbuild) | ~ 90 000 | ~ 88 KiB |
| Combined | ~ 1 075 475 | ~ 1 050 KiB |

Cap: `2 × 1024 × 1024 = 2 097 152` bytes (`scripts/check-wasm.mjs:27` + `lefthook.yml:66-81` pre-push budget). Headroom: **~ 51%** of the cap.

Phase 8 (gaiji) and Phase 9 (encoding) deferrals (ADR 0006, 0007) mean the bundle is not about to grow either: no new tables, no new dictionaries.

`aozora-scan`'s SIMD path is **already** enabled at WASM build time when `wasm-pack` runs with `simd128` target features — `aozora-scan/Cargo.toml` opt-feature picks it up automatically; the round's WASM rebuilds during this work-up reflect that. There's nothing for aozora-obsidian's Phase 12 to flip on; the upstream pipeline already does it.

## Decision

**Defer** the WASM section split and the per-section `wasm-opt -Oz` switch. The catalogue rows for "WASM section split + lazy load", "WASM SIMD (opt-in)", and "`wasm-opt -Oz`" move from `hypothesis` to `deferred (no pressure)` with this ADR linked.

The trigger for revisiting:

- **`aozora.wasm` total exceeds 1.5 MiB.** At that point, the lefthook pre-push gate (currently 2 MiB) starts running tight and a section split becomes a real planning question. The Phase 8 / 9 ADRs both cap the upstream growth that would push the total higher; if those ADRs ever invert (a real Markov detector + JIS X 0213 image dictionary land in `aozora-encoding`), then Phase 12's split + lazy-load becomes load-bearing.
- **Mobile init latency exceeds 500 ms cold.** The current Phase 2 `init cold` bench tier in `bench/wasm-boundary.bench.ts` measures init time; if mobile real-device numbers (Phase 12 is a release-prep round task) exceed 500 ms, lazy-load by section becomes worth the extra coordination.

## Consequences

Easier:

- **No new build pipeline complexity.** Section-splitting `aozora.wasm` requires either (a) an upstream `wasm-pack` configuration change to emit multiple `.wasm` artefacts, or (b) a `wasm-bindgen` post-processing step to slice exports into separate modules. Both add Docker-build time and ship-zip surface.
- **No lazy-load failure mode.** The current single-`.wasm` load is fail-fast: if `aozora.wasm` is missing, the plugin shows a fallback banner via `src/processor.ts:73-79`. Section split would multiply this — `aozora-gaiji.wasm` could be present but `aozora-core.wasm` missing, requiring per-section banner messaging.

Harder:

- **No WASM-SIMD-vs-portable gating story.** If the current upstream build silently falls back to portable on Capacitor WebViews that don't expose `simd128`, we won't notice without explicit instrumentation. Mitigation: when a Phase 15 mobile bench harness lands, it captures the SIMD-vs-portable dispatch at runtime via the `aozora-scan::best_scanner` selector (which logs which backend it picked) — that visibility is the upstream's responsibility, not aozora-obsidian's.

## Implementation

ADR-only; no code changes. Catalogue updated.
