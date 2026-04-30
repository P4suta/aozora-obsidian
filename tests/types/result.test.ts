import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  all,
  andThen,
  err,
  fromThrowable,
  isErr,
  isOk,
  map,
  mapErr,
  ok,
  type Result,
  sequence,
  tap,
  tapErr,
  unwrapOr,
} from "../../src/types/result";

describe("Result", () => {
  it("ok constructs an OK variant; err constructs an ERR variant", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        const r = ok(n);
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(r.value).toBe(n);
        }
      }),
    );
    fc.assert(
      fc.property(fc.string(), (s) => {
        const r = err(s);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error).toBe(s);
        }
      }),
    );
  });

  it("isOk / isErr narrow correctly", () => {
    const a: Result<number, string> = ok(1);
    const b: Result<number, string> = err("boom");
    expect(isOk(a)).toBe(true);
    expect(isErr(a)).toBe(false);
    expect(isOk(b)).toBe(false);
    expect(isErr(b)).toBe(true);
  });

  describe("map", () => {
    it("applies the function to the OK value", () => {
      fc.assert(
        fc.property(fc.integer(), fc.func<[number], number>(fc.integer()), (n, f) => {
          expect(map(ok(n), f)).toEqual(ok(f(n)));
        }),
      );
    });

    it("is a no-op on ERR (functor identity on the error channel)", () => {
      fc.assert(
        fc.property(fc.string(), fc.func<[number], number>(fc.integer()), (e, f) => {
          const r: Result<number, string> = err(e);
          expect(map(r, f)).toEqual(r);
        }),
      );
    });
  });

  describe("mapErr", () => {
    it("applies the function to the ERR value", () => {
      fc.assert(
        fc.property(fc.string(), fc.func<[string], string>(fc.string()), (e, f) => {
          expect(mapErr(err(e), f)).toEqual(err(f(e)));
        }),
      );
    });

    it("is a no-op on OK", () => {
      fc.assert(
        fc.property(fc.integer(), fc.func<[string], string>(fc.string()), (n, f) => {
          const r: Result<number, string> = ok(n);
          expect(mapErr(r, f)).toEqual(r);
        }),
      );
    });
  });

  describe("andThen", () => {
    it("threads the OK value through; left identity (return >>= f === f x)", () => {
      fc.assert(
        fc.property(fc.integer(), (n) => {
          const f = (x: number): Result<string, never> => ok(String(x));
          expect(andThen(ok(n), f)).toEqual(f(n));
        }),
      );
    });

    it("right identity (m >>= return === m)", () => {
      fc.assert(
        fc.property(fc.integer(), (n) => {
          const r: Result<number, string> = ok(n);
          expect(andThen(r, ok)).toEqual(r);
        }),
      );
    });

    it("preserves errors", () => {
      fc.assert(
        fc.property(fc.string(), (e) => {
          const r: Result<number, string> = err(e);
          expect(andThen(r, (n) => ok(n + 1))).toEqual(r);
        }),
      );
    });
  });

  describe("unwrapOr", () => {
    it("returns the OK value when present", () => {
      fc.assert(
        fc.property(fc.integer(), fc.integer(), (n, fallback) => {
          expect(unwrapOr(ok(n), fallback)).toBe(n);
        }),
      );
    });

    it("returns the fallback on ERR", () => {
      fc.assert(
        fc.property(fc.string(), fc.integer(), (e, fallback) => {
          const r: Result<number, string> = err(e);
          expect(unwrapOr(r, fallback)).toBe(fallback);
        }),
      );
    });
  });

  describe("fromThrowable", () => {
    it("captures synchronous throws into the error channel", () => {
      fc.assert(
        fc.property(fc.string(), (msg) => {
          const r = fromThrowable<number, string>(
            () => {
              throw new Error(msg);
            },
            (raw) => (raw instanceof Error ? raw.message : "unknown"),
          );
          expect(r).toEqual(err(msg));
        }),
      );
    });

    it("returns the OK value when the callback succeeds", () => {
      fc.assert(
        fc.property(fc.integer(), (n) => {
          const r = fromThrowable<number, string>(
            () => n,
            () => "noop",
          );
          expect(r).toEqual(ok(n));
        }),
      );
    });
  });

  describe("all / sequence", () => {
    it("collects all OKs into a single OK of the array", () => {
      fc.assert(
        fc.property(fc.array(fc.integer()), (ns) => {
          const results: Result<number, string>[] = ns.map(ok);
          expect(all(results)).toEqual(ok(ns));
        }),
      );
    });

    it("short-circuits on the first ERR", () => {
      const results: Result<number, string>[] = [ok(1), err("boom"), ok(3)];
      expect(all(results)).toEqual(err("boom"));
    });

    it("returns ok([]) for the empty input", () => {
      expect(all([])).toEqual(ok([]));
    });

    it("sequence is an alias for all", () => {
      const results: Result<number, string>[] = [ok(1), ok(2)];
      expect(sequence(results)).toEqual(all(results));
    });
  });

  describe("tap / tapErr", () => {
    it("tap runs the side effect on OK and returns the original Result", () => {
      const seen: number[] = [];
      const r: Result<number, string> = ok(7);
      const out = tap(r, (n) => seen.push(n));
      expect(out).toBe(r);
      expect(seen).toEqual([7]);
    });

    it("tap is a no-op on ERR", () => {
      const seen: number[] = [];
      const r: Result<number, string> = err("boom");
      const out = tap(r, (n) => seen.push(n));
      expect(out).toBe(r);
      expect(seen).toEqual([]);
    });

    it("tapErr runs the side effect on ERR and returns the original Result", () => {
      const seen: string[] = [];
      const r: Result<number, string> = err("boom");
      const out = tapErr(r, (e) => seen.push(e));
      expect(out).toBe(r);
      expect(seen).toEqual(["boom"]);
    });

    it("tapErr is a no-op on OK", () => {
      const seen: string[] = [];
      const r: Result<number, string> = ok(7);
      const out = tapErr(r, (e) => seen.push(e));
      expect(out).toBe(r);
      expect(seen).toEqual([]);
    });
  });
});
