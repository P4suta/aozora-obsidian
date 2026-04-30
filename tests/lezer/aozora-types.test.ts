import { describe, expect, it } from "vitest";
import type { AozoraNodeKind } from "../../src/wasm/node-schema";
import {
  AOZORA_NODE_KIND_ORDER,
  aozoraNodeSet,
  DOCUMENT_NODE_ID,
  nodeIdForKind,
} from "../../src/lezer/aozora-types";

describe("AOZORA_NODE_KIND_ORDER", () => {
  it("includes every documented AozoraNodeKind exactly once", () => {
    const set = new Set(AOZORA_NODE_KIND_ORDER);
    expect(set.size).toBe(AOZORA_NODE_KIND_ORDER.length);
    // Sanity check that the canonical 20 kinds are present.
    expect(AOZORA_NODE_KIND_ORDER).toContain("ruby");
    expect(AOZORA_NODE_KIND_ORDER).toContain("unknown");
    expect(AOZORA_NODE_KIND_ORDER).toContain("containerOpen");
    expect(AOZORA_NODE_KIND_ORDER).toContain("containerClose");
  });
});

describe("nodeIdForKind", () => {
  it("returns a unique id per known kind, all > DOCUMENT_NODE_ID", () => {
    const ids = AOZORA_NODE_KIND_ORDER.map((k) => nodeIdForKind(k));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toBeGreaterThan(DOCUMENT_NODE_ID);
    }
  });

  it("falls back to the unknown id when given an unrecognised kind", () => {
    // Cast through `unknown` to simulate forward-compat upstream
    // adding a kind the TS schema hasn't learned yet.
    const fakeKind = "novel-future-kind" as unknown as AozoraNodeKind;
    expect(nodeIdForKind(fakeKind)).toBe(nodeIdForKind("unknown"));
  });
});

describe("aozoraNodeSet", () => {
  it("registers a NodeType for every kind plus the Document top", () => {
    // 20 kinds + 1 Document = 21 NodeTypes total.
    const seen: number[] = [];
    aozoraNodeSet.types.forEach((nt) => seen.push(nt.id));
    expect(seen.length).toBe(AOZORA_NODE_KIND_ORDER.length + 1);
    expect(seen).toContain(DOCUMENT_NODE_ID);
  });

  it("names the Document top node 'Document'", () => {
    const top = aozoraNodeSet.types.find((nt) => nt.id === DOCUMENT_NODE_ID);
    expect(top?.name).toBe("Document");
    expect(top?.isTop).toBe(true);
  });

  it("names each kind in PascalCase", () => {
    const ruby = aozoraNodeSet.types.find((nt) => nt.id === nodeIdForKind("ruby"));
    expect(ruby?.name).toBe("Ruby");
    const tcy = aozoraNodeSet.types.find((nt) => nt.id === nodeIdForKind("tateChuYoko"));
    expect(tcy?.name).toBe("TateChuYoko");
  });

  it("groups inline kinds and block kinds via NodeProp", () => {
    const ruby = aozoraNodeSet.types.find((nt) => nt.id === nodeIdForKind("ruby"));
    const pageBreak = aozoraNodeSet.types.find((nt) => nt.id === nodeIdForKind("pageBreak"));
    const containerOpen = aozoraNodeSet.types.find(
      (nt) => nt.id === nodeIdForKind("containerOpen"),
    );
    expect(ruby?.is("Inline")).toBe(true);
    expect(pageBreak?.is("Block")).toBe(true);
    expect(containerOpen?.is("Block")).toBe(true);
    // Every Aozora node is in the Aozora group regardless of inline/block.
    expect(ruby?.is("Aozora")).toBe(true);
    expect(pageBreak?.is("Aozora")).toBe(true);
  });
});
