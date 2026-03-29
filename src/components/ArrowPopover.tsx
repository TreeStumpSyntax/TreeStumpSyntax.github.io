import { useEffect, useRef } from "react";
import { useProjectStore } from "../stores/projectStore";
import type {
    ArrowCurveStyle,
    ArrowHeadStyle,
    ArrowLineStyle,
    ArrowRouting,
} from "../types";
import { DEFAULT_ARROW_SETTINGS } from "../types";


function SelectField({
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
        <label className="flex items-center justify-between py-1.5">
            <span className="text-xs">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="rounded-md border border-border bg-bg px-1.5 py-0.5 text-xs outline-none"
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

function ColorField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    const hex = value.replace(/^#/, "");
    // Display the value directly — if it's invalid mid-edit, the swatch just won't update
    const displayColor = /^[0-9a-fA-F]{6}$/.test(hex) ? value : "#000000";

    return (
        <div className="flex items-center justify-between py-1.5">
            <span className="text-xs">{label}</span>
            <div className="flex items-center gap-1.5">
                <span
                    className="inline-block h-4 w-4 rounded border border-border"
                    style={{ backgroundColor: displayColor }}
                />
                <div className="flex items-center rounded-md border border-border bg-bg px-1.5">
                    <span className="pointer-events-none select-none font-mono text-[10px] text-primary">
                        #
                    </span>
                    <input
                        type="text"
                        value={hex}
                        onChange={(e) => {
                            const v = e.target.value;
                            if (/^[0-9a-fA-F]{0,6}$/.test(v))
                                onChange("#" + v);
                        }}
                        onBlur={() => {
                            if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
                                onChange("#1a1a1a");
                            }
                        }}
                        className="w-[6ch] bg-transparent py-0.5 font-mono text-[10px] outline-none"
                    />
                </div>
            </div>
        </div>
    );
}

export default function ArrowPopover() {
    const popover = useProjectStore((s) => s.arrowPopover);
    const arrowSettings = useProjectStore((s) => s.arrowSettings);
    const defaultArrowColor = useProjectStore((s) => s.settings.defaultArrowColor);
    const updateArrowSettings = useProjectStore((s) => s.updateArrowSettings);
    const setArrowPopover = useProjectStore((s) => s.setArrowPopover);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!popover) return;
        const handler = (e: PointerEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setArrowPopover(null);
            }
        };
        // Delay to avoid the same click that opened the popover from closing it
        const timer = setTimeout(
            () => window.addEventListener("pointerdown", handler),
            0,
        );
        return () => {
            clearTimeout(timer);
            window.removeEventListener("pointerdown", handler);
        };
    }, [popover, setArrowPopover]);

    useEffect(() => {
        if (!popover) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                setArrowPopover(null);
            }
        };
        window.addEventListener("keydown", handler, true);
        return () => window.removeEventListener("keydown", handler, true);
    }, [popover, setArrowPopover]);

    if (!popover) return null;

    const defaults = { ...DEFAULT_ARROW_SETTINGS, color: defaultArrowColor };
    const current = { ...defaults, ...arrowSettings[popover.key] };

    // Clamp position to viewport
    const popoverWidth = 220;
    const popoverHeight = 260;
    const x = Math.min(popover.x, window.innerWidth - popoverWidth - 12);
    const y = Math.min(popover.y, window.innerHeight - popoverHeight - 12);

    const [sourceLabel, targetLabel] = popover.key.split("::");

    return (
        <div
            ref={ref}
            className="fixed z-50 rounded-xl border border-border bg-bg shadow-lg"
            style={{
                left: x,
                top: y,
                width: popoverWidth,
            }}
        >
            <div className="border-b border-border px-3 py-2">
                <div className="truncate text-xs font-medium">
                    {sourceLabel} &rarr; {targetLabel}
                </div>
            </div>
            <div className="px-3 py-1">
                <SelectField
                    label="Line style"
                    value={current.lineStyle}
                    options={[
                        { value: "solid", label: "Solid" },
                        { value: "dashed", label: "Dashed" },
                        { value: "dotted", label: "Dotted" },
                    ]}
                    onChange={(v) =>
                        updateArrowSettings(
                            popover.key,
                            { lineStyle: v as ArrowLineStyle },
                            false,
                        )
                    }
                />
                <SelectField
                    label="Routing"
                    value={current.routing}
                    options={[
                        { value: "below", label: "Below tree" },
                        { value: "above", label: "Above tree" },
                    ]}
                    onChange={(v) =>
                        updateArrowSettings(
                            popover.key,
                            { routing: v as ArrowRouting },
                            false,
                        )
                    }
                />
                <SelectField
                    label="Curve style"
                    value={current.curveStyle}
                    options={[
                        { value: "bezier", label: "Bezier" },
                        { value: "boxy", label: "Boxy" },
                    ]}
                    onChange={(v) =>
                        updateArrowSettings(
                            popover.key,
                            { curveStyle: v as ArrowCurveStyle },
                            false,
                        )
                    }
                />
                <SelectField
                    label="Arrowhead"
                    value={current.arrowHeadStyle}
                    options={[
                        { value: "filled", label: "Filled" },
                        { value: "open", label: "Open" },
                        { value: "none", label: "None" },
                    ]}
                    onChange={(v) =>
                        updateArrowSettings(
                            popover.key,
                            { arrowHeadStyle: v as ArrowHeadStyle },
                            false,
                        )
                    }
                />
                <ColorField
                    label="Color"
                    value={current.color}
                    onChange={(v) =>
                        updateArrowSettings(popover.key, { color: v }, true)
                    }
                />
            </div>
        </div>
    );
}
