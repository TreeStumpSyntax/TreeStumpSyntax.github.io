import { create } from "zustand";
import { persist } from "zustand/middleware";
import { layoutTree } from "../lib/layout";
import { parse } from "../lib/parser";
import { matchBrackets } from "../lib/bracketMatcher";
import {
    computeNodesInRect,
    deleteRanges,
    findTreeNode,
    getSelectedRanges,
    type ContentRect,
} from "../lib/selection";
import {
    moveNodeUnder as moveNodeUnderImpl,
    swapSibling as swapSiblingImpl,
    findHighestSelectedNode,
} from "../lib/treeOperations";
import { arrowExtraPadding } from "../lib/arrowLayout";
import { extractArrows } from "../lib/parser";
import type { ArrowSettings, CanvasState, Settings, TreeNode } from "../types";
import { DEFAULT_ARROW_SETTINGS, FONT_SIZE } from "../types";

export const DEFAULT_SETTINGS: Settings = {
    autoSubscript: false,
    triangles: true,
    terminalLines: false,
    coloring: true,
    nodeColor: "#2563eb",
    leafColor: "#dc2626",
    defaultArrowColor: "#1a1a1a",
    alignment: "top",
    fontFamily: "Geist",
    nodeSpacing: 24,
    lineHeight: 60,
};

const DEFAULT_CANVAS: CanvasState = {
    x: 0,
    y: 0,
    zoom: 1,
};

const DEFAULT_BRACKET_TEXT =
    "[S [NP TreeStump][VP [V generates][NP [Adj beautiful][N syntax trees]]]]";

// --------------- undo / redo history (module-level, session-only) ---------------

interface Snapshot {
    bracketText: string;
    settings: Settings;
    arrowSettings: Record<string, ArrowSettings>;
}

const MAX_HISTORY = 100;
const MERGE_INTERVAL_MS = 500;

let past: Snapshot[] = [];
let future: Snapshot[] = [];
let lastPushTime = 0;

type TypingOp = "word" | "firstSpace" | "consecutiveSpace" | "delete" | "none";
let lastTypingOp: TypingOp = "none";

export type TextEditType = "word" | "space" | "delete";

function takeSnapshot(state: {
    bracketText: string;
    settings: Settings;
    arrowSettings: Record<string, ArrowSettings>;
}): Snapshot {
    return {
        bracketText: state.bracketText,
        settings: { ...state.settings },
        arrowSettings: { ...state.arrowSettings },
    };
}

function pushSnapshot(state: {
    bracketText: string;
    settings: Settings;
    arrowSettings: Record<string, ArrowSettings>;
}) {
    past.push(takeSnapshot(state));
    if (past.length > MAX_HISTORY) past.shift();
}

/**
 * VS Code-style character-class undo stops for text editing.
 * Undo boundaries are placed at word/space/delete transitions, not on a timer.
 */
function deriveTypingOp(editType: TextEditType): TypingOp {
    if (editType === "space") {
        return lastTypingOp === "firstSpace" ||
            lastTypingOp === "consecutiveSpace"
            ? "consecutiveSpace"
            : "firstSpace";
    }
    if (editType === "delete") return "delete";
    return "word";
}

function shouldCreateTextUndoStop(newOp: TypingOp): boolean {
    if (lastTypingOp === "none") return true;
    if (lastTypingOp === "firstSpace") return false;
    const norm = (op: TypingOp): string =>
        op === "firstSpace" || op === "consecutiveSpace" ? "space" : op;
    return norm(lastTypingOp) !== norm(newOp);
}

function pushHistoryForText(
    state: { bracketText: string; settings: Settings; arrowSettings: Record<string, ArrowSettings> },
    editType?: TextEditType,
) {
    if (editType == null) {
        pushSnapshot(state);
        future = [];
        lastTypingOp = "none";
        return;
    }
    const newOp = deriveTypingOp(editType);
    if (shouldCreateTextUndoStop(newOp)) {
        pushSnapshot(state);
    }
    future = [];
    lastTypingOp = newOp;
}

/**
 * Time-based merge for settings changes (slider drags, color hex input).
 */
function pushHistoryTimeBased(
    state: { bracketText: string; settings: Settings; arrowSettings: Record<string, ArrowSettings> },
    merge: boolean,
) {
    const now = Date.now();
    const shouldMerge =
        merge && now - lastPushTime < MERGE_INTERVAL_MS && past.length > 0;
    if (!shouldMerge) {
        pushSnapshot(state);
    }
    future = [];
    lastPushTime = now;
    lastTypingOp = "none";
}

// -------------------------------------------------------------------------------

interface ProjectStore {
    projectName: string;
    bracketText: string;
    settings: Settings;
    canvas: CanvasState;
    cursorPos: number | null;
    pendingFit: boolean;
    autoFit: boolean;
    selectedNodes: Set<number>;
    clipboard: string | null;
    arrowSettings: Record<string, ArrowSettings>;
    selectedArrow: string | null;
    arrowPopover: { key: string; x: number; y: number } | null;

    setProjectName: (name: string) => void;
    resetSettings: () => void;
    setAutoFit: (v: boolean) => void;
    fitView: () => void;
    setBracketText: (text: string, editType?: TextEditType) => void;
    updateSettings: (partial: Partial<Settings>, merge?: boolean) => void;
    setCanvas: (canvas: CanvasState) => void;
    setCursorPos: (pos: number | null) => void;
    resetProject: () => void;
    loadProject: (state: {
        projectName?: string;
        bracketText: string;
        settings: Settings;
        canvas: CanvasState;
        arrowSettings?: Record<string, ArrowSettings>;
    }) => void;
    clearPendingFit: () => void;
    undo: () => void;
    redo: () => void;
    toggleNodeSelection: (sourceStart: number) => void;
    clearSelection: () => void;
    deleteSelectedNodes: () => void;
    selectNodesInRect: (rect: ContentRect) => void;
    copySelectedNodes: () => string | null;
    pasteAsChild: () => void;
    moveNodeUnder: (
        draggedSourceStart: number,
        targetSourceStart: number,
        insertIndex?: number,
    ) => void;
    swapSibling: (
        sourceStart: number,
        direction: "left" | "right",
    ) => void;
    updateArrowSettings: (
        key: string,
        partial: Partial<ArrowSettings>,
        merge?: boolean,
    ) => void;
    selectArrow: (key: string | null) => void;
    setArrowPopover: (
        popover: { key: string; x: number; y: number } | null,
    ) => void;
    deleteSelectedArrow: () => void;
    cutSelectedArrow: () => void;
    arrowClipboard: string | null;
    pasteArrow: () => void;
}

/** Remove one arrow target from bracketText. Returns new text or null if not found. */
function removeArrowText(
    bracketText: string,
    sourceLabel: string,
    targetLabel: string,
): string | null {
    const { tree } = parse(bracketText);
    if (!tree) return null;

    let found: TreeNode | null = null;
    function visit(node: TreeNode) {
        if (node.label === sourceLabel && node.arrowTargets?.includes(targetLabel)) found = node;
        for (const child of node.children) visit(child);
    }
    visit(tree);

    if (!found || (found as TreeNode).arrowSyntaxStart == null) return null;
    const node = found as TreeNode;
    const syntaxStart = node.arrowSyntaxStart!;
    const syntaxEnd = node.arrowSyntaxEnd!;
    const remaining = node.arrowTargets!.filter((t) => t !== targetLabel);

    if (remaining.length === 0) {
        let start = syntaxStart;
        while (start > 0 && bracketText[start - 1] === " ") start--;
        return bracketText.slice(0, start) + bracketText.slice(syntaxEnd);
    }
    return (
        bracketText.slice(0, syntaxStart) +
        "-> " + remaining.join("; ") +
        bracketText.slice(syntaxEnd)
    );
}

export const useProjectStore = create<ProjectStore>()(
    persist(
        (set, get) => ({
            projectName: "Untitled",
            bracketText: DEFAULT_BRACKET_TEXT,
            settings: DEFAULT_SETTINGS,
            canvas: DEFAULT_CANVAS,
            cursorPos: null,
            pendingFit: false,
            autoFit: true,
            selectedNodes: new Set<number>(),
            clipboard: null,
            arrowSettings: {},
            selectedArrow: null,
            arrowPopover: null,
            arrowClipboard: null,

            setProjectName: (name) => set({ projectName: name }),
            setAutoFit: (v) => set({ autoFit: v }),
            fitView: () => set({ pendingFit: true }),
            resetSettings: () => {
                pushHistoryTimeBased(get(), false);
                set({ settings: DEFAULT_SETTINGS });
            },
            setBracketText: (text, editType) => {
                pushHistoryForText(get(), editType);
                if (get().selectedNodes.size > 0) {
                    set({ bracketText: text, selectedNodes: new Set() });
                } else {
                    set({ bracketText: text });
                }
            },
            setCursorPos: (pos) => set({ cursorPos: pos }),
            clearPendingFit: () => set({ pendingFit: false }),
            updateSettings: (partial, merge = false) => {
                pushHistoryTimeBased(get(), merge);
                set((state) => ({
                    settings: { ...state.settings, ...partial },
                }));
            },
            setCanvas: (canvas) => set({ canvas }),
            resetProject: () => {
                pushHistoryTimeBased(get(), false);
                set({
                    projectName: "Untitled",
                    bracketText: DEFAULT_BRACKET_TEXT,
                    settings: DEFAULT_SETTINGS,
                    canvas: DEFAULT_CANVAS,
                    pendingFit: true,
                    selectedNodes: new Set(),
                    arrowSettings: {},
                    selectedArrow: null,
                    arrowPopover: null,
                });
            },
            loadProject: (project) => {
                pushHistoryTimeBased(get(), false);
                set({
                    projectName: project.projectName ?? "Untitled",
                    bracketText: project.bracketText,
                    settings: { ...DEFAULT_SETTINGS, ...project.settings },
                    canvas: project.canvas ?? DEFAULT_CANVAS,
                    pendingFit: true,
                    selectedNodes: new Set(),
                    arrowSettings: project.arrowSettings ?? {},
                    selectedArrow: null,
                    arrowPopover: null,
                });
            },
            undo: () => {
                if (past.length === 0) return;
                future.push(takeSnapshot(get()));
                const prev = past.pop()!;
                lastTypingOp = "none";
                lastPushTime = 0;
                set({
                    bracketText: prev.bracketText,
                    settings: prev.settings,
                    arrowSettings: prev.arrowSettings,
                    selectedNodes: new Set(),
                    selectedArrow: null,
                    arrowPopover: null,
                });
            },
            redo: () => {
                if (future.length === 0) return;
                past.push(takeSnapshot(get()));
                const next = future.pop()!;
                lastTypingOp = "none";
                lastPushTime = 0;
                set({
                    bracketText: next.bracketText,
                    settings: next.settings,
                    arrowSettings: next.arrowSettings,
                    selectedNodes: new Set(),
                    selectedArrow: null,
                    arrowPopover: null,
                });
            },
            toggleNodeSelection: (sourceStart) => {
                const next = new Set(get().selectedNodes);
                if (next.has(sourceStart)) {
                    next.delete(sourceStart);
                } else {
                    next.add(sourceStart);
                }
                set({ selectedNodes: next, selectedArrow: null, arrowPopover: null });
            },
            clearSelection: () => {
                const updates: Partial<ProjectStore> = {};
                if (get().selectedNodes.size > 0) updates.selectedNodes = new Set();
                if (get().selectedArrow) updates.selectedArrow = null;
                if (get().arrowPopover) updates.arrowPopover = null;
                if (Object.keys(updates).length > 0) set(updates);
            },
            deleteSelectedNodes: () => {
                const { bracketText, selectedNodes } = get();
                if (selectedNodes.size === 0) return;
                const ranges = getSelectedRanges(bracketText, selectedNodes);
                if (ranges.length === 0) return;
                pushSnapshot(get());
                future = [];
                lastTypingOp = "none";
                const newText = deleteRanges(bracketText, ranges);
                set({ bracketText: newText, selectedNodes: new Set() });
            },
            selectNodesInRect: (rect) => {
                const { bracketText, settings, arrowSettings: as_, selectedNodes: current } = get();
                const { tree } = parse(bracketText);
                if (!tree) return;
                const layout = layoutTree(tree, settings);
                if (!layout) return;
                const padding = FONT_SIZE * 2;
                const arrows = extractArrows(tree);
                const extra = arrowExtraPadding(arrows, as_);
                const inRect = computeNodesInRect(
                    layout.root,
                    rect,
                    padding,
                    padding + FONT_SIZE + extra.above,
                );
                const toggled = new Set(current);
                for (const ss of inRect) {
                    if (toggled.has(ss)) toggled.delete(ss);
                    else toggled.add(ss);
                }
                set({ selectedNodes: toggled });
            },
            copySelectedNodes: () => {
                const { bracketText, selectedNodes } = get();
                if (selectedNodes.size === 0) return null;
                const ranges = getSelectedRanges(bracketText, selectedNodes);
                if (ranges.length === 0) return null;
                const text = ranges
                    .map((r) => bracketText.slice(r.start, r.end))
                    .join(" ");
                set({ clipboard: text });
                return text;
            },
            pasteAsChild: () => {
                const { bracketText, clipboard, selectedNodes } = get();
                if (!clipboard || selectedNodes.size !== 1) return;

                const targetStart = [...selectedNodes][0];
                const { tree } = parse(bracketText);
                if (!tree) return;

                const targetNode = findTreeNode(tree, targetStart);
                if (
                    !targetNode ||
                    targetNode.sourceStart == null ||
                    targetNode.sourceEnd == null
                )
                    return;

                let insertPos: number;
                if (targetNode.terminal) {
                    insertPos = targetNode.sourceEnd;
                } else {
                    const { pairs } = matchBrackets(bracketText);
                    let openPos = targetNode.sourceStart - 1;
                    while (openPos >= 0 && bracketText[openPos] !== "[")
                        openPos--;
                    if (openPos < 0) return;
                    const closePos = pairs.get(openPos);
                    if (closePos == null) return;
                    insertPos = closePos;
                }

                const prev = bracketText[insertPos - 1];
                const spacer =
                    prev != null && prev !== " " && prev !== "[" ? " " : "";

                pushSnapshot(get());
                future = [];
                lastTypingOp = "none";
                const newText =
                    bracketText.slice(0, insertPos) +
                    spacer +
                    clipboard +
                    bracketText.slice(insertPos);
                set({ bracketText: newText, selectedNodes: new Set() });
            },
            moveNodeUnder: (
                draggedSourceStart,
                targetSourceStart,
                insertIndex?,
            ) => {
                const { bracketText } = get();
                const newText = moveNodeUnderImpl(
                    bracketText,
                    draggedSourceStart,
                    targetSourceStart,
                    insertIndex,
                );
                if (newText == null || newText === bracketText) return;
                pushSnapshot(get());
                future = [];
                lastTypingOp = "none";
                set({ bracketText: newText, selectedNodes: new Set() });
            },
            swapSibling: (sourceStart, direction) => {
                const { bracketText } = get();
                const result = swapSiblingImpl(
                    bracketText,
                    sourceStart,
                    direction,
                );
                if (!result || result.text === bracketText) return;
                pushSnapshot(get());
                future = [];
                lastTypingOp = "none";
                set({
                    bracketText: result.text,
                    selectedNodes: new Set([result.newSourceStart]),
                });
            },
            updateArrowSettings: (key, partial, merge = false) => {
                pushHistoryTimeBased(get(), merge);
                set((state) => ({
                    arrowSettings: {
                        ...state.arrowSettings,
                        [key]: {
                            ...DEFAULT_ARROW_SETTINGS,
                            ...state.arrowSettings[key],
                            ...partial,
                        },
                    },
                }));
            },
            selectArrow: (key) => {
                set({
                    selectedArrow: key,
                    selectedNodes: new Set(),
                    arrowPopover: key == null ? null : get().arrowPopover,
                });
            },
            setArrowPopover: (popover) => {
                set({
                    arrowPopover: popover,
                    selectedArrow: popover?.key ?? null,
                    selectedNodes: new Set(),
                });
            },
            deleteSelectedArrow: () => {
                const { selectedArrow, bracketText, arrowSettings } = get();
                if (!selectedArrow) return;
                const sepIdx = selectedArrow.indexOf("::");
                if (sepIdx < 0) return;
                const newText = removeArrowText(bracketText, selectedArrow.slice(0, sepIdx), selectedArrow.slice(sepIdx + 2));
                if (newText == null) return;
                const newArrowSettings = { ...arrowSettings };
                delete newArrowSettings[selectedArrow];
                pushSnapshot(get());
                future = [];
                lastTypingOp = "none";
                set({ bracketText: newText, arrowSettings: newArrowSettings, selectedArrow: null, arrowPopover: null });
            },
            cutSelectedArrow: () => {
                const { selectedArrow, bracketText, arrowSettings } = get();
                if (!selectedArrow) return;
                const sepIdx = selectedArrow.indexOf("::");
                if (sepIdx < 0) return;
                const targetLabel = selectedArrow.slice(sepIdx + 2);
                const newText = removeArrowText(bracketText, selectedArrow.slice(0, sepIdx), targetLabel);
                if (newText == null) return;
                const newArrowSettings = { ...arrowSettings };
                delete newArrowSettings[selectedArrow];
                pushSnapshot(get());
                future = [];
                lastTypingOp = "none";
                set({ bracketText: newText, arrowSettings: newArrowSettings, selectedArrow: null, arrowPopover: null, arrowClipboard: targetLabel });
            },
            pasteArrow: () => {
                const { arrowClipboard, bracketText, selectedNodes } = get();
                if (!arrowClipboard || selectedNodes.size === 0) return;
                const { tree } = parse(bracketText);
                if (!tree) return;
                const sourceStart = findHighestSelectedNode(bracketText, selectedNodes);
                if (sourceStart == null) return;
                const node = findTreeNode(tree, sourceStart);
                if (!node || node.sourceEnd == null) return;
                let newText: string;
                if (node.arrowSyntaxEnd != null) {
                    newText =
                        bracketText.slice(0, node.arrowSyntaxEnd) +
                        "; " + arrowClipboard +
                        bracketText.slice(node.arrowSyntaxEnd);
                } else {
                    newText =
                        bracketText.slice(0, node.sourceEnd) +
                        " -> " + arrowClipboard +
                        bracketText.slice(node.sourceEnd);
                }
                pushSnapshot(get());
                future = [];
                lastTypingOp = "none";
                set({ bracketText: newText, arrowClipboard: null });
            },
        }),
        {
            name: "treestump-project",
            partialize: (state) => ({
                projectName: state.projectName,
                bracketText: state.bracketText,
                settings: state.settings,
                canvas: state.canvas,
                autoFit: state.autoFit,
                arrowSettings: state.arrowSettings,
            }),
        },
    ),
);
