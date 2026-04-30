/**
 * Japanese typography helpers — Phase 13 (N layer) of the
 * Architectural Refresh round.
 *
 * Two responsibilities:
 *
 * 1. **約物半角化 (punctuation half-width)** — when a Japanese
 *    full-width punctuation character (`、` `。` `「` `」` `（` `）`)
 *    sits next to ascii / latin characters, browsers render the
 *    full-width spacing the punctuation reserves around itself,
 *    creating awkward gaps. The traditional TeX-Plain Japanese
 *    typesetting fix is to halve the punctuation's logical width
 *    where it abuts a non-CJK character. Modern CSS exposes this
 *    via `text-spacing-trim` (W3C, 2025-2026 evergreen), but
 *    `text-spacing-trim` only acts at glyph-rendering time. For
 *    pre-rendered HTML or for fallback browsers, this module
 *    exposes a JS-side normaliser that callers can opt into.
 *
 * 2. **行頭禁則 detection** — a small predicate that classifies
 *    individual characters into the "may-not-start-a-line" set
 *    Japanese typesetting forbids (closing brackets, sentence-end
 *    punctuation). Used by Phase 5's `LanguageSupport` later to
 *    influence soft-wrap candidates.
 *
 * Both functions are pure, idempotent, and do not own any DOM.
 * The integration with rendered output is Phase 5 / styles.css.
 */

/**
 * The set of Japanese punctuation characters traditional TeX
 * 約物半角化 considers candidates for half-width treatment.
 *
 * Limited to the punctuation forms that have an ascii equivalent
 * in the Aozora text domain (transcribers occasionally insert
 * ascii `,` instead of `、` etc.); the half-width form mirrors
 * the ascii spacing the TeX rule emulates.
 */
const PUNCTUATION_TO_HALF_WIDTH: ReadonlyMap<string, string> = new Map([
  // sentence punctuation
  ["、", ", "],
  ["。", ". "],
  // brackets
  ["（", " ("],
  ["）", ") "],
  ["「", " ‘"],
  ["」", "’ "],
  ["『", " “"],
  ["』", "” "],
]);

/**
 * Punctuation that may NOT start a typeset line. The standard JIS
 * 行頭禁則 set, restricted to the characters Aozora actually emits.
 */
const FORBIDDEN_LINE_START: ReadonlySet<string> = new Set([
  "、",
  "。",
  "」",
  "』",
  "）",
  "！",
  "？",
  "・",
  "：",
  "；",
  ")",
  "]",
  ",",
  ".",
]);

/**
 * Apply 約物半角化 — replace full-width Japanese punctuation with
 * its half-width equivalent **only** where the punctuation abuts
 * an ascii / latin character. Pure: same input → same output, no
 * side effects, idempotent (running it twice yields the same
 * result as running it once because half-width punctuation is
 * already ascii and not in the swap table).
 */
export function applyHalfWidthPunctuation(input: string): string {
  if (input.length === 0) {
    return input;
  }
  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i] ?? "";
    const replacement = PUNCTUATION_TO_HALF_WIDTH.get(ch);
    if (replacement === undefined) {
      out += ch;
      continue;
    }
    const before = input[i - 1] ?? "";
    const after = input[i + 1] ?? "";
    if (isAscii(before) || isAscii(after)) {
      out += replacement;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * True if `ch` is one of the JIS 行頭禁則 characters Aozora
 * may emit — that is, callers laying out text should not start
 * a new line with this character.
 *
 * Returns `false` for the empty string and for any character not
 * in the forbidden set. Multibyte characters are matched by
 * exact codepoint (single-character strings); pass each character
 * individually rather than a full string.
 */
export function isLineStartForbidden(ch: string): boolean {
  return FORBIDDEN_LINE_START.has(ch);
}

function isAscii(ch: string): boolean {
  if (ch.length === 0) {
    return false;
  }
  const code = ch.charCodeAt(0);
  // Treat ascii printable + space as "latin context" for the
  // 約物半角化 trigger. Anything ≥ 0x80 is non-latin and leaves
  // the punctuation full-width.
  return code >= 0x20 && code < 0x80;
}
