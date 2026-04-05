import { useMemo } from "react";
import { useNavigate } from "react-router";
import { matchBrackets } from "../lib/bracketMatcher";
import { useProjectStore } from "../stores/projectStore";

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

function BracketSnippet({ children }: { children: string }) {
    const spans = useMemo(() => {
        const match = matchBrackets(children);
        const result: { text: string; color?: string }[] = [];
        let buffer = "";
        for (let i = 0; i < children.length; i++) {
            const ch = children[i];
            if (BRACKETS.has(ch)) {
                if (buffer) {
                    result.push({ text: buffer });
                    buffer = "";
                }
                const isUnmatched = match.unmatched.has(i);
                const color = isUnmatched
                    ? ERROR_COLOR
                    : BRACKET_COLORS[
                          match.depths.get(i)! % BRACKET_COLORS.length
                      ];
                result.push({ text: ch, color });
            } else {
                buffer += ch;
            }
        }
        if (buffer) result.push({ text: buffer });
        return result;
    }, [children]);

    return (
        <div className="rounded-xl border border-border bg-surface p-4 font-mono text-sm text-primary">
            {spans.map((s, i) =>
                s.color ? (
                    <span key={i} style={{ color: s.color, fontWeight: 600 }}>
                        {s.text}
                    </span>
                ) : (
                    <span key={i}>{s.text}</span>
                ),
            )}
        </div>
    );
}

const IS_MAC =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const MOD = IS_MAC ? "⌘" : "Ctrl";

function Key({ children }: { children: string }) {
    return (
        <kbd className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-secondary shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
            {children}
        </kbd>
    );
}

function Code({ children }: { children: string }) {
    return (
        <code className="rounded-md bg-surface px-2 py-0.5 font-mono text-sm text-primary">
            {children}
        </code>
    );
}

function Video({ src }: { src: string }) {
    return (
        <img
            src={src}
            className="w-full rounded-xl border border-border bg-surface"
        />
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="border-t border-border pt-8">
            <h2 className="mb-3 text-base font-semibold tracking-tight text-primary">
                {title}
            </h2>
            <div className="space-y-3 text-sm leading-relaxed text-secondary">
                {children}
            </div>
        </div>
    );
}

export default function TutorialPage() {
    const navigate = useNavigate();
    const resetProject = useProjectStore((s) => s.resetProject);

    function handleTryIt() {
        resetProject();
        navigate("/edit");
    }

    return (
        <div className="flex h-full flex-col bg-bg">
            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-2xl space-y-8 px-6 py-10">
                    <button
                        onClick={() => navigate("/")}
                        className="flex items-center gap-2 text-sm text-secondary transition-colors hover:text-primary"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M10 3L5 8l5 5" />
                        </svg>
                        Back
                    </button>

                    <Section title="Bracket notation">
                        <p>
                            TreeStump uses labelled bracket notation. Each pair
                            of brackets contains a label followed by its
                            children:
                        </p>
                        <BracketSnippet>
                            [S [NP John][VP [V saw][NP Mary]]]
                        </BracketSnippet>
                        <Video src="/videos/1e_cropped.gif" />
                    </Section>

                    <Section title="Visual editor">
                        <p>
                            The visual editor provides a more intuitive way to
                            edit your trees. Just click a node's text to edit it
                            inline. Press <Key>↵</Key> to confirm or{" "}
                            <Key>Esc</Key> to cancel.
                        </p>
                        <Video src="/videos/2e_cropped.gif" />
                    </Section>

                    <Section title="Select and edit">
                        <p>
                            Hold <Key>{MOD}</Key> and click a node to select it
                            or drag to select multiple nodes at once. Press{" "}
                            <Key>⌫</Key> while nodes are selected to delete them
                            along with their subtrees.
                        </p>
                        <Video src="/videos/3e_cropped.gif" />
                    </Section>

                    <Section title="Rearrange">
                        <p>
                            Select a node and press <Key>{MOD}</Key>{" "}
                            <Key>←</Key> or <Key>{MOD}</Key> <Key>→</Key> to
                            swap it with its left or right sibling.
                        </p>
                        <Video src="/videos/4e_cropped.gif" />
                    </Section>

                    <Section title="Drag and drop">
                        <p>
                            Drag a node and drop it on or next to another node
                            to move it there as a child or sibling.
                        </p>
                        <Video src="/videos/5e_cropped.gif" />
                    </Section>

                    <Section title="Undo and redo">
                        <p>
                            Press <Key>{MOD}</Key> <Key>Z</Key> to undo any
                            change, and <Key>{MOD}</Key> <Key>⇧</Key>{" "}
                            <Key>Z</Key> to redo.
                        </p>
                        <Video src="/videos/6e_cropped.gif" />
                    </Section>

                    <Section title="Copy, cut, and paste">
                        <p>
                            Select a node and press <Key>{MOD}</Key>{" "}
                            <Key>C</Key> to copy its subtree, or{" "}
                            <Key>{MOD}</Key> <Key>X</Key> to cut it. Then select
                            another node and press <Key>{MOD}</Key> <Key>V</Key>{" "}
                            to paste it as a child of that node.
                        </p>
                    </Section>

                    <Section title="Triangles">
                        <p>
                            Multi-word terminal nodes automatically render with
                            triangles. Add <Code>~</Code> to a parent node to
                            force a triangle over a single word.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <BracketSnippet>
                                    [DP [D' [D the] [NP~ tree]]]
                                </BracketSnippet>
                                <img
                                    src="/images/triangles1.png"
                                    className="w-full rounded-xl border border-border bg-surface"
                                />
                            </div>
                            <div className="space-y-2">
                                <BracketSnippet>[DP the tree]</BracketSnippet>
                                <img
                                    src="/images/triangles2.png"
                                    className="w-full rounded-xl border border-border bg-surface"
                                />
                            </div>
                        </div>
                    </Section>

                    <Section title="Export">
                        <p>
                            Open the settings menu (top-left button) to export
                            your tree as a PNG or SVG, or save the full project
                            as a <Code>.treestump</Code> file you can re-open
                            later.
                        </p>
                    </Section>

                    <div className="border-t border-border pt-8 pb-2 text-center">
                        <button
                            onClick={handleTryIt}
                            className="rounded-xl bg-primary px-8 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-80 active:scale-[0.98]"
                        >
                            Start a new project
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
