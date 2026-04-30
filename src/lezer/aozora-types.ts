import { NodeProp, NodeSet, NodeType } from "@lezer/common";
import type { AozoraNodeKind } from "../wasm/node-schema";

/**
 * Aozora-notation node types for the Lezer tree.
 *
 * Each `AozoraNodeKind` from the WASM token stream (Phase 2) maps to
 * exactly one Lezer `NodeType`. Phase 5 will register these against
 * CodeMirror via `LanguageSupport`; the syntax-highlight `styleTags`
 * + fold / indent metadata that drives that integration ride on the
 * `NodeProp`s declared here.
 *
 * Layout:
 *   id 0 = `Document` (the top node)
 *   id 1.. = one slot per `AozoraNodeKind`, in the order of
 *            `AOZORA_NODE_KIND_ORDER`.
 *
 * Adding a new variant means: extend the upstream
 * `aozora_node_kind_str` mapper, extend `AozoraNodeKindSchema`,
 * append the kind to `AOZORA_NODE_KIND_ORDER`, and the Lezer
 * NodeType auto-allocates. The ordering matters because Lezer
 * indexes NodeTypes by numeric id; rearranging the array would
 * invalidate any cached tree built with the old order.
 */

/**
 * Canonical ordering of `AozoraNodeKind` values. Position in this
 * array becomes the Lezer NodeType id (offset by 1 — id 0 is the
 * top `Document` node).
 *
 * Append-only: do not insert in the middle, do not reorder. The
 * order is part of the wire format the Lezer Tree (and any future
 * cached on-disk Tree) depends on.
 */
export const AOZORA_NODE_KIND_ORDER: readonly AozoraNodeKind[] = [
  "ruby",
  "bouten",
  "tateChuYoko",
  "gaiji",
  "indent",
  "alignEnd",
  "warichu",
  "keigakomi",
  "pageBreak",
  "sectionBreak",
  "heading",
  "headingHint",
  "sashie",
  "kaeriten",
  "annotation",
  "doubleRuby",
  "container",
  "containerOpen",
  "containerClose",
  "unknown",
];

/** Numeric id of the top-level Document node. */
export const DOCUMENT_NODE_ID = 0;

/**
 * Convert a string-tagged `AozoraNodeKind` to its Lezer NodeType id.
 * Returns the `unknown` node id if the kind isn't in the canonical
 * order (defensive against forward-compat upstream additions).
 */
export function nodeIdForKind(kind: AozoraNodeKind): number {
  const index = AOZORA_NODE_KIND_ORDER.indexOf(kind);
  if (index === -1) {
    return AOZORA_NODE_KIND_ORDER.indexOf("unknown") + 1;
  }
  return index + 1;
}

/**
 * Lezer NodeSet for aozora trees. Built once at module load.
 *
 * `NodeProp.group` lets downstream consumers (Phase 5 LanguageSupport,
 * Phase 10 diagnostic decorator) bulk-query "give me every aozora
 * node" rather than enumerating each kind. The "Inline" / "Block"
 * sub-groups mirror the upstream `aozora_lex::NodeRef::Inline` vs
 * `BlockLeaf` / `BlockOpen` / `BlockClose` distinction.
 */
function buildNodeSet(): NodeSet {
  const types: NodeType[] = [
    NodeType.define({ id: DOCUMENT_NODE_ID, name: "Document", top: true }),
  ];
  AOZORA_NODE_KIND_ORDER.forEach((kind, index) => {
    // `NodeType.define` accepts either NodePropSource entries or
    // `[NodeProp<T>, T]` pairs in its `props` array. The pair form
    // attaches the value (here: a `readonly string[]` of group
    // labels) directly to this single NodeType — no per-name
    // record-form indirection needed since we know the binding at
    // construction time.
    const props: [NodeProp<readonly string[]>, readonly string[]][] = [
      [NodeProp.group, ["Aozora", kindGroup(kind)]],
    ];
    types.push(
      NodeType.define({
        id: index + 1,
        name: nodeNameForKind(kind),
        props,
      }),
    );
  });
  return new NodeSet(types);
}

/**
 * PascalCase name for the Lezer NodeType corresponding to a kind.
 * Used by `styleTags` matchers in Phase 5.
 */
function nodeNameForKind(kind: AozoraNodeKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

/**
 * Bucket an `AozoraNodeKind` into the Lezer node-prop group it
 * belongs to. Mirrors the upstream `NodeRef::Inline` vs
 * `BlockLeaf` / `BlockOpen` / `BlockClose` tagging.
 */
function kindGroup(kind: AozoraNodeKind): "Inline" | "Block" {
  switch (kind) {
    case "pageBreak":
    case "sectionBreak":
    case "heading":
    case "headingHint":
    case "sashie":
    case "indent":
    case "alignEnd":
    case "container":
    case "containerOpen":
    case "containerClose":
      return "Block";
    default:
      return "Inline";
  }
}

export const aozoraNodeSet: NodeSet = buildNodeSet();
