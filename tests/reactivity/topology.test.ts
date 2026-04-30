import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { topologicalSort } from "../../src/reactivity/topology";

describe("topologicalSort", () => {
  it("returns the original order when there are no edges", () => {
    const result = topologicalSort(["a", "b", "c"], []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(["a", "b", "c"]);
    }
  });

  it("orders a linear chain a→b→c", () => {
    const result = topologicalSort(
      ["a", "b", "c"],
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(["a", "b", "c"]);
    }
  });

  it("orders a diamond a→b, a→c, b→d, c→d so a precedes everyone and d follows", () => {
    const result = topologicalSort(
      ["a", "b", "c", "d"],
      [
        { from: "a", to: "b" },
        { from: "a", to: "c" },
        { from: "b", to: "d" },
        { from: "c", to: "d" },
      ],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const order = result.value;
      expect(order[0]).toBe("a");
      expect(order[order.length - 1]).toBe("d");
      expect(order.indexOf("b")).toBeLessThan(order.indexOf("d"));
      expect(order.indexOf("c")).toBeLessThan(order.indexOf("d"));
    }
  });

  it("returns an Err for a self-cycle a→a", () => {
    const result = topologicalSort(["a"], [{ from: "a", to: "a" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.involved).toContain("a");
    }
  });

  it("returns an Err for a 2-cycle a→b→a", () => {
    const result = topologicalSort(
      ["a", "b"],
      [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.involved.length).toBeGreaterThan(0);
    }
  });

  it("returns an Err when an edge references an unknown node", () => {
    const result = topologicalSort(["a", "b"], [{ from: "a", to: "ghost" }]);
    expect(result.ok).toBe(false);
  });

  it("preserves every node in the result on success (property)", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 5 }), {
          minLength: 1,
          maxLength: 8,
        }),
        (nodes) => {
          // Build a strictly-acyclic graph: each edge goes from
          // a lower-index node to a higher-index node.
          const edges = nodes.flatMap((from, i) =>
            nodes.slice(i + 1).map((to) => ({ from, to })),
          );
          const result = topologicalSort(nodes, edges);
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.value.slice().sort()).toEqual(nodes.slice().sort());
          }
        },
      ),
    );
  });

  it("the result respects every edge a→b ⇒ index(a) < index(b)", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 5 }), {
          minLength: 2,
          maxLength: 6,
        }),
        (nodes) => {
          const edges = nodes.flatMap((from, i) =>
            nodes.slice(i + 1).map((to) => ({ from, to })),
          );
          const result = topologicalSort(nodes, edges);
          if (result.ok) {
            for (const edge of edges) {
              expect(result.value.indexOf(edge.from)).toBeLessThan(
                result.value.indexOf(edge.to),
              );
            }
          }
        },
      ),
    );
  });
});
