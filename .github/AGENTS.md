# TreeStump — AI Agent Guide

## What is TreeStump?

TreeStump is a modern, browser-based syntax tree generator. Users type
linguistic phrase structures in labelled bracket notation and see an
interactive SVG tree rendered in real time on a pannable/zoomable canvas.

## Architecture

- **Stack**: Vite + React 19 + TypeScript + Tailwind CSS v4 + Zustand
- **Routing**: React Router v7 with `HashRouter` (for GitHub Pages compatibility)
- **Rendering**: SVG rendered via React components
- **State**: Single Zustand store with `persist` middleware (localStorage)
- **Hosting**: Static site on GitHub Pages via GitHub Actions

## Project Layout

```
src/
  components/   — React UI components (pages, panels, editor, canvas)
  lib/          — Pure logic (parser, layout algorithm, export utilities)
  stores/       — Zustand store
  types.ts      — Shared TypeScript types
  App.tsx       — Router configuration
  index.css     — Tailwind theme + design tokens
```

## Design System

Based on Sunday.ai's aesthetic — warm, spacious, minimal:
- Fonts: Geist (sans) + Geist Mono
- Colors: white bg, off-black text (#1a1a1a), yellow accent (#f7e731),
  warm grey surfaces (#f3f3f0), 12px border radius
- No shadows, flat surfaces, generous whitespace

## Key Patterns

- Settings and bracket text live in `useProjectStore` (Zustand)
- Tree data flows: bracketText → parser → TreeNode → layout → PositionedNode → SVG
- Derived state (parsed tree, layout) is computed via `useMemo`, not stored
- Export: SVG serialization for .svg, SVG→canvas→blob for .png, JSON for .treestump

## Development

```bash
npm install
npm run dev     # http://localhost:5173/TreeStump/
npm run build   # Production build to dist/
```
