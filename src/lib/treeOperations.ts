import type { PositionedNode, TreeNode } from "../types";
import { matchBrackets } from "./bracketMatcher";
import { findTreeNode } from "./selection";
import { parse } from "./parser";

/**
 * Collect all sourceStart values in a positioned subtree.
 * Used to build an exclusion set when hit-testing drop targets
 * (dragging onto a descendant of the dragged node is invalid).
 */
export function getSubtreeSourceStarts(
    node: PositionedNode,
    result: Set<number> = new Set(),
): Set<number> {
    if (node.sourceStart != null) result.add(node.sourceStart);
    for (const child of node.children) {
        getSubtreeSourceStarts(child, result);
    }
    return result;
}

/**
 * Returns the bracket range [openPos, closePos+1) for a non-terminal node,
 * or the label range for a terminal node.
 */
function getNodeRange(
    bracketText: string,
    node: TreeNode,
    pairs: ReadonlyMap<number, number>,
): { start: number; end: number } | null {
    if (node.sourceStart == null || node.sourceEnd == null) return null;

    if (node.terminal) {
        return { start: node.sourceStart, end: node.sourceEnd };
    }

    let openPos = node.sourceStart - 1;
    while (openPos >= 0 && bracketText[openPos] !== "[") openPos--;
    if (openPos < 0) return null;

    const closePos = pairs.get(openPos);
    if (closePos == null) return null;

    return { start: openPos, end: closePos + 1 };
}

function findParent(root: TreeNode, sourceStart: number): TreeNode | null {
    for (const child of root.children) {
        if (child.sourceStart === sourceStart) return root;
        const found = findParent(child, sourceStart);
        if (found) return found;
    }
    return null;
}

/**
 * Given a set of selected nodes (by sourceStart), returns the sourceStart of
 * the single "highest" node — the one whose subtree contains all other selected nodes.
 * Returns null if no such unique ancestor exists (e.g., two unrelated nodes selected).
 */
export function findHighestSelectedNode(
    bracketText: string,
    selectedNodes: ReadonlySet<number>,
): number | null {
    if (selectedNodes.size === 0) return null;
    if (selectedNodes.size === 1) return [...selectedNodes][0];

    const { tree } = parse(bracketText);
    if (!tree) return null;

    const { pairs } = matchBrackets(bracketText);

    const ranges = new Map<number, { start: number; end: number }>();
    function collectRanges(node: TreeNode) {
        if (node.sourceStart != null && selectedNodes.has(node.sourceStart)) {
            const range = getNodeRange(bracketText, node, pairs);
            if (range) ranges.set(node.sourceStart, range);
        }
        for (const child of node.children) collectRanges(child);
    }
    collectRanges(tree);

    for (const [ss, range] of ranges) {
        const allInside = [...selectedNodes].every(
            (other) => other === ss || (other >= range.start && other < range.end),
        );
        if (allInside) return ss;
    }

    return null;
}

/**
 * Swap a node with its left or right sibling.
 * Returns the new bracket text and the moved node's new sourceStart,
 * or null if the swap is invalid (at edge, root node, etc.).
 */
export function swapSibling(
    bracketText: string,
    sourceStart: number,
    direction: "left" | "right",
): { text: string; newSourceStart: number } | null {
    const { tree } = parse(bracketText);
    if (!tree) return null;

    const { pairs } = matchBrackets(bracketText);

    const parent = findParent(tree, sourceStart);
    if (!parent) return null;

    const idx = parent.children.findIndex(
        (c) => c.sourceStart === sourceStart,
    );
    if (idx < 0) return null;

    const swapIdx = direction === "left" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= parent.children.length) return null;

    const nodeRange = getNodeRange(bracketText, parent.children[idx], pairs);
    const sibRange = getNodeRange(bracketText, parent.children[swapIdx], pairs);
    if (!nodeRange || !sibRange) return null;

    const [first, second] =
        nodeRange.start < sibRange.start
            ? [nodeRange, sibRange]
            : [sibRange, nodeRange];

    const firstText = bracketText.slice(first.start, first.end);
    const secondText = bracketText.slice(second.start, second.end);
    const between = bracketText.slice(first.end, second.start);

    const text =
        bracketText.slice(0, first.start) +
        secondText +
        between +
        firstText +
        bracketText.slice(second.end);

    const newSourceStart =
        direction === "left"
            ? sibRange.start + (sourceStart - nodeRange.start)
            : sibRange.end - nodeRange.end + sourceStart;

    return { text, newSourceStart };
}

/**
 * Move a subtree to become a child of a target node.
 * When `insertIndex` is omitted the node is appended as the last child.
 * When provided it is inserted before the child at that index.
 *
 * Returns the new bracket text, or null if the move is invalid.
 */
export function moveNodeUnder(
    bracketText: string,
    draggedSourceStart: number,
    targetSourceStart: number,
    insertIndex?: number,
): string | null {
    const { tree } = parse(bracketText);
    if (!tree) return null;

    const { pairs } = matchBrackets(bracketText);

    const draggedNode = findTreeNode(tree, draggedSourceStart);
    const targetNode = findTreeNode(tree, targetSourceStart);
    if (!draggedNode || !targetNode) return null;

    if (targetNode.terminal) return null;

    const dragRange = getNodeRange(bracketText, draggedNode, pairs);
    if (!dragRange) return null;

    let targetOpenPos = targetNode.sourceStart! - 1;
    while (targetOpenPos >= 0 && bracketText[targetOpenPos] !== "[")
        targetOpenPos--;
    if (targetOpenPos < 0) return null;
    const targetClosePos = pairs.get(targetOpenPos);
    if (targetClosePos == null) return null;

    // Can't drop onto self or a descendant
    if (targetOpenPos >= dragRange.start && targetClosePos < dragRange.end)
        return null;

    // Determine if the dragged node is already a direct child and at what index
    const dragChildIdx = targetNode.children.findIndex(
        (c) => c.sourceStart === draggedSourceStart,
    );
    const isDirectChild = dragChildIdx >= 0;

    if (insertIndex != null) {
        // Same-position no-op when reordering within the same parent
        if (
            isDirectChild &&
            (insertIndex === dragChildIdx ||
                insertIndex === dragChildIdx + 1)
        )
            return null;
    } else {
        // Without insertIndex, dropping onto current parent is a no-op
        if (isDirectChild) return null;
    }

    // Compute insertion position
    let insertPos: number;
    if (
        insertIndex != null &&
        insertIndex < targetNode.children.length
    ) {
        const childAtIdx = targetNode.children[insertIndex];
        const childRange = getNodeRange(bracketText, childAtIdx, pairs);
        if (!childRange) return null;
        insertPos = childRange.start;
    } else {
        insertPos = targetClosePos;
    }

    const extractedText = bracketText.slice(dragRange.start, dragRange.end);

    const charBeforeInsert = bracketText[insertPos - 1];
    const leadingSpace =
        charBeforeInsert != null &&
        charBeforeInsert !== " " &&
        charBeforeInsert !== "["
            ? " "
            : "";
    const charAtInsert = bracketText[insertPos];
    const trailingSpace =
        charAtInsert != null &&
        charAtInsert !== " " &&
        charAtInsert !== "]"
            ? " "
            : "";
    const insertText = leadingSpace + extractedText + trailingSpace;

    let result: string;

    if (dragRange.end <= insertPos) {
        const afterRemove =
            bracketText.slice(0, dragRange.start) +
            bracketText.slice(dragRange.end);
        const adj = insertPos - (dragRange.end - dragRange.start);
        result =
            afterRemove.slice(0, adj) + insertText + afterRemove.slice(adj);
    } else if (dragRange.start >= insertPos) {
        const afterInsert =
            bracketText.slice(0, insertPos) +
            insertText +
            bracketText.slice(insertPos);
        const adjStart = dragRange.start + insertText.length;
        const adjEnd = dragRange.end + insertText.length;
        result =
            afterInsert.slice(0, adjStart) + afterInsert.slice(adjEnd);
    } else {
        return null;
    }

    return result.replace(/ {2,}/g, " ");
}
