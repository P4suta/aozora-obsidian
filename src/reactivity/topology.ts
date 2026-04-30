/**
 * Topological sort with cycle detection — used by the reactivity
 * store to order effect evaluation deterministically and to fail
 * loudly on circular settings dependencies at startup.
 *
 * Kahn's algorithm with an explicit "remaining edges" counter.
 * O(V + E). Returns an `Ok` with the sorted node list or an
 * `Err` carrying the cycle as a list of node ids in the order they
 * appear when the cycle is hit.
 */

import { err, ok, type Result } from "../types/result";

export interface TopologyEdge<N> {
  readonly from: N;
  readonly to: N;
}

export interface CycleError<N> {
  readonly kind: "cycle";
  readonly involved: readonly N[];
}

/**
 * Order `nodes` so every edge `(from, to)` has `from` placed
 * before `to` in the result. If no such ordering exists (the
 * dependency graph contains a cycle), return `err`.
 *
 * `nodes` defines the universe — every endpoint of every edge
 * must appear in `nodes`. Unknown endpoints are treated as a
 * graph-construction error and reported as a cycle (because the
 * caller's settings declaration is malformed by definition).
 */
export function topologicalSort<N>(
  nodes: readonly N[],
  edges: readonly TopologyEdge<N>[],
): Result<readonly N[], CycleError<N>> {
  const indegree = new Map<N, number>();
  const adjacency = new Map<N, N[]>();
  for (const node of nodes) {
    indegree.set(node, 0);
    adjacency.set(node, []);
  }
  for (const edge of edges) {
    if (!indegree.has(edge.from) || !indegree.has(edge.to)) {
      return err({ kind: "cycle", involved: [edge.from, edge.to] });
    }
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    adjacency.get(edge.from)?.push(edge.to);
  }

  const ready: N[] = [];
  for (const node of nodes) {
    if (indegree.get(node) === 0) {
      ready.push(node);
    }
  }

  const order: N[] = [];
  while (ready.length > 0) {
    const current = ready.shift();
    if (current === undefined) {
      break;
    }
    order.push(current);
    for (const next of adjacency.get(current) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) {
        ready.push(next);
      }
    }
  }

  if (order.length !== nodes.length) {
    const involved = nodes.filter((n) => (indegree.get(n) ?? 0) > 0);
    return err({ kind: "cycle", involved });
  }
  return ok(order);
}
