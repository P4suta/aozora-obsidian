#!/usr/bin/env node
// Compare bench/last-run.json (latest `vitest bench` output) against
// bench/baseline.json (canonical baseline committed to git).
//
// Surfaces any benchmark whose median time-per-op delta against
// baseline is >= ±5%. Output is GitHub-flavored markdown so the same
// script can be reused for PR comments via `gh pr comment` (future
// roadmap item).
//
// Read-only: never writes to baseline.json. Baseline updates follow
// the protocol in bench/README.md (3 conditions, ADR required).
//
// Exit codes:
//   0 — comparison succeeded (regardless of regression direction)
//   1 — last-run.json missing (run `just bench` first)
//   2 — baseline.json missing or malformed

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LAST_RUN_PATH = resolve(PROJECT_ROOT, "bench", "last-run.json");
const BASELINE_PATH = resolve(PROJECT_ROOT, "bench", "baseline.json");
const REGRESSION_THRESHOLD = 0.05;

if (!existsSync(LAST_RUN_PATH)) {
  console.error(`bench-compare: ${LAST_RUN_PATH} missing — run \`just bench\` first.`);
  process.exit(1);
}

const lastRun = JSON.parse(readFileSync(LAST_RUN_PATH, "utf8"));
const baseline = readBaseline();

const lastByName = flattenBenches(lastRun);
const baselineByName = baseline.results
  ? Object.fromEntries(baseline.results.map((entry) => [entry.name, entry]))
  : {};

const lines = ["# Bench compare", ""];
const baselineCount = Object.keys(baselineByName).length;

if (baselineCount === 0) {
  lines.push(
    "_No baseline yet — current run will be reported but no diffs are computed._",
    "",
    "| Bench | mean (ns/op) | hz |",
    "|---|---:|---:|",
  );
  for (const [name, entry] of Object.entries(lastByName)) {
    lines.push(`| ${name} | ${formatMean(entry.mean)} | ${formatHz(entry.hz)} |`);
  }
  console.log(lines.join("\n"));
  process.exit(0);
}

lines.push(
  "| Bench | baseline (ns/op) | now (ns/op) | Δ | hz now | status |",
  "|---|---:|---:|---:|---:|:---:|",
);

let regressions = 0;
let improvements = 0;
let neutral = 0;

for (const [name, entry] of Object.entries(lastByName)) {
  const base = baselineByName[name];
  if (base === undefined) {
    lines.push(
      `| ${name} | _new_ | ${formatMean(entry.mean)} | — | ${formatHz(entry.hz)} | 🆕 |`,
    );
    continue;
  }
  const delta = (entry.mean - base.mean) / base.mean;
  let status = "·";
  if (delta >= REGRESSION_THRESHOLD) {
    status = "🔴 regress";
    regressions += 1;
  } else if (delta <= -REGRESSION_THRESHOLD) {
    status = "🟢 improve";
    improvements += 1;
  } else {
    neutral += 1;
  }
  lines.push(
    `| ${name} | ${formatMean(base.mean)} | ${formatMean(entry.mean)} | ${formatPct(delta)} | ${formatHz(entry.hz)} | ${status} |`,
  );
}

const removed = Object.keys(baselineByName).filter((n) => !(n in lastByName));
for (const name of removed) {
  lines.push(`| ${name} | ${formatMean(baselineByName[name].mean)} | _missing_ | — | — | ⚠️ removed |`);
}

lines.push(
  "",
  `**Summary**: ${improvements} improved, ${regressions} regressed, ${neutral} within ±5%, ${removed.length} removed.`,
);

console.log(lines.join("\n"));

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`bench-compare: ${BASELINE_PATH} missing.`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch (err) {
    console.error(`bench-compare: baseline.json malformed — ${err.message}`);
    process.exit(2);
  }
}

/**
 * Flatten the vitest bench JSON into a `{ name → { mean, hz } }` map.
 * vitest bench output shape (v4):
 *   { files: [{ groups: [{ benchmarks: [{ name, mean, hz, ... }] }] }] }
 * The `name` we use for matching is `<group>/<benchmark>` so the same
 * benchmark name in two groups is disambiguated.
 */
function flattenBenches(report) {
  const out = {};
  for (const file of report.files ?? []) {
    for (const group of file.groups ?? []) {
      for (const bench of group.benchmarks ?? []) {
        const key = `${group.fullName ?? group.name ?? "anon"}/${bench.name}`;
        out[key] = { mean: bench.mean ?? bench.result?.mean, hz: bench.hz ?? bench.result?.hz };
      }
    }
  }
  return out;
}

function formatMean(ns) {
  if (ns === undefined || ns === null) return "—";
  if (ns >= 1_000_000) return `${(ns / 1_000_000).toFixed(2)}ms`;
  if (ns >= 1_000) return `${(ns / 1_000).toFixed(2)}µs`;
  return `${ns.toFixed(0)}ns`;
}

function formatHz(hz) {
  if (hz === undefined || hz === null) return "—";
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(2)}M`;
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(2)}k`;
  return hz.toFixed(0);
}

function formatPct(delta) {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${(delta * 100).toFixed(1)}%`;
}
