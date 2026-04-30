import { foldNodeProp, indentNodeProp } from "@codemirror/language";
import { describe, expect, it } from "vitest";
import {
  aozoraLanguage,
  aozoraLanguageFromNodes,
  aozoraNodeSetForTests,
  walkAozora,
} from "../../src/lezer/aozora-language";
import { buildAozoraTree } from "../../src/lezer/aozora-parser";
import { nodeIdForKind } from "../../src/lezer/aozora-types";
import type { AozoraNodeView } from "../../src/wasm/node-schema";

describe("aozoraLanguage", () => {
  it("returns a Language instance whose parser yields the supplied Tree", () => {
    const tree = buildAozoraTree("hello", []);
    const lang = aozoraLanguage(tree);
    expect(lang.name).toBe("aozora");
    // The fixed-tree parser hands back the same tree regardless of input.
    const parsed = lang.parser.parse("anything");
    expect(parsed.length).toBe(tree.length);
  });

  it("attaches a usable Extension via `language.extension`", () => {
    const tree = buildAozoraTree("hi", []);
    const lang = aozoraLanguage(tree);
    expect(lang.extension).toBeDefined();
  });

  it("configure() returns an equivalent fixed-tree parser", () => {
    const tree = buildAozoraTree("hi", []);
    const lang = aozoraLanguage(tree);
    const reconfigured = lang.parser.configure({});
    const reparsed = reconfigured.parse("anything");
    expect(reparsed.length).toBe(tree.length);
  });

  it("startParse exposes the advance/stoppedAt/parsedPos triple Lezer expects", () => {
    const tree = buildAozoraTree("hi", []);
    const lang = aozoraLanguage(tree);
    const partial = lang.parser.startParse("ignored");
    expect(partial.parsedPos).toBe(tree.length);
    expect(partial.stoppedAt).toBeNull();
    expect(partial.advance().length).toBe(tree.length);
  });

  it("hasWrappers() is false (Aozora's flat tree has no nested parsers)", () => {
    const tree = buildAozoraTree("hi", []);
    const lang = aozoraLanguage(tree);
    expect(lang.parser.hasWrappers()).toBe(false);
  });
});

describe("aozoraLanguageFromNodes", () => {
  it("returns the Tree, the Language, and a CodeMirror Extension together", () => {
    const nodes: readonly AozoraNodeView[] = [{ kind: "ruby", start: 0, end: 6 }];
    const out = aozoraLanguageFromNodes("source", nodes);
    expect(out.tree.topNode.firstChild?.type.id).toBe(nodeIdForKind("ruby"));
    expect(out.language.name).toBe("aozora");
    expect(out.extension).toBeDefined();
  });
});

describe("Aozora NodeSet metadata", () => {
  it("attaches foldNodeProp to Container and Heading", () => {
    const containerType = aozoraNodeSetForTests.types.find(
      (nt) => nt.id === nodeIdForKind("container"),
    );
    const headingType = aozoraNodeSetForTests.types.find(
      (nt) => nt.id === nodeIdForKind("heading"),
    );
    expect(containerType?.prop(foldNodeProp)).toBeDefined();
    expect(headingType?.prop(foldNodeProp)).toBeDefined();
  });

  it("attaches indentNodeProp to Container and Indent", () => {
    const containerType = aozoraNodeSetForTests.types.find(
      (nt) => nt.id === nodeIdForKind("container"),
    );
    const indentType = aozoraNodeSetForTests.types.find(
      (nt) => nt.id === nodeIdForKind("indent"),
    );
    expect(containerType?.prop(indentNodeProp)).toBeDefined();
    expect(indentType?.prop(indentNodeProp)).toBeDefined();
  });
});

describe("walkAozora", () => {
  it("yields each node in document order including the start node", () => {
    const nodes: readonly AozoraNodeView[] = [
      { kind: "ruby", start: 0, end: 5 },
      { kind: "bouten", start: 5, end: 10 },
    ];
    const tree = buildAozoraTree("0123456789", nodes);
    const ids = Array.from(walkAozora(tree.topNode), (n) => n.type.id);
    // Expected: [Document, Ruby, Bouten]
    expect(ids).toEqual([0, nodeIdForKind("ruby"), nodeIdForKind("bouten")]);
  });

  it("handles a leaf (no children)", () => {
    const tree = buildAozoraTree("plain", []);
    const ids = Array.from(walkAozora(tree.topNode), (n) => n.type.id);
    expect(ids).toEqual([0]);
  });
});
