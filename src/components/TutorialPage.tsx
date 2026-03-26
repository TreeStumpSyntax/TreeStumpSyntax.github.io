import { useNavigate } from "react-router";
import { useProjectStore } from "../stores/projectStore";

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

                    <Section title="Write bracket notation">
                        <p>
                            TreeStump reads{" "}
                            <strong className="font-medium text-primary">
                                labelled bracket notation
                            </strong>{" "}
                            — a standard format used in linguistics to describe
                            phrase structure trees.
                        </p>
                        <p>
                            Each pair of brackets contains a label followed by
                            its children:
                        </p>
                        <div className="rounded-xl border border-border bg-surface p-4 font-mono text-sm text-primary">
                            [S [NP John][VP [V saw][NP Mary]]]
                        </div>
                        <p>
                            Labels can be anything — <Code>NP</Code>,{" "}
                            <Code>V'</Code>, <Code>DP</Code>, etc. Words at the
                            end of a branch (terminals) don't need brackets:
                            just type the word inside the parent.
                        </p>
                        <p>
                            Brackets auto-pair as you type, and the bracket
                            editor at the bottom of the screen highlights
                            matching pairs by depth.
                        </p>
                    </Section>

                    <Section title="Select and edit nodes">
                        <p>
                            <strong className="font-medium text-primary">
                                Click
                            </strong>{" "}
                            any node on the tree to select it. Click again to
                            deselect. You can select multiple nodes at once —
                            click an empty area to clear the selection.
                        </p>
                        <p>
                            <strong className="font-medium text-primary">
                                Double-click
                            </strong>{" "}
                            a node to edit its label inline. Press <Key>↵</Key>{" "}
                            to confirm or <Key>Esc</Key> to cancel.
                        </p>
                        <p>
                            Hold <Key>{MOD}</Key> and drag on the canvas to
                            box-select a region of nodes at once.
                        </p>
                    </Section>

                    <Section title="Rearrange the tree">
                        <p>
                            <strong className="font-medium text-primary">
                                Drag
                            </strong>{" "}
                            any node and drop it onto another node to move it
                            there as a child.
                        </p>
                        <p>
                            Select a node and press <Key>{MOD}</Key>{" "}
                            <Key>←</Key> or <Key>{MOD}</Key> <Key>→</Key> to
                            swap it with its left or right sibling. When a
                            parent node is selected along with its children, the
                            whole subtree swaps together.
                        </p>
                        <p>
                            Select one or more nodes and press <Key>⌫</Key> to
                            delete them along with their subtrees.
                        </p>
                    </Section>

                    <Section title="Copy, cut, and paste">
                        <p>
                            Select a node and press <Key>{MOD}</Key>{" "}
                            <Key>C</Key> to copy its subtree, or{" "}
                            <Key>{MOD}</Key> <Key>X</Key> to cut it. Then select
                            any other node and press <Key>{MOD}</Key>{" "}
                            <Key>V</Key> to paste it as a child of that node.
                        </p>
                    </Section>

                    <Section title="Export your tree">
                        <p>
                            Open the{" "}
                            <strong className="font-medium text-primary">
                                settings menu
                            </strong>{" "}
                            (top-left button) to export your tree as a PNG or
                            SVG, or save the full project as a{" "}
                            <Code>.treestump</Code> file you can re-open later.
                        </p>
                        <p>
                            You can also use keyboard shortcuts:{" "}
                            <Key>{MOD}</Key> <Key>⇧</Key> <Key>S</Key> for PNG,{" "}
                            <Key>{MOD}</Key> <Key>⇧</Key> <Key>E</Key> for SVG,
                            and <Key>{MOD}</Key> <Key>S</Key> to save the
                            project file.
                        </p>
                        <p>
                            Give your project a name in the settings menu — that
                            name will be used as the filename when you export.
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
