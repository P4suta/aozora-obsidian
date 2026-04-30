# 04 — Bench operations

> The bench-first discipline (ADR 0003 §1) requires that every adoption decision land with a number. This file documents how the round's bench harness is run, how baselines are updated, and how regressions are detected.

## Layout

| Path | Purpose |
|---|---|
| `bench/` | Bench harness root |
| `bench/wasm-boundary.bench.ts` | Phase -1 + Phase 2: WASM init / parse / to_html / serialize / diagnostics / nodes across 100B–1MB tiers |
| `bench/lezer-tree.bench.ts` | Phase 4: `buildAozoraTree` across 100, 1k, 10k, 100k node tiers |
| `bench/baseline.json` | Canonical baseline (committed) |
| `bench/last-run.json` | Latest `vitest bench` output (gitignored) |
| `scripts/bench-compare.mjs` | Read-only diff: `last-run.json` vs `baseline.json`, ±5% threshold, GitHub-flavored markdown output |
| `bench/fixtures.ts` | Shared synthetic source generator + size ladder |
| `bench/harness.ts` | Plugin stub + parser factory for the bench |

## Day-to-day workflow

```sh
# Run all benches against the current code (Docker; mirrors CI).
just bench

# Diff the latest run against the canonical baseline.
just bench-compare
```

`just bench` writes `bench/last-run.json`. `just bench-compare` reads both, prints a markdown table, and exits 0 regardless of regression direction (the threshold is informational, not a hard fail).

## Updating the baseline

Bench numbers depend on:

- The `aozora.wasm` artefact (which depends on the upstream aozora workspace SHA).
- The TS code at the WASM-cross / Lezer-build path.
- The Docker image's Rust + Bun + binaryen versions.
- The runner's CPU.

A baseline bump is appropriate when **all three** of the following hold:

1. **Intentional renderer / lexer change.** The aozora workspace got a meaningful update — `aozora-pin.txt` (when it lands) or the upstream commit SHA bumped.
2. **Numbers reproduce.** The same `just bench` run on the same Docker image produces the same delta direction across at least 3 consecutive runs.
3. **An ADR records the bump.** Either a successor ADR amends an earlier adoption decision with the new number, or a fresh ADR explains the bench shift's source.

Concretely:

```sh
# 1. Capture a fresh run.
just bench

# 2. Ingest as the new baseline (manual copy, deliberate step).
cp bench/last-run.json bench/baseline.json

# 3. Commit with the relevant ADR + a description of what changed.
jj describe @ -m 'bench: refresh baseline; upstream aozora bumped to X.Y.Z (ADR ###)'
```

The `cp` step is intentionally not automated — making baseline bumps explicit prevents drift from accumulating one merge at a time.

## CI integration

`.github/workflows/build.yml` runs `just bench` as a **warn-only** step (the bench produces an artefact `aozora-obsidian-bench` retained for 30 days but does not fail the workflow). Shared GitHub-runner variance is too noisy for a hard threshold; trends across recent workflow runs are the diagnostic signal.

Hard-fail graduation (turning bench regressions into blocking CI) is a roadmap "Now (v0.1.x)" task once 30+ days of baseline data has accumulated and a stable threshold can be chosen by quantile rather than fiat.

## Phase coverage

| Phase | Bench | Status |
|---|---|---|
| -1 | `bench/wasm-boundary.bench.ts` (init + parse + to_html + serialize + diagnostics) | shipped |
| 2 | `bench/wasm-boundary.bench.ts` (`nodes ${size}` step) | shipped |
| 4 | `bench/lezer-tree.bench.ts` (build tree at 100 / 1k / 10k / 100k) | shipped |
| 5 | `bench/codemirror-decoration.bench.ts` (LanguageSupport build time at 100 / 1000 paragraph viewports) | deferred — requires editor wiring (release-prep round) |
| 6 | `bench/reactivity.bench.ts` (5-setting flip cumulative) | deferred — requires lifecycle wiring |
| 7 | n/a (effect-ts rejected, no bench needed) | — |
| 8 | n/a (gaiji deferred) | — |
| 9 | n/a (encoding deferred) | — |
| 10 | `bench/diagnostics.bench.ts` (interval tree query @ 1k diagnostics) | deferred — module ready, harness writeup pending |
| 11 | `bench/parse-cache.bench.ts` (cache hit rate over 5 re-parses) | deferred — requires lifecycle wiring |
| 12 | n/a (bundle split deferred) | — |
| 13 | `bench/typography.bench.ts` (約物半角化 throughput) | deferred — micro-bench only valuable post-bind |

The deferred benches all fall into the same bucket: they require Plugin-lifecycle wiring (Phase 5 LanguageSupport + Phase 6 reactive store binding to `main.ts`) which the round explicitly defers to a release-prep round. When that wiring lands, each `bench/*.bench.ts` becomes a thin wrapper around the live integration path.

## Notes for future-me

- **Don't optimise without a bench.** ADR 0003 §1 isn't aspirational. If a future change "feels faster", the bench delta is the truth.
- **Don't game the bench.** Adjusting tier sizes or iterations to hide regression is the same anti-pattern as `// TODO fix` left as the only docs.
- **The bench is not the only signal.** `vitest run --coverage` (C1 100%) catches correctness; `just bench` catches performance. They're complementary; neither subsumes the other.
