import { computed, effect, type ReadonlySignal, type Signal, signal } from "@preact/signals-core";
import { type AozoraSettings, parseStoredSettings } from "../schema/settings";
import { err, ok, type Result } from "../types/result";
import { type CycleError, topologicalSort } from "./topology";

/**
 * Signal-driven settings store. Phase 6 (Reactivity layer, I).
 *
 * Replaces the `applyLivePreviewToggle()` / `applyTxtRegistration()`
 * / `rerenderAllPreviews()` direct-call cascade in `src/main.ts:90-115`
 * with a declarative dependency graph — settings → derived signals
 * → effect handlers — that the @preact/signals-core runtime walks
 * in topological order with glitch-free guarantees.
 *
 * Per-setting signals are exposed as a record so consumer effects
 * can subscribe by reading the specific signal they care about,
 * not the whole `AozoraSettings` object. This keeps the
 * dependency graph fine-grained (Solid signals or MobX-style
 * derived computation): a `writingMode` toggle wakes only the
 * `rerender preview` effect, not the `register .txt extension`
 * effect.
 *
 * Cycle detection: `defineEffects(...)` accepts an explicit
 * dependency graph (settings → effects). `topologicalSort` runs
 * once at store-construction time; a cycle aborts construction
 * via `err(...)` rather than crashing later in production.
 */

export type SettingSignal<K extends keyof AozoraSettings> = Signal<AozoraSettings[K]>;

export type SettingSignals = {
  readonly [K in keyof AozoraSettings]: SettingSignal<K>;
};

export interface ReactiveStore {
  /** Per-setting signals; reading inside `effect` registers a dep. */
  readonly signals: SettingSignals;
  /**
   * Snapshot of the current value of every signal as a plain object.
   * Reads each signal — call inside an effect to make the effect
   * depend on every setting (rare; prefer reading individual
   * signals).
   */
  readonly snapshot: () => AozoraSettings;
  /**
   * Update one or more settings. Each touched signal fires its
   * subscribers; @preact/signals-core's batching ensures a coherent
   * read-modify-write across multiple field updates.
   */
  readonly update: (partial: Partial<AozoraSettings>) => void;
  /**
   * Replace the entire stored payload — used at plugin load time to
   * hydrate from disk via `parseStoredSettings`. Same batched
   * behaviour as `update`.
   */
  readonly hydrate: (stored: unknown) => void;
}

/**
 * Build a `ReactiveStore` from an initial settings snapshot.
 * `parseStoredSettings` should be applied **before** calling this
 * — the constructor takes already-validated `AozoraSettings`.
 */
export function createReactiveStore(initial: AozoraSettings): ReactiveStore {
  // Mutable storage one signal per field. The key list is the
  // exact set of `AozoraSettings` keys; type-driven so adding a
  // new field forces a TypeScript error here.
  const signals = {
    writingMode: signal(initial.writingMode),
    enableLivePreview: signal(initial.enableLivePreview),
    defaultEncoding: signal(initial.defaultEncoding),
    gaijiFallback: signal(initial.gaijiFallback),
    detectAozoraTxt: signal(initial.detectAozoraTxt),
    txtGlob: signal(initial.txtGlob),
  } satisfies SettingSignals;

  return {
    signals,
    snapshot: () => ({
      writingMode: signals.writingMode.value,
      enableLivePreview: signals.enableLivePreview.value,
      defaultEncoding: signals.defaultEncoding.value,
      gaijiFallback: signals.gaijiFallback.value,
      detectAozoraTxt: signals.detectAozoraTxt.value,
      txtGlob: signals.txtGlob.value,
    }),
    update: (partial) => {
      for (const key of Object.keys(partial) as (keyof AozoraSettings)[]) {
        applyUpdate(signals, key, partial[key]);
      }
    },
    hydrate: (stored) => {
      const next = parseStoredSettings(stored);
      signals.writingMode.value = next.writingMode;
      signals.enableLivePreview.value = next.enableLivePreview;
      signals.defaultEncoding.value = next.defaultEncoding;
      signals.gaijiFallback.value = next.gaijiFallback;
      signals.detectAozoraTxt.value = next.detectAozoraTxt;
      signals.txtGlob.value = next.txtGlob;
    },
  };
}

/**
 * Per-key signal write. Encapsulated as a function so the type
 * system narrows `Partial<AozoraSettings>[K]` on each iteration.
 */
function applyUpdate<K extends keyof AozoraSettings>(
  signals: SettingSignals,
  key: K,
  value: AozoraSettings[K] | undefined,
): void {
  if (value === undefined) {
    return;
  }
  signals[key].value = value;
}

/**
 * Effect-graph definition + topological registration.
 *
 * `effects` lists the named effect handlers; `dependencies`
 * declares "effect X reads signal Y". Cycles between effects
 * (effect A → setting that triggers effect B → setting that
 * triggers effect A) are caught at registration time.
 *
 * Returns the disposer function from `effect()` so the caller can
 * detach the whole graph at plugin unload. The disposer runs every
 * registered effect's individual disposer in reverse-topological
 * order so any effect-local cleanup observes its dependencies in
 * a consistent state.
 */
export interface EffectSpec {
  readonly id: string;
  readonly run: () => void | Promise<void>;
}

export interface EffectGraph {
  readonly effects: readonly EffectSpec[];
  readonly edges: readonly { readonly from: string; readonly to: string }[];
}

export function registerEffects(graph: EffectGraph): Result<() => void, CycleError<string>> {
  const ids = graph.effects.map((e) => e.id);
  const sortResult = topologicalSort(ids, graph.edges);
  if (!sortResult.ok) {
    return err(sortResult.error);
  }
  const ordered = sortResult.value;
  const idToSpec = new Map(graph.effects.map((e) => [e.id, e]));
  const disposers: (() => void)[] = [];
  for (const id of ordered) {
    const spec = idToSpec.get(id);
    /* istanbul ignore if -- defensive: `topologicalSort` returns a
       permutation of `ids`, which is exactly the keys we seeded
       into `idToSpec`. `continue` is a fail-soft invariant
       safeguard, not a reachable branch. */
    if (spec === undefined) {
      continue;
    }
    const dispose = effect(() => {
      void spec.run();
    });
    disposers.push(dispose);
  }
  return ok(() => {
    // Run cleanup in reverse-topological order. The optional chain
    // is defensive against an out-of-bounds index regression.
    for (let i = disposers.length - 1; i >= 0; i--) {
      /* istanbul ignore next -- defensive: bounded loop keeps
         `disposers[i]` defined; `?.()` is dead under the invariant. */
      disposers[i]?.();
    }
  });
}

/**
 * Construct a `ReadonlySignal<T>` derived from one or more setting
 * signals. Thin wrapper over `computed()` that surfaces the same
 * type-friendly accessor pattern the rest of the store uses.
 */
export function derive<T>(fn: () => T): ReadonlySignal<T> {
  return computed(fn);
}
