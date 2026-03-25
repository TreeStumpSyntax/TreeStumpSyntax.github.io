import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchBrackets } from "../lib/bracketMatcher";
import { handleBracketKey } from "../lib/bracketPairing";
import { layoutTree } from "../lib/layout";
import { parse } from "../lib/parser";
import { deleteRanges, getSelectedRanges } from "../lib/selection";
import { useProjectStore, type TextEditType } from "../stores/projectStore";
import { getSubtreeSourceStarts } from "../lib/treeOperations";
import type { PositionedNode, Settings } from "../types";
import { FONT_SIZE, STROKE_WIDTH } from "../types";

interface EditingState {
    prefix: string;
    suffix: string;
    x: number;
    y: number;
    label: string;
    color: string;
    fontWeight: number;
}

let _measureCtx: CanvasRenderingContext2D | null = null;

function measureTextWidth(text: string, fontFamily: string): number {
    if (!_measureCtx) {
        const canvas = document.createElement("canvas");
        _measureCtx = canvas.getContext("2d");
    }
    if (!_measureCtx) return text.length * FONT_SIZE * 0.5;
    _measureCtx.font = `${FONT_SIZE}px ${fontFamily}, sans-serif`;
    return _measureCtx.measureText(text).width;
}

const BLACK = "#1a1a1a";
const SELECT_FILL = "#B4D5FE";
const SELECT_STROKE = "#8ABDF5";

const BRACKET_COLORS = [
    "#3b6cf3",
    "#e5623a",
    "#1a9e5c",
    "#b547c1",
    "#d4a017",
    "#0ea5c9",
    "#e34080",
    "#6d5ede",
];
const ERROR_COLOR = "#e53e3e";
const EDIT_BRACKETS = new Set(["[", "]", "(", ")"]);

function getNodeColor(isLeaf: boolean, settings: Settings): string {
    if (!settings.coloring) return BLACK;
    return isLeaf ? settings.leafColor : settings.nodeColor;
}

function selectionRect(
    key: string,
    x: number,
    y: number,
    label: string,
    fontFamily: string,
): React.ReactNode {
    const w = measureTextWidth(label, fontFamily);
    return (
        <rect
            key={key}
            x={x - w / 2 - 4}
            y={y - FONT_SIZE * 0.55}
            width={w + 8}
            height={FONT_SIZE * 1.1}
            fill={SELECT_FILL}
            stroke={SELECT_STROKE}
            strokeWidth={1.5}
            rx={4}
        />
    );
}

function renderNode(
    node: PositionedNode,
    settings: Settings,
    path: string,
    onNodeClick?: (
        node: PositionedNode,
        color: string,
        fontWeight: number,
        modKey: boolean,
    ) => void,
    onNodeDragStart?: (
        node: PositionedNode,
        e: React.PointerEvent,
    ) => void,
    editingSourceStart?: number,
    selectedNodes?: ReadonlySet<number>,
): React.ReactNode[] {
    const elements: React.ReactNode[] = [];
    const isLeaf = !!node.terminal;
    const color = getNodeColor(isLeaf, settings);
    const hasSource = node.sourceStart != null && node.sourceEnd != null;
    const isBeingEdited = hasSource && node.sourceStart === editingSourceStart;
    const isSelected =
        hasSource && selectedNodes?.has(node.sourceStart!) === true;
    const weight = 500;

    const displayLabel =
        node.subscript != null
            ? `${node.label}${subscriptStr(node.subscript)}`
            : node.label;

    if (isSelected) {
        elements.push(
            selectionRect(
                `sel-${path}`,
                node.x,
                node.y,
                displayLabel,
                settings.fontFamily,
            ),
        );
    }

    elements.push(
        <text
            key={`t-${path}`}
            x={node.x}
            y={node.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill={color}
            fontFamily={settings.fontFamily}
            fontSize={FONT_SIZE}
            fontWeight={weight}
            style={{
                cursor: hasSource ? "pointer" : undefined,
                opacity: isBeingEdited ? 0 : undefined,
            }}
            onPointerDown={
                hasSource
                    ? (e) => {
                          e.stopPropagation();
                          if (!(e.metaKey || e.ctrlKey))
                              onNodeDragStart?.(node, e);
                      }
                    : undefined
            }
            onClick={
                hasSource
                    ? (e) => onNodeClick?.(node, color, weight, e.metaKey || e.ctrlKey)
                    : undefined
            }
        >
            {displayLabel}
        </text>,
    );

    if (node.triangle && node.children.length === 1) {
        const child = node.children[0];
        const childHasSource =
            child.sourceStart != null && child.sourceEnd != null;
        const childColor = getNodeColor(true, settings);
        const childIsBeingEdited =
            childHasSource && child.sourceStart === editingSourceStart;
        const childIsSelected =
            childHasSource && selectedNodes?.has(child.sourceStart!) === true;
        const textWidth =
            measureTextWidth(child.label, settings.fontFamily) - 2;
        const halfW = Math.max(0, textWidth / 2);
        const topY = node.y + FONT_SIZE * 0.6;
        const bottomY = child.y - FONT_SIZE * 0.75;

        elements.push(
            <path
                key={`p-${path}`}
                d={`M${node.x},${topY}L${child.x - halfW},${bottomY}L${child.x + halfW},${bottomY}Z`}
                fill="none"
                stroke={BLACK}
                strokeWidth={STROKE_WIDTH}
            />,
        );

        if (childIsSelected) {
            elements.push(
                selectionRect(
                    `sel-${path}-0`,
                    child.x,
                    child.y,
                    child.label,
                    settings.fontFamily,
                ),
            );
        }

        elements.push(
            <text
                key={`t-${path}-0`}
                x={child.x}
                y={child.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={childColor}
                fontFamily={settings.fontFamily}
                fontSize={FONT_SIZE}
                fontWeight={weight}
                style={{
                    cursor: childHasSource ? "pointer" : undefined,
                    opacity: childIsBeingEdited ? 0 : undefined,
                }}
                onPointerDown={
                    childHasSource
                        ? (e) => {
                              e.stopPropagation();
                              if (!(e.metaKey || e.ctrlKey))
                                  onNodeDragStart?.(child, e);
                          }
                        : undefined
                }
                onClick={
                    childHasSource
                        ? (e) =>
                              onNodeClick?.(
                                  child,
                                  childColor,
                                  weight,
                                  e.metaKey || e.ctrlKey,
                              )
                        : undefined
                }
            >
                {child.label}
            </text>,
        );
    } else {
        const topY = node.y + FONT_SIZE * 0.6;
        const drawableEdges: { x: number; bottomY: number }[] = [];
        const childEntries: { child: PositionedNode; childPath: string }[] = [];

        for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i];
            const childPath = `${path}-${i}`;
            const isTerminalLeaf =
                child.children.length === 0 &&
                child.terminal &&
                !child.triangle;

            childEntries.push({ child, childPath });

            if (!isTerminalLeaf || settings.terminalLines) {
                drawableEdges.push({
                    x: child.x,
                    bottomY: child.y - FONT_SIZE * 0.7,
                });
            }
        }

        if (drawableEdges.length > 0) {
            let d = `M${drawableEdges[0].x},${drawableEdges[0].bottomY}L${node.x},${topY}`;
            for (let i = 1; i < drawableEdges.length; i++) {
                const edge = drawableEdges[i];
                if (i === 1) {
                    d += `L${edge.x},${edge.bottomY}`;
                } else {
                    d += `M${node.x},${topY}L${edge.x},${edge.bottomY}`;
                }
            }

            elements.push(
                <path
                    key={`p-${path}`}
                    d={d}
                    fill="none"
                    stroke={BLACK}
                    strokeWidth={STROKE_WIDTH}
                />,
            );
        }

        for (const { child, childPath } of childEntries) {
            elements.push(
                ...renderNode(
                    child,
                    settings,
                    childPath,
                    onNodeClick,
                    onNodeDragStart,
                    editingSourceStart,
                    selectedNodes,
                ),
            );
        }
    }

    return elements;
}

function subscriptStr(n: number): string {
    const subs = "₀₁₂₃₄₅₆₇₈₉";
    return String(n)
        .split("")
        .map((d) => subs[parseInt(d)] || d)
        .join("");
}

function findNodeBySourceStart(
    node: PositionedNode,
    sourceStart: number,
): PositionedNode | null {
    if (node.sourceStart === sourceStart) return node;
    for (const child of node.children) {
        const found = findNodeBySourceStart(child, sourceStart);
        if (found) return found;
    }
    return null;
}

const DRAG_THRESHOLD = 4;

type DropTarget =
    | { type: "onto"; sourceStart: number }
    | {
          type: "between";
          parentSourceStart: number;
          index: number;
          x: number;
          y: number;
      };

function findDropTarget(
    root: PositionedNode,
    px: number,
    py: number,
    fontFamily: string,
    excludeSet: Set<number>,
    dragIsTerminal: boolean,
): PositionedNode | null {
    let closest: PositionedNode | null = null;
    let closestDist = Infinity;

    function visit(node: PositionedNode) {
        if (node.sourceStart == null || node.terminal) return;
        if (excludeSet.has(node.sourceStart)) return;

        const hasTerminalChild = node.children.some((c) => c.terminal);
        const okForOnto = dragIsTerminal
            ? node.children.length === 0
            : !hasTerminalChild;

        if (okForOnto) {
            const labelWidth = measureTextWidth(node.label, fontFamily);
            const halfW = labelWidth / 2 + 8;
            const halfH = FONT_SIZE * 0.7;

            if (
                px >= node.x - halfW &&
                px <= node.x + halfW &&
                py >= node.y - halfH &&
                py <= node.y + halfH
            ) {
                const dist = Math.abs(px - node.x) + Math.abs(py - node.y);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = node;
                }
            }
        }

        for (const child of node.children) visit(child);
    }

    visit(root);
    return closest;
}

interface InsertionPoint {
    parentSourceStart: number;
    index: number;
    x: number;
    y: number;
}

/**
 * Walk the positioned tree looking for gaps between sibling nodes where
 * the cursor could drop. Returns the best insertion point or null.
 */
function findInsertionPoint(
    root: PositionedNode,
    px: number,
    py: number,
    fontFamily: string,
    excludeSet: Set<number>,
    lineHeight: number,
    draggedSourceStart: number,
    dragIsTerminal: boolean,
): InsertionPoint | null {
    let best: InsertionPoint | null = null;
    let bestDist = Infinity;

    function visit(node: PositionedNode) {
        if (node.sourceStart == null || node.terminal) return;
        if (excludeSet.has(node.sourceStart)) return;

        const children = node.children;
        if (children.length === 0) return;
        const hasTerminalChild = children.some((c) => c.terminal);
        if (hasTerminalChild !== dragIsTerminal) {
            for (const c of children) visit(c);
            return;
        }

        // Use first child's Y as the row level
        const rowY = children[0].y;
        if (Math.abs(py - rowY) > FONT_SIZE * 1.2) {
            for (const c of children) visit(c);
            return;
        }

        const dragIdx = children.findIndex(
            (c) => c.sourceStart === draggedSourceStart,
        );

        if (dragIsTerminal) {
            // Terminal drags: check terminal children's label areas only
            for (let j = 0; j < children.length; j++) {
                const child = children[j];
                if (!child.terminal) continue;
                if (child.sourceStart === draggedSourceStart) continue;

                const labelW = measureTextWidth(child.label, fontFamily);
                const halfW = labelW / 2 + 4;
                const halfH = FONT_SIZE * 0.7;

                if (
                    px >= child.x - halfW &&
                    px <= child.x + halfW &&
                    py >= child.y - halfH &&
                    py <= child.y + halfH
                ) {
                    const insertBefore = px < child.x;
                    const idx = insertBefore ? j : j + 1;
                    if (
                        dragIdx >= 0 &&
                        (idx === dragIdx || idx === dragIdx + 1)
                    )
                        continue;
                    const indicatorX = insertBefore
                        ? child.x - halfW
                        : child.x + halfW;
                    const dist =
                        Math.abs(px - indicatorX) + Math.abs(py - rowY);
                    if (dist < bestDist) {
                        bestDist = dist;
                        best = {
                            parentSourceStart: node.sourceStart,
                            index: idx,
                            x: indicatorX,
                            y: rowY,
                        };
                    }
                }
            }
        } else {
            // Non-terminal drags: check gaps between children
            for (let i = 0; i <= children.length; i++) {
                if (dragIdx >= 0 && (i === dragIdx || i === dragIdx + 1))
                    continue;

                let gapX: number;
                if (i === 0) {
                    const firstW =
                        measureTextWidth(children[0].label, fontFamily) / 2 +
                        12;
                    gapX = children[0].x - firstW;
                } else if (i === children.length) {
                    const lastChild = children[children.length - 1];
                    const lastW =
                        measureTextWidth(lastChild.label, fontFamily) / 2 + 12;
                    gapX = lastChild.x + lastW;
                } else {
                    const leftChild = children[i - 1];
                    const rightChild = children[i];
                    gapX = (leftChild.x + rightChild.x) / 2;
                }

                const dx = Math.abs(px - gapX);
                const dy = Math.abs(py - rowY);
                const dist = dx + dy;

                if (dx < lineHeight && dist < bestDist) {
                    bestDist = dist;
                    best = {
                        parentSourceStart: node.sourceStart,
                        index: i,
                        x: gapX,
                        y: rowY,
                    };
                }
            }
        }

        for (const c of children) visit(c);
    }

    visit(root);
    return best;
}

export default function TreeView() {
    const bracketText = useProjectStore((s) => s.bracketText);
    const settings = useProjectStore((s) => s.settings);
    const setBracketText = useProjectStore((s) => s.setBracketText);
    const cursorPos = useProjectStore((s) => s.cursorPos);
    const setCursorPos = useProjectStore((s) => s.setCursorPos);
    const selectedNodes = useProjectStore((s) => s.selectedNodes);
    const toggleNodeSelection = useProjectStore((s) => s.toggleNodeSelection);
    const clearSelection = useProjectStore((s) => s.clearSelection);

    const [editing, setEditing] = useState<EditingState | null>(null);
    const [editValue, setEditValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );
    const autoPairPos = useRef<number | null>(null);
    const selfEditRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const dragRef = useRef<{
        sourceStart: number;
        label: string;
        startClientX: number;
        startClientY: number;
        isDragging: boolean;
        isTerminal: boolean;
    } | null>(null);
    const dragSkipClick = useRef(false);
    const dropTargetRef = useRef<DropTarget | null>(null);

    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
    const [ghostPos, setGhostPos] = useState<{
        x: number;
        y: number;
    } | null>(null);

    useEffect(() => () => clearTimeout(debounceRef.current), []);

    useEffect(() => {
        if (!editing) return;
        if (selfEditRef.current) {
            selfEditRef.current = false;
            return;
        }
        clearTimeout(debounceRef.current);
        setEditing(null);
        setCursorPos(null);
    }, [bracketText]); // eslint-disable-line react-hooks/exhaustive-deps

    const layout = useMemo(() => {
        const { tree } = parse(bracketText);
        if (!tree) return null;
        return layoutTree(tree, settings);
    }, [bracketText, settings]);

    const layoutRef = useRef(layout);
    layoutRef.current = layout;

    useEffect(() => {
        const toNodeCoords = (
            clientX: number,
            clientY: number,
        ): { x: number; y: number } | null => {
            const svg = svgRef.current;
            if (!svg) return null;
            const rect = svg.getBoundingClientRect();
            const zoom = useProjectStore.getState().canvas.zoom;
            const padding = FONT_SIZE * 2;
            return {
                x: (clientX - rect.left) / zoom - padding,
                y: (clientY - rect.top) / zoom - padding - FONT_SIZE,
            };
        };

        const handlePointerMove = (e: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag) return;

            const dx = Math.abs(e.clientX - drag.startClientX);
            const dy = Math.abs(e.clientY - drag.startClientY);

            if (
                !drag.isDragging &&
                (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)
            ) {
                drag.isDragging = true;
                dragSkipClick.current = true;
            }

            if (!drag.isDragging) return;

            const currentLayout = layoutRef.current;
            if (!currentLayout) return;

            const coords = toNodeCoords(e.clientX, e.clientY);
            if (!coords) return;

            setGhostPos(coords);

            const draggedNode = findNodeBySourceStart(
                currentLayout.root,
                drag.sourceStart,
            );
            if (!draggedNode) return;

            const excludeSet = getSubtreeSourceStarts(draggedNode);
            const { fontFamily, lineHeight: settingsLH } =
                useProjectStore.getState().settings;

            const dragIsTerminal = drag.isTerminal;

            // Priority 1: cursor is directly on a node label
            const ontoTarget = findDropTarget(
                currentLayout.root,
                coords.x,
                coords.y,
                fontFamily,
                excludeSet,
                dragIsTerminal,
            );
            if (ontoTarget) {
                const dt: DropTarget = {
                    type: "onto",
                    sourceStart: ontoTarget.sourceStart!,
                };
                dropTargetRef.current = dt;
                setDropTarget(dt);
                return;
            }

            // Priority 2: cursor is in a gap between siblings or on a terminal label
            const ins = findInsertionPoint(
                currentLayout.root,
                coords.x,
                coords.y,
                fontFamily,
                excludeSet,
                settingsLH,
                drag.sourceStart,
                dragIsTerminal,
            );
            if (ins) {
                const dt: DropTarget = {
                    type: "between",
                    parentSourceStart: ins.parentSourceStart,
                    index: ins.index,
                    x: ins.x,
                    y: ins.y,
                };
                dropTargetRef.current = dt;
                setDropTarget(dt);
                return;
            }

            dropTargetRef.current = null;
            setDropTarget(null);
        };

        const handlePointerUp = () => {
            const drag = dragRef.current;
            if (!drag) return;

            const dt = dropTargetRef.current;
            if (drag.isDragging && dt != null) {
                const store = useProjectStore.getState();
                if (dt.type === "onto") {
                    store.moveNodeUnder(drag.sourceStart, dt.sourceStart);
                } else {
                    store.moveNodeUnder(
                        drag.sourceStart,
                        dt.parentSourceStart,
                        dt.index,
                    );
                }
            }

            dragRef.current = null;
            dropTargetRef.current = null;
            setDropTarget(null);
            setGhostPos(null);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, []);

    useEffect(() => {
        if (ghostPos) {
            document.body.style.cursor = "grabbing";
            return () => {
                document.body.style.cursor = "";
            };
        }
    }, [ghostPos]);

    const handleNodeDragStart = useCallback(
        (node: PositionedNode, e: React.PointerEvent) => {
            if (node.sourceStart == null) return;
            dragRef.current = {
                sourceStart: node.sourceStart,
                label: node.label,
                startClientX: e.clientX,
                startClientY: e.clientY,
                isDragging: false,
                isTerminal: !!node.terminal,
            };
        },
        [],
    );

    const commitEdit = useCallback(() => {
        clearTimeout(debounceRef.current);
        if (!editing) return;

        if (editValue.trim() === "") {
            const originalText = editing.prefix + editing.label + editing.suffix;
            const ranges = getSelectedRanges(
                originalText,
                new Set([editing.prefix.length]),
            );
            if (ranges.length > 0) {
                const newText = deleteRanges(originalText, ranges);
                selfEditRef.current = true;
                setBracketText(newText);
            }
        } else {
            const newText = editing.prefix + editValue + editing.suffix;
            if (newText !== bracketText) {
                selfEditRef.current = true;
                setBracketText(newText);
            }
        }

        setEditing(null);
        setCursorPos(null);
    }, [editing, editValue, bracketText, setBracketText, setCursorPos]);

    const cancelEdit = useCallback(() => {
        clearTimeout(debounceRef.current);
        if (editing) {
            selfEditRef.current = true;
            setBracketText(editing.prefix + editing.label + editing.suffix);
        }
        setEditing(null);
        setCursorPos(null);
    }, [editing, setBracketText, setCursorPos]);

    const handleNodeClick = useCallback(
        (
            node: PositionedNode,
            color: string,
            fontWeight: number,
            modKey: boolean,
        ) => {
            if (dragSkipClick.current) {
                dragSkipClick.current = false;
                return;
            }
            if (node.sourceStart == null || node.sourceEnd == null) return;
            if (modKey) {
                if (editing) commitEdit();
                toggleNodeSelection(node.sourceStart);
                return;
            }
            clearSelection();
            setEditing({
                prefix: bracketText.slice(0, node.sourceStart),
                suffix: bracketText.slice(node.sourceEnd),
                x: node.x,
                y: node.y,
                label: node.label,
                color,
                fontWeight,
            });
            setEditValue(node.label);
            setCursorPos(node.sourceEnd);
        },
        [bracketText, setCursorPos, toggleNodeSelection, clearSelection, editing, commitEdit],
    );

    useEffect(() => {
        if (editing) {
            autoPairPos.current = null;
            requestAnimationFrame(() => {
                const input = inputRef.current;
                if (input) {
                    input.focus();
                    input.setSelectionRange(
                        input.value.length,
                        input.value.length,
                    );
                }
            });
        }
    }, [editing]);

    const editSourceStart = editing ? editing.prefix.length : undefined;
    const editingNode =
        editing && layout
            ? findNodeBySourceStart(layout.root, editing.prefix.length)
            : null;
    const editX = editingNode?.x ?? editing?.x ?? 0;
    const editY = editingNode?.y ?? editing?.y ?? 0;

    const editBracketMatch = useMemo(() => {
        if (!editing) return null;
        return matchBrackets(editing.prefix + editValue + editing.suffix);
    }, [editing, editValue]);

    const editHighlightPositions = useMemo(() => {
        const positions = new Set<number>();
        if (!editing || !editBracketMatch || cursorPos == null)
            return positions;
        const fullText = editing.prefix + editValue + editing.suffix;
        for (const offset of [0, -1]) {
            const idx = cursorPos + offset;
            if (
                idx >= 0 &&
                idx < fullText.length &&
                EDIT_BRACKETS.has(fullText[idx])
            ) {
                const pair = editBracketMatch.pairs.get(idx);
                if (pair != null) {
                    positions.add(idx);
                    positions.add(pair);
                    break;
                }
            }
        }
        return positions;
    }, [editing, editValue, editBracketMatch, cursorPos]);

    const editSpans = useMemo(() => {
        if (!editing || !editBracketMatch) return [];
        const offset = editing.prefix.length;
        const spans: { text: string; color?: string; highlight?: boolean }[] =
            [];
        let buf = "";
        for (let i = 0; i < editValue.length; i++) {
            const ch = editValue[i];
            const gi = offset + i;
            if (EDIT_BRACKETS.has(ch)) {
                if (buf) {
                    spans.push({ text: buf });
                    buf = "";
                }
                const isUnmatched = editBracketMatch.unmatched.has(gi);
                const color = isUnmatched
                    ? ERROR_COLOR
                    : BRACKET_COLORS[
                          editBracketMatch.depths.get(gi)! %
                              BRACKET_COLORS.length
                      ];
                spans.push({
                    text: ch,
                    color,
                    highlight: editHighlightPositions.has(gi),
                });
            } else {
                buf += ch;
            }
        }
        if (buf) spans.push({ text: buf });
        return spans;
    }, [editing, editValue, editBracketMatch, editHighlightPositions]);

    const editSpanPositions = useMemo(() => {
        if (!editing || editSpans.length === 0) return [];
        const totalWidth = measureTextWidth(editValue, settings.fontFamily);
        const startX = editX - totalWidth / 2;
        let acc = 0;
        return editSpans.map((span) => {
            const w = measureTextWidth(span.text, settings.fontFamily);
            const x = startX + acc;
            acc += w;
            return { x, width: w };
        });
    }, [editing, editSpans, editValue, editX, settings.fontFamily]);

    if (!layout) return null;

    const padding = FONT_SIZE * 2;
    const svgWidth = layout.width + padding * 2;
    const svgHeight = layout.height + padding * 2;

    const editWidth = editing
        ? Math.max(
              60,
              measureTextWidth(editValue || " ", settings.fontFamily) + 24,
          )
        : 0;

    return (
        <svg
            ref={svgRef}
            id="tree-svg"
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            xmlns="http://www.w3.org/2000/svg"
            style={{ overflow: "visible" }}
        >
            <g transform={`translate(${padding}, ${padding + FONT_SIZE})`}>
                {renderNode(
                    layout.root,
                    settings,
                    "r",
                    handleNodeClick,
                    handleNodeDragStart,
                    editSourceStart,
                    selectedNodes,
                )}
                {editing && (
                    <>
                        {editSpanPositions.map((pos, i) => {
                            const span = editSpans[i];
                            if (!span?.highlight || !span.color) return null;
                            return (
                                <rect
                                    key={`hl-${i}`}
                                    x={pos.x - 1}
                                    y={editY - FONT_SIZE * 0.45}
                                    width={pos.width + 2}
                                    height={FONT_SIZE * 0.9}
                                    fill={span.color + "30"}
                                    stroke={span.color + "60"}
                                    strokeWidth={1}
                                    rx={2}
                                />
                            );
                        })}
                        <text
                            x={editX}
                            y={editY}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontFamily={settings.fontFamily}
                            fontSize={FONT_SIZE}
                            fontWeight={editing.fontWeight}
                            fill={editing.color}
                        >
                            {editSpans.map((span, i) =>
                                span.color ? (
                                    <tspan
                                        key={i}
                                        fill={span.color}
                                        fontWeight={600}
                                    >
                                        {span.text}
                                    </tspan>
                                ) : (
                                    <tspan key={i}>{span.text}</tspan>
                                ),
                            )}
                        </text>
                        <foreignObject
                            x={editX - editWidth / 2}
                            y={editY - FONT_SIZE}
                            width={editWidth}
                            height={FONT_SIZE * 2}
                            onPointerDown={(e) => {
                                if (!e.metaKey && !e.ctrlKey)
                                    e.stopPropagation();
                            }}
                            onClick={(e) => {
                                if (
                                    (e.metaKey || e.ctrlKey) &&
                                    editSourceStart != null
                                ) {
                                    commitEdit();
                                    toggleNodeSelection(editSourceStart);
                                }
                            }}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={editValue}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const nativeInput =
                                        e.nativeEvent as InputEvent;
                                    let editType: TextEditType | undefined;
                                    if (
                                        nativeInput.inputType?.startsWith(
                                            "delete",
                                        )
                                    ) {
                                        editType = "delete";
                                    } else if (
                                        nativeInput.inputType === "insertText"
                                    ) {
                                        editType =
                                            nativeInput.data === " "
                                                ? "space"
                                                : "word";
                                    }
                                    setEditValue(val);
                                    clearTimeout(debounceRef.current);
                                    if (val) {
                                        const newText =
                                            editing.prefix +
                                            val +
                                            editing.suffix;
                                        const capturedEditType = editType;
                                        debounceRef.current = setTimeout(() => {
                                            selfEditRef.current = true;
                                            setBracketText(
                                                newText,
                                                capturedEditType,
                                            );
                                        }, 50);
                                    }
                                    requestAnimationFrame(() => {
                                        const input = inputRef.current;
                                        if (input)
                                            setCursorPos(
                                                editing.prefix.length +
                                                    (input.selectionStart ?? 0),
                                            );
                                    });
                                }}
                                onKeyDown={(e) => {
                                    const mod = e.metaKey || e.ctrlKey;
                                    if (mod && e.key.toLowerCase() === "z") {
                                        e.preventDefault();
                                        return;
                                    }
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        commitEdit();
                                        return;
                                    }
                                    if (e.key === "Escape") {
                                        cancelEdit();
                                        return;
                                    }

                                    const input = e.currentTarget;
                                    const localStart =
                                        input.selectionStart ?? 0;
                                    const localEnd =
                                        input.selectionEnd ?? localStart;
                                    const globalStart =
                                        editing.prefix.length + localStart;
                                    const globalEnd =
                                        editing.prefix.length + localEnd;
                                    const fullText =
                                        editing.prefix +
                                        editValue +
                                        editing.suffix;
                                    const bm = matchBrackets(fullText);
                                    const result = handleBracketKey(
                                        e.key,
                                        fullText,
                                        globalStart,
                                        globalEnd,
                                        bm,
                                        autoPairPos.current,
                                    );
                                    if (result) {
                                        e.preventDefault();
                                        const prefixLen = editing.prefix.length;
                                        const newEditValue = result.text.slice(
                                            prefixLen,
                                            result.text.length -
                                                editing.suffix.length,
                                        );
                                        setEditValue(newEditValue);
                                        selfEditRef.current = true;
                                        setBracketText(result.text);
                                        autoPairPos.current =
                                            result.autoPairPos;
                                        const newLocalStart =
                                            result.selStart - prefixLen;
                                        const newLocalEnd =
                                            result.selEnd - prefixLen;
                                        setCursorPos(result.selStart);
                                        requestAnimationFrame(() => {
                                            input.setSelectionRange(
                                                newLocalStart,
                                                newLocalEnd,
                                            );
                                        });
                                    } else {
                                        autoPairPos.current = null;
                                    }
                                }}
                                onSelect={() => {
                                    const input = inputRef.current;
                                    if (input)
                                        setCursorPos(
                                            editing.prefix.length +
                                                (input.selectionStart ?? 0),
                                        );
                                }}
                                onKeyUp={() => {
                                    const input = inputRef.current;
                                    if (input)
                                        setCursorPos(
                                            editing.prefix.length +
                                                (input.selectionStart ?? 0),
                                        );
                                }}
                                onBlur={commitEdit}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    textAlign: "center",
                                    fontSize: `${FONT_SIZE}px`,
                                    fontFamily: `${settings.fontFamily}, sans-serif`,
                                    fontWeight: editing.fontWeight,
                                    color: "transparent",
                                    caretColor: BLACK,
                                    lineHeight: `${FONT_SIZE * 2}px`,
                                    border: "none",
                                    outline: "none",
                                    background: "transparent",
                                    padding: 0,
                                }}
                            />
                        </foreignObject>
                    </>
                )}
                {dropTarget?.type === "onto" &&
                    (() => {
                        const tn = findNodeBySourceStart(
                            layout.root,
                            dropTarget.sourceStart,
                        );
                        if (!tn) return null;
                        const dl =
                            tn.subscript != null
                                ? `${tn.label}${subscriptStr(tn.subscript)}`
                                : tn.label;
                        const w = measureTextWidth(dl, settings.fontFamily);
                        return (
                            <rect
                                x={tn.x - w / 2 - 6}
                                y={tn.y - FONT_SIZE * 0.6}
                                width={w + 12}
                                height={FONT_SIZE * 1.2}
                                fill="rgba(34, 197, 94, 0.15)"
                                stroke="rgba(34, 197, 94, 0.7)"
                                strokeWidth={2}
                                rx={6}
                                pointerEvents="none"
                            />
                        );
                    })()}
                {dropTarget?.type === "between" && (
                    <g pointerEvents="none">
                        <line
                            x1={dropTarget.x}
                            y1={dropTarget.y - FONT_SIZE * 0.7}
                            x2={dropTarget.x}
                            y2={dropTarget.y + FONT_SIZE * 0.7}
                            stroke="rgba(34, 197, 94, 0.7)"
                            strokeWidth={2}
                            strokeLinecap="round"
                        />
                        <circle
                            cx={dropTarget.x}
                            cy={dropTarget.y}
                            r={3}
                            fill="rgba(34, 197, 94, 0.7)"
                        />
                    </g>
                )}
                {ghostPos && dragRef.current && (
                    <text
                        x={ghostPos.x}
                        y={ghostPos.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontFamily={settings.fontFamily}
                        fontSize={FONT_SIZE}
                        fontWeight={500}
                        fill={BLACK}
                        opacity={0.5}
                        pointerEvents="none"
                    >
                        {dragRef.current.label}
                    </text>
                )}
            </g>
        </svg>
    );
}
