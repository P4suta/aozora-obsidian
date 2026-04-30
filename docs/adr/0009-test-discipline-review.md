# 0009. Test-discipline review — adopt fast-check property + metamorphic; defer mutation + differential

- Status: accepted
- Date: 2026-04-30
- Deciders: @P4suta
- Tags: testing, property, mutation, metamorphic, differential, refresh-phase-14
- See also: [0003 — Architectural Refresh discipline](./0003-architecture-refresh-bench-first.md)

## Context

Phase 14 of the Architectural Refresh round was scoped to evaluate five test-strengthening tools: property-based testing (`fast-check`), mutation testing (`@stryker-mutator/core`), fuzzing (`cargo fuzz`), metamorphic testing, and differential testing.

The catalogue lists each as `hypothesis` with bench / cost gates from ADR 0003.

This ADR closes Phase 14 with explicit adoption / deferral status per tool, anchored to the work the round actually produced.

## Adopted

### Property-based testing (`fast-check`)

**Status: adopted (round-wide).**

Phase 1 (`tests/types/{brand,result,phantom}.test.ts`, `tests/schema/settings.test.ts`), Phase 4 (`tests/lezer/aozora-parser.test.ts`), Phase 6 (`tests/reactivity/topology.test.ts`, `tests/reactivity/store.test.ts`), Phase 10 (`tests/diagnostics/interval-tree.test.ts`), Phase 11 (`tests/cache/xxhash.test.ts`, `tests/cache/lru.test.ts`), and Phase 13 (`tests/typography/japanese.test.ts`) all carry at least one `fc.assert(fc.property(...))` invariant in addition to table-driven cases.

The shrinking behaviour caught the `AOZORA_NODE_KIND_ORDER` boundary case in Phase 4 (the `?? "unknown"` fallback that would never fire for in-bounds indices) and several `parseStoredSettings` partial-merge edge cases in Phase 1.

`fast-check ^4.7.0` is a permanent devDep.

### Metamorphic testing

**Status: adopted (selectively).**

The relevant invariant for the round — `parse(serialize(parse(x))) ≡ parse(x)` — applies to the upstream `aozora` parser, not the aozora-obsidian TS layer (which doesn't own a parser; Phase 2 routes through the upstream lex + render). The upstream's own proptest suite at `aozora-lex/tests/property_borrowed_arena.rs` already pins this invariant.

aozora-obsidian's metamorphic-style invariants are:

- `nodes_json_view` source-order monotonicity (`tests/aozora-wasm.test.ts` schema validates that `nodes()` returns spans whose `start` is monotone — verified at the upstream `crates/aozora-wasm/src/lib.rs` test `nodes_json_view_spans_are_in_source_order`).
- `parseStoredSettings(s)` round-trip (Phase 1) — explicit `expect(parseStoredSettings(s)).toEqual(s)`.

These already exist; no new tooling is needed.

### Cargo fuzz

**Status: adopted (upstream).**

The aozora workspace already operates `cargo fuzz` corpora at `aozora-lex/fuzz/`. aozora-obsidian inherits the safety those produce by transitively depending on the same crates via WASM. No JS-side fuzz harness is needed; if a fuzz target ever touches the WASM ↔ JS boundary specifically, it lives upstream.

## Deferred

### Mutation testing (`@stryker-mutator/core`)

**Status: deferred (cost / benefit gap).**

Stryker's runtime cost is steep — a 5–10 minute mutation run on the current 188-test suite, multiplied by every PR. With C1 100% already enforced (`vitest.config.ts:26-31`) and `fast-check` property tests catching most logic-equivalent mutations, the marginal mutation-score signal Stryker would add is small relative to its CI weight.

Re-evaluate when:

- The test suite grows to a point where an additional metric beyond C1 100% is warranted to detect "tests that pass by accident."
- The CI runtime budget can absorb a 10-minute mutation step (current `just ci` runs ~3 minutes; doubling that would push pre-push hooks past the threshold a developer waits on).

### Differential testing (vs `aozora-tools` LSP formatter)

**Status: deferred (cross-repo coordination cost).**

The proposal was to compare the output of `aozora-wasm`'s `to_html` / `serialize` against the same source's `aozora-tools` LSP formatter output. The two implementations should agree on canonical output; differential testing would surface regression on either side.

Cost: requires `aozora-tools` to be installed and runnable in the aozora-obsidian Docker image (it isn't), plus a fixture-comparison harness that survives upstream API drift in either repo.

Defer until:

- aozora-obsidian's CI has a use-case that demands differential confidence (e.g. release-prep round where a change in `to_html` output is observed but its source is unclear — upstream-WASM bug or aozora-obsidian-side mishandling of the wire shape).
- A shared fixture registry exists across the aozora workspace that all consumers can pull from.

## Catalog updates

The Phase 14 row in `docs/architecture-refresh/01-data-structure-catalog.md`:

- `Property-based testing (fast-check)` → adopted
- `Mutation testing (@stryker-mutator/core)` → deferred (this ADR)
- `Cargo fuzz` → adopted (upstream)
- `Snapshot testing` → adopted (vitest built-in; no separate phase)
- `Metamorphic testing` → adopted (selectively)
- `Differential testing` → deferred (this ADR)
- `Concolic testing` → rejected (already documented; subsumed by property + fuzz)

## Implementation

ADR-only; no code changes. Catalogue updated.
