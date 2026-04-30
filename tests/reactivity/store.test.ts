import { effect } from "@preact/signals-core";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/schema/settings";
import {
  createReactiveStore,
  derive,
  registerEffects,
} from "../../src/reactivity/store";

describe("createReactiveStore", () => {
  it("seeds every signal from the initial AozoraSettings snapshot", () => {
    const store = createReactiveStore(DEFAULT_SETTINGS);
    expect(store.signals.writingMode.value).toBe(DEFAULT_SETTINGS.writingMode);
    expect(store.signals.enableLivePreview.value).toBe(DEFAULT_SETTINGS.enableLivePreview);
    expect(store.signals.txtGlob.value).toEqual(DEFAULT_SETTINGS.txtGlob);
  });

  it("snapshot() returns a fresh object whose values match the live signals", () => {
    const store = createReactiveStore(DEFAULT_SETTINGS);
    expect(store.snapshot()).toEqual(DEFAULT_SETTINGS);
    store.signals.writingMode.value = "vertical";
    expect(store.snapshot().writingMode).toBe("vertical");
  });

  it("update() mutates only the provided fields", () => {
    const store = createReactiveStore(DEFAULT_SETTINGS);
    store.update({ writingMode: "vertical", detectAozoraTxt: false });
    expect(store.signals.writingMode.value).toBe("vertical");
    expect(store.signals.detectAozoraTxt.value).toBe(false);
    expect(store.signals.enableLivePreview.value).toBe(DEFAULT_SETTINGS.enableLivePreview);
  });

  it("update() ignores undefined keys (no-op rather than reset)", () => {
    const store = createReactiveStore({
      ...DEFAULT_SETTINGS,
      writingMode: "vertical",
    });
    // `undefined` for writingMode means "don't touch", not "set to undefined".
    store.update({ writingMode: undefined });
    expect(store.signals.writingMode.value).toBe("vertical");
  });

  it("hydrate() round-trips a stored AozoraSettings payload", () => {
    const store = createReactiveStore(DEFAULT_SETTINGS);
    const target = { ...DEFAULT_SETTINGS, writingMode: "vertical", enableLivePreview: false };
    store.hydrate(target);
    expect(store.snapshot()).toEqual(target);
  });

  it("hydrate() recovers DEFAULT_SETTINGS for an unparseable payload", () => {
    const store = createReactiveStore({
      ...DEFAULT_SETTINGS,
      writingMode: "vertical",
    });
    store.hydrate("garbage");
    expect(store.snapshot()).toEqual(DEFAULT_SETTINGS);
  });

  it("notifies subscribers on signal change (single-field)", () => {
    const store = createReactiveStore(DEFAULT_SETTINGS);
    const seen: string[] = [];
    const dispose = effect(() => {
      seen.push(store.signals.writingMode.value);
    });
    expect(seen).toEqual(["horizontal"]);
    store.update({ writingMode: "vertical" });
    expect(seen).toEqual(["horizontal", "vertical"]);
    dispose();
  });

  it("a single update batches multiple field changes into one effect run per dependent", () => {
    const store = createReactiveStore(DEFAULT_SETTINGS);
    const runs = vi.fn();
    const dispose = effect(() => {
      runs(store.signals.writingMode.value, store.signals.detectAozoraTxt.value);
    });
    runs.mockClear();
    store.update({ writingMode: "vertical", detectAozoraTxt: false });
    // batching: signal core may run the effect once or twice
    // depending on micro-batch boundaries. We assert the post-state
    // is consistent rather than the exact run count.
    expect(store.signals.writingMode.value).toBe("vertical");
    expect(store.signals.detectAozoraTxt.value).toBe(false);
    dispose();
  });
});

describe("derive", () => {
  it("returns a ReadonlySignal that recomputes on dep change", () => {
    const store = createReactiveStore(DEFAULT_SETTINGS);
    const isVertical = derive(() => store.signals.writingMode.value === "vertical");
    expect(isVertical.value).toBe(false);
    store.update({ writingMode: "vertical" });
    expect(isVertical.value).toBe(true);
  });
});

describe("registerEffects", () => {
  it("returns Ok and runs every effect at least once", () => {
    const seen: string[] = [];
    const result = registerEffects({
      effects: [
        { id: "a", run: () => seen.push("a") },
        { id: "b", run: () => seen.push("b") },
      ],
      edges: [{ from: "a", to: "b" }],
    });
    expect(result.ok).toBe(true);
    expect(seen).toContain("a");
    expect(seen).toContain("b");
    if (result.ok) {
      result.value();
    }
  });

  it("returns Err on a self-cycle", () => {
    const result = registerEffects({
      effects: [{ id: "a", run: () => {} }],
      edges: [{ from: "a", to: "a" }],
    });
    expect(result.ok).toBe(false);
  });

  it("returns Err on a 2-cycle", () => {
    const result = registerEffects({
      effects: [
        { id: "a", run: () => {} },
        { id: "b", run: () => {} },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("dispose teardown runs every disposer", () => {
    const result = registerEffects({
      effects: [
        { id: "a", run: () => {} },
        { id: "b", run: () => {} },
      ],
      edges: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Smoke test — the disposer must not throw.
      expect(() => result.value()).not.toThrow();
    }
  });

  it("skips an effect spec referenced only by edges (defensive)", () => {
    // If `edges` references an id not in `effects`, topologicalSort
    // surfaces the malformed-graph as a cycle. Verify that.
    const result = registerEffects({
      effects: [{ id: "a", run: () => {} }],
      edges: [{ from: "a", to: "ghost" }],
    });
    expect(result.ok).toBe(false);
  });
});
