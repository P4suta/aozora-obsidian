import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createLruCache } from "../../src/cache/lru";

describe("createLruCache", () => {
  it("starts empty", () => {
    const cache = createLruCache<string, number>(4);
    expect(cache.size()).toBe(0);
    expect(cache.get("missing")).toBeUndefined();
    expect(cache.has("missing")).toBe(false);
  });

  it("rejects capacity < 1", () => {
    expect(() => createLruCache(0)).toThrow(TypeError);
    expect(() => createLruCache(-1)).toThrow(TypeError);
    expect(() => createLruCache(1.5)).toThrow(TypeError);
  });

  it("set + get round-trip", () => {
    const cache = createLruCache<string, number>(4);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    expect(cache.has("a")).toBe(true);
    expect(cache.size()).toBe(1);
  });

  it("set on an existing key replaces the value", () => {
    const cache = createLruCache<string, number>(4);
    cache.set("a", 1);
    cache.set("a", 2);
    expect(cache.get("a")).toBe(2);
    expect(cache.size()).toBe(1);
  });

  it("evicts the least-recently-used on overflow (no recency promotion)", () => {
    const cache = createLruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3); // evicts "a"
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);
    expect(cache.has("c")).toBe(true);
  });

  it("get refreshes recency, sparing a key that would otherwise be evicted", () => {
    const cache = createLruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // promote "a"; next eviction should drop "b"
    cache.set("c", 3);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });

  it("set on an existing key refreshes recency", () => {
    const cache = createLruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 11); // promote "a"; next eviction should drop "b"
    cache.set("c", 3);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });

  it("clear empties the cache", () => {
    const cache = createLruCache<string, number>(4);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.has("a")).toBe(false);
  });

  it("has does NOT touch recency", () => {
    const cache = createLruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.has("a"); // membership-only — doesn't promote
    cache.set("c", 3);
    // Without promotion, "a" was the LRU and got evicted.
    expect(cache.has("a")).toBe(false);
  });

  it("size is bounded by capacity (property)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.array(fc.tuple(fc.string(), fc.integer())),
        (capacity, ops) => {
          const cache = createLruCache<string, number>(capacity);
          for (const [k, v] of ops) {
            cache.set(k, v);
            expect(cache.size()).toBeLessThanOrEqual(capacity);
          }
        },
      ),
    );
  });
});
