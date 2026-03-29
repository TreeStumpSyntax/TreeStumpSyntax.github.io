import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchBrackets, type BracketMatch } from "../lib/bracketMatcher";
import { handleBracketKey } from "../lib/bracketPairing";
import { parse, extractArrows, validateArrows } from "../lib/parser";
import { getSelectedPositions, getSelectedRanges } from "../lib/selection";
import { useProjectStore, type TextEditType } from "../stores/projectStore";
import type { TreeNode } from "../types";

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
const BRACKETS = new Set(["[", "]", "(", ")"]);

const SELECT_BG = "#B4D5FE";

interface Span {
    text: string;
    color?: string;
    highlight?: boolean;
    selected?: boolean;
}

function colorize(
    text: string,
    match: BracketMatch,
    highlightPositions: Set<number>,
    selectedPositions: Set<number>,
): Span[] {
    const spans: Span[] = [];
    let buffer = "";
    let bufferSelected = false;

    function flushBuffer() {
        if (buffer) {
            spans.push({ text: buffer, selected: bufferSelected || undefined });
            buffer = "";
        }
    }

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const isSelected = selectedPositions.has(i);
        if (BRACKETS.has(ch)) {
            flushBuffer();
            const isUnmatched = match.unmatched.has(i);
            const color = isUnmatched
                ? ERROR_COLOR
                : BRACKET_COLORS[match.depths.get(i)! % BRACKET_COLORS.length];
            spans.push({
                text: ch,
                color,
                highlight: highlightPositions.has(i),
                selected: isSelected || undefined,
            });
        } else {
            if (buffer.length > 0 && isSelected !== bufferSelected) {
                flushBuffer();
            }
            if (buffer.length === 0) {
                bufferSelected = isSelected;
            }
            buffer += ch;
        }
    }
    flushBuffer();
    return spans;
}

function highlightArrowSyntax(
    spans: Span[],
    arrowColorMap: Map<number, string>,
): Span[] {
    const result: Span[] = [];
    let charOffset = 0;
    for (const span of spans) {
        if (span.color) {
            result.push(span);
            charOffset += span.text.length;
            continue;
        }
        const parts = span.text.split(/(->|;)/);
        let localOff = 0;
        for (const part of parts) {
            const absPos = charOffset + localOff;
            if ((part === "->" || part === ";") && arrowColorMap.has(absPos)) {
                result.push({
                    text: part,
                    color: arrowColorMap.get(absPos)!,
                    selected: span.selected,
                });
            } else if (part) {
                result.push({ ...span, text: part });
            }
            localOff += part.length;
        }
        charOffset += span.text.length;
    }
    return result;
}

export default function BracketEditor() {
    const bracketText = useProjectStore((s) => s.bracketText);
    const setBracketText = useProjectStore((s) => s.setBracketText);
    const defaultArrowColor = useProjectStore((s) => s.settings.defaultArrowColor);
    const arrowSettings = useProjectStore((s) => s.arrowSettings);
    const cursorPos = useProjectStore((s) => s.cursorPos);
    const setCursorPos = useProjectStore((s) => s.setCursorPos);
    const selectedNodes = useProjectStore((s) => s.selectedNodes);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const autoPairPos = useRef<number | null>(null);
    const [isFocused, setIsFocused] = useState(false);

    const bracketMatch = useMemo(
        () => matchBrackets(bracketText),
        [bracketText],
    );

    const highlightPositions = useMemo(() => {
        const positions = new Set<number>();
        if (cursorPos == null) return positions;

        for (const offset of [0, -1]) {
            const idx = cursorPos + offset;
            if (
                idx >= 0 &&
                idx < bracketText.length &&
                BRACKETS.has(bracketText[idx])
            ) {
                const pair = bracketMatch.pairs.get(idx);
                if (pair != null) {
                    positions.add(idx);
                    positions.add(pair);
                    break;
                }
            }
        }
        return positions;
    }, [cursorPos, bracketText, bracketMatch]);

    const selectedPositions = useMemo(() => {
        if (selectedNodes.size === 0) return new Set<number>();
        const ranges = getSelectedRanges(bracketText, selectedNodes);
        return getSelectedPositions(ranges);
    }, [bracketText, selectedNodes]);

    const arrowColorMap = useMemo(() => {
        const { tree } = parse(bracketText);
        if (!tree) return new Map<number, string>();
        const map = new Map<number, string>();
        function visit(node: TreeNode) {
            if (
                node.arrowSyntaxStart != null &&
                node.arrowSyntaxEnd != null &&
                node.arrowTargets?.length
            ) {
                const key = `${node.label}::${node.arrowTargets[0]}`;
                const color = arrowSettings[key]?.color ?? defaultArrowColor;
                map.set(node.arrowSyntaxStart, color);
                for (let i = node.arrowSyntaxStart + 2; i < node.arrowSyntaxEnd; i++) {
                    if (bracketText[i] === ";") map.set(i, color);
                }
            }
            for (const child of node.children) visit(child);
        }
        visit(tree);
        return map;
    }, [bracketText, arrowSettings, defaultArrowColor]);

    const spans = useMemo(
        () =>
            highlightArrowSyntax(
                colorize(
                    bracketText,
                    bracketMatch,
                    highlightPositions,
                    selectedPositions,
                ),
                arrowColorMap,
            ),
        [bracketText, bracketMatch, highlightPositions, selectedPositions, arrowColorMap],
    );

    const unmatchedCount = bracketMatch.unmatched.size;

    const arrowErrorCount = useMemo(() => {
        const { tree } = parse(bracketText);
        if (!tree) return 0;
        const arrows = extractArrows(tree);
        if (arrows.length === 0) return 0;
        return validateArrows(tree, arrows).length;
    }, [bracketText]);

    const updateCursorPos = useCallback(() => {
        const ta = textareaRef.current;
        if (ta && ta === document.activeElement) {
            setCursorPos(ta.selectionStart);
        }
    }, [setCursorPos]);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = `${ta.scrollHeight}px`;
    }, [bracketText]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            const maxScroll = el.scrollHeight - el.clientHeight;
            if (maxScroll <= 0) return;
            e.preventDefault();
            el.scrollTop = Math.max(
                0,
                Math.min(maxScroll, el.scrollTop + e.deltaY * 0.4),
            );
        };
        el.addEventListener("wheel", handler, { passive: false });
        return () => el.removeEventListener("wheel", handler);
    }, []);

    return (
        <div className="pointer-events-none fixed right-0 bottom-0 left-0 z-40 flex justify-center px-3 pb-3 sm:px-4 sm:pb-4">
            <div
                className={`bracket-pop-up pointer-events-auto w-full max-w-3xl overflow-hidden rounded-2xl border bg-surface/90 backdrop-blur-md transition-all duration-150 ${
                    isFocused ? "border-primary/20 shadow-lg" : "border-border"
                }`}
            >
                <div className="flex flex-nowrap items-center gap-2 overflow-hidden px-4 pt-2.5 pb-0">
                    <span className="shrink-0 font-mono text-[10px] tracking-wide text-secondary uppercase">
                        Bracket notation
                    </span>
                    {unmatchedCount > 0 && (
                        <>
                            <span className="shrink-0 text-[10px] text-secondary/30">
                                &middot;
                            </span>
                            <span className="min-w-0 truncate font-mono text-[10px] tracking-wider text-error">
                                {unmatchedCount} unmatched bracket
                                {unmatchedCount !== 1 && "s"}
                            </span>
                        </>
                    )}
                    {arrowErrorCount > 0 && (
                        <>
                            <span className="shrink-0 text-[10px] text-secondary/30">
                                &middot;
                            </span>
                            <span className="min-w-0 truncate font-mono text-[10px] tracking-wider text-error">
                                {arrowErrorCount} invalid arrow target
                                {arrowErrorCount !== 1 && "s"}
                            </span>
                        </>
                    )}
                </div>
                <div
                    ref={scrollRef}
                    className="scrollbar-none relative overflow-x-hidden overflow-y-auto"
                    style={{ maxHeight: "5.9rem" }}
                >
                    <pre
                        className="pointer-events-none absolute top-0 right-0 left-0 whitespace-pre-wrap wrap-break-word px-4 pt-1.5 pb-3 font-mono text-[1.05rem] leading-relaxed"
                        aria-hidden="true"
                    >
                        {spans.map((span, i) => {
                            const style: React.CSSProperties = {};
                            if (span.color) {
                                style.color = span.color;
                                style.fontWeight = 600;
                            }
                            if (span.highlight && span.color) {
                                style.backgroundColor = span.color + "30";
                                style.borderRadius = "2px";
                                style.outline = `1px solid ${span.color}60`;
                            }
                            if (span.selected) {
                                style.backgroundColor = SELECT_BG;
                                style.borderRadius = "2px";
                            }
                            return (
                                <span
                                    key={i}
                                    style={
                                        Object.keys(style).length > 0
                                            ? style
                                            : undefined
                                    }
                                >
                                    {span.text}
                                </span>
                            );
                        })}
                        {"\n"}
                    </pre>
                    <textarea
                        ref={textareaRef}
                        value={bracketText}
                        onChange={(e) => {
                            const input = e.nativeEvent as InputEvent;
                            let editType: TextEditType | undefined;
                            if (input.inputType?.startsWith("delete")) {
                                editType = "delete";
                            } else if (input.inputType === "insertText") {
                                editType =
                                    input.data === " " ? "space" : "word";
                            }
                            setBracketText(e.target.value, editType);
                        }}
                        onKeyDown={(e) => {
                            const mod = e.metaKey || e.ctrlKey;
                            if (mod && e.key.toLowerCase() === "z") {
                                e.preventDefault();
                                return;
                            }
                            const ta = e.currentTarget;
                            const result = handleBracketKey(
                                e.key,
                                bracketText,
                                ta.selectionStart,
                                ta.selectionEnd,
                                bracketMatch,
                                autoPairPos.current,
                            );
                            if (result) {
                                e.preventDefault();
                                setBracketText(result.text);
                                autoPairPos.current = result.autoPairPos;
                                requestAnimationFrame(() => {
                                    ta.selectionStart = result.selStart;
                                    ta.selectionEnd = result.selEnd;
                                    updateCursorPos();
                                });
                            } else {
                                autoPairPos.current = null;
                            }
                        }}
                        onKeyUp={updateCursorPos}
                        onSelect={updateCursorPos}
                        onClick={updateCursorPos}
                        onFocus={() => {
                            setIsFocused(true);
                            updateCursorPos();
                        }}
                        onBlur={() => {
                            setIsFocused(false);
                            setCursorPos(null);
                        }}
                        rows={1}
                        spellCheck={false}
                        className="relative w-full resize-none overflow-hidden whitespace-pre-wrap wrap-break-word bg-transparent px-4 pt-1.5 pb-3 font-mono text-[1.05rem] leading-relaxed text-transparent caret-primary outline-none"
                        placeholder="[S [NP phrase][VP [V structure]]]"
                    />
                </div>
            </div>
        </div>
    );
}
