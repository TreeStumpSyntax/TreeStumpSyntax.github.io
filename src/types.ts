export interface TreeNode {
  label: string;
  children: TreeNode[];
  sourceStart?: number;
  sourceEnd?: number;
  /** True for plain-text leaves (terminal words), false for bracketed nodes. */
  terminal?: boolean;
  /** Labels of nodes this node has arrows pointing to. */
  arrowTargets?: string[];
  /** Source position of the '->' token for this node's arrow syntax. */
  arrowSyntaxStart?: number;
  /** Source position just after the last arrow target character. */
  arrowSyntaxEnd?: number;
}

export interface PositionedNode {
  label: string;
  children: PositionedNode[];
  x: number;
  y: number;
  width: number;
  /** Whether this node should render as a triangle (collapsed leaf). */
  triangle: boolean;
  /** Subscript index if auto-subscript is enabled (e.g. 1 for NP₁). null if none. */
  subscript: number | null;
  sourceStart?: number;
  sourceEnd?: number;
  terminal?: boolean;
}

export type Alignment = "top" | "leaves-bottom" | "bottom";

export interface Settings {
  autoSubscript: boolean;
  triangles: boolean;
  terminalLines: boolean;
  coloring: boolean;
  nodeColor: string;
  leafColor: string;
  defaultArrowColor: string;
  alignment: Alignment;
  fontFamily: string;
  nodeSpacing: number;
  lineHeight: number;
}

export const FONT_SIZE = 16;
export const STROKE_WIDTH = 1.5;

export interface CanvasState {
  x: number;
  y: number;
  zoom: number;
}

export interface ArrowDefinition {
  sourceLabel: string;
  targetLabel: string;
}

export type ArrowLineStyle = "solid" | "dashed" | "dotted";
export type ArrowRouting = "below" | "above";
export type ArrowCurveStyle = "bezier" | "boxy";
export type ArrowHeadStyle = "filled" | "open" | "none";

export interface ArrowSettings {
  lineStyle: ArrowLineStyle;
  routing: ArrowRouting;
  curveStyle: ArrowCurveStyle;
  arrowHeadStyle: ArrowHeadStyle;
  color: string;
}

export const DEFAULT_ARROW_SETTINGS: ArrowSettings = {
  lineStyle: "solid",
  routing: "below",
  curveStyle: "bezier",
  arrowHeadStyle: "filled",
  color: "#1a1a1a",
};

export interface ProjectState {
  projectName: string;
  bracketText: string;
  settings: Settings;
  canvas: CanvasState;
  arrowSettings?: Record<string, ArrowSettings>;
}
