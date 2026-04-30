// zod 4 ships a flat module namespace (no `z` re-export object), so we
// pull the helpers in via `import * as z` and use the same `z.X` call
// shape the v3 / v4-mini docs use.
import * as z from "zod";

/**
 * SettingsSchema — runtime validator + type generator for the
 * plugin's persisted settings.
 *
 * Replaces the hand-written `interface AozoraSettings` (previously
 * declared in `src/settings.ts`) with a schema that runs at the
 * load-data boundary. The schema is the single source of truth:
 * the static `AozoraSettings` type is derived via
 * `z.infer<typeof SettingsSchema>`, the runtime validator is the
 * same constant, and `DEFAULT_SETTINGS` is type-checked against the
 * schema's shape at build time (so adding a field forces a
 * default-update).
 *
 * `parseStoredSettings` is the boundary entry: it accepts the raw
 * payload returned by `Plugin.loadData()` (which is `unknown` after
 * `@total-typescript/ts-reset` sharpens the stdlib) and returns a
 * fully-validated `AozoraSettings`. Forward-compatibility: a
 * partially-valid stored object falls through to a default-merged
 * result so a corrupt or upgraded data file doesn't lock the plugin
 * out of loading.
 */

const WritingModeSchema = z.enum(["horizontal", "vertical"]);
const EncodingSchema = z.enum(["utf8", "sjis"]);
const GaijiFallbackSchema = z.enum(["image", "description", "codepoint"]);

export const SettingsSchema = z.object({
  writingMode: WritingModeSchema,
  enableLivePreview: z.boolean(),
  defaultEncoding: EncodingSchema,
  gaijiFallback: GaijiFallbackSchema,
  detectAozoraTxt: z.boolean(),
  txtGlob: z.array(z.string()).readonly(),
});

export type WritingMode = z.infer<typeof WritingModeSchema>;
export type Encoding = z.infer<typeof EncodingSchema>;
export type GaijiFallback = z.infer<typeof GaijiFallbackSchema>;
export type AozoraSettings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: AozoraSettings = {
  writingMode: "horizontal",
  enableLivePreview: true,
  defaultEncoding: "utf8",
  gaijiFallback: "description",
  detectAozoraTxt: true,
  txtGlob: [],
};

/**
 * Validate stored data and return a complete `AozoraSettings`.
 *
 * Strategy:
 *   1. Try `SettingsSchema.safeParse(stored)`. On success, return
 *      the parsed value verbatim.
 *   2. On total failure, retry with a `partial()` schema and merge
 *      the surviving fields onto `DEFAULT_SETTINGS`. This keeps the
 *      plugin loadable across schema upgrades that drop or rename
 *      fields without forcing the user through a manual reset.
 *   3. If even the partial parse fails, return `DEFAULT_SETTINGS`
 *      unchanged.
 */
export function parseStoredSettings(stored: unknown): AozoraSettings {
  const full = SettingsSchema.safeParse(stored);
  if (full.success) {
    return full.data;
  }
  const partial = SettingsSchema.partial().safeParse(stored);
  if (partial.success) {
    // Per-field nullish coalesce: zod's `partial()` widens each
    // field to `T | undefined`, but `exactOptionalPropertyTypes`
    // forbids spreading `undefined` over a required slot, so we
    // narrow field-by-field. `??` keeps falsy-but-valid values
    // (`false`, `""`, `[]`) intact, restoring DEFAULT_SETTINGS only
    // when the field is genuinely absent.
    const p = partial.data;
    return {
      writingMode: p.writingMode ?? DEFAULT_SETTINGS.writingMode,
      enableLivePreview: p.enableLivePreview ?? DEFAULT_SETTINGS.enableLivePreview,
      defaultEncoding: p.defaultEncoding ?? DEFAULT_SETTINGS.defaultEncoding,
      gaijiFallback: p.gaijiFallback ?? DEFAULT_SETTINGS.gaijiFallback,
      detectAozoraTxt: p.detectAozoraTxt ?? DEFAULT_SETTINGS.detectAozoraTxt,
      txtGlob: p.txtGlob ?? DEFAULT_SETTINGS.txtGlob,
    };
  }
  return DEFAULT_SETTINGS;
}
