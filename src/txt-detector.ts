import { minimatch } from "minimatch";
import type { TFile, Vault } from "obsidian";
import { decodeAozoraBytes } from "./encoding";
import type { Encoding } from "./settings";

const TEIHON_MARKER = "底本：";
const SNIFF_BYTE_LIMIT = 4096;

export type TxtDetectionReason = "header-marker" | "glob-match" | "no-match";

export interface TxtDetectionResult {
  readonly isAozora: boolean;
  readonly reason: TxtDetectionReason;
}

export interface TxtDetectorDeps {
  readonly vault: Vault;
  readonly defaultEncoding: Encoding;
}

/**
 * Decide whether a `.txt` file should be treated as Aozora-format.
 *
 * Two evidence channels in order of cost:
 *   1. `txtGlob` patterns (e.g. `小説/** / *.txt`) — cheap, no I/O.
 *   2. Header sniff: read the first 4 KiB and look for `底本：`,
 *      the canonical marker that every Aozora-Bunko transcription
 *      carries in its bibliographic footer (which lives near the
 *      start of the file because the Aozora pipeline emits the
 *      bibliographic header above the body).
 *
 * Bytes are read via `vault.adapter.readBinary` so SJIS-encoded
 * files (legacy Aozora) also decode correctly via
 * `decodeAozoraBytes`. We sniff only the head; full-file decode
 * happens later in the Markdown post-processor / encoding layer.
 */
export async function detectAozoraTxt(
  file: TFile,
  globs: readonly string[],
  deps: TxtDetectorDeps,
): Promise<TxtDetectionResult> {
  if (globs.some((glob) => minimatch(file.path, glob))) {
    return { isAozora: true, reason: "glob-match" };
  }
  const adapter = deps.vault.adapter;
  const arrayBuffer = await adapter.readBinary(file.path);
  const sliceLen = Math.min(SNIFF_BYTE_LIMIT, arrayBuffer.byteLength);
  const head = new Uint8Array(arrayBuffer, 0, sliceLen);
  const decoded = decodeAozoraBytes(head, deps.defaultEncoding);
  if (decoded.text.includes(TEIHON_MARKER)) {
    return { isAozora: true, reason: "header-marker" };
  }
  return { isAozora: false, reason: "no-match" };
}
