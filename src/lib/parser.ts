import type { TreeNode } from "../types";

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
 *   Tree     -> '[' Label Children ']'
 *   Children -> (Tree | Leaf)*
 *   Label    -> non-whitespace, non-bracket characters
 *   Leaf     -> non-bracket characters (trimmed)
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

    const forceTriangle = rawLabel.endsWith("~");
    const label = forceTriangle ? rawLabel.slice(0, -1) || "?" : rawLabel;

    const children: TreeNode[] = [];

    while (pos < input.length) {
      skipWhitespace();

      if (peek() === "]") {
        advance(); // consume ']'
        return { label, children, sourceStart: labelStart, sourceEnd: labelEnd, ...(forceTriangle && { forceTriangle: true }) };
      }

      if (peek() === "[") {
        const child = parseNode();
        if (child) children.push(child);
      } else if (pos < input.length && peek() !== "]") {
        const rawStart = pos;
        const leafText = readLeafText();
        if (leafText) {
          const raw = input.slice(rawStart, pos);
          const leadingWS = raw.length - raw.trimStart().length;
          const trailingWS = raw.length - raw.trimEnd().length;
          children.push({
            label: leafText,
            children: [],
            sourceStart: rawStart + leadingWS,
            sourceEnd: pos - trailingWS,
            terminal: true,
          });
        }
      }
    }

    // Reached end of input without closing bracket
    errors.push({ position: openPos, message: "Unmatched '['" });
    return { label, children, sourceStart: labelStart, sourceEnd: labelEnd, ...(forceTriangle && { forceTriangle: true }) };
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
