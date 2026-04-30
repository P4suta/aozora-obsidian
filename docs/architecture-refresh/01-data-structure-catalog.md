# 01 — Algorithm / data-structure adoption catalogue

> Part I (problem domains × candidate inventory) and Part II (adoption decisions) of the Architectural Refresh round, lifted out of the chat-session plan and into the repo so adoption decisions remain auditable across sessions and contributors.
>
> Methodology: `docs/adr/0003-architecture-refresh-bench-first.md`. Inventory of upstream resources: `00-current-naive-points.md` §0.1.

## How to read this file

Two sections:

- **Part I — Problem domains × candidate inventory** lists what we can pick from for each problem the plugin actually solves. Entries are wide on purpose; the goal is exhaustiveness, not adoption.
- **Part II — Adoption ledger** records the current decision per candidate. Initial state for any candidate is `hypothesis`. Promotion to `adopted` requires a bench (under `bench/*.bench.ts`), a baseline / before / after run, and an ADR (under `docs/adr/`) linking the numbers.

When a phase moves a candidate's row, it must:

1. Update the row's status (`hypothesis` → `adopted` / `rejected` / `deferred`).
2. Link the ADR that records the bench.
3. If `rejected` or `deferred`, add a one-line note in `03-tradeoffs.md` so future planners don't re-propose without new evidence.

---

## Part I — Problem domains × candidate inventory

### Domain map

| # | Domain | Current naive shape | Goal |
|---|---|---|---|
| D1 | Lexing — sentinel detection | Hand-written `SENTINEL_PATTERN`/`RUBY_PATTERN`/`BOUTEN_PATTERN`/`GAIJI_PATTERN`/`ANNOTATION_PATTERN` regex in `src/livepreview.ts` and `src/inline-processor.ts`. WASM side already uses `aozora-scan`. | Eliminate TS-side regex lexers; consume the upstream `aozora-scan` trigger stream through the WASM boundary instead. |
| D2 | Parsing — structural | WASM side: `aozora-lex` recursive descent. TS side: ad-hoc string-replace plus innerHTML. | Single source of structure (the WASM-resident `aozora-lex` AST), exposed to TS as a token / node stream that downstream layers (Reading view, Live preview) both consume. |
| D3 | Incremental rendering | Live preview rebuilds the full viewport on every change; Reading-view post-processor rescans every paragraph. | Edit-localised re-parse, share parse output across both views, lean on `@codemirror/view`'s native incremental plumbing. |
| D4 | Gaiji resolution | `data-aozora-gaiji-mode` dataset switches CSS presentation; the actual JIS X 0213 → Unicode / SVG path mapping lives inline in WASM with no compression. | Memory-efficient mapping with O(log n) (or better) lookup; ship the dictionary as a separately-loadable WASM section. |
| D5 | Encoding detection | `src/encoding.ts` detects only by BOM. BOM-less Shift_JIS is misclassified per user's `defaultEncoding`. | Robust detection for BOM-less SJIS / UTF-8 / EUC-JP through `aozora-encoding` (extending it if necessary). |
| D6 | Diagnostics UX | Single fallback banner at the bottom of the rendered container. | Per-span inline markers, severity colouring, hover popovers, quick-fix code actions. |
| D7 | Settings reactivity | `updateSettings()` calls `applyLivePreviewToggle()` / `applyTxtRegistration()` / `rerenderAllPreviews()` in fixed sequence. | Declarative dependency graph; computed derivations; minimal re-evaluation; cycle detection at startup. |
| D8 | Error / effect boundary | `try`/`catch` plus `console.warn`. WASM ↔ JS boundary errors are stringified ad-hoc. | Type-encoded expected errors, tracked side-effects, handler-based recovery. |

### Candidate inventory (wide pick list)

#### Lexing / parsing
- Aho-Corasick automaton — multi-pattern single pass. **Already shipped via `aozora-scan` upstream (Teddy backend);** no TS-side reimplementation.
- Boyer-Moore-Horspool — single-pattern skip-distance. Single-pattern only; superseded by Aho-Corasick for our use.
- Two-way / Crochemore-Perrin — constant-space linear. Same constraint as above.
- Knuth-Morris-Pratt — failure-function linear. Subsumed by Aho-Corasick.
- SIMD lexer (`v128` swizzle/shuffle, simdjson-style) — **already in `aozora-scan` (AVX2 structural-bitmap backend; iOS Safari 16.4+ / Android Chrome).**
- Pratt parser — operator-precedence pairing of nested annotations.
- PEG (`pest`) — grammar-driven, packrat memoisation O(n).
- GLR (`lalrpop`) — handles ambiguous grammars; overkill for unambiguous Aozora.
- Tree-sitter — incremental industry-standard.
- Lezer parser — CodeMirror 6 native incremental parser. Persistent rope-based tree.

#### Tree / persistent data structures
- Persistent rope — O(log n) concat/slice; CodeMirror's `Text` already is one.
- Patricia trie / radix tree — prefix lookup; suits gaiji codepoint tables.
- DAWG — suffix-shared word graph; tighter than trie for many short strings.
- FST (`fst` crate) — compressed key-value mapping; ~100 KB for JIS X 0213 mencode → Unicode.
- Persistent red-black tree — immutable ordered set/map.
- Hash consing — share immutable subtrees by structural identity. O(1) equality.
- Skip list — probabilistic balanced ordered list.
- Finger tree — amortised O(1) head/tail + O(log n) split.
- Zipper / Huet zipper — local AST navigation. CodeMirror's `TreeCursor` is one.
- Eytzinger layout (Khuong & Morin 2017) — **already shipped via `aozora-veb`.** 2-3× faster than `Vec::binary_search` once N ≥ L1.
- Y-fast trie / van Emde Boas — integer-key predecessor in O(log log n). Overkill.
- Order statistics tree — rank/select. Subsumed by rope.
- Interval tree — span × point overlap O(log n + k). Useful for diagnostic spans.
- Segment tree / Fenwick — range query. Subsumed by rope/index.
- Suffix tree / suffix array / FM-index — full-text search; out of scope for the Refresh round.

#### Diff / incremental
- Persistent rope — see above.
- Myers diff (O(ND)).
- Histogram / patience diff — readability-friendly.
- Tree edit distance (Zhang-Shasha) — AST diff O(n²·m²).
- Hashable subtree fingerprinting — Merkle-tree-style.
- CRDT (Yjs, Automerge) — conflict-free replicated; future collaboration scope.
- Operational Transform — historical CRDT alternative.

#### Caching / memoisation
- LRU / LFU / 2Q / ARC cache — replacement policies.
- Bloom filter — membership test O(1), false-positive ε; ~8 bits/key.
- Counting Bloom filter — Bloom + delete.
- Cuckoo filter — lower false-positive than Bloom + delete.
- Quotient filter — mergeable Bloom variant.
- HyperLogLog — distinct count.
- Count-min sketch — frequency estimation.
- MinHash / SimHash — Jaccard similarity.

#### Concurrency / async
- Lock-free queue / stack — under WASM threads (mobile WebView limited).
- STM — optimistic concurrency.
- Actor model — message passing.
- Async iterator / channel — pipeline.
- Web Workers — JS-side background work.

#### Reactivity layer
- Signals (`@preact/signals-core` ≈ 1 KB) — push-based reactive primitive.
- MobX-style observables — proxy-based.
- RxJS observables — stream-based.
- Solid signals — fine-grained, nested-store-aware.
- FRP — time-varying values, Conal Elliott style.
- Pull vs push trade-off.
- Topological sort — for dependency-graph cycle detection.

#### Type theory / algebra
- Result / Either ADT.
- Effect-ts — typed effects, composable handlers.
- Algebraic effects (Eff/Koka style).
- IO / Free monad.
- Lenses (`monocle-ts`, `optics-ts`).
- Profunctor optics.
- GADT (via discriminated union).
- Brand types / nominal types.
- Phantom types — zero-cost markers.
- Higher-kinded type simulation (`fp-ts`).
- Refinement types (`io-ts`, `zod`).
- Template literal types.

#### Encoding / numeric
- Markov-chain n-gram detector — chardet-style.
- Byte-pair frequency.
- PPM / LZ / LZMA / BWT — compression family.
- Rabin-Karp rolling hash.
- xxHash / cityhash — fast non-cryptographic hash.

#### WASM / bundle
- Section split + lazy load — core / gaiji / encoding as separate `.wasm` sections.
- WASM SIMD (`v128`) — production-supported on iOS 16.4+ / Android Chrome.
- WASM tail call (Stage 4 in 2025) — recursion optimisation.
- Component model (WIT) — module composition; ecosystem still maturing.
- `wasm-opt -Oz` — size-priority optimisation.

#### Layout / typography
- Knuth-Plass linebreaking — paragraph balancing.
- TeX-style 行頭禁則 — punctuation half-width / hanging.
- Unicode bidi — vertical/horizontal mix.
- Variable fonts (`vert`, `vrt2` axes) — vertical glyph substitution.
- OpenType GSUB / GPOS.

#### Testing
- Property-based testing (`fast-check`) — `forall` invariants with shrinking.
- Mutation testing (`@stryker-mutator/core`) — tests-of-tests.
- Fuzzing (`cargo fuzz`, libFuzzer, `fast-check.assert.shrink`).
- Snapshot testing.
- Metamorphic testing — `parse(serialize(parse(x))) ≡ parse(x)`.
- Differential testing — compare two implementations' output.
- Concolic testing.

---

## Part II — Adoption ledger

Schema:

- **Status**: `adopted` (already in production), `hypothesis` (under bench evaluation), `rejected` (explicitly not wanted), `deferred` (out of round scope).
- **Solves**: D# from the domain map.
- **ADR**: file under `docs/adr/` once status changes from `hypothesis` (link added when the ADR lands).
- **Notes**: one-liner; full reasoning lives in the ADR or in `03-tradeoffs.md`.

| Candidate | Status | Solves | ADR | Notes |
|---|---|---|---|---|
| `aozora-scan` (Teddy + structural-bitmap + DFA) | adopted (upstream) | D1 | [0004](../adr/0004-aozora-scan-as-upstream-lexer.md) | Phase 2: `Document::nodes_json` projects `BorrowedLexOutput.source_nodes` to TS via JSON wire + zod. |
| `aozora-lex` (`lex_into_arena`) | adopted (upstream) | D2 | [0004](../adr/0004-aozora-scan-as-upstream-lexer.md) | Same plumbing path. |
| `aozora-veb` (Eytzinger) | adopted (upstream) | D2, D4 | [0004](../adr/0004-aozora-scan-as-upstream-lexer.md) | Indirect: registry lookup; aozora-obsidian doesn't talk to it directly. |
| `aozora-encoding` (`encoding_rs` + Shift_JIS) | adopted (upstream) | D5 | [0004](../adr/0004-aozora-scan-as-upstream-lexer.md) | Markov extension Phase 9 if bench shows BOM-less misclassification. |
| Boyer-Moore-Horspool / KMP / two-way | rejected | D1 | [0004](../adr/0004-aozora-scan-as-upstream-lexer.md) | Subsumed by `aozora-scan`. |
| Pratt parser | hypothesis | D2 | TBD | Already used inside `aozora-lexer` via `aozora-spec`-driven pair tables; no new work needed unless the WASM-side AST exposure exposes a phase that benefits. |
| PEG (`pest`) | rejected | D2 | 0004 (planned) | Context-sensitive notations (`［＃...、N 字下げ］`) push too much work into semantic actions; hand-rolled wins on readability. |
| Tree-sitter | rejected | D2, D3 | [0004](../adr/0004-aozora-scan-as-upstream-lexer.md) | Functional overlap with Lezer; CodeMirror native is Lezer. Two parsers = lint-discipline violation. |
| Lezer parser (Tree) | hypothesis | D2, D3 | TBD | Phase 4-5 builds Lezer Tree from WASM token stream + registers `LanguageSupport`. Bench gate: viewport 100p decoration build < 1 ms. |
| Persistent rope | adopted (CodeMirror native) | D3 | 0004 (planned) | `@codemirror/state` Text. |
| Hash consing | hypothesis | D2, D3 | TBD | Phase 11. Bench gate: 1 MB source, ≥ 20% memory reduction. |
| LRU cache (4 entries) + xxHash key | hypothesis | D3 | TBD | Phase 11. Bench gate: 5× re-parse cumulative ≥ 50% reduction. |
| Patricia trie / radix tree | deferred (upstream-covered) | D4 | [0006](../adr/0006-gaiji-layer-defer-to-upstream.md) | Phase 8. `aozora-encoding` upstream already covers gaiji classification; TS-side mapping would duplicate. |
| FST | deferred (upstream-covered) | D4 | [0006](../adr/0006-gaiji-layer-defer-to-upstream.md) | Same as Patricia. Re-evaluate via upstream `aozora-encoding` extension if bench shows the WASM round-trip dominates. |
| Bloom filter | deferred (upstream-covered) | D4 | [0006](../adr/0006-gaiji-layer-defer-to-upstream.md) | Same; round-trip cost will be quantified by Phase 2's `nodes ${size}` bench. |
| DAWG | rejected | D4 | TBD | FST is a strict generalisation. |
| Cuckoo / Quotient filter | rejected | D4 | TBD | Bloom is sufficient at our scale. |
| Persistent red-black tree | rejected | (general) | TBD | Lezer Tree's persistence subsumes. |
| Skip list / Finger tree | rejected | (general) | TBD | Rope + Lezer cover. |
| Zipper | hypothesis | D2, D3 | TBD | Lean on `TreeCursor` from `@lezer/common`. Phase 4. |
| Order statistics tree | rejected | (general) | TBD | Rope's row-index methods cover this. |
| Interval tree | hypothesis | D6 | TBD | Phase 10. O(log n + k) cursor × diagnostic overlap. |
| Suffix tree / array / FM-index | deferred | search | — | Out of round scope; v0.2.x roadmap. |
| Myers / patience / histogram diff | rejected | D3 | TBD | CodeMirror's `Transaction.changes` provides edit deltas; diff unnecessary. |
| Tree edit distance (Zhang-Shasha) | rejected | D3 | TBD | Same — edits are observed not derived. |
| CRDT / OT | deferred | — | — | Future collaboration; out of round. |
| HyperLogLog / Count-min / MinHash / SimHash | deferred | — | — | Telemetry; out of round. |
| Lock-free / STM / Actor / WASM threads | deferred | D3 | — | Mobile WebView limited; out of round. |
| Web Workers | deferred | D3 | — | Obsidian Plugin worker policy unclear; out of round. |
| Signals (`@preact/signals-core`) | hypothesis | D7 | TBD | Phase 6. Bench gate: 5-setting flip cumulative time + rerender count ≤ baseline. |
| MobX / RxJS / Solid signals | rejected | D7 | TBD | `@preact/signals-core` covers; RxJS is overkill. |
| Topological sort (settings deps) | hypothesis | D7 | TBD | Phase 6. Cycle detection at startup. |
| Optics-ts (lenses) | hypothesis | D7 | TBD | Phase 6. Bundle-size gate ≤ +5 KB. |
| Profunctor optics (advanced) | rejected | D7 | TBD | Excess for our nesting depth. |
| Result / Either ADT | adopted | D8 | [0005](../adr/0005-effect-layer-handrolled-result.md) | Phase 1 + Phase 7 augmentation (`all` / `sequence` / `tap` / `tapErr`). |
| Effect-ts (`effect`) | rejected | D8 | [0005](../adr/0005-effect-layer-handrolled-result.md) | Phase 7. Bundle weight ≈ 80 KB gz; current code has no use surface beyond what `Result<T, E>` already covers. Re-evaluate when structured concurrency or layered DI becomes load-bearing. |
| Algebraic effects (Eff/Koka) | rejected | D8 | TBD | Effect-ts subsumes. |
| Free / IO monad | rejected | D8 | TBD | Effect-ts subsumes. |
| GADT (discriminated union) | adopted | D2 | TBD | Phase 1 lands the Brand / Phantom / Result foundation. |
| Brand types | adopted | D2, D3 | TBD | Phase 1. Zero-cost. |
| Phantom types | adopted | D2, D8 | TBD | Phase 1. Zero-cost. |
| HKT simulation (`fp-ts`) | rejected | (general) | TBD | Effect-ts subsumes. |
| Refinement (`zod`) | adopted | D7 | TBD | Phase 1. Bundle-size gate ≤ +20 KB. |
| `io-ts` | rejected | D7 | TBD | `zod` is the modern incumbent. |
| Markov n-gram detector | deferred (data gate) | D5 | [0007](../adr/0007-encoding-detector-defer-to-data.md) | Phase 9. Re-evaluation gated on a labelled BOM-less SJIS corpus from aozora.gr.jp; close gate if misclassification < 1%, else extend `aozora-encoding` upstream. |
| Byte-pair frequency | rejected | D5 | TBD | Subsumed by Markov n-gram. |
| Rabin-Karp | rejected | D1 | TBD | `aozora-scan` subsumes. |
| xxHash | hypothesis | D3 | TBD | LRU key, hash-cons structural hash. Phase 11. |
| WASM section split + lazy load | deferred (no pressure) | D4, L | [0008](../adr/0008-bundle-defer-section-split.md) | Current bundle ~1.05 MiB ≪ 2 MiB cap; Phase 8 / 9 deferrals mean no new growth. Revisit if total > 1.5 MiB or mobile init > 500 ms. |
| WASM SIMD (opt-in) | adopted (upstream) | D1 | [0008](../adr/0008-bundle-defer-section-split.md) | `aozora-scan` already enables `simd128` automatically when `wasm-pack` builds with the feature; nothing for aozora-obsidian to flip. |
| `wasm-opt -Oz` | deferred (no pressure) | (size) | [0008](../adr/0008-bundle-defer-section-split.md) | Same bundle-headroom argument; uniform `-O3` is fine until size budget tightens. |
| WASM tail call | deferred | — | — | Stage 4 but Capacitor WebView support uneven. |
| WASM Component model | rejected | — | TBD | Ecosystem too early. |
| Knuth-Plass linebreaking | rejected | typography | TBD | CSS `text-wrap: balance` covers. |
| TeX 行頭禁則 (JS prelude) | hypothesis | typography | TBD | Phase 13. Adopted only if visual diff vs `text-spacing-trim` shows a difference. |
| `text-spacing-trim` (CSS) | adopted | typography | TBD | Phase 13. CSS-only, full evergreen support 2026. |
| Variable fonts (vert/vrt2 axes) | adopted | typography | TBD | Phase 13. CSS `font-feature-settings` already used; variable axis declaration is a config tightening. |
| Bidi algorithm | rejected | typography | TBD | Out of scope; CSS handles vert/horiz mix. |
| OpenType GSUB/GPOS | rejected | typography | TBD | Out of scope; rely on browser+font support. |
| Property-based testing (`fast-check`) | adopted | (test) | [0009](../adr/0009-test-discipline-review.md) | Re-added in Phase 1; per-phase property tests across types, schema, lezer, reactivity, diagnostics, cache, typography. |
| Mutation testing (`@stryker-mutator/core`) | deferred (cost gate) | (test) | [0009](../adr/0009-test-discipline-review.md) | C1 100% + fast-check property tests close most of the mutation-score gap; revisit when CI budget can absorb a +10-minute step. |
| Cargo fuzz | adopted (upstream) | (test) | [0009](../adr/0009-test-discipline-review.md) | Already in `aozora-lex/fuzz`; aozora-obsidian inherits via WASM. |
| Snapshot testing | adopted | (test) | [0009](../adr/0009-test-discipline-review.md) | Vitest built-in; used by Reading-view post-processor tests. |
| Metamorphic testing | adopted (selectively) | (test) | [0009](../adr/0009-test-discipline-review.md) | Round-trip invariants in Phase 1 (`parseStoredSettings`) + Phase 4 (lezer order). The Aozora parser-side `parse∘serialize∘parse` invariant is upstream's `aozora-lex/tests/property_borrowed_arena.rs`. |
| Differential testing (vs `aozora-tools` LSP formatter) | deferred (cross-repo) | (test) | [0009](../adr/0009-test-discipline-review.md) | Cross-repo coordination cost outweighs current need; revisit when a release-prep round surfaces a divergence to investigate. |
| Concolic testing | rejected | (test) | TBD | Property + fuzz suffice. |
| @total-typescript/ts-reset | adopted | (lint) | — | Phase -1.5 build(deps) commit. Side-effect import in `src/main.ts`. |
| knip | adopted | (lint) | — | Phase -1.5. CI/lefthook gate. |
| publint --strict | rejected | (lint) | — | Phase -1.5. aozora-obsidian is a private Obsidian plugin distributed as a GitHub-release zip (`main.js` + `manifest.json` + `styles.css` + `aozora.wasm`), not an npm package — publint's --strict checks target a publishing model the project doesn't follow. Obsidian-manifest discipline is covered by `bun run validate-manifest` (lefthook pre-commit). |
| type-coverage --strict --at-least 99 | adopted | (lint) | — | Phase -1.5. CI/lefthook gate. |
| commitlint (`config-conventional` + repo scope-enum) | adopted | (lint) | — | Phase -1.5. Replaces lefthook regex. |

---

## Process

This catalogue is updated by every phase that touches an entry. Nothing is silent: hypothesis → adopted always lands in an ADR; rejection / deferral is recorded in `03-tradeoffs.md`. The catalogue itself never reasons; it points at the source of truth (ADR, bench number, tradeoff note).
