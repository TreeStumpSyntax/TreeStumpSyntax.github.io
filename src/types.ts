export interface TreeNode {
  label: string;
  children: TreeNode[];
  sourceStart?: number;
  sourceEnd?: number;
  /** True for plain-text leaves (terminal words), false for bracketed nodes. */
  terminal?: boolean;
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

export interface ProjectState {
  projectName: string;
  bracketText: string;
  settings: Settings;
  canvas: CanvasState;
}
