# 03 — Tradeoffs and rejection register

> Companion to `01-data-structure-catalog.md`. The catalogue lists each adoption decision with status + ADR link; this file collects the *why-not* for every candidate that ended up `rejected` or `deferred` so future planners don't re-propose without new evidence.

## Rejected outright

| Candidate | ADR | Reason |
|---|---|---|
| Self-rolled Aho-Corasick / SIMD lexer | [0004](../adr/0004-aozora-scan-as-upstream-lexer.md) | Subsumed by upstream `aozora-scan` (Teddy + AVX2 structural-bitmap + DFA). Re-implementing would duplicate without bench evidence of a gap. |
| Boyer-Moore-Horspool / KMP / two-way / Crochemore-Perrin | [0004](../adr/0004-aozora-scan-as-upstream-lexer.md) | Single-pattern matchers. Aozora is a multi-pattern problem; subsumed by `aozora-scan`. |
| PEG (`pest`) | [0004](../adr/0004-aozora-scan-as-upstream-lexer.md) | Context-sensitive notations push too much work into semantic actions; hand-rolled Pratt-style parsing in `aozora-lex` wins on readability. |
| Tree-sitter | [0004](../adr/0004-aozora-scan-as-upstream-lexer.md) | Functional overlap with Lezer (Phase 4-5); two parsers = lint-discipline violation. |
| DAWG | [0006](../adr/0006-gaiji-layer-defer-to-upstream.md) | FST is a strict generalisation. |
| Cuckoo / Quotient filter | [0006](../adr/0006-gaiji-layer-defer-to-upstream.md) | Bloom is sufficient at our scale. |
| Persistent red-black tree | (catalogue) | Lezer Tree's persistence subsumes. |
| Skip list / Finger tree | (catalogue) | Rope + Lezer cover. |
| Order statistics tree | (catalogue) | Rope's row-index methods cover. |
| Myers / patience / histogram diff | (catalogue) | CodeMirror's `Transaction.changes` provides edit deltas; diff unnecessary. |
| Tree edit distance (Zhang-Shasha) | (catalogue) | Same — edits observed not derived. |
| MobX / RxJS / Solid signals | (catalogue) | `@preact/signals-core` covers; RxJS is overkill. |
| Profunctor optics | (catalogue) | Excess for our nesting depth. |
| Algebraic effects (Eff/Koka) | [0005](../adr/0005-effect-layer-handrolled-result.md) | `effect-ts` would have subsumed; `effect-ts` itself rejected too. |
| Free / IO monad | [0005](../adr/0005-effect-layer-handrolled-result.md) | Same. |
| Effect-ts (`effect`) | [0005](../adr/0005-effect-layer-handrolled-result.md) | ≈ 80 KB gz bundle weight; no use surface beyond what the hand-rolled `Result<T, E>` already covers. Re-evaluate if structured concurrency or layered DI becomes load-bearing. |
| HKT simulation (`fp-ts`) | (catalogue) | Effect-ts subsumes — also rejected. |
| `io-ts` | (catalogue) | `zod` is the modern incumbent. |
| Byte-pair frequency | [0007](../adr/0007-encoding-detector-defer-to-data.md) | Subsumed by Markov n-gram (also deferred). |
| Rabin-Karp | [0004](../adr/0004-aozora-scan-as-upstream-lexer.md) | `aozora-scan` subsumes. |
| WASM Component model (WIT) | [0008](../adr/0008-bundle-defer-section-split.md) | Ecosystem too early. |
| Knuth-Plass linebreaking | [0009](../adr/0009-test-discipline-review.md) | CSS `text-wrap: balance` covers. |
| Bidi algorithm / OpenType GSUB/GPOS | (catalogue) | Out of scope; CSS handles vert/horiz mix. |
| Concolic testing | [0009](../adr/0009-test-discipline-review.md) | Property + fuzz suffice. |
| `publint --strict` | [Phase -1.5](../architecture-refresh/01-data-structure-catalog.md) | aozora-obsidian is a private Obsidian plugin distributed as a GitHub-release zip, not an npm package; publint targets a publishing model the project doesn't follow. Manifest discipline covered by `validate-manifest`. |

## Deferred (revisit-when conditions)

| Candidate | ADR | Trigger to revisit |
|---|---|---|
| Patricia trie / radix tree (gaiji glyph table) | [0006](../adr/0006-gaiji-layer-defer-to-upstream.md) | Per-paragraph render time exceeds 5 ms on a 1000-gaiji corpus tier. |
| FST (JIS X 0213 mencode → Unicode) | [0006](../adr/0006-gaiji-layer-defer-to-upstream.md) | Same. |
| Bloom filter (gaiji early-exit) | [0006](../adr/0006-gaiji-layer-defer-to-upstream.md) | Same. |
| Markov n-gram encoding detector | [0007](../adr/0007-encoding-detector-defer-to-data.md) | A labelled BOM-less SJIS corpus from aozora.gr.jp shows ≥ 1% misclassification by current BOM-only path. |
| WASM section split + lazy load | [0008](../adr/0008-bundle-defer-section-split.md) | Total WASM artefact > 1.5 MiB OR mobile cold-init > 500 ms. |
| `wasm-opt -Oz` per-section | [0008](../adr/0008-bundle-defer-section-split.md) | Same; conditional on the section split being chosen. |
| Mutation testing (`@stryker-mutator/core`) | [0009](../adr/0009-test-discipline-review.md) | Test suite grows to a point where a mutation-score signal beyond C1 100% is warranted; CI runtime budget can absorb +10 minutes. |
| Differential testing (vs `aozora-tools` LSP) | [0009](../adr/0009-test-discipline-review.md) | Release-prep round surfaces an output divergence to investigate; shared cross-repo fixture registry exists. |
| optics-ts (lenses) for nested settings | (catalogue) | A future setting becomes legitimately nested (per-domain glob lists with attached config). |
| Hash consing | (catalogue) | Multi-tab preview workflow shows >20% AST memory share across documents. |
| Suffix tree / array / FM-index (full-text search) | (catalogue) | Roadmap "Next" v0.2.x — not in current round scope. |
| CRDT / OT (collaboration) | (catalogue) | Future collaboration phase; not in current round scope. |
| HyperLogLog / Count-min / MinHash / SimHash (telemetry) | (catalogue) | Telemetry; out of round. |
| Lock-free / STM / Actor / WASM threads | (catalogue) | Mobile WebView limited; out of round. |
| Web Workers | (catalogue) | Obsidian Plugin worker policy unclear; out of round. |
| WASM tail call | [0008](../adr/0008-bundle-defer-section-split.md) | Capacitor WebView support uneven. |

## What this register is for

Every entry in the rejection / deferral columns is a "this was considered, here is why we said no" record. A future planner who proposes the same candidate must either cite new evidence that invalidates the original reason (and update the ADR), or pick a different path. This is the systemise discipline of ADR 0003 §3 in action: nothing decided is silent.
