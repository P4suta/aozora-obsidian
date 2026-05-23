/**
 * Result<T, E> — tagged-union ADT for expected errors.
 *
 * Replaces the "throw and pray" pattern at boundary crossings
 * (WASM ↔ JS, JSON.parse, file I/O, settings load) with a value
 * the caller must explicitly destructure. The hand-rolled ADT
 * keeps bundle weight minimal; Phase 7 may promote to effect-ts
 * if the bench / readability gates documented in
 * `docs/architecture-refresh/01-data-structure-catalog.md` pass.
 *
 * The combinators below mirror the standard set (`map`, `mapErr`,
 * `andThen` / flatMap, `unwrapOr`, `isOk`, `isErr`). Variance is
 * intentional: `ok(value)` returns `Result<T, never>` and
 * `err(error)` returns `Result<never, E>`, so unioning with another
 * branch widens correctly.
 */

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is { readonly ok: true; readonly value: T } {
  return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is { readonly ok: false; readonly error: E } {
  return !r.ok;
}

export function map<T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r;
}

export function mapErr<T, E, F>(r: Result<T, E>, f: (e: E) => F): Result<T, F> {
  return r.ok ? r : err(f(r.error));
}

export function andThen<T, U, E>(r: Result<T, E>, f: (t: T) => Result<U, E>): Result<U, E> {
  return r.ok ? f(r.value) : r;
}

export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}

/**
 * Lift a synchronous, possibly-throwing callback into a Result,
 * normalising thrown values into the error channel via the supplied
 * `coerce` function. Used at the boundary against legacy throw-y
 * APIs (TextDecoder, JSON.parse pre-ts-reset, etc.); fresh code
 * should return Result directly rather than passing through here.
 */
export function fromThrowable<T, E>(fn: () => T, coerce: (raw: unknown) => E): Result<T, E> {
  try {
    return ok(fn());
  } catch (raw) {
    return err(coerce(raw));
  }
}

/**
 * Collect a homogeneous list of Results into a single Result of a
 * list. The first `Err` short-circuits — subsequent `Result`s are
 * not inspected. This is the standard `traverse` shape; alias as
 * `sequence` for callers used to that name.
 *
 * Phase 7 added in lieu of effect-ts's `Effect.all` (rejected, see
 * `docs/adr/0005-effect-layer-handrolled-result.md`).
 */
export function all<T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> {
  const collected: T[] = [];
  for (const r of results) {
    if (!r.ok) {
      return r;
    }
    collected.push(r.value);
  }
  return ok(collected);
}

/** Alias for `all` matching the traverse / sequence vocabulary. */
export function sequence<T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> {
  return all(results);
}

/**
 * Run a side-effect on the OK value without changing the Result.
 * Returns the original `r`. Useful for telemetry, logging, or
 * wiring incidental tasks (cache warming, metric tick) into a
 * Result chain without breaking the value flow.
 */
export function tap<T, E>(r: Result<T, E>, f: (value: T) => void): Result<T, E> {
  if (r.ok) {
    f(r.value);
  }
  return r;
}

/**
 * Symmetric `tap` on the ERR channel. The error is observed but the
 * Result is unchanged. Common use: log a structured warning when
 * the error path fires, while the caller still decides what to do
 * with the failure.
 */
export function tapErr<T, E>(r: Result<T, E>, f: (error: E) => void): Result<T, E> {
  if (!r.ok) {
    f(r.error);
  }
  return r;
}
