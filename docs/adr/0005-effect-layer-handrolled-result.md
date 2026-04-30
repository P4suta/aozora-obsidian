# 0005. Reject `effect-ts`; keep the hand-rolled `Result<T, E>` ADT

- Status: accepted
- Date: 2026-04-30
- Deciders: @P4suta
- Tags: error-handling, effects, bundle-size, refresh-phase-7
- See also: [0003 — Architectural Refresh discipline](./0003-architecture-refresh-bench-first.md), [Phase 1 commit `vlxuzkus`](../architecture-refresh/01-data-structure-catalog.md)

## Context

Phase 1 introduced `src/types/result.ts` with the standard `Result<T, E>` combinator set (`ok` / `err` / `isOk` / `isErr` / `map` / `mapErr` / `andThen` / `unwrapOr` / `fromThrowable`). The Architectural Refresh round had Phase 7 reserved for evaluating `effect-ts` (the `effect` npm package) as a graduation path: typed effects, composable handlers, structured concurrency, layer-based dependency injection, and a richer Either / Result module.

ADR 0003 §1 (bench-first) requires that any candidate be admitted only when bench evidence shows it moves the needle. ADR 0003 §2 (reuse-first) requires checking whether existing primitives already cover the use case before adding a dependency. Phase 7 is the gate for effect-ts.

## Bench evidence

The relevant signal for `effect-ts` is bundle-size delta plus runtime cost of `Effect.runSync` / `Effect.runPromise` vs a hand-rolled Result chain. A representative micro-bench comparing the two against the current Plugin lifecycle paths (`AozoraDocumentHandle.parse` → `nodes()` → schema validate → render) was scoped for Phase 7.

The Phase 7 work-up surfaced two dispositive facts before the bench was even run:

1. **Bundle-size budget.** `effect` 3.x minified-gzipped weighs ≈ 80 KB; the full runtime including `@effect/platform` shims pushes that toward 130 KB. The `aozora.wasm` artefact already eats 985 KB of the 2 MiB ADR-0001 plugin budget. `main.js` (TS bundle) currently sits in the low-tens-of-KB range; admitting effect-ts would more than double it without any user-visible behaviour change.

2. **No surface uses that the hand-rolled Result doesn't already cover.** Every error path in the round so far (`parseStoredSettings` schema fallback, `AozoraDocumentHandle.diagnostics` / `nodes` JSON-parse failures, `AozoraParser.instantiateWasm` adapter-missing, `topologicalSort` cycle detection) terminates in a single tag-discriminated `Err`. None compose multiple effect channels (Reader + State + Error), none need structured concurrency, none have a need for layer-based DI. The use-case is "tag the error, return it, let the caller pattern-match" — which is exactly what `Result<T, E>` is for.

## Decision

**Reject** `effect-ts` adoption in this round. Stay on the hand-rolled `Result<T, E>` from Phase 1. The catalogue's row is set to `rejected` with this ADR as the back-reference.

To close the residual gap (a few combinators the round will use that Phase 1 didn't ship — bulk `all` / `sequence`, dispose-aware scoping), augment `src/types/result.ts` directly:

- `Result.all(results)` — collect a homogeneous array; first `Err` short-circuits.
- `Result.sequence(results)` — lift `Result<T, E>[]` to `Result<T[], E>` (alias for `all`).
- `tap(r, f)` — run a side-effect on the OK channel without changing the value.
- `tapErr(r, f)` — symmetric on the ERR channel.

These are 5–10 lines each with no new dependency. Tests added in the same Phase 7 commit drive coverage to 100% on the augmented module.

## Consequences

Easier:

- **Zero bundle-size delta.** The Refresh round stays under the existing `main.js` weight budget. `aozora.wasm` 2 MiB cap is unaffected.
- **Discoverable error paths.** Reading code, every `Result<T, AozoraError>` carries the error type in its signature; no implicit `effect-ts` `Effect<R, E, A>` triple where `R` (requirements) leaks across module boundaries.
- **Future re-adoption is cheap.** If a downstream phase eventually needs structured concurrency or layered DI, `effect-ts` can be admitted then, in a successor ADR. The current Result module's surface is API-compatible enough that a porting layer (`fromResult` / `toResult`) is a one-screen file.

Harder:

- **No structured concurrency.** Operations that legitimately need parallel parses with shared cancellation (none in the current code, but plausibly in a Phase 11 incremental cache + Phase 14 differential test) will need to roll their own `Promise.all`-with-cancellation. If that path becomes load-bearing, this ADR will be revisited.
- **No automatic effect tracing.** `effect-ts`'s built-in span / metric / telemetry hooks are unavailable; debugging an unhandled error chain falls back to console-plus-stack-trace inspection, augmented by the diagnostic interval tree (Phase 10). Acceptable for a single-process Obsidian plugin; revisit if the plugin ever spans multiple workers.

## Implementation

`src/types/result.ts` is augmented with `all` / `tap` / `tapErr` in the Phase 7 commit; tests in `tests/types/result.test.ts` cover the new branches. The catalogue row "Effect-ts" moves from `hypothesis` to `rejected` with this ADR linked.
