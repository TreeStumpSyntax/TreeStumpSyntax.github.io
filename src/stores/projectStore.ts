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
} from "../lib/treeOperations";
import type { CanvasState, Settings } from "../types";
import { FONT_SIZE } from "../types";

export const DEFAULT_SETTINGS: Settings = {
    autoSubscript: false,
    triangles: true,
    terminalLines: false,
    coloring: true,
    nodeColor: "#2563eb",
    leafColor: "#dc2626",
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
}

const MAX_HISTORY = 100;
const MERGE_INTERVAL_MS = 500;

let past: Snapshot[] = [];
let future: Snapshot[] = [];
let lastPushTime = 0;

type TypingOp = "word" | "firstSpace" | "consecutiveSpace" | "delete" | "none";
let lastTypingOp: TypingOp = "none";

export type TextEditType = "word" | "space" | "delete";

function takeSnapshot(state: { bracketText: string; settings: Settings }): Snapshot {
    return { bracketText: state.bracketText, settings: { ...state.settings } };
}

function pushSnapshot(state: { bracketText: string; settings: Settings }) {
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
    state: { bracketText: string; settings: Settings },
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
    state: { bracketText: string; settings: Settings },
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
            autoFit: false,
            selectedNodes: new Set<number>(),
            clipboard: null,

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
                    selectedNodes: new Set(),
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
                    selectedNodes: new Set(),
                });
            },
            toggleNodeSelection: (sourceStart) => {
                const next = new Set(get().selectedNodes);
                if (next.has(sourceStart)) {
                    next.delete(sourceStart);
                } else {
                    next.add(sourceStart);
                }
                set({ selectedNodes: next });
            },
            clearSelection: () => {
                if (get().selectedNodes.size > 0) {
                    set({ selectedNodes: new Set() });
                }
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
                const { bracketText, settings, selectedNodes: current } = get();
                const { tree } = parse(bracketText);
                if (!tree) return;
                const layout = layoutTree(tree, settings);
                if (!layout) return;
                const padding = FONT_SIZE * 2;
                const inRect = computeNodesInRect(
                    layout.root,
                    rect,
                    padding,
                    padding + FONT_SIZE,
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
        }),
        {
            name: "treestump-project",
            partialize: (state) => ({
                projectName: state.projectName,
                bracketText: state.bracketText,
                settings: state.settings,
                canvas: state.canvas,
                autoFit: state.autoFit,
            }),
        },
    ),
);
