import type { TreeNode, PositionedNode, Settings } from "../types";
import { FONT_SIZE } from "../types";

function measureText(text: string): number {
  return text.length * FONT_SIZE * 0.6 + FONT_SIZE;
}

/**
 * Bottom-up pass: compute the horizontal space each subtree needs.
 * A node's width = max(label width + spacing, sum of children widths).
 * This guarantees a parent is never narrower than its children combined,
 * and siblings never share horizontal space.
 */
function computeWidths(
  node: TreeNode,
  settings: Settings,
  widths: Map<TreeNode, number>,
): number {
  const labelWidth = measureText(node.label) + settings.nodeSpacing;

  if (node.children.length === 0) {
    widths.set(node, labelWidth);
    return labelWidth;
  }

  let childrenTotal = 0;
  for (const child of node.children) {
    childrenTotal += computeWidths(child, settings, widths);
  }

  const width = Math.max(labelWidth, childrenTotal);
  widths.set(node, width);
  return width;
}

/**
 * Top-down pass: position every node within its allocated horizontal span.
 * Children fill their parent's span left-to-right, scaled up proportionally
 * when the parent's label is wider than the combined children.
 */
function positionNodes(
  node: TreeNode,
  depth: number,
  left: number,
  allocated: number,
  settings: Settings,
  siblingIndex: number,
  subscriptMap: Map<string, number[]> | null,
  widths: Map<TreeNode, number>,
): PositionedNode {
  const isLeaf = node.children.length === 0;
  const isTriangle =
    settings.triangles &&
    !isLeaf &&
    node.children.length === 1 &&
    node.children[0].children.length === 0 &&
    (node.children[0].label.includes(" ") || node.forceTriangle === true);

  let subscript: number | null = null;
  if (subscriptMap) {
    const indices = subscriptMap.get(node.label);
    if (indices && indices.length > 1) {
      subscript = indices.indexOf(depth * 1000 + siblingIndex) + 1;
    }
  }

  const children: PositionedNode[] = [];

  if (node.children.length > 0) {
    const childNaturalWidths = node.children.map((c) => widths.get(c)!);
    const totalNatural = childNaturalWidths.reduce((a, b) => a + b, 0);
    const scale =
      totalNatural > 0 ? Math.max(1, allocated / totalNatural) : 1;

    let offset = left;
    for (let i = 0; i < node.children.length; i++) {
      const childAlloc = childNaturalWidths[i] * scale;
      children.push(
        positionNodes(
          node.children[i],
          depth + 1,
          offset,
          childAlloc,
          settings,
          i,
          subscriptMap,
          widths,
        ),
      );
      offset += childAlloc;
    }
  }

  return {
    label: node.label,
    children,
    x: left + allocated / 2,
    y: depth * settings.lineHeight,
    width: measureText(node.label),
    triangle: isTriangle,
    subscript,
    sourceStart: node.sourceStart,
    sourceEnd: node.sourceEnd,
    terminal: node.terminal,
  };
}

function buildSubscriptMap(
  node: TreeNode,
  depth: number,
  siblingIndex: number,
  map: Map<string, number[]>,
): void {
  const key = node.label;
  if (!map.has(key)) map.set(key, []);
  map.get(key)!.push(depth * 1000 + siblingIndex);

  for (let i = 0; i < node.children.length; i++) {
    buildSubscriptMap(node.children[i], depth + 1, i, map);
  }
}

function collapseLeaves(node: PositionedNode): void {
  if (node.triangle) return;
  for (const child of node.children) {
    if (child.children.length === 0 && child.terminal) {
      child.y = node.y + FONT_SIZE * 1.2;
    } else if (child.children.length > 0) {
      collapseLeaves(child);
    }
  }
}

function alignLeavesBottom(root: PositionedNode): void {
  let maxY = 0;
  function findMaxY(n: PositionedNode) {
    maxY = Math.max(maxY, n.y);
    for (const c of n.children) findMaxY(c);
  }
  findMaxY(root);

  function pushLeaves(n: PositionedNode) {
    if (n.children.length === 0) n.y = maxY;
    for (const c of n.children) pushLeaves(c);
  }
  pushLeaves(root);
}

function isPreTerminal(n: PositionedNode): boolean {
  return (
    !n.terminal &&
    n.children.length > 0 &&
    n.children.every((c) => c.terminal === true)
  );
}

function alignNodesBottom(root: PositionedNode, settings: Settings): void {
  let maxY = 0;
  function findMaxPreTermY(n: PositionedNode) {
    if (isPreTerminal(n)) maxY = Math.max(maxY, n.y);
    for (const c of n.children) {
      if (!c.terminal) findMaxPreTermY(c);
    }
  }
  findMaxPreTermY(root);

  function pushDown(n: PositionedNode) {
    if (isPreTerminal(n)) {
      n.y = maxY;
      for (const c of n.children) {
        c.y =
          n.triangle || settings.terminalLines
            ? maxY + settings.lineHeight
            : maxY + FONT_SIZE * 1.2;
      }
    }
    for (const c of n.children) {
      if (!c.terminal) pushDown(c);
    }
  }
  pushDown(root);
}

export interface LayoutResult {
  root: PositionedNode;
  width: number;
  height: number;
}

export function layoutTree(
  tree: TreeNode,
  settings: Settings,
): LayoutResult | null {
  if (!tree) return null;

  const subscriptMap: Map<string, number[]> | null = settings.autoSubscript
    ? new Map()
    : null;
  if (subscriptMap) {
    buildSubscriptMap(tree, 0, 0, subscriptMap);
    for (const [key, indices] of subscriptMap) {
      if (indices.length <= 1) subscriptMap.delete(key);
    }
  }

  const widths = new Map<TreeNode, number>();
  const totalWidth = computeWidths(tree, settings, widths);

  const root = positionNodes(
    tree,
    0,
    0,
    totalWidth,
    settings,
    0,
    subscriptMap,
    widths,
  );

  if (settings.alignment === "bottom") {
    alignNodesBottom(root, settings);
  } else {
    if (!settings.terminalLines) {
      collapseLeaves(root);
    }
    if (settings.alignment === "leaves-bottom" && settings.terminalLines) {
      alignLeavesBottom(root);
    }
  }

  let maxX = 0;
  let maxY = 0;
  function findBounds(n: PositionedNode) {
    maxX = Math.max(maxX, n.x + measureText(n.label) / 2);
    maxY = Math.max(maxY, n.y);
    for (const c of n.children) findBounds(c);
  }
  findBounds(root);

  return {
    root,
    width: maxX + FONT_SIZE,
    height: maxY + settings.lineHeight,
  };
}
