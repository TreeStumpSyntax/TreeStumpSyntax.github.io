import { type BracketMatch } from "./bracketMatcher";

const PAIR_MAP: Record<string, string> = { "[": "[]", "(": "()" };
const CLOSE_SET = new Set(["]", ")"]);

export interface BracketKeyResult {
  text: string;
  selStart: number;
  selEnd: number;
  autoPairPos: number | null;
}

export function handleBracketKey(
  key: string,
  fullText: string,
  selStart: number,
  selEnd: number,
  bracketMatch: BracketMatch,
  autoPairPos: number | null,
): BracketKeyResult | null {
  if (key in PAIR_MAP) {
    const [opener, closer] = PAIR_MAP[key];
    const before = fullText.slice(0, selStart);
    const after = fullText.slice(selEnd);

    if (selStart !== selEnd) {
      const selected = fullText.slice(selStart, selEnd);
      return {
        text: before + opener + selected + closer + after,
        selStart: selStart + 1,
        selEnd: selEnd + 1,
        autoPairPos: null,
      };
    }

    let hasUnmatchedCloser = false;
    for (const pos of bracketMatch.unmatched) {
      if (pos >= selEnd && fullText[pos] === closer) {
        hasUnmatchedCloser = true;
        break;
      }
    }
    const insert = hasUnmatchedCloser ? opener : opener + closer;
    return {
      text: before + insert + after,
      selStart: selStart + 1,
      selEnd: selStart + 1,
      autoPairPos: hasUnmatchedCloser ? null : selStart + 1,
    };
  }

  if (
    CLOSE_SET.has(key) &&
    fullText[selStart] === key &&
    selStart === selEnd
  ) {
    return {
      text: fullText,
      selStart: selStart + 1,
      selEnd: selStart + 1,
      autoPairPos: null,
    };
  }

  if (
    key === "Backspace" &&
    selStart === selEnd &&
    autoPairPos === selStart &&
    fullText[selStart - 1] in PAIR_MAP &&
    fullText[selStart] === PAIR_MAP[fullText[selStart - 1]][1]
  ) {
    const before = fullText.slice(0, selStart - 1);
    const after = fullText.slice(selStart + 1);
    return {
      text: before + after,
      selStart: selStart - 1,
      selEnd: selStart - 1,
      autoPairPos: null,
    };
  }

  return null;
}
