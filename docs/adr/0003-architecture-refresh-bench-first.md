# 0003. Architectural Refresh — bench-first / reuse-first / systemise

- Status: accepted
- Date: 2026-04-30
- Deciders: @P4suta
- Tags: architecture, methodology, discipline
- Supersedes: (none)
- Superseded-by: (none)

## Context

The Architectural Refresh round(`docs/architecture-refresh/00-current-naive-points.md`)was opened with the goal of replacing aozora-obsidian's naive TS internals with a sophisticated, layered design. An initial plan listed many candidate algorithms / data structures and recorded YES/NO adoption decisions in a single table.

Two failure modes surfaced during planning that this ADR fixes:

1. **Decisions made on intuition rather than measurement.** The plan said "adopt Aho-Corasick", "adopt Lezer", "adopt signals", "adopt effect-ts" without bench evidence. Each candidate sounded modern; none had been timed against this specific workload.
2. **Failure to reuse upstream.** `aozora-scan`(SIMD trigger-byte scanner, Teddy + AVX2 structural-bitmap + DFA, 10-20 GiB/s)already exists in the sibling `aozora` workspace. The plan proposed to "add Aho-Corasick to aozora-wasm" — duplicating the existing crate. Similarly: `aozora-bench` (criterion + corpus + PGO) and `aozora-trace` (samply gecko-format profile loader + 6 analyses) already provide measurement infrastructure that the plan was about to reinvent.

User feedback (2026-04-30) crystallised the problem:

> 開発における意思決定はノリと推測で行うのではなく、Data Drivenに行おう。プロファイルしたいことはすべて一回限りの使い捨てにするのではなく、今後も誰かの役に立つ、あるいは明日の私が役に立つように仕組み化をする。乱立をさせるのではなく、すべて規律に沿って美しくアーキテクチャを意識してまとめることが大事かもしれませんね。

(Translated: "Development decisions should not be made on instinct and guesswork — make them data-driven. Profiling work should not be one-shot throwaway scripts; systematise them so they help future-me or others. Don't proliferate; align everything to disciplined, architecturally-conscious design.")

## Decision

The Architectural Refresh round operates under three rules. Every phase, every adoption decision, every PR is gated on these:

### 1. Bench-first

Every adoption candidate (algorithm, data structure, library, refactor) starts as a **hypothesis**. Promotion to "adopted" requires:

- A bench in `bench/*.bench.ts` that measures the relevant metric **before** any implementation.
- A baseline run committed to `bench/baseline.json`.
- An "after" run that demonstrates the candidate moves the metric in the desired direction by a margin large enough to outweigh the variance noise floor (typically ≥ 5% on stable machines, ≥ 10% on shared CI runners).
- An ADR (this directory, 0004 onward) that links the bench numbers and records the adoption decision.

If the bench shows no improvement (or shows regression), the candidate is **rejected** and recorded in `docs/architecture-refresh/03-tradeoffs.md` so future planners don't re-propose it without new evidence.

The bench harness lives in `bench/` (see `bench/README.md` for the file layout and `bench/baseline.json` for the canonical numbers). It is invoked via `just bench`(Docker-first per ADR 0002), runs `vitest bench`(v4.x native), and writes `bench/last-run.json` for `scripts/bench-compare.mjs` to diff against the baseline.

### 2. Reuse-first

Before introducing any new dependency, new crate, or new self-written algorithm, the engineer **must** verify that the sibling `aozora` workspace doesn't already solve the problem. The current inventory (as of 2026-04-30, see `00-current-naive-points.md` §0.1):

| Existing crate | Solves |
|---|---|
| `aozora-scan` | SIMD trigger-byte scanning (Teddy / structural-bitmap / DFA) |
| `aozora-lex` | borrowed-AST orchestrator |
| `aozora-lexer` | 4-phase lexer (sanitize / events / pair / classify) |
| `aozora-syntax` | borrowed AST types + `Interner` |
| `aozora-render` | HTML / serialisation renderers |
| `aozora-encoding` | Shift_JIS decode + gaiji (extension target) |
| `aozora-veb` | Eytzinger-layout sorted lookup (Khuong & Morin 2017) |
| `aozora-bench` | criterion + corpus walker + PGO profile source |
| `aozora-trace` | samply gecko-format trace loader + 6 analyses |
| `aozora-test-utils` | proptest strategies |
| `aozora-corpus` | corpus walker (filesystem / archive) |

When upstream **doesn't** have what we need, the rule is:

1. First preference: extend the relevant aozora-* crate so the capability lives upstream and is reusable by every aozora consumer (CLI / FFI / WASM / Python / VSCode).
2. Second preference: add to aozora-obsidian only when the capability is fundamentally a JS/CodeMirror/Obsidian-side concern (e.g. CodeMirror `LanguageSupport` registration, Lezer Tree adapter, Obsidian setting-tab reactivity).
3. **Never duplicate** an upstream capability in TS form. Concretely: no JS regex lexers (`livepreview.ts`'s 4 patterns are slated for deletion in Phase 5), no JS BOM-only encoding heuristics that ignore `aozora-encoding` (Phase 9 extends upstream).

### 3. Systemise

Every artefact produced during this round must answer "how does this become a permanent asset?". Concretely:

- **Bench harnesses** live under `bench/`, share a common `harness.ts` and `fixtures.ts`, and accumulate over phases.
- **ADRs** are numbered (this is 0003), are short (one decision per file), link to bench numbers and to other ADRs, and never get retroactively rewritten — they are amended via subsequent ADRs that supersede them.
- **Architecture docs** under `docs/architecture-refresh/` are series-structured (`00-current-naive-points.md`, `01-data-structure-catalog.md`, `02-layer-design.md`, `03-tradeoffs.md`) and are updated by every phase.
- **Profile traces** captured for optimisation work are loaded via `aozora-trace`, the analyses are committed (folded stacks for flamegraphs, top-N hot leaves, library distribution), and the raw `.json.gz` is referenced from the ADR.
- **One-shot scripts** are not committed unless they're being formalised — either they become an ADR with the steps documented, or they go in the trash. No `tmp_check.mjs` / `quick_test.sh` in version control.
- **Catalogues** (Part I/II of the round plan) move from chat-session ephemeral form into `docs/architecture-refresh/01-data-structure-catalog.md` and are kept in sync with adoption decisions.

## Consequences

Easier:

- **Decisions are auditable.** Anyone (including future-me) can read an ADR, find the bench numbers, and understand why a candidate was adopted or rejected. No re-litigation.
- **Round scope stays bounded.** The bench-first gate naturally rejects pet candidates that don't move the needle, so the round doesn't bloat with "modern-sounding" additions that contribute nothing.
- **Upstream improvements compound.** Capabilities pushed to `aozora-encoding` (e.g. Markov decoder if Phase 9 decides it's worth it) help every aozora consumer, not just the Obsidian plugin.

Harder:

- **Phases are slower up front.** Writing the bench, capturing baseline, then implementing, then re-running the bench takes longer than just implementing. The trade is that we don't ship optimisations that don't optimise.
- **Some aesthetic refactors don't qualify.** A refactor that improves only readability (without bench-measurable performance impact) needs an explicit "readability" justification in the ADR. We don't blanket-reject such refactors, but they need a different rationale than the bench gate.
- **Workspace boundary discipline costs time when extending upstream.** Adding a feature to `aozora-encoding` (a sibling repo) is more friction than adding it to aozora-obsidian's `src/encoding.ts`. The cost is paid because the alternative — duplicating logic — is what got us into this mess.

## Implementation

This round's phases (see `/home/yasunobu/.claude/plans/aozora-tools-vscode-plugin-obsidian-mellow-dream.md`) operate under this ADR:

- Phase -1: bench harness foundation. Each bench a baseline.json entry. Empty until first run.
- Phase 0: critique document (done, see `00-current-naive-points.md`).
- Phase 1 onward: every adoption decision goes through the bench gate and produces an ADR.

Subsequent ADRs in this round:

- `0004-aozora-scan-as-upstream-lexer.md` — formalises Phase 2's reversal (no self-written Aho-Corasick).
- `0005+` — one per major phase decision.

## Notes

The bench gate is **calibrated against this workload**, not against generic JS. Aozora rendering is dominated by lex+parse over UTF-8 Japanese with frequent 3-byte BMP triggers; benchmarks against generic regex/lex libraries published by other projects do not transfer. The decision to use `aozora-scan` rather than reinventing isn't an appeal to authority; it's the conclusion of measuring upstream against generic alternatives in `aozora-bench`'s `synthetic_corpus` and `crime_and_punishment` runs.

The discipline is intended to apply for the duration of the Refresh round (target: end at v0.1.0 release). After release, normal maintenance (bug fixes, dependency bumps, small features) does not require a per-change ADR. A separate post-mortem ADR will record whether the discipline produced the intended outcome.
