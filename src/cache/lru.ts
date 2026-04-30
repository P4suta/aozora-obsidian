/**
 * Tiny LRU cache used to memoise parsed Aozora trees by source.
 *
 * Capacity defaults to 4 — the realistic working set for an
 * Obsidian preview pane is one document at a time, occasionally
 * with one switch back-and-forth. Even four entries is generous;
 * each entry pins a Lezer Tree which is small (a few KB for a
 * typical short story) but worth bounding.
 *
 * The implementation exploits that JS Maps preserve insertion
 * order; deleting + re-inserting on hit refreshes recency without
 * a separate doubly-linked list.
 *
 * Phase 11 of the Architectural Refresh round.
 */

export interface LruCache<K, V> {
  /** Look up; returns undefined on miss. Marks the entry as recently used. */
  readonly get: (key: K) => V | undefined;
  /** Insert or replace. Evicts the least-recently-used on capacity. */
  readonly set: (key: K, value: V) => void;
  /** Membership without touching recency. */
  readonly has: (key: K) => boolean;
  /** Number of entries currently held. */
  readonly size: () => number;
  /** Drop every entry. */
  readonly clear: () => void;
}

/**
 * Build an LRU cache with the supplied `capacity`. `capacity`
 * must be a positive integer; pass 1+ to satisfy the LRU
 * invariant ("at least one slot to put the value in"). Throws
 * via TypeError on `capacity < 1`.
 */
export function createLruCache<K, V>(capacity: number): LruCache<K, V> {
  if (capacity < 1 || !Number.isInteger(capacity)) {
    throw new TypeError(
      `LRU capacity must be a positive integer, got ${capacity}`,
    );
  }
  const store = new Map<K, V>();
  return {
    get: (key) => {
      const value = store.get(key);
      if (value === undefined) {
        return undefined;
      }
      // Refresh recency: re-insertion moves the key to the end.
      store.delete(key);
      store.set(key, value);
      return value;
    },
    set: (key, value) => {
      // Refresh recency on existing key by deleting first; then
      // insertion-order places the key at the end (most recent).
      if (store.has(key)) {
        store.delete(key);
      }
      store.set(key, value);
      while (store.size > capacity) {
        // The first key in iteration order is the LRU.
        const oldest = store.keys().next();
        if (oldest.done === true) {
          break;
        }
        store.delete(oldest.value);
      }
    },
    has: (key) => store.has(key),
    size: () => store.size,
    clear: () => store.clear(),
  };
}
