// WASM boundary bench: measures every step that crosses the
// JS ⇄ WASM line for the bundled `aozora-wasm` artefact.
//
// Steps measured:
//   - init cold (first `AozoraParser.ready()` for a fresh parser)
//   - parse (`Document::new` + lex_into_arena + arena allocation)
//   - to_html (renderer → string return → JS conversion)
//   - serialize (renderer → canonicalised aozora source)
//   - diagnostics_json (Vec<Diagnostic> → JSON string → JS)
//   - dispose (RawDocument::free, releases the bumpalo arena)
//
// Each step is benched at the synthetic-size ladder (100B → 1MB).
// The published numbers form the baseline that downstream phases
// (Phase 2/4/11) compare against when proposing changes.

import { bench, describe } from "vitest";
import { makeColdParserFactory, makeReadyParser } from "./harness";
import { SOURCE_SIZE_LADDER, syntheticSource } from "./fixtures";

describe("wasm-boundary: init", () => {
  // Cold init bench — re-instantiates the wasm module each iteration.
  // wasm-bindgen's `init()` is idempotent in production (memoised in
  // `wasm-loader.ts:25-30`) but we want the cold-path number, so we
  // ask the harness for a fresh parser per iteration.
  bench(
    "init cold (fresh AozoraParser.ready)",
    async () => {
      const parser = makeColdParserFactory()();
      await parser.ready();
    },
    { iterations: 20 },
  );
});

describe("wasm-boundary: parse + render (warm)", () => {
  // Single shared parser; init cost is paid once before the bench
  // suite runs. This isolates per-call parse + render cost.
  let parser: Awaited<ReturnType<typeof makeReadyParser>> | undefined;

  for (const tier of SOURCE_SIZE_LADDER) {
    const source = syntheticSource(tier.bytes);

    bench(
      `parse ${tier.label}`,
      async () => {
        if (parser === undefined) {
          parser = await makeReadyParser();
        }
        const doc = await parser.parse(source);
        doc.dispose();
      },
      { iterations: tier.bytes >= 1_000_000 ? 30 : 100 },
    );

    bench(
      `to_html ${tier.label}`,
      async () => {
        if (parser === undefined) {
          parser = await makeReadyParser();
        }
        const doc = await parser.parse(source);
        try {
          doc.toHtml();
        } finally {
          doc.dispose();
        }
      },
      { iterations: tier.bytes >= 1_000_000 ? 30 : 100 },
    );

    bench(
      `serialize ${tier.label}`,
      async () => {
        if (parser === undefined) {
          parser = await makeReadyParser();
        }
        const doc = await parser.parse(source);
        try {
          doc.serialize();
        } finally {
          doc.dispose();
        }
      },
      { iterations: tier.bytes >= 1_000_000 ? 30 : 100 },
    );

    bench(
      `diagnostics ${tier.label}`,
      async () => {
        if (parser === undefined) {
          parser = await makeReadyParser();
        }
        const doc = await parser.parse(source);
        try {
          doc.diagnostics();
        } finally {
          doc.dispose();
        }
      },
      { iterations: tier.bytes >= 1_000_000 ? 30 : 100 },
    );

    // Phase 2 (D layer): JSON wire from `Document::nodes_json` →
    // zod-validated `AozoraNodeView[]` on the JS side. Baseline lets
    // Phase 4 (Lezer Tree builder) see whether the JSON cross + zod
    // parse cost is acceptable, or whether a structured serde-wasm-
    // bindgen path becomes necessary.
    bench(
      `nodes ${tier.label}`,
      async () => {
        if (parser === undefined) {
          parser = await makeReadyParser();
        }
        const doc = await parser.parse(source);
        try {
          doc.nodes();
        } finally {
          doc.dispose();
        }
      },
      { iterations: tier.bytes >= 1_000_000 ? 30 : 100 },
    );
  }
});
