import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildAozoraTree } from "../../src/lezer/aozora-parser";
import { nodeIdForKind } from "../../src/lezer/aozora-types";
import type { AozoraNodeKind, AozoraNodeView } from "../../src/wasm/node-schema";

const ALL_KINDS: readonly AozoraNodeKind[] = [
  "ruby",
  "bouten",
  "tateChuYoko",
  "gaiji",
  "indent",
  "alignEnd",
  "warichu",
  "keigakomi",
  "pageBreak",
  "sectionBreak",
  "heading",
  "headingHint",
  "sashie",
  "kaeriten",
  "annotation",
  "doubleRuby",
  "container",
  "containerOpen",
  "containerClose",
  "unknown",
];

describe("buildAozoraTree", () => {
  it("returns a tree with the source's UTF-8 length when the node list is empty", () => {
    const source = "あいうえお";
    const tree = buildAozoraTree(source, []);
    expect(tree.length).toBe(new TextEncoder().encode(source).byteLength);
    expect(tree.topNode.firstChild).toBeNull();
  });

  it("encodes one tree node per AozoraNodeView (flat)", () => {
    const source = "｜青梅《おうめ》";
    const nodes: readonly AozoraNodeView[] = [{ kind: "ruby", start: 0, end: 21 }];
    const tree = buildAozoraTree(source, nodes);
    const child = tree.topNode.firstChild;
    expect(child).not.toBeNull();
    expect(child?.from).toBe(0);
    expect(child?.to).toBe(21);
    expect(child?.type.id).toBe(nodeIdForKind("ruby"));
    expect(child?.nextSibling).toBeNull();
  });

  it("preserves source order across many nodes", () => {
    const source = "1234567890";
    const nodes: readonly AozoraNodeView[] = [
      { kind: "ruby", start: 0, end: 2 },
      { kind: "bouten", start: 2, end: 4 },
      { kind: "annotation", start: 4, end: 6 },
    ];
    const tree = buildAozoraTree(source, nodes);
    const seen: { id: number; from: number; to: number }[] = [];
    let cur = tree.topNode.firstChild;
    while (cur !== null) {
      seen.push({ id: cur.type.id, from: cur.from, to: cur.to });
      cur = cur.nextSibling;
    }
    expect(seen).toEqual([
      { id: nodeIdForKind("ruby"), from: 0, to: 2 },
      { id: nodeIdForKind("bouten"), from: 2, to: 4 },
      { id: nodeIdForKind("annotation"), from: 4, to: 6 },
    ]);
  });

  it("clamps a span whose start is before the previous node's end", () => {
    const source = "abcdefghij";
    const nodes: readonly AozoraNodeView[] = [
      { kind: "ruby", start: 0, end: 5 },
      // overlap: starts at 3 even though prev ended at 5
      { kind: "bouten", start: 3, end: 7 },
    ];
    const tree = buildAozoraTree(source, nodes);
    const second = tree.topNode.firstChild?.nextSibling;
    expect(second?.from).toBe(5);
    expect(second?.to).toBe(7);
  });

  it("clamps an end that exceeds the document UTF-8 length", () => {
    const source = "abc"; // 3 bytes
    const nodes: readonly AozoraNodeView[] = [{ kind: "ruby", start: 0, end: 100 }];
    const tree = buildAozoraTree(source, nodes);
    expect(tree.topNode.firstChild?.to).toBe(3);
  });

  it("clamps a start that exceeds the document UTF-8 length to docLength", () => {
    const source = "abc"; // 3 bytes
    const nodes: readonly AozoraNodeView[] = [{ kind: "ruby", start: 99, end: 100 }];
    const tree = buildAozoraTree(source, nodes);
    expect(tree.topNode.firstChild?.from).toBe(3);
    expect(tree.topNode.firstChild?.to).toBe(3);
  });

  it("clamps an end that lies before the (already-clamped) start", () => {
    const source = "abcdefghij";
    const nodes: readonly AozoraNodeView[] = [{ kind: "ruby", start: 5, end: 2 }];
    const tree = buildAozoraTree(source, nodes);
    expect(tree.topNode.firstChild?.from).toBe(5);
    expect(tree.topNode.firstChild?.to).toBe(5);
  });

  it("yields the same id for the same kind for every node", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            kind: fc.constantFrom(...ALL_KINDS),
            offset: fc.nat({ max: 1000 }),
            len: fc.integer({ min: 0, max: 50 }),
          }),
          { maxLength: 50 },
        ),
        (entries) => {
          // Build non-overlapping ascending spans from the input.
          let prev = 0;
          const nodes: AozoraNodeView[] = entries.map((e) => {
            const start = prev + e.offset;
            const end = start + e.len;
            prev = end;
            return { kind: e.kind, start, end };
          });
          const source = "x".repeat(prev);
          const tree = buildAozoraTree(source, nodes);
          let cur = tree.topNode.firstChild;
          let i = 0;
          while (cur !== null) {
            const expected = nodes[i];
            expect(expected).toBeDefined();
            if (expected !== undefined) {
              expect(cur.type.id).toBe(nodeIdForKind(expected.kind));
            }
            cur = cur.nextSibling;
            i += 1;
          }
          expect(i).toBe(nodes.length);
        },
      ),
    );
  });
});
