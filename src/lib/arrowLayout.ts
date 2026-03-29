import type {
  ArrowDefinition,
  ArrowSettings,
  PositionedNode,
} from "../types";
import { DEFAULT_ARROW_SETTINGS, FONT_SIZE } from "../types";

export interface ArrowPath {
  /** Unique key for this arrow: "sourceLabel::targetLabel" */
  key: string;
  sourceLabel: string;
  targetLabel: string;
  sourcePt: { x: number; y: number };
  targetPt: { x: number; y: number };
  /** SVG path d attribute for the arrow line */
  path: string;
  /** SVG path d attribute for the arrowhead (null if style is "none") */
  arrowheadPath: string | null;
  /** Whether the arrowhead should be filled or stroked */
  arrowheadFilled: boolean;
  /** Resolved settings for this arrow */
  settings: ArrowSettings;
}

/** Build a map from node label to its positioned coordinates. */
function buildLabelPositionMap(
  root: PositionedNode,
): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  function visit(node: PositionedNode) {
    // First occurrence wins (no duplicates assumed)
    if (!map.has(node.label)) {
      map.set(node.label, { x: node.x, y: node.y });
    }
    for (const child of node.children) visit(child);
  }
  visit(root);
  return map;
}

/** Find the maximum Y value in the positioned tree. */
function findMaxY(root: PositionedNode): number {
  let maxY = root.y;
  function visit(node: PositionedNode) {
    maxY = Math.max(maxY, node.y);
    for (const child of node.children) visit(child);
  }
  visit(root);
  return maxY;
}

/** Find the minimum Y value in the positioned tree. */
function findMinY(root: PositionedNode): number {
  let minY = root.y;
  function visit(node: PositionedNode) {
    minY = Math.min(minY, node.y);
    for (const child of node.children) visit(child);
  }
  visit(root);
  return minY;
}

export function arrowKey(sourceLabel: string, targetLabel: string): string {
  return `${sourceLabel}::${targetLabel}`;
}

function computeArrowheadPath(
  tipX: number,
  tipY: number,
  fromX: number,
  fromY: number,
  style: "filled" | "open" | "none",
  size: number = 8,
): string | null {
  if (style === "none") return null;
  const angle = Math.atan2(tipY - fromY, tipX - fromX);
  const leftX = tipX - size * Math.cos(angle - Math.PI / 6);
  const leftY = tipY - size * Math.sin(angle - Math.PI / 6);
  const rightX = tipX - size * Math.cos(angle + Math.PI / 6);
  const rightY = tipY - size * Math.sin(angle + Math.PI / 6);
  if (style === "filled") {
    return `M${tipX},${tipY}L${leftX},${leftY}L${rightX},${rightY}Z`;
  }
  // open style
  return `M${leftX},${leftY}L${tipX},${tipY}L${rightX},${rightY}`;
}

const SLOT_SPACING = FONT_SIZE * 1.5;
const BASE_CLEARANCE = FONT_SIZE * 2;

export function computeArrowPaths(
  root: PositionedNode,
  arrows: ArrowDefinition[],
  arrowSettingsMap: Record<string, ArrowSettings>,
  defaultColor?: string,
): ArrowPath[] {
  if (arrows.length === 0) return [];

  const labelMap = buildLabelPositionMap(root);
  const maxY = findMaxY(root);
  const minY = findMinY(root);

  // Group arrows by routing direction and resolve settings
  const belowArrows: {
    arrow: ArrowDefinition;
    settings: ArrowSettings;
    span: number;
    srcPos: { x: number; y: number };
    tgtPos: { x: number; y: number };
  }[] = [];
  const aboveArrows: typeof belowArrows = [];

  for (const arrow of arrows) {
    const srcPos = labelMap.get(arrow.sourceLabel);
    const tgtPos = labelMap.get(arrow.targetLabel);
    if (!srcPos || !tgtPos) continue; // skip invalid (errors shown separately)

    const key = arrowKey(arrow.sourceLabel, arrow.targetLabel);
    const settings = {
      ...DEFAULT_ARROW_SETTINGS,
      ...(defaultColor != null ? { color: defaultColor } : {}),
      ...arrowSettingsMap[key],
    };
    const span = Math.abs(srcPos.x - tgtPos.x);
    const entry = { arrow, settings, span, srcPos, tgtPos };

    if (settings.routing === "above") {
      aboveArrows.push(entry);
    } else {
      belowArrows.push(entry);
    }
  }

  // Sort each group by span (widest first) for slot assignment
  belowArrows.sort((a, b) => b.span - a.span);
  aboveArrows.sort((a, b) => b.span - a.span);

  const results: ArrowPath[] = [];

  // Process below arrows
  for (let i = 0; i < belowArrows.length; i++) {
    const { arrow, settings, srcPos, tgtPos } = belowArrows[i];
    const key = arrowKey(arrow.sourceLabel, arrow.targetLabel);

    const srcY = srcPos.y + FONT_SIZE * 0.6;
    const tgtY = tgtPos.y + FONT_SIZE * 0.6;
    const clearanceY = maxY + BASE_CLEARANCE + i * SLOT_SPACING;

    let path: string;
    if (settings.curveStyle === "boxy") {
      path = boxyPath(srcPos.x, srcY, tgtPos.x, tgtY, clearanceY);
    } else {
      path = bezierPath(srcPos.x, srcY, tgtPos.x, tgtY, clearanceY);
    }

    // Arrowhead: compute direction of arrival at target
    const arrowheadFromY =
      settings.curveStyle === "boxy" ? clearanceY : clearanceY;
    const arrowheadPath = computeArrowheadPath(
      tgtPos.x,
      tgtY,
      tgtPos.x,
      arrowheadFromY,
      settings.arrowHeadStyle,
    );

    results.push({
      key,
      sourceLabel: arrow.sourceLabel,
      targetLabel: arrow.targetLabel,
      sourcePt: { x: srcPos.x, y: srcY },
      targetPt: { x: tgtPos.x, y: tgtY },
      path,
      arrowheadPath,
      arrowheadFilled: settings.arrowHeadStyle === "filled",
      settings,
    });
  }

  // Process above arrows
  for (let i = 0; i < aboveArrows.length; i++) {
    const { arrow, settings, srcPos, tgtPos } = aboveArrows[i];
    const key = arrowKey(arrow.sourceLabel, arrow.targetLabel);

    const srcY = srcPos.y - FONT_SIZE * 0.7;
    const tgtY = tgtPos.y - FONT_SIZE * 0.7;
    const clearanceY = minY - BASE_CLEARANCE - i * SLOT_SPACING;

    let path: string;
    if (settings.curveStyle === "boxy") {
      path = boxyPath(srcPos.x, srcY, tgtPos.x, tgtY, clearanceY);
    } else {
      path = bezierPath(srcPos.x, srcY, tgtPos.x, tgtY, clearanceY);
    }

    const arrowheadPath = computeArrowheadPath(
      tgtPos.x,
      tgtY,
      tgtPos.x,
      clearanceY,
      settings.arrowHeadStyle,
    );

    results.push({
      key,
      sourceLabel: arrow.sourceLabel,
      targetLabel: arrow.targetLabel,
      sourcePt: { x: srcPos.x, y: srcY },
      targetPt: { x: tgtPos.x, y: tgtY },
      path,
      arrowheadPath,
      arrowheadFilled: settings.arrowHeadStyle === "filled",
      settings,
    });
  }

  return results;
}

function bezierPath(
  srcX: number,
  srcY: number,
  tgtX: number,
  tgtY: number,
  clearanceY: number,
): string {
  return `M${srcX},${srcY} C${srcX},${clearanceY} ${tgtX},${clearanceY} ${tgtX},${tgtY}`;
}

function boxyPath(
  srcX: number,
  srcY: number,
  tgtX: number,
  tgtY: number,
  clearanceY: number,
): string {
  return [
    `M${srcX},${srcY}`,
    `L${srcX},${clearanceY}`,
    `L${tgtX},${clearanceY}`,
    `L${tgtX},${tgtY}`,
  ].join(" ");
}

/** Calculate the extra SVG height/padding needed for arrows. */
export function arrowExtraPadding(
  arrows: ArrowDefinition[],
  arrowSettingsMap: Record<string, ArrowSettings>,
): { below: number; above: number } {
  let belowCount = 0;
  let aboveCount = 0;

  for (const arrow of arrows) {
    const key = arrowKey(arrow.sourceLabel, arrow.targetLabel);
    const settings = { ...DEFAULT_ARROW_SETTINGS, ...arrowSettingsMap[key] };
    if (settings.routing === "above") {
      aboveCount++;
    } else {
      belowCount++;
    }
  }

  return {
    below:
      belowCount > 0
        ? BASE_CLEARANCE + belowCount * SLOT_SPACING
        : 0,
    above:
      aboveCount > 0
        ? BASE_CLEARANCE + aboveCount * SLOT_SPACING
        : 0,
  };
}
