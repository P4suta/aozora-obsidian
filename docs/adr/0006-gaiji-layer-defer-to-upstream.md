# 0006. Defer the FST + Patricia + Bloom gaiji layer; lean on `aozora-encoding`

- Status: accepted (deferred)
- Date: 2026-04-30
- Deciders: @P4suta
- Tags: gaiji, jis-x-0213, refresh-phase-8
- See also: [0003 — Architectural Refresh discipline](./0003-architecture-refresh-bench-first.md)

## Context

Phase 8 of the Architectural Refresh round was scoped to add an FST (`fst` Rust crate) + Patricia trie + Bloom filter triple inside `aozora-wasm` (or the TS plugin) so JIS X 0213 mencode → Unicode lookup runs at memory-efficient and lookup-fast cost.

The catalogue (`docs/architecture-refresh/01-data-structure-catalog.md`) lists FST / Patricia / Bloom as `hypothesis` against domain D4 (gaiji resolution).

ADR 0003 §1 (bench-first) requires bench evidence that the new layer beats the current path. ADR 0003 §2 (reuse-first) requires checking whether existing upstream resources already cover the use case.

## Inventory

The sibling `aozora-encoding` crate (`/home/yasunobu/projects/aozora/crates/aozora-encoding/`) already declares its responsibility as "Aozora Bunko notation: Shift_JIS decoding and gaiji (外字) resolution" (Cargo.toml `description` field). Its Phase 0 inventory (`docs/architecture-refresh/00-current-naive-points.md` §0.1) reflects this.

The current TS-side gaiji handling (`src/processor.ts:42`, `styles.css:230-239`) tags rendered `<span class="aozora-gaiji">` with a `data-codepoint` / `data-description` attribute and switches between three CSS presentations via the parent's `data-aozora-gaiji-mode`. The actual mencode → Unicode + glyph-image / description / codepoint mapping happens **upstream** inside `aozora-render` and `aozora-encoding` before the HTML lands at the WASM boundary.

In other words: the round's Phase 8 proposal would have added a parallel mapping table on the TS side, duplicating data that already lives in upstream Rust where it's bench-validated against the Aozora-Bunko corpus.

## Decision

**Defer** the TS-side FST + Patricia + Bloom layer indefinitely. The round adopts no new gaiji infrastructure on the aozora-obsidian side.

Concretely:

- The catalogue rows for `Patricia trie / radix tree`, `FST`, and `Bloom filter` move from `hypothesis` (D4) to `deferred (upstream-covered)` with this ADR linked.
- `DAWG`, `Cuckoo / Quotient filter`, and `Persistent red-black tree` rows stay `rejected` for the same reason they were before — they were never going to beat what `aozora-encoding` already provides.
- The CSS presentation switch in `styles.css:230-239` stays as-is; it's the aozora-obsidian-side responsibility (DOM-side rendering), distinct from the upstream classification responsibility.

If a future round shows a bench-measurable cost in the WASM ↔ JS round-trip for gaiji-heavy documents (criterion: per-paragraph render time exceeds 5 ms on a 1000-gaiji corpus tier), revisit by extending `aozora-encoding` upstream rather than building a parallel layer in aozora-obsidian. Recording the eventual bench in this ADR's successor is the path forward.

## Consequences

Easier:

- **No upstream-vs-downstream divergence in the gaiji table.** Every aozora consumer sees the same JIS X 0213 mapping because they share `aozora-encoding`. A future Unicode-Standard upgrade lands once.
- **Bundle stays small.** A standalone FST keyed by JIS X 0213 mencode would have added ≥ 100 KB to the ship-zip, in addition to whatever the Patricia / Bloom buffers cost.
- **No JS-side gaiji bug surface.** The plugin doesn't re-implement JIS classification, so a TS-side regression in this area is impossible by construction.

Harder:

- **Forward-compat depends on `aozora-encoding` keeping pace.** When JIS adds a new codepoint or the Unicode Standard ships an updated mapping, the aozora-obsidian plugin sees the change only after the upstream crate ships a release. Acceptable given the cadence (Unicode major versions are ~yearly, JIS X 0213 last revised in 2012).
- **No early-exit Bloom check.** A Bloom filter on the WASM side would have allowed the JS to skip the WASM round-trip for source ranges with no gaiji. This is theoretical: the round-trip cost is small (Phase 2 bench `nodes ${size}` numbers will quantify it), and gaiji-free documents simply won't surface gaiji in the `nodes()` stream.

## Implementation

This ADR ships only the catalogue update. No code changes; no dependency changes.
