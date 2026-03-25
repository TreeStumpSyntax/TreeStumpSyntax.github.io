import type { PositionedNode, TreeNode } from "../types";
import { matchBrackets } from "./bracketMatcher";
import { parse } from "./parser";

export interface SelectionRange {
    start: number;
    end: number;
}

/**
 * For each selected node (by sourceStart), compute the full text range
 * encompassing the entire subtree (including brackets for non-terminal nodes).
 * Deduplicates overlapping ranges (parent selected alongside child).
 */
export function getSelectedRanges(
    bracketText: string,
    selectedNodes: ReadonlySet<number>,
): SelectionRange[] {
    if (selectedNodes.size === 0) return [];

    const { tree } = parse(bracketText);
    if (!tree) return [];

    const { pairs } = matchBrackets(bracketText);
    const ranges: SelectionRange[] = [];

    function visit(node: TreeNode) {
        if (
            node.sourceStart != null &&
            node.sourceEnd != null &&
            selectedNodes.has(node.sourceStart)
        ) {
            if (node.terminal) {
                ranges.push({ start: node.sourceStart, end: node.sourceEnd });
            } else {
                let openPos = node.sourceStart - 1;
                while (openPos >= 0 && bracketText[openPos] !== "[") openPos--;
                if (openPos >= 0) {
                    const closePos = pairs.get(openPos);
                    if (closePos != null) {
                        ranges.push({ start: openPos, end: closePos + 1 });
                    }
                }
            }
        }
        for (const child of node.children) {
            visit(child);
        }
    }

    visit(tree);

    ranges.sort((a, b) => a.start - b.start);

    const merged: SelectionRange[] = [];
    for (const r of ranges) {
        const last = merged[merged.length - 1];
        if (last && r.start >= last.start && r.end <= last.end) continue;
        merged.push(r);
    }

    return merged;
}

export function deleteRanges(text: string, ranges: SelectionRange[]): string {
    const sorted = [...ranges].sort((a, b) => b.start - a.start);
    let result = text;
    for (const { start, end } of sorted) {
        result = result.slice(0, start) + result.slice(end);
    }
    return result.replace(/ {2,}/g, " ");
}

export function getSelectedPositions(ranges: SelectionRange[]): Set<number> {
    const positions = new Set<number>();
    for (const { start, end } of ranges) {
        for (let i = start; i < end; i++) {
            positions.add(i);
        }
    }
    return positions;
}

export function findTreeNode(
    node: TreeNode,
    sourceStart: number,
): TreeNode | null {
    if (node.sourceStart === sourceStart) return node;
    for (const child of node.children) {
        const found = findTreeNode(child, sourceStart);
        if (found) return found;
    }
    return null;
}

export interface ContentRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

/**
 * Walk a positioned tree and return sourceStart values for every node
 * whose center falls inside the given content-space rectangle.
 * `offsetX`/`offsetY` translate node positions into content space
 * (typically the SVG padding + font offset applied by the `<g>` transform).
 */
export function computeNodesInRect(
    root: PositionedNode,
    rect: ContentRect,
    offsetX: number,
    offsetY: number,
): Set<number> {
    const selected = new Set<number>();

    function visit(node: PositionedNode) {
        if (node.sourceStart != null) {
            const cx = node.x + offsetX;
            const cy = node.y + offsetY;
            if (
                cx >= rect.left &&
                cx <= rect.right &&
                cy >= rect.top &&
                cy <= rect.bottom
            ) {
                selected.add(node.sourceStart);
            }
        }
        for (const child of node.children) {
            visit(child);
        }
    }

    visit(root);
    return selected;
}
