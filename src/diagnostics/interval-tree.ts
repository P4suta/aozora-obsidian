/**
 * Augmented interval tree — point-stab + range-query in O(log n + k).
 *
 * Used by Phase 10 (Diagnostic UX) to answer "which diagnostic
 * spans overlap the cursor / a hover position?" without scanning
 * every diagnostic in the document.
 *
 * Implementation: balanced-by-construction binary search tree
 * keyed on `start`, augmented per node with `maxEndInSubtree`.
 * Build is `O(n log n)` (sort + recursive median split); the
 * tree is immutable — diagnostic-list changes rebuild it (cheap
 * compared to per-keystroke reuse savings).
 *
 * The "augmented BST" approach beats the naive sorted-array
 * approach asymptotically when many diagnostics start before the
 * query point but only a few overlap it (a common case for
 * cursor-at-EOF on a long document).
 *
 * Reference: CLRS §14.3 ("Interval trees") — adapted to a static
 * tree (no rotations) since rebuilds are infrequent.
 */

export interface Interval<T> {
  readonly start: number;
  readonly end: number;
  readonly payload: T;
}

interface IntervalNode<T> {
  readonly start: number;
  readonly end: number;
  readonly payload: T;
  readonly maxEnd: number;
  readonly left: IntervalNode<T> | null;
  readonly right: IntervalNode<T> | null;
}

interface IntervalTree<T> {
  /** Number of intervals stored. */
  readonly size: number;
  /**
   * Return every interval overlapping the point `p` (half-open:
   * `start <= p < end`). Result order is in-order tree traversal
   * (== sorted-by-start ascending), but consumers should not rely
   * on a specific ordering.
   */
  readonly stab: (p: number) => Interval<T>[];
  /**
   * Return every interval overlapping the closed range `[lo, hi]`.
   * Convenience wrapper over multiple stabs collapsed into one
   * recursion.
   */
  readonly range: (lo: number, hi: number) => Interval<T>[];
}

/**
 * Build an immutable interval tree from a list of intervals.
 *
 * Cost: `O(n log n)` for the initial sort; the recursive bisect
 * is `O(n)`. Allocation: one `IntervalNode` per input. Empty
 * input → empty tree (`size: 0`, `stab` always returns `[]`).
 */
export function buildIntervalTree<T>(intervals: readonly Interval<T>[]): IntervalTree<T> {
  if (intervals.length === 0) {
    return EMPTY_TREE as IntervalTree<T>;
  }
  const sorted = intervals.slice().sort((a, b) => a.start - b.start);
  const root = buildSubtree(sorted, 0, sorted.length);
  return {
    size: sorted.length,
    stab: (p) => collectStab(root, p),
    range: (lo, hi) => collectRange(root, lo, hi),
  };
}

const EMPTY_TREE: IntervalTree<unknown> = {
  size: 0,
  stab: () => [],
  range: () => [],
};

/**
 * Recursively split the sorted slice `[lo, hi)` at its median to
 * produce a balanced tree. The median choice keeps the tree's
 * height at O(log n), so even pathological span distributions
 * (every span overlapping every other) still query at O(log n + k).
 */
function buildSubtree<T>(
  sorted: readonly Interval<T>[],
  lo: number,
  hi: number,
): IntervalNode<T> | null {
  if (lo >= hi) {
    return null;
  }
  const mid = (lo + hi) >>> 1;
  const here = sorted[mid];
  /* istanbul ignore if -- defensive: `lo < hi` and `mid ∈ [lo, hi)`
     guarantees `sorted[mid]` is defined; the early return is a
     fail-fast safeguard against an invariant violation rather than
     a reachable branch in production. */
  if (here === undefined) {
    return null;
  }
  const left = buildSubtree(sorted, lo, mid);
  const right = buildSubtree(sorted, mid + 1, hi);
  const maxEnd = Math.max(
    here.end,
    left?.maxEnd ?? Number.NEGATIVE_INFINITY,
    right?.maxEnd ?? Number.NEGATIVE_INFINITY,
  );
  return {
    start: here.start,
    end: here.end,
    payload: here.payload,
    maxEnd,
    left,
    right,
  };
}

/** Walk the tree collecting intervals containing the point `p`. */
function collectStab<T>(node: IntervalNode<T> | null, p: number): Interval<T>[] {
  const out: Interval<T>[] = [];
  walkStab(node, p, out);
  return out;
}

function walkStab<T>(node: IntervalNode<T> | null, p: number, out: Interval<T>[]): void {
  if (node === null || node.maxEnd <= p) {
    // No descendant can overlap `p` if the subtree's maxEnd is
    // already <= p (intervals are half-open: start <= p < end).
    return;
  }
  walkStab(node.left, p, out);
  if (node.start <= p && p < node.end) {
    out.push({ start: node.start, end: node.end, payload: node.payload });
  }
  if (node.start <= p) {
    walkStab(node.right, p, out);
  }
}

/** Walk the tree collecting intervals overlapping `[lo, hi]` (closed). */
function collectRange<T>(node: IntervalNode<T> | null, lo: number, hi: number): Interval<T>[] {
  const out: Interval<T>[] = [];
  walkRange(node, lo, hi, out);
  return out;
}

function walkRange<T>(
  node: IntervalNode<T> | null,
  lo: number,
  hi: number,
  out: Interval<T>[],
): void {
  if (node === null || node.maxEnd <= lo) {
    return;
  }
  walkRange(node.left, lo, hi, out);
  // Half-open vs closed-range intersection:
  //   span [s, e) overlaps closed range [lo, hi]  iff  s <= hi && e > lo
  if (node.start <= hi && node.end > lo) {
    out.push({ start: node.start, end: node.end, payload: node.payload });
  }
  if (node.start <= hi) {
    walkRange(node.right, lo, hi, out);
  }
}
