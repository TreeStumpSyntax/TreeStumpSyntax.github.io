import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { exportPng, exportProject, exportSvg } from "../lib/export";
import { useProjectStore } from "../stores/projectStore";
import type { Alignment } from "../types";

interface HamburgerMenuProps {
    open: boolean;
    onToggle: () => void;
    onClose: () => void;
}

function Toggle({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between py-2">
            <span className="text-sm">{label}</span>
            <button
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                    checked ? "bg-primary" : "bg-grey-dark"
                }`}
            >
                <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-bg transition-transform ${
                        checked ? "translate-x-4" : ""
                    }`}
                />
            </button>
        </div>
    );
}

function SliderSetting({
    label,
    value,
    min,
    max,
    step,
    onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
}) {
    const displayValue = Math.round(((value - min) / (max - min)) * 100);
    const [draft, setDraft] = useState<string | null>(null);

    function applyDisplayValue(raw: string) {
        const n = parseInt(raw, 10);
        if (isNaN(n)) return;
        const clamped = Math.max(0, Math.min(100, n));
        const actual = min + (clamped / 100) * (max - min);
        const stepped = Math.round(actual / step) * step;
        onChange(Math.max(min, Math.min(max, stepped)));
    }

    return (
        <label className="flex flex-col gap-1 py-2">
            <div className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <input
                    type="text"
                    inputMode="numeric"
                    value={draft ?? String(displayValue)}
                    onFocus={() => setDraft(String(displayValue))}
                    onChange={(e) => {
                        const v = e.target.value;
                        if (/^\d{0,3}$/.test(v)) {
                            if (v !== "" && parseInt(v, 10) > 100) {
                                setDraft("100");
                                applyDisplayValue("100");
                            } else {
                                setDraft(v);
                                if (v !== "") applyDisplayValue(v);
                            }
                        }
                    }}
                    onBlur={() => setDraft(null)}
                    className="w-[3.5ch] bg-transparent text-right font-mono text-xs text-secondary outline-none"
                />
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="accent-primary"
            />
        </label>
    );
}

function ColorSetting({
    label,
    value,
    disabled,
    onChange,
}: {
    label: string;
    value: string;
    disabled?: boolean;
    onChange: (v: string) => void;
}) {
    const lastValidRef = useRef(value);
    const hex = value.replace(/^#/, "");

    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
        lastValidRef.current = value;
    }

    return (
        <div
            className={`flex items-center justify-between py-2 ${disabled ? "pointer-events-none opacity-40" : ""}`}
        >
            <span className="text-sm">{label}</span>
            <div className="flex items-center gap-2">
                <span
                    className="inline-block h-5 w-5 rounded-md border border-border"
                    style={{ backgroundColor: lastValidRef.current }}
                />
                <div className="flex items-center rounded-lg border border-border bg-bg px-2.5">
                    <span className="pointer-events-none select-none font-mono text-xs text-primary">
                        #
                    </span>
                    <input
                        type="text"
                        value={hex}
                        onChange={(e) => {
                            const v = e.target.value;
                            if (/^[0-9a-fA-F]{0,6}$/.test(v)) onChange("#" + v);
                        }}
                        onBlur={() => {
                            if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
                                onChange(lastValidRef.current);
                            }
                        }}
                        className="w-[6ch] bg-transparent py-1 font-mono text-xs outline-none"
                    />
                </div>
            </div>
        </div>
    );
}

function SelectSetting({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
}) {
    return (
        <label className="flex items-center justify-between py-2">
            <span className="text-sm">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="rounded-lg border border-border bg-bg px-2 py-1 text-sm outline-none"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function ShortcutRow({ label, keys }: { label: string; keys: string[] }) {
    return (
        <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-secondary">{label}</span>
            <div className="flex items-center gap-1">
                {keys.map((key, i) => (
                    <kbd
                        key={i}
                        className="inline-flex min-w-[20px] items-center justify-center rounded-md border border-border bg-bg px-1.5 py-0.5 font-mono text-[11px] text-secondary shadow-[0_1px_0_0_rgba(0,0,0,0.06)]"
                    >
                        {key}
                    </kbd>
                ))}
            </div>
        </div>
    );
}

const SIDEBAR_WIDTH = 320;
const sidebarSpring = { type: "spring" as const, stiffness: 400, damping: 35 };

const IS_MAC =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const MOD = IS_MAC ? "⌘" : "Ctrl";
const SHIFT = IS_MAC ? "⇧" : "Shift";
const DEL = IS_MAC ? "⌫" : "Del";

const SHORTCUTS: { label: string; keys: string[] }[] = [
    { label: "Undo", keys: [MOD, "Z"] },
    { label: "Redo", keys: [MOD, SHIFT, "Z"] },
    { label: "Select node", keys: ["Click"] },
    { label: "Box select", keys: [MOD, "Drag"] },
    { label: "Delete selected", keys: [DEL] },
    { label: "Copy", keys: [MOD, "C"] },
    { label: "Cut", keys: [MOD, "X"] },
    { label: "Paste as child", keys: [MOD, "V"] },
    { label: "Move node", keys: [MOD, "← / →"] },
    { label: "Confirm edit", keys: ["↵"] },
    { label: "Cancel / Deselect", keys: ["Esc"] },
    { label: "Export project", keys: [MOD, "S"] },
    { label: "Download PNG", keys: [MOD, SHIFT, "S"] },
    { label: "Download SVG", keys: [MOD, SHIFT, "E"] },
];

export default function HamburgerMenu({
    open,
    onToggle,
    onClose,
}: HamburgerMenuProps) {
    const navigate = useNavigate();
    const projectName = useProjectStore((s) => s.projectName);
    const setProjectName = useProjectStore((s) => s.setProjectName);
    const settings = useProjectStore((s) => s.settings);
    const updateSettings = useProjectStore((s) => s.updateSettings);
    const resetSettings = useProjectStore((s) => s.resetSettings);
    const autoFit = useProjectStore((s) => s.autoFit);
    const setAutoFit = useProjectStore((s) => s.setAutoFit);
    const fitView = useProjectStore((s) => s.fitView);
    const loadProject = useProjectStore((s) => s.loadProject);
    const bracketText = useProjectStore((s) => s.bracketText);
    const canvas = useProjectStore((s) => s.canvas);
    const fileInputRef = useRef<HTMLInputElement>(null);

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result as string);
                if (data.bracketText) {
                    if (!data.projectName) {
                        data.projectName = file.name.replace(/\.[^.]+$/, "");
                    }
                    loadProject(data);
                }
            } catch {
                // invalid file
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    }

    return (
        <>
            <motion.button
                onClick={onToggle}
                className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface/90 text-primary backdrop-blur-md"
                style={{
                    boxShadow:
                        "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.04)",
                }}
                initial={false}
                animate={{
                    opacity: open ? 0 : 1,
                    pointerEvents: open ? "none" : "auto",
                }}
                transition={{ duration: 0.15 }}
                tabIndex={open ? -1 : 0}
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                >
                    <path d="M3 5h12M3 9h12M3 13h12" />
                </svg>
            </motion.button>

            <AnimatePresence>
                {open && (
                    <>
                        <motion.aside
                            key="sidebar"
                            className="fixed top-0 bottom-0 left-0 z-50 flex w-[320px] flex-col border-r border-border bg-surface/90 backdrop-blur-md"
                            initial={{ x: -SIDEBAR_WIDTH }}
                            animate={{ x: 0 }}
                            exit={{ x: -SIDEBAR_WIDTH }}
                            transition={sidebarSpring}
                            style={{
                                boxShadow: "4px 0 24px -4px rgba(0,0,0,0.08)",
                            }}
                        >
                            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                                <h2 className="text-sm font-semibold tracking-tight">
                                    Settings
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-secondary hover:text-primary"
                                >
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 14 14"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                    >
                                        <path d="M1 1l12 12M13 1L1 13" />
                                    </svg>
                                </button>
                            </div>

                            <div className="scrollbar-none flex-1 overflow-y-auto px-5 pt-4 pb-6">
                                <div className="pb-4 border-b border-border">
                                    <label className="flex flex-col gap-1.5">
                                        <span className="font-mono text-xs tracking-wide text-secondary uppercase">
                                            Project name
                                        </span>
                                        <input
                                            type="text"
                                            value={projectName}
                                            onChange={(e) =>
                                                setProjectName(e.target.value)
                                            }
                                            placeholder="Untitled"
                                            className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm outline-none focus:border-primary"
                                        />
                                    </label>
                                </div>
                                <p className="mt-4 mb-1 font-mono text-xs tracking-wide text-secondary uppercase">
                                    Display
                                </p>
                                <Toggle
                                    label="Auto subscript"
                                    checked={settings.autoSubscript}
                                    onChange={(v) =>
                                        updateSettings({ autoSubscript: v })
                                    }
                                />
                                <Toggle
                                    label="Triangles"
                                    checked={settings.triangles}
                                    onChange={(v) =>
                                        updateSettings({ triangles: v })
                                    }
                                />
                                <Toggle
                                    label="Terminal lines"
                                    checked={settings.terminalLines}
                                    onChange={(v) =>
                                        updateSettings({ terminalLines: v })
                                    }
                                />
                                <Toggle
                                    label="Coloring"
                                    checked={settings.coloring}
                                    onChange={(v) =>
                                        updateSettings({ coloring: v })
                                    }
                                />
                                <ColorSetting
                                    label="Node color"
                                    value={settings.nodeColor}
                                    disabled={!settings.coloring}
                                    onChange={(v) =>
                                        updateSettings({ nodeColor: v }, true)
                                    }
                                />
                                <ColorSetting
                                    label="Leaf color"
                                    value={settings.leafColor}
                                    disabled={!settings.coloring}
                                    onChange={(v) =>
                                        updateSettings({ leafColor: v }, true)
                                    }
                                />

                                <div className="mt-4 border-t border-border pt-3">
                                    <p className="mb-1 font-mono text-xs tracking-wide text-secondary uppercase">
                                        Layout
                                    </p>
                                    <SelectSetting
                                        label="Alignment"
                                        value={settings.alignment}
                                        options={[
                                            {
                                                value: "top",
                                                label: "Align top",
                                            },
                                            {
                                                value: "leaves-bottom",
                                                label: "Leaves at bottom",
                                            },
                                            {
                                                value: "bottom",
                                                label: "Nodes at bottom",
                                            },
                                        ]}
                                        onChange={(v) =>
                                            updateSettings({
                                                alignment: v as Alignment,
                                            })
                                        }
                                    />
                                    <SelectSetting
                                        label="Font"
                                        value={settings.fontFamily}
                                        options={[
                                            {
                                                value: "Geist",
                                                label: "Sans-serif",
                                            },
                                            {
                                                value: "Geist Mono",
                                                label: "Monospace",
                                            },
                                            { value: "serif", label: "Serif" },
                                        ]}
                                        onChange={(v) =>
                                            updateSettings({ fontFamily: v })
                                        }
                                    />
                                    <SliderSetting
                                        label="Width"
                                        value={settings.nodeSpacing}
                                        min={0}
                                        max={50}
                                        step={0.5}
                                        onChange={(v) =>
                                            updateSettings(
                                                { nodeSpacing: v },
                                                true,
                                            )
                                        }
                                    />
                                    <SliderSetting
                                        label="Height"
                                        value={settings.lineHeight}
                                        min={30}
                                        max={130}
                                        step={1}
                                        onChange={(v) =>
                                            updateSettings(
                                                { lineHeight: v },
                                                true,
                                            )
                                        }
                                    />
                                    <button
                                        onClick={resetSettings}
                                        className="mt-4 text-xs text-secondary transition-colors hover:text-primary"
                                    >
                                        Reset to defaults
                                    </button>
                                </div>

                                <div className="mt-4 border-t border-border pt-3">
                                    <p className="mb-3 font-mono text-xs tracking-wide text-secondary uppercase">
                                        View
                                    </p>
                                    <button
                                        onClick={fitView}
                                        className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-secondary active:scale-[0.98]"
                                    >
                                        Fit to view
                                    </button>
                                    <div className="mt-1">
                                        <Toggle
                                            label="Auto-fit"
                                            checked={autoFit}
                                            onChange={setAutoFit}
                                        />
                                    </div>
                                </div>

                                <div className="mt-4 border-t border-border pt-3">
                                    <p className="mb-3 font-mono text-xs tracking-wide text-secondary uppercase">
                                        Export
                                    </p>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() =>
                                                exportPng(projectName)
                                            }
                                            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-secondary active:scale-[0.98]"
                                        >
                                            Download PNG
                                        </button>
                                        <button
                                            onClick={() =>
                                                exportSvg(projectName)
                                            }
                                            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-secondary active:scale-[0.98]"
                                        >
                                            Download SVG
                                        </button>
                                        <button
                                            onClick={() =>
                                                exportProject({
                                                    projectName,
                                                    bracketText,
                                                    settings,
                                                    canvas,
                                                })
                                            }
                                            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-secondary active:scale-[0.98]"
                                        >
                                            Export Project
                                        </button>
                                        <button
                                            onClick={() =>
                                                fileInputRef.current?.click()
                                            }
                                            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-secondary active:scale-[0.98]"
                                        >
                                            Import Project
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".treestump,.json"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                    </div>
                                </div>

                                <div className="mt-4 border-t border-border pt-3">
                                    <p className="mb-1 font-mono text-xs tracking-wide text-secondary uppercase">
                                        Keyboard shortcuts
                                    </p>
                                    {SHORTCUTS.map((s) => (
                                        <ShortcutRow
                                            key={s.label}
                                            label={s.label}
                                            keys={s.keys}
                                        />
                                    ))}
                                </div>

                                <div className="mt-4 border-t border-border pt-3 pb-2">
                                    <button
                                        onClick={() => {
                                            onClose();
                                            navigate("/");
                                        }}
                                        className="flex items-center gap-2 py-2 text-sm text-secondary transition-colors hover:text-primary"
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
                                        Back to Home
                                    </button>
                                </div>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
