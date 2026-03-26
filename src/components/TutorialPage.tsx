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
                        <div className="rounded-xl border border-border bg-surface p-4 font-mono text-sm text-primary">
                            [S [NP John][VP [V saw][NP Mary]]]
                        </div>
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
                            swap it with its left or right sibling. When a
                            parent node is selected along with its children, the
                            whole subtree swaps together.
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
