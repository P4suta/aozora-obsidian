# 0004. Adopt `aozora-scan` (and `aozora-lex`) as the upstream lexer

- Status: accepted
- Date: 2026-04-30
- Deciders: @P4suta
- Tags: parsing, wasm-boundary, reuse, refresh-phase-2
- Supersedes: (none — supersedes the *initial* Architectural Refresh round plan, which had proposed adding Aho-Corasick to `aozora-wasm` ourselves)
- See also: [0003 — Architectural Refresh discipline](./0003-architecture-refresh-bench-first.md)

## Context

The Phase 0 critique (`docs/architecture-refresh/00-current-naive-points.md` §0.1, §0.4) identified TS-side regex lexers (`src/livepreview.ts`'s four patterns + `src/inline-processor.ts:21`'s `SENTINEL_PATTERN`) as the principal lexing duplication: each of these reimplements, badly and on every keystroke, what `aozora-scan` already does in upstream Rust at SIMD speeds (10–20 GiB/s on Japanese — see the Teddy / structural-bitmap / DFA dispatcher described at `aozora/crates/aozora-scan/src/lib.rs:1-26`).

The initial plan for this round proposed adding our own Aho-Corasick implementation directly into `aozora-wasm`. That proposal (a) duplicated the upstream capability — exactly the kind of proliferation the Architectural Refresh discipline (ADR 0003 §2 "Reuse-first") was meant to prevent — and (b) had no supporting bench number; "Aho-Corasick is the right tool" was an intuition, not a measurement.

## Decision

The Refresh round consumes the existing upstream pipeline through a thin new method on `aozora-wasm`'s `Document`, rather than adding a new self-rolled lexer:

1. **aozora-scan** (SIMD trigger-byte scanner) stays in production unchanged. Its three backends (Teddy via `aho_corasick::packed::Searcher`; AVX2 structural-bitmap; DFA fallback) are dispatched at runtime by the upstream `best_scanner` selector. The aozora-obsidian round adds **no new lexer crate**, **no new Aho-Corasick implementation**, and **no new SIMD helper**.

2. **aozora-lex** (`lex_into_arena`) stays in production unchanged. Its borrowed-AST output (`BorrowedLexOutput.source_nodes`) is sorted by `source_span.start` already, which is the wire ordering the JS side wants for Lezer-Tree construction.

3. A new `Document::nodes_json` method on `aozora-wasm` (Phase 2 commit) projects `BorrowedLexOutput.source_nodes` into a small JSON array of `{kind, start, end}` triples — one source-byte span per classified `AozoraNode<'_>`, plus `containerOpen` / `containerClose` tags for the paired-block-container variants of `aozora::NodeRef`.

4. The aozora-obsidian side validates the wire JSON through a zod schema (`src/wasm/node-schema.ts`) before any plugin code touches it. Schema rejection on a forward-compatible upstream change surfaces as an explicit `Result.err` path (Phase 7) rather than silent corruption.

Concretely **rejected** by this ADR:

- Self-rolled Aho-Corasick (the original Phase 2 proposal). Subsumed by `aozora-scan`'s Teddy backend, which has SIMD support, multi-backend dispatch, and a proptest-pinned cross-check against `NaiveScanner`. Re-implementing would mean two scanners to maintain, and the tasks's bench-first gate (ADR 0003 §1) couldn't justify the duplication anyway: the upstream is already faster than we'd plausibly write, and our workload spends almost no time in lexing — it spends time in renderer + DOM mutation.
- Boyer-Moore-Horspool / KMP / Two-way / Crochemore-Perrin (single-pattern matchers). Subsumed identically; they would also force a per-pattern back-and-forth that defeats the multi-pattern single-pass shape of aozora notation.
- Tree-sitter as a parallel parser. Functional overlap with Lezer (Phase 4–5); duplicating two incremental-parser stacks is the lint-discipline violation the round most wants to avoid.

## Consequences

Easier:

- **No upstream/downstream divergence in the lexer.** Every aozora consumer (CLI / FFI / WASM / Python / VSCode / aozora-obsidian) sees the same trigger classification because they share the same crate. A future bug fix in `aozora-scan` lands once.
- **The bench-first gate has something to measure.** The Phase 2 commit adds `bench/wasm-boundary.bench.ts`'s `nodes ${size}` step at five source-size tiers; subsequent phases (Phase 4 Lezer-Tree builder, Phase 5 LanguageSupport) compare against this baseline. Numerical claims about "TS regex lexer is X% slower than the WASM nodes path" become measurable instead of asserted.
- **Forward-compat is upstream-friendly.** When `aozora-syntax` adds a new `AozoraNode` variant, our `aozora_node_kind_str` helper falls through to `"unknown"` (the upstream enum is `#[non_exhaustive]`). No coordinated cross-repo rollout is required to keep the plugin loading.

Harder:

- **JSON wire crossing has a non-zero cost.** Every `nodes()` call serialises in Rust, copies across the JS boundary, and round-trips through zod. On 1 MB input the bench will tell us whether this is acceptable; if not, Phase 4 may promote to a `serde_wasm_bindgen` zero-copy structured emission. ADR 0004 commits to the JSON form *for now*; the upgrade path is documented in `docs/architecture-refresh/01-data-structure-catalog.md` "Adopted: aozora-lex / aozora-scan" rows under "Status".
- **Two-repo coordination for upstream-affecting changes.** Adding `Document::nodes_json` required editing `aozora/crates/aozora-wasm/src/lib.rs` (a sibling repo). The aozora workspace commit is currently held back because it has unrelated in-progress edits; `aozora-pin.txt` is deferred until that lands. CI on aozora-obsidian's `main` will rebuild against whatever the upstream `main` is at the time, so order-of-merge matters.
- **Forward-port discipline on the upstream side.** Future variants in `AozoraNode` need a corresponding entry in `aozora_node_kind_str` *and* in `AozoraNodeKindSchema` (TS side). The `unknown` fall-through keeps the plugin from breaking, but the TS code won't surface the new variant by name until both sides are updated. This is documented at the head of `src/wasm/node-schema.ts`.

## Bench numbers

Initial baseline will be captured by `just bench` against `bench/wasm-boundary.bench.ts` and persisted into `bench/baseline.json` (currently a stub; populated on the first CI run after the Phase 2 GitHub Actions step lands the artefact). Until those numbers exist, the adoption is provisional — if the JSON wire turns out to dominate at the working-set tiers (100 KB and up), Phase 4 will revisit the encoding and this ADR will be amended via a successor.

The cap from ADR-0001 (`aozora.wasm` ≤ 2 MiB) still applies; the Phase 2 build measured 985 475 bytes (`just wasm` output, +1.8 KB vs Phase 1 at 983 707 bytes — within the noise floor of `wasm-opt` non-determinism).

## Implementation reference

- `aozora/crates/aozora-wasm/src/lib.rs` — `Document::nodes_json`, `nodes_json_view`, `aozora_node_kind_str`.
- `aozora-obsidian/src/wasm/node-schema.ts` — zod schema (kind enum + entry + list).
- `aozora-obsidian/src/aozora-wasm.ts` — `AozoraDocumentHandle.nodes()`.
- `aozora-obsidian/bench/wasm-boundary.bench.ts` — `nodes ${size}` bench step.
- `aozora-obsidian/tests/aozora-wasm.test.ts`, `tests/wasm/node-schema.test.ts` — coverage.
- `aozora-obsidian/docs/architecture-refresh/01-data-structure-catalog.md` — adoption ledger updated to "adopted (upstream)" for `aozora-scan` and `aozora-lex` with a back-link to this ADR.
