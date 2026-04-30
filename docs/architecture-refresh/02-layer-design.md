# 02 — Layer design

> Companion to `00-current-naive-points.md` (where naive points were diagnosed) and `01-data-structure-catalog.md` (where data-structure adoption is recorded). This file describes the layered architecture the Architectural Refresh round produced — what each layer owns, what it depends on, and what its boundaries are.

## Layer responsibilities

| Layer | Code home | Responsibility | Depends on |
|---|---|---|---|
| **A — Lexing (upstream)** | `aozora-scan` (sibling repo) | SIMD trigger-byte scan over UTF-8 source. Three-backend dispatch: Teddy / structural-bitmap / DFA. | (none) |
| **B — Parsing (upstream)** | `aozora-lex`, `aozora-lexer`, `aozora-syntax` | borrowed-AST construction; PUA-sentinel registry; classification into 18 `AozoraNode` variants. | A |
| **D — WASM token-stream API** | `aozora/crates/aozora-wasm/src/lib.rs::Document::nodes_json` | JSON projection of `BorrowedLexOutput.source_nodes`. | B |
| **K — Type-level foundation** | `src/types/{brand,result,phantom}.ts`, `src/schema/settings.ts` | Branded primitives, `Result<T, E>` ADT, phantom kind tags, zod settings schema with boundary validation. | (none) |
| **D′ — TS WASM wrapper** | `src/aozora-wasm.ts`, `src/wasm/node-schema.ts` | Wrap raw WASM `Document`; validate `nodes_json` JSON wire through zod; surface `AozoraDocumentHandle.nodes()` to consumers. | D, K |
| **B′ — Lezer Tree builder** | `src/lezer/{aozora-types,aozora-parser}.ts` | Fold `AozoraNodeView[]` stream → Lezer `Tree` with NodeSet + group props. Append-only kind ordering as wire invariant. | D′ |
| **E — CodeMirror LanguageSupport** | `src/lezer/aozora-language.ts` | Wrap Lezer Tree in `@codemirror/language` `Language`; styleTags / foldNodeProp / indentNodeProp metadata for Obsidian theme integration. | B′ |
| **I — Reactivity** | `src/reactivity/{store,topology}.ts` | Signal-driven settings store; topological-sort cycle detection at startup; effect graph registration. | K |
| **J — Error / Effect** | `src/types/result.ts` (Phase 7-augmented: `all` / `tap` / `tapErr`) | Hand-rolled `Result<T, E>` chain; effect-ts rejected per ADR 0005. | K |
| **H — Diagnostic UX** | `src/diagnostics/interval-tree.ts` | Augmented interval tree for cursor × diagnostic-span overlap (CLRS §14.3). | (none — pure data structure) |
| **C — Persistence / cache** | `src/cache/{xxhash,lru}.ts` | xxHash32 for source-content keys; bounded LRU cache for parsed Lezer Trees. | (none) |
| **N — Typography** | `src/typography/japanese.ts`, `styles.css` | 約物半角化 helper; 行頭禁則 predicate; CSS `text-spacing-trim` declaration. | (none) |
| **M — Test discipline** | `tests/**/*.test.ts`, `bench/**/*.bench.ts` | Property + metamorphic + snapshot tests; bench harness with baseline regression. | (every other layer it tests) |

## Dependency graph

```
                     A (aozora-scan, upstream)
                          │
                          ▼
                B (aozora-lex / -syntax, upstream)
                          │
                          ▼
                          D (WASM nodes_json export)
                          │
                          ▼
        K (Brand, Result, Phantom, zod settings)
        │                 │
        ▼                 ▼
        I (signals)       D′ (TS WASM wrapper)
                          │
                          ▼
                          B′ (Lezer Tree builder)
                          │
                          ▼
                          E (CodeMirror LanguageSupport)

        H (interval tree) — independent, consumed by E + future Plugin lifecycle wiring
        C (xxHash + LRU)  — independent, consumed by future Plugin lifecycle wiring
        N (typography)    — independent, consumed by E + styles.css
        J (Result chain)  — augmented K, consumed by every error-prone callsite

        M (tests + bench) cuts across every layer.
```

## Layer-crossing contracts

| From | To | Contract | Validated where |
|---|---|---|---|
| D | D′ | JSON wire `[{kind, start, end}, ...]`; sorted by `start` ascending | `AozoraNodeViewListSchema.safeParse` (zod, Phase 2) |
| D′ | B′ | `readonly AozoraNodeView[]` | TS type system + `tests/lezer/aozora-parser.test.ts` property invariant |
| B′ | E | Lezer `Tree` with NodeSet from `aozora-types.ts` | `tests/lezer/aozora-language.test.ts` NodeProp round-trip |
| K | (every layer) | `Result<T, E>` discriminated union; never throw on the boundary | per-layer tests; biome rule `noExplicitAny` enforces structural ADTs |
| WASM stream order | Lezer Tree | spans monotonic in `start` → flat children in source order | upstream `nodes_json_view_spans_are_in_source_order` test |

## What's NOT in the round

- **Plugin lifecycle integration** of E / I / H / C. The round produced reusable modules; binding them to `Plugin.registerEditorExtension` / `addSettingTab` / `app.workspace.iterateAllLeaves` is a release-prep round task. The current `src/main.ts` continues to use the alpha-era cascade.
- **Mobile-specific runtime checks.** Per ADR 0001 the plugin claims `isDesktopOnly: false`; mobile-real-device verification is a release-prep round task once the editor wiring of Phase 5 + 6 lands.
- **Marketplace submission machinery.** Pin file (`aozora-pin.txt`), CHANGELOG split, GitHub Release zip composition — all release-prep round tasks.

## Open follow-ups (next round)

- Wire `aozoraLanguageFromNodes(...)` into `Plugin.registerEditorExtension` via the existing `livePreviewCompartment`. Snapshot-test that the visual output matches the legacy `livepreview.ts` path before deleting it.
- Replace `src/main.ts` direct-call cascade with a `createReactiveStore + registerEffects` graph that mirrors the existing settings-tab onChange handlers.
- Convert `processor.ts` / `inline-processor.ts` `try/catch` returns to `Result<HTMLElement, AozoraError>` chain.
- Bind `src/diagnostics/interval-tree.ts` + the `diagnostics_json` payload to `CodeMirror.Decoration.mark` for in-line markers.
- Hook `src/cache/lru.ts` into `wasm-loader.ts`'s parse path (same source ⇒ reuse parsed tree).
