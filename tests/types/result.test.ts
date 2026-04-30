import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  andThen,
  err,
  fromThrowable,
  isErr,
  isOk,
  map,
  mapErr,
  ok,
  type Result,
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
});
