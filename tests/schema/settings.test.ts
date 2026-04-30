import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type AozoraSettings,
  DEFAULT_SETTINGS,
  parseStoredSettings,
  SettingsSchema,
} from "../../src/schema/settings";

const writingModeArb = fc.constantFrom("horizontal", "vertical" as const);
const encodingArb = fc.constantFrom("utf8", "sjis" as const);
const gaijiFallbackArb = fc.constantFrom("image", "description", "codepoint" as const);

const settingsArb: fc.Arbitrary<AozoraSettings> = fc.record({
  writingMode: writingModeArb,
  enableLivePreview: fc.boolean(),
  defaultEncoding: encodingArb,
  gaijiFallback: gaijiFallbackArb,
  detectAozoraTxt: fc.boolean(),
  txtGlob: fc.array(fc.string()),
});

describe("SettingsSchema", () => {
  it("accepts every value the type system permits", () => {
    fc.assert(
      fc.property(settingsArb, (s) => {
        expect(SettingsSchema.safeParse(s).success).toBe(true);
      }),
    );
  });

  it("DEFAULT_SETTINGS itself parses cleanly", () => {
    expect(SettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
  });

  it("rejects values outside the enum sets", () => {
    const invalidExtension = { ...DEFAULT_SETTINGS, writingMode: "diagonal" };
    expect(SettingsSchema.safeParse(invalidExtension).success).toBe(false);
  });

  it("rejects wrong primitive types", () => {
    const mistyped = { ...DEFAULT_SETTINGS, enableLivePreview: "yes" };
    expect(SettingsSchema.safeParse(mistyped).success).toBe(false);
  });
});

describe("parseStoredSettings", () => {
  it("returns DEFAULT_SETTINGS when stored is null / undefined / non-object", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.string(),
          fc.integer(),
          fc.boolean(),
        ),
        (stored) => {
          expect(parseStoredSettings(stored)).toEqual(DEFAULT_SETTINGS);
        },
      ),
    );
  });

  it("round-trips a fully-valid stored payload", () => {
    fc.assert(
      fc.property(settingsArb, (s) => {
        expect(parseStoredSettings(s)).toEqual(s);
      }),
    );
  });

  it("merges partial-valid storage onto DEFAULT_SETTINGS for forward-compat", () => {
    // Only `writingMode` is present and valid; the rest of DEFAULT_SETTINGS fills in.
    const partial = { writingMode: "vertical" };
    expect(parseStoredSettings(partial)).toEqual({
      ...DEFAULT_SETTINGS,
      writingMode: "vertical",
    });
  });

  it("falls back to DEFAULT_SETTINGS when even the partial parse rejects", () => {
    // A non-object payload can't be partially-parsed as a record.
    expect(parseStoredSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it("ignores unknown extra fields without throwing", () => {
    const withExtras = { ...DEFAULT_SETTINGS, somethingExtraneous: 123 };
    const out = parseStoredSettings(withExtras);
    expect(out).toEqual(DEFAULT_SETTINGS);
  });

  it("survives every shuffled subset of valid fields", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.constantFrom(
            "writingMode",
            "enableLivePreview",
            "defaultEncoding",
            "gaijiFallback",
            "detectAozoraTxt",
            "txtGlob" as const,
          ),
        ),
        settingsArb,
        (keep, full) => {
          const subset: Record<string, unknown> = {};
          for (const k of keep) {
            subset[k] = full[k];
          }
          const parsed = parseStoredSettings(subset);
          // Each kept key matches the source; missing keys default.
          for (const k of keep) {
            expect(parsed[k]).toEqual(full[k]);
          }
          for (const k of [
            "writingMode",
            "enableLivePreview",
            "defaultEncoding",
            "gaijiFallback",
            "detectAozoraTxt",
            "txtGlob",
          ] as const) {
            if (!keep.includes(k)) {
              expect(parsed[k]).toEqual(DEFAULT_SETTINGS[k]);
            }
          }
        },
      ),
    );
  });
});
