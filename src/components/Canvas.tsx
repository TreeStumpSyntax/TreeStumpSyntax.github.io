import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
    type PointerEvent as ReactPointerEvent,
    type WheelEvent as ReactWheelEvent,
} from "react";
import { useProjectStore } from "../stores/projectStore";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_SENSITIVITY = 0.001;
const CLICK_THRESHOLD = 4;

interface CanvasProps {
    children?: ReactNode;
}

interface SelectionBox {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

function fitContentToViewport(
    container: HTMLElement,
    content: HTMLElement,
    setCanvas: (canvas: { x: number; y: number; zoom: number }) => void,
) {
    const viewport = container.getBoundingClientRect();
    const svg = content.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const svgWidth = svg.width.baseVal.value;
    const svgHeight = svg.height.baseVal.value;
    if (svgWidth === 0 || svgHeight === 0) return;

    const PADDING_X = 60;
    const PADDING_TOP = 60;
    const PADDING_BOTTOM = 160;

    const availableWidth = viewport.width - PADDING_X * 2;
    const availableHeight = viewport.height - PADDING_TOP - PADDING_BOTTOM;

    const zoom = Math.max(
        MIN_ZOOM,
        Math.min(availableWidth / svgWidth, availableHeight / svgHeight, 2.0),
    );

    const scaledWidth = svgWidth * zoom;
    const scaledHeight = svgHeight * zoom;

    const x = (viewport.width - scaledWidth) / 2;
    const y = PADDING_TOP + (availableHeight - scaledHeight) / 2;

    setCanvas({ x, y, zoom });
}

export default function Canvas({ children }: CanvasProps) {
    const canvas = useProjectStore((s) => s.canvas);
    const setCanvas = useProjectStore((s) => s.setCanvas);
    const pendingFit = useProjectStore((s) => s.pendingFit);
    const clearPendingFit = useProjectStore((s) => s.clearPendingFit);
    const selectNodesInRect = useProjectStore((s) => s.selectNodesInRect);
    const clearSelection = useProjectStore((s) => s.clearSelection);
    const autoFit = useProjectStore((s) => s.autoFit);
    const bracketText = useProjectStore((s) => s.bracketText);

    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const isPanning = useRef(false);
    const isSelecting = useRef(false);
    const lastPointer = useRef({ x: 0, y: 0 });
    const pointerDownPos = useRef({ x: 0, y: 0 });
    const selBoxRef = useRef<SelectionBox | null>(null);
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    const [ready, setReady] = useState(false);

    useLayoutEffect(() => {
        const { canvas: c, pendingFit: pf } = useProjectStore.getState();
        if (!pf && (c.x !== 0 || c.y !== 0 || c.zoom !== 1)) {
            setReady(true);
        }
    }, []);

    useEffect(() => {
        if (!pendingFit) return;
        clearPendingFit();
        setReady(false);

        const el = containerRef.current;
        const content = contentRef.current;
        if (!el || !content) return;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                fitContentToViewport(el, content, setCanvas);
                setReady(true);
            });
        });
    }, [pendingFit, clearPendingFit, setCanvas]);

    useEffect(() => {
        const el = containerRef.current;
        const content = contentRef.current;
        if (!el || !content) return;

        const { canvas: c } = useProjectStore.getState();
        if (c.x !== 0 || c.y !== 0 || c.zoom !== 1) return;

        requestAnimationFrame(() => {
            fitContentToViewport(el, content, setCanvas);
            setReady(true);
        });
    }, [setCanvas]);

    useEffect(() => {
        if (!autoFit) return;
        const el = containerRef.current;
        const content = contentRef.current;
        if (!el || !content) return;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                fitContentToViewport(el, content, setCanvas);
            });
        });
    }, [autoFit, bracketText, setCanvas]);

    const handlePointerDown = useCallback((e: ReactPointerEvent) => {
        if (e.button !== 0) return;
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

        if (e.metaKey || e.ctrlKey) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            isSelecting.current = true;
            const box: SelectionBox = {
                startX: x,
                startY: y,
                endX: x,
                endY: y,
            };
            selBoxRef.current = box;
            setSelectionBox(box);
        } else {
            isPanning.current = true;
            lastPointer.current = { x: e.clientX, y: e.clientY };
        }
    }, []);

    const handlePointerMove = useCallback(
        (e: ReactPointerEvent) => {
            if (isSelecting.current) {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const prev = selBoxRef.current;
                if (!prev) return;
                const box: SelectionBox = { ...prev, endX: x, endY: y };
                selBoxRef.current = box;
                setSelectionBox(box);
                return;
            }
            if (!isPanning.current) return;
            const dx = e.clientX - lastPointer.current.x;
            const dy = e.clientY - lastPointer.current.y;
            lastPointer.current = { x: e.clientX, y: e.clientY };
            const current = useProjectStore.getState().canvas;
            setCanvas({
                ...current,
                x: current.x + dx,
                y: current.y + dy,
            });
        },
        [setCanvas],
    );

    const handlePointerUp = useCallback(
        (e: ReactPointerEvent) => {
            if (isSelecting.current) {
                isSelecting.current = false;
                const box = selBoxRef.current;
                selBoxRef.current = null;
                setSelectionBox(null);

                if (box) {
                    const dx = Math.abs(box.endX - box.startX);
                    const dy = Math.abs(box.endY - box.startY);
                    if (dx >= CLICK_THRESHOLD || dy >= CLICK_THRESHOLD) {
                        const {
                            x: cx,
                            y: cy,
                            zoom,
                        } = useProjectStore.getState().canvas;
                        const left = Math.min(box.startX, box.endX);
                        const top = Math.min(box.startY, box.endY);
                        const right = Math.max(box.startX, box.endX);
                        const bottom = Math.max(box.startY, box.endY);
                        selectNodesInRect({
                            left: (left - cx) / zoom,
                            top: (top - cy) / zoom,
                            right: (right - cx) / zoom,
                            bottom: (bottom - cy) / zoom,
                        });
                    }
                }
                return;
            }

            isPanning.current = false;

            const dx = Math.abs(e.clientX - pointerDownPos.current.x);
            const dy = Math.abs(e.clientY - pointerDownPos.current.y);
            if (dx < CLICK_THRESHOLD && dy < CLICK_THRESHOLD) {
                clearSelection();
            }
        },
        [selectNodesInRect, clearSelection],
    );

    const handleWheel = useCallback(
        (e: ReactWheelEvent) => {
            e.preventDefault();
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;

            const current = useProjectStore.getState().canvas;
            const pointerX = e.clientX - rect.left;
            const pointerY = e.clientY - rect.top;

            const delta = -e.deltaY * ZOOM_SENSITIVITY;
            const newZoom = Math.min(
                MAX_ZOOM,
                Math.max(MIN_ZOOM, current.zoom * (1 + delta)),
            );
            const scale = newZoom / current.zoom;

            setCanvas({
                x: pointerX - scale * (pointerX - current.x),
                y: pointerY - scale * (pointerY - current.y),
                zoom: newZoom,
            });
        },
        [setCanvas],
    );

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const prevent = (e: Event) => e.preventDefault();
        el.addEventListener("wheel", prevent, { passive: false });
        return () => el.removeEventListener("wheel", prevent);
    }, []);

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 cursor-grab select-none overflow-hidden active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            style={{
                backgroundImage:
                    "radial-gradient(circle, var(--color-grey-dark) 1px, transparent 1px)",
                backgroundSize: `${24 * canvas.zoom}px ${24 * canvas.zoom}px`,
                backgroundPosition: `${canvas.x}px ${canvas.y}px`,
            }}
        >
            <div
                ref={contentRef}
                style={{
                    transform: `translate(${canvas.x}px, ${canvas.y}px) scale(${canvas.zoom})`,
                    transformOrigin: "0 0",
                    opacity: ready ? 1 : 0,
                    transition: ready ? "opacity 0.2s ease-out" : "none",
                }}
            >
                {children}
            </div>
            {selectionBox && (
                <div
                    style={{
                        position: "absolute",
                        left: Math.min(selectionBox.startX, selectionBox.endX),
                        top: Math.min(selectionBox.startY, selectionBox.endY),
                        width: Math.abs(
                            selectionBox.endX - selectionBox.startX,
                        ),
                        height: Math.abs(
                            selectionBox.endY - selectionBox.startY,
                        ),
                        backgroundColor: "rgba(37, 99, 235, 0.08)",
                        border: "1.5px solid rgba(37, 99, 235, 0.4)",
                        borderRadius: "3px",
                        pointerEvents: "none",
                    }}
                />
            )}
        </div>
    );
}
