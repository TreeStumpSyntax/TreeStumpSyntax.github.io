export interface BracketMatch {
  pairs: Map<number, number>;
  unmatched: Set<number>;
  depths: Map<number, number>;
}

const OPENERS = new Set(["[", "("]);
const CLOSERS: Record<string, string> = { "]": "[", ")": "(" };

export function matchBrackets(text: string): BracketMatch {
  const pairs = new Map<number, number>();
  const unmatched = new Set<number>();
  const depths = new Map<number, number>();
  const stack: Array<{ pos: number; type: string }> = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (OPENERS.has(ch)) {
      depths.set(i, stack.length);
      stack.push({ pos: i, type: ch });
    } else if (ch in CLOSERS) {
      const expectedOpen = CLOSERS[ch];
      if (stack.length > 0 && stack[stack.length - 1].type === expectedOpen) {
        const open = stack.pop()!;
        pairs.set(open.pos, i);
        pairs.set(i, open.pos);
        depths.set(i, depths.get(open.pos)!);
      } else {
        unmatched.add(i);
      }
    }
  }

  for (const { pos } of stack) {
    unmatched.add(pos);
  }

  return { pairs, unmatched, depths };
}
