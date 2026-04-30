# 0007. Defer the Markov-chain n-gram encoding detector; bench gate keyed to a real corpus

- Status: accepted (deferred)
- Date: 2026-04-30
- Deciders: @P4suta
- Tags: encoding-detection, shift_jis, refresh-phase-9
- See also: [0003 — Architectural Refresh discipline](./0003-architecture-refresh-bench-first.md), [0006 — gaiji layer](./0006-gaiji-layer-defer-to-upstream.md)

## Context

Phase 9 of the Architectural Refresh round was scoped to add a Markov-chain n-gram encoding detector (chardet-style) so BOM-less Shift_JIS sources don't get misclassified as UTF-8 when the user's `defaultEncoding` setting disagrees.

Current path (`src/encoding.ts:46-60`): BOM detection only — UTF-8 / UTF-16 BOMs trigger their own decoders; everything else falls through to `defaultEncoding`. BOM-less SJIS with `defaultEncoding === 'utf8'` decodes garbage.

The catalogue lists `Markov-chain n-gram detector` as `hypothesis` against domain D5 (encoding detection). ADR 0003 §1 (bench-first) requires the detector be bench-gated against a real-world corpus before adoption.

## What's missing

The bench-gate criterion is a **misclassification rate ≥ 1% on a representative aozora.gr.jp corpus subset** (i.e. Markov-detection improves correctness on real input). Without that corpus, the gate cannot be evaluated. The round budget doesn't include corpus-acquisition work, and the available short-text fixtures (under `bench/fixtures.ts` synthetic generator + `aozora-bench` upstream's `crime_and_punishment`) all have BOMs or known encodings — they don't exercise the misclassification path.

## Decision

**Defer** the encoding-detector layer to a follow-up round, gated on:

1. Acquiring a corpus of ≥ 100 BOM-less Shift_JIS files from aozora.gr.jp, with ground-truth encoding labels. The corpus belongs in `tests/fixtures/encoding/` so it can drive both the bench and a regression test.
2. Running the existing BOM-only `decodeAozoraBytes` against that corpus and counting BOM-less misclassifications. If < 1% → encoder selection is already adequate; close the issue. If ≥ 1% → add the Markov detector to **`aozora-encoding` upstream** (per ADR 0006 §"Decision" — extend upstream, not duplicate downstream) and revisit this ADR.

Until the corpus exists, the catalogue row for "Markov n-gram encoding detector" reads `deferred (data gate)` with this ADR linked.

The current `src/encoding.ts:56-58` SJIS-by-`defaultEncoding` path stays as-is. Users who repeatedly read BOM-less SJIS files set `defaultEncoding: "sjis"` in settings; the heuristic exists for the BOM-bearing UTF-8 / UTF-16 majority case.

## Consequences

Easier:

- **No premature optimisation.** The round doesn't ship a Markov detector that may turn out to be unnecessary; the detector adds bundle weight (training data + model coefficients in the WASM) and code complexity that's only worth paying if the misclassification rate justifies it.
- **The gate is reproducible.** A future maintainer (including future-me) reads this ADR, builds the corpus, runs the bench, and gets a numerical answer. No "we forgot why this didn't ship" mystery.

Harder:

- **Setting-sensitive UX in the meantime.** A user with `defaultEncoding: "utf8"` who loads a vintage SJIS Aozora `.txt` sees mojibake in their preview. Mitigation: the settings tab description for "Default encoding" already calls out this trade-off (`src/settings.ts:69-70`); a future README clarification can make the trade-off more visible.

## Implementation

ADR-only; no code changes. Catalogue updated.
