// Bench fixtures: synthetic + corpus-derived source bodies for the
// `bench/*.bench.ts` harnesses. Kept in `bench/` (not `tests/`) so
// the unit-test suite ignores them and so bench code paths are clear
// from production code paths.
//
// Synthetic sizes follow a logarithmic ladder (100B, 1KB, 10KB, 100KB,
// 1MB) so the published bench results communicate the asymptotic
// behaviour, not just one operating point. The 100 KB and 1 MB tiers
// are the realistic working set: a single Aozora-Bunko short story
// is ~30-100 KB UTF-8, a long-form novella is ~500 KB - 1 MB.

const RUBY = "｜青梅《おうめ》";
const BOUTEN_OPEN = "［＃「";
const BOUTEN_CLOSE = "」に傍点］";
const ANNOTATION = "［＃改ページ］";
const GAIJI = "※［＃「木＋吶のつくり」、第3水準1-85-54］";
const PLAIN = "あの頃の私は何を考えていたのだろう。";

/**
 * Synthesise a deterministic Aozora-shaped source of a target byte
 * length. Deterministic so bench-to-bench variance is purely
 * runtime-side (not input-side).
 *
 * The cycle interleaves all top-level node kinds the renderer
 * exercises (ruby, bouten with paired open/close, annotation, gaiji,
 * plain prose) so every bench input touches every render branch.
 */
export function syntheticSource(targetBytes: number): string {
  const cycle = [
    PLAIN,
    RUBY,
    PLAIN,
    `${BOUTEN_OPEN}秘密${BOUTEN_CLOSE}`,
    ANNOTATION,
    PLAIN,
    GAIJI,
    "\n",
  ];
  const cycleText = cycle.join("");
  const cycleBytes = Buffer.byteLength(cycleText, "utf8");
  const repeats = Math.max(1, Math.ceil(targetBytes / cycleBytes));
  const out = cycleText.repeat(repeats);
  return out.slice(0, targetBytes);
}

export const SOURCE_SIZE_LADDER: ReadonlyArray<{ label: string; bytes: number }> = [
  { label: "100B", bytes: 100 },
  { label: "1KB", bytes: 1_000 },
  { label: "10KB", bytes: 10_000 },
  { label: "100KB", bytes: 100_000 },
  { label: "1MB", bytes: 1_000_000 },
];
