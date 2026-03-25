import { useCallback, useEffect, useState } from "react";
import { exportPng, exportProject, exportSvg } from "../lib/export";
import { findHighestSelectedNode } from "../lib/treeOperations";
import { useProjectStore } from "../stores/projectStore";
import BracketEditor from "./BracketEditor";
import Canvas from "./Canvas";
import HamburgerMenu from "./HamburgerMenu";
import TreeView from "./TreeView";

export default function EditorPage() {
    const [menuOpen, setMenuOpen] = useState(false);
    const projectName = useProjectStore((s) => s.projectName);
    const bracketText = useProjectStore((s) => s.bracketText);
    const settings = useProjectStore((s) => s.settings);
    const canvas = useProjectStore((s) => s.canvas);

    const undo = useProjectStore((s) => s.undo);
    const redo = useProjectStore((s) => s.redo);
    const selectedNodes = useProjectStore((s) => s.selectedNodes);
    const clearSelection = useProjectStore((s) => s.clearSelection);
    const deleteSelectedNodes = useProjectStore((s) => s.deleteSelectedNodes);
    const copySelectedNodes = useProjectStore((s) => s.copySelectedNodes);
    const pasteAsChild = useProjectStore((s) => s.pasteAsChild);
    const swapSibling = useProjectStore((s) => s.swapSibling);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;
            const key = e.key.toLowerCase();
            const tag = (e.target as HTMLElement)?.tagName;
            const inTextInput = tag === "INPUT" || tag === "TEXTAREA";

            if (mod && !e.shiftKey && key === "z") {
                e.preventDefault();
                undo();
            } else if (mod && e.shiftKey && key === "z") {
                e.preventDefault();
                redo();
            } else if (mod && e.shiftKey && key === "e") {
                e.preventDefault();
                exportSvg(projectName);
            } else if (mod && e.shiftKey && key === "s") {
                e.preventDefault();
                exportPng(projectName);
            } else if (mod && !e.shiftKey && key === "s") {
                e.preventDefault();
                exportProject({ projectName, bracketText, settings, canvas });
            } else if (
                mod &&
                !e.shiftKey &&
                key === "c" &&
                !inTextInput &&
                selectedNodes.size > 0
            ) {
                e.preventDefault();
                const text = copySelectedNodes();
                if (text) navigator.clipboard.writeText(text).catch(() => {});
            } else if (
                mod &&
                !e.shiftKey &&
                key === "x" &&
                !inTextInput &&
                selectedNodes.size > 0
            ) {
                e.preventDefault();
                const text = copySelectedNodes();
                if (text) navigator.clipboard.writeText(text).catch(() => {});
                deleteSelectedNodes();
            } else if (mod && !e.shiftKey && key === "v" && !inTextInput) {
                e.preventDefault();
                pasteAsChild();
            } else if (
                mod &&
                !e.shiftKey &&
                (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
                !inTextInput
            ) {
                e.preventDefault();
                if (selectedNodes.size >= 1) {
                    const ss = findHighestSelectedNode(bracketText, selectedNodes);
                    if (ss != null) {
                        swapSibling(ss, e.key === "ArrowLeft" ? "left" : "right");
                    }
                }
            } else if (e.key === "Escape") {
                if (selectedNodes.size > 0) {
                    clearSelection();
                } else {
                    setMenuOpen(false);
                }
            } else if (
                (e.key === "Delete" || e.key === "Backspace") &&
                selectedNodes.size > 0 &&
                !inTextInput
            ) {
                e.preventDefault();
                deleteSelectedNodes();
            }
        },
        [
            projectName,
            bracketText,
            settings,
            canvas,
            undo,
            redo,
            selectedNodes,
            clearSelection,
            deleteSelectedNodes,
            copySelectedNodes,
            pasteAsChild,
            swapSibling,
        ],
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    return (
        <div className="relative h-full w-full overflow-hidden bg-bg">
            <Canvas>
                <TreeView />
            </Canvas>

            <BracketEditor />
            <HamburgerMenu
                open={menuOpen}
                onToggle={() => setMenuOpen((o) => !o)}
                onClose={() => setMenuOpen(false)}
            />
        </div>
    );
}
