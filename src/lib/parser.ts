import type { ArrowDefinition, TreeNode } from "../types";

export interface ParseResult {
  tree: TreeNode | null;
  errors: ParseError[];
}

export interface ParseError {
  position: number;
  message: string;
}

/**
 * Parse labelled bracket notation into a TreeNode.
 *
 * Grammar:
 *   Tree     -> '[' Label ArrowTargets? Children ']'
 *   Children -> (Tree | Leaf)*
 *   Label    -> non-whitespace, non-bracket characters
 *   Leaf     -> non-bracket characters (trimmed), may contain '-> targets'
 *   ArrowTargets -> '->' Target (';' Target)*
 *   Target   -> non-whitespace, non-bracket, non-semicolon characters
 *
 * Supports error recovery: unmatched brackets are reported but parsing
 * continues, producing a partial tree when possible.
 */
export function parse(input: string): ParseResult {
  const errors: ParseError[] = [];
  let pos = 0;

  function peek(): string {
    return input[pos] ?? "";
  }

  function advance(): string {
    return input[pos++] ?? "";
  }

  function skipWhitespace() {
    while (pos < input.length && /\s/.test(input[pos])) pos++;
  }

  function readLabel(): string {
    let label = "";
    while (pos < input.length && !/[[\]\s]/.test(input[pos])) {
      label += advance();
    }
    return label;
  }

  function readLeafText(): string {
    let text = "";
    while (pos < input.length && input[pos] !== "[" && input[pos] !== "]") {
      text += advance();
    }
    return text.trim();
  }

  function readArrowTargets(): string[] {
    let text = "";
    while (pos < input.length && input[pos] !== "[" && input[pos] !== "]") {
      text += advance();
    }
    return text
      .split(";")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function parseNode(): TreeNode | null {
    skipWhitespace();

    if (peek() !== "[") return null;
    const openPos = pos;
    advance(); // consume '['

    skipWhitespace();
    const labelStart = pos;
    const rawLabel = readLabel() || "?";
    const labelEnd = pos;
    if (rawLabel === "?") {
      errors.push({ position: openPos, message: "Expected label after '['" });
    }

    // Check for arrow targets after label (non-terminal arrows)
    let arrowTargets: string[] | undefined;
    let arrowSyntaxStart: number | undefined;
    let arrowSyntaxEnd: number | undefined;
    const savedPos = pos;
    skipWhitespace();
    if (pos + 1 < input.length && input[pos] === "-" && input[pos + 1] === ">") {
      const arrowPos = pos;
      arrowSyntaxStart = pos;
      pos += 2; // consume '->'
      skipWhitespace();
      const targets = readArrowTargets();
      arrowSyntaxEnd = pos;
      if (targets.length === 0) {
        errors.push({ position: arrowPos, message: "Expected target after '->'" });
      } else {
        arrowTargets = targets;
      }
    } else {
      pos = savedPos; // restore position if no arrow found
    }

    const forceTriangle = rawLabel.endsWith("~");
    const label = forceTriangle ? rawLabel.slice(0, -1) || "?" : rawLabel;

    const children: TreeNode[] = [];

    while (pos < input.length) {
      skipWhitespace();

      if (peek() === "]") {
        advance(); // consume ']'
        return {
          label,
          children,
          sourceStart: labelStart,
          sourceEnd: labelEnd,
          ...(arrowTargets ? { arrowTargets, arrowSyntaxStart, arrowSyntaxEnd } : {}),
          ...(forceTriangle && { forceTriangle: true }) };
      }

      if (peek() === "[") {
        const child = parseNode();
        if (child) children.push(child);
      } else if (pos < input.length && peek() !== "]") {
        const rawStart = pos;
        const leafText = readLeafText();
        if (leafText) {
          // Check for arrow in terminal text
          const arrowIdx = leafText.indexOf("->");
          let actualLabel: string;
          let leafArrowTargets: string[] | undefined;

          if (arrowIdx >= 0) {
            actualLabel = leafText.slice(0, arrowIdx).trim();
            const targetStr = leafText.slice(arrowIdx + 2).trim();
            const targets = targetStr
              .split(";")
              .map((t) => t.trim())
              .filter(Boolean);
            if (targets.length === 0) {
              errors.push({
                position: rawStart + arrowIdx,
                message: "Expected target after '->'",
              });
            } else {
              leafArrowTargets = targets;
            }
            if (!actualLabel) {
              actualLabel = leafText; // fallback if nothing before ->
            }
          } else {
            actualLabel = leafText;
          }

          const raw = input.slice(rawStart, pos);
          const leadingWS = raw.length - raw.trimStart().length;
          // For arrow leaves, sourceEnd should cover only the actual label, not the arrow syntax
          let effectiveEnd: number;
          if (arrowIdx >= 0) {
            // Find the end of the actual label in the raw text
            const rawBeforeArrow = raw.slice(0, raw.indexOf("->"));
            const trimmedBeforeArrow = rawBeforeArrow.trimEnd();
            effectiveEnd = rawStart + leadingWS + trimmedBeforeArrow.trimStart().length;
          } else {
            const trailingWS = raw.length - raw.trimEnd().length;
            effectiveEnd = pos - trailingWS;
          }

          children.push({
            label: actualLabel,
            children: [],
            sourceStart: rawStart + leadingWS,
            sourceEnd: effectiveEnd,
            terminal: true,
            ...(leafArrowTargets ? {
              arrowTargets: leafArrowTargets,
              arrowSyntaxStart: rawStart + raw.indexOf("->"),
              arrowSyntaxEnd: rawStart + raw.trimEnd().length,
            } : {}),
          });
        }
      }
    }

    // Reached end of input without closing bracket
    errors.push({ position: openPos, message: "Unmatched '['" });
    return {
      label,
      children,
      sourceStart: labelStart,
      sourceEnd: labelEnd, ...(forceTriangle && { forceTriangle: true }),
      ...(arrowTargets ? { arrowTargets, arrowSyntaxStart, arrowSyntaxEnd } : {}),
    };
  }

  skipWhitespace();

  if (peek() !== "[") {
    // Try to find the first bracket
    const text = input.trim();
    if (!text) return { tree: null, errors: [] };

    // Find first '[' and try from there
    const firstBracket = input.indexOf("[");
    if (firstBracket === -1) {
      const leadingWS = input.length - input.trimStart().length;
      return {
        tree: {
          label: text,
          children: [],
          sourceStart: leadingWS,
          sourceEnd: leadingWS + text.length,
          terminal: true,
        },
        errors: [],
      };
    }
    pos = firstBracket;
  }

  const tree = parseNode();

  // Validate arrow targets
  if (tree) {
    const arrows = extractArrows(tree);
    const arrowErrors = validateArrows(tree, arrows);
    errors.push(...arrowErrors);
  }

  // Check for extra closing brackets
  skipWhitespace();
  while (pos < input.length) {
    if (peek() === "]") {
      errors.push({ position: pos, message: "Unmatched ']'" });
      advance();
    } else if (peek() === "[") {
      // Another tree — just use the first one, report the rest
      break;
    } else {
      advance();
    }
    skipWhitespace();
  }

  return { tree, errors };
}

/** Collect all arrow definitions from a parsed tree. */
export function extractArrows(tree: TreeNode): ArrowDefinition[] {
  const arrows: ArrowDefinition[] = [];
  function visit(node: TreeNode) {
    if (node.arrowTargets) {
      for (const target of node.arrowTargets) {
        arrows.push({ sourceLabel: node.label, targetLabel: target });
      }
    }
    for (const child of node.children) visit(child);
  }
  visit(tree);
  return arrows;
}

/** Check that all arrow target labels exist as node labels in the tree. */
export function validateArrows(
  tree: TreeNode,
  arrows: ArrowDefinition[],
): ParseError[] {
  if (arrows.length === 0) return [];

  const allLabels = new Set<string>();
  function collectLabels(node: TreeNode) {
    allLabels.add(node.label);
    for (const child of node.children) collectLabels(child);
  }
  collectLabels(tree);

  const errors: ParseError[] = [];
  function visit(node: TreeNode) {
    if (node.arrowTargets) {
      for (const target of node.arrowTargets) {
        if (!allLabels.has(target)) {
          errors.push({
            position: node.sourceStart ?? 0,
            message: `Arrow target "${target}" not found in tree`,
          });
        }
      }
    }
    for (const child of node.children) visit(child);
  }
  visit(tree);
  return errors;
}
