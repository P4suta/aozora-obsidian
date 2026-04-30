import { Tree } from "@lezer/common";
import type { AozoraNodeView } from "../wasm/node-schema";
import { aozoraNodeSet, DOCUMENT_NODE_ID, nodeIdForKind } from "./aozora-types";

/**
 * Build a Lezer `Tree` from a flat `AozoraNodeView[]` stream.
 *
 * Input contract (enforced upstream by zod, Phase 2):
 *   - `nodes` is sorted by `start` ascending.
 *   - Each `start` / `end` is a non-negative byte offset into
 *     `source`; `start <= end <= source.byteLength`.
 *   - Spans may overlap if upstream classifies a paired-container
 *     range that contains inline runs. The Lezer buffer assumes a
 *     non-overlapping flat sequence — if the upstream side ever
 *     emits overlaps, this builder collapses them by sorting on
 *     start and clamping end to the next start. We log nothing yet
 *     (Phase 7 Effect layer will turn this into a Result.err);
 *     for now, the contract is "pre-Phase-2 emitter doesn't overlap
 *     because BorrowedLexOutput.source_nodes is contiguous-tile by
 *     construction".
 *
 * Output: a Lezer `Tree` whose top node is `Document`, whose
 * children are one Lezer node per `AozoraNodeView`, all flat (no
 * nesting yet — Phase 5 will introduce nesting via container
 * pairing).
 *
 * Lezer's flat buffer encoding is `[typeID, start, end, size]` per
 * node, where `size` is the count of buffer entries this node spans
 * (4 for a leaf — itself only). See `@lezer/common` docs at
 * <https://lezer.codemirror.net/docs/ref/#common.Tree^build>.
 */
export function buildAozoraTree(source: string, nodes: readonly AozoraNodeView[]): Tree {
  const docLength = byteLengthUtf8(source);
  // Each node contributes 4 buffer entries: [type, start, end, size].
  // size = 4 for a flat leaf (self-only).
  const buffer = new Array<number>(nodes.length * 4);
  let cursor = 0;
  let prevEnd = 0;
  for (const node of nodes) {
    const start = clampStart(node.start, prevEnd, docLength);
    const end = clampEnd(node.end, start, docLength);
    buffer[cursor] = nodeIdForKind(node.kind);
    buffer[cursor + 1] = start;
    buffer[cursor + 2] = end;
    buffer[cursor + 3] = 4;
    cursor += 4;
    prevEnd = end;
  }
  return Tree.build({
    buffer: buffer.slice(0, cursor),
    nodeSet: aozoraNodeSet,
    topID: DOCUMENT_NODE_ID,
    length: docLength,
  });
}

/**
 * UTF-8 byte length of a JS string. The WASM side reports byte
 * offsets in UTF-8 bytes, so the Lezer Tree's `length` (and the
 * clamps below) operate in the same units. Avoids the
 * UTF-16-vs-UTF-8 mismatch that would otherwise miscount surrogates
 * in the Lezer's range.
 */
function byteLengthUtf8(s: string): number {
  return new TextEncoder().encode(s).byteLength;
}

function clampStart(candidate: number, prevEnd: number, docLength: number): number {
  if (candidate < prevEnd) {
    return prevEnd;
  }
  if (candidate > docLength) {
    return docLength;
  }
  return candidate;
}

function clampEnd(candidate: number, start: number, docLength: number): number {
  if (candidate < start) {
    return start;
  }
  if (candidate > docLength) {
    return docLength;
  }
  return candidate;
}
