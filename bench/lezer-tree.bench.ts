// Lezer-Tree builder bench. Measures the cost of folding a flat
// `AozoraNodeView[]` stream (output of Phase 2's `Document.nodes_json`
// + zod validation) into a Lezer `Tree` (input of Phase 5's
// CodeMirror `LanguageSupport`).
//
// Tiers track the realistic working set for a long-form Aozora
// document: a single short story typically classifies into ~100-1k
// nodes, a novella into ~10k. The 100k tier exists to prove the
// linear-in-node-count scaling claim from the bench-first ADR
// (`docs/adr/0003-architecture-refresh-bench-first.md`).

import { bench, describe } from "vitest";
import { buildAozoraTree } from "../src/lezer/aozora-parser";
import type { AozoraNodeView } from "../src/wasm/node-schema";

function syntheticNodes(count: number): AozoraNodeView[] {
  const nodes: AozoraNodeView[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    const len = (i % 7) + 3;
    const kindIndex = i % 5;
    const kind = (
      ["ruby", "bouten", "annotation", "gaiji", "indent"] as const
    )[kindIndex] ?? "ruby";
    nodes.push({ kind, start: cursor, end: cursor + len });
    cursor += len + 1;
  }
  return nodes;
}

const TIERS = [100, 1_000, 10_000, 100_000] as const;

describe("lezer-tree build", () => {
  for (const count of TIERS) {
    const nodes = syntheticNodes(count);
    // The renderer uses byte offsets, so size the source buffer
    // accordingly. Content is irrelevant — Lezer never inspects it.
    const lastEnd = nodes[nodes.length - 1]?.end ?? 0;
    const source = "x".repeat(lastEnd);

    bench(
      `build tree (${count.toLocaleString()} nodes)`,
      () => {
        buildAozoraTree(source, nodes);
      },
      { iterations: count >= 100_000 ? 30 : 200 },
    );
  }
});
