import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildIntervalTree, type Interval } from "../../src/diagnostics/interval-tree";

const intervalArb = fc
  .tuple(fc.nat({ max: 1000 }), fc.nat({ max: 100 }))
  .map(([start, len]) => ({ start, end: start + len + 1, payload: `${start}-${start + len + 1}` }));

const intervalsArb = fc.array(intervalArb, { minLength: 0, maxLength: 50 });

function naiveStab<T>(intervals: readonly Interval<T>[], p: number): Interval<T>[] {
  return intervals.filter((iv) => iv.start <= p && p < iv.end);
}

function naiveRange<T>(intervals: readonly Interval<T>[], lo: number, hi: number): Interval<T>[] {
  return intervals.filter((iv) => iv.start <= hi && iv.end > lo);
}

describe("buildIntervalTree", () => {
  it("returns size 0 + empty queries for the empty input", () => {
    const tree = buildIntervalTree<string>([]);
    expect(tree.size).toBe(0);
    expect(tree.stab(0)).toEqual([]);
    expect(tree.stab(100)).toEqual([]);
    expect(tree.range(0, 1)).toEqual([]);
  });

  it("stab returns the single matching interval at the start", () => {
    const tree = buildIntervalTree([{ start: 5, end: 10, payload: "a" }]);
    expect(tree.stab(5)).toEqual([{ start: 5, end: 10, payload: "a" }]);
    expect(tree.stab(9)).toEqual([{ start: 5, end: 10, payload: "a" }]);
  });

  it("stab does NOT match the end (half-open: start <= p < end)", () => {
    const tree = buildIntervalTree([{ start: 5, end: 10, payload: "a" }]);
    expect(tree.stab(10)).toEqual([]);
  });

  it("stab returns multiple matches when intervals nest", () => {
    const tree = buildIntervalTree([
      { start: 0, end: 100, payload: "outer" },
      { start: 10, end: 20, payload: "inner" },
    ]);
    const matches = tree.stab(15);
    expect(matches.length).toBe(2);
    expect(matches.map((m) => m.payload).sort()).toEqual(["inner", "outer"]);
  });

  it("range matches an interval that straddles lo or hi", () => {
    const tree = buildIntervalTree([
      { start: 0, end: 5, payload: "left" },
      { start: 8, end: 20, payload: "right" },
    ]);
    const matches = tree.range(4, 9);
    expect(matches.map((m) => m.payload).sort()).toEqual(["left", "right"]);
  });

  it("range does not match an interval entirely below lo (end <= lo)", () => {
    const tree = buildIntervalTree([{ start: 0, end: 5, payload: "x" }]);
    expect(tree.range(5, 10)).toEqual([]);
  });

  it("range does not match an interval entirely above hi (start > hi)", () => {
    const tree = buildIntervalTree([{ start: 10, end: 20, payload: "x" }]);
    expect(tree.range(0, 5)).toEqual([]);
  });

  it("size matches input length", () => {
    fc.assert(
      fc.property(intervalsArb, (xs) => {
        expect(buildIntervalTree(xs).size).toBe(xs.length);
      }),
    );
  });

  it("stab matches the naive O(n) reference (property)", () => {
    fc.assert(
      fc.property(intervalsArb, fc.nat({ max: 1500 }), (xs, p) => {
        const tree = buildIntervalTree(xs);
        const got = tree.stab(p).map((iv) => iv.payload).sort();
        const expected = naiveStab(xs, p)
          .map((iv) => iv.payload)
          .sort();
        expect(got).toEqual(expected);
      }),
    );
  });

  it("range matches the naive O(n) reference (property)", () => {
    fc.assert(
      fc.property(
        intervalsArb,
        fc.nat({ max: 1500 }),
        fc.nat({ max: 100 }),
        (xs, lo, span) => {
          const hi = lo + span;
          const tree = buildIntervalTree(xs);
          const got = tree
            .range(lo, hi)
            .map((iv) => iv.payload)
            .sort();
          const expected = naiveRange(xs, lo, hi)
            .map((iv) => iv.payload)
            .sort();
          expect(got).toEqual(expected);
        },
      ),
    );
  });
});
