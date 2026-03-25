# TreeStump — Claude Instructions

## Dev commands

```bash
npm run dev      # start Vite dev server
npm run build    # tsc + vite build
npm run lint     # eslint
```

## What this project is

A browser-based syntax tree generator for linguistics. Users type **labelled bracket notation** (e.g. `[S [NP foo][VP [V bar]]]`) and get a live, interactive SVG tree. No backend.

## Architecture

**Data pipeline:**

```
bracketText (string, source of truth)
  → parse()      → TreeNode (src/lib/parser.ts)
  → layoutTree() → PositionedNode + dimensions (src/lib/layout.ts)
  → TreeView     → SVG (src/components/TreeView.tsx)
```

**Key files:**

- `src/types.ts` — shared types and constants (`FONT_SIZE=16`, `STROKE_WIDTH=1.5`)
- `src/stores/projectStore.ts` — single Zustand store; all app state lives here
- `src/lib/parser.ts` — recursive descent parser
- `src/lib/layout.ts` — two-pass tree layout (bottom-up widths, top-down positions)
- `src/lib/bracketMatcher.ts` — bracket pairing/depth/unmatched detection
- `src/lib/bracketPairing.ts` — auto-pair/skip/delete logic for the textarea
- `src/lib/selection.ts` — node selection, rect hit-test, range helpers
- `src/lib/treeOperations.ts` — `moveNodeUnder` (drag-drop) and `swapSibling` (⌘←/→)
- `src/lib/export.ts` — SVG, PNG, and `.treestump` project export/import
- `src/components/Canvas.tsx` — pan/zoom/box-select container
- `src/components/TreeView.tsx` — SVG renderer with inline editing and drag-drop
- `src/components/BracketEditor.tsx` — bottom bar: hidden textarea + colored `<pre>` overlay
- `src/components/HamburgerMenu.tsx` — settings sidebar + keyboard shortcut reference

## Critical conventions

- **Node identity:** nodes are identified by `sourceStart` (their label's start index in `bracketText`). Selections, drag-drop, inline edits, and undo all key off this. Never use label strings or tree positions as identity.
- **`bracketText` is the only source of truth.** The tree, layout, and SVG are all derived — never mutate them directly.
- **Undo/redo** is implemented as module-level `past[]`/`future[]` snapshot stacks in `projectStore.ts`, not stored in Zustand. VS Code-style undo stops for text (word/space/delete class transitions); time-based merge (500 ms) for settings sliders.
- **State:** everything goes through `useProjectStore`. Don't add local state for things that need to persist or participate in undo.
- **Persisted fields:** only `bracketText`, `settings`, and `canvas` are saved to localStorage (`treestump-project`). `selectedNodes`, `clipboard`, and `cursorPos` are session-only.
- **Triangle nodes:** a non-terminal with exactly one child that is a terminal containing a space renders as a filled triangle (controlled by `settings.triangles`).
