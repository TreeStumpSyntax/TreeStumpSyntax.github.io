# TreeStump

A modern, browser-based syntax tree generator with an interactive canvas editor.

Type linguistic phrase structures in labelled bracket notation and see a beautiful SVG tree rendered in real time.

## Features

- Real-time syntax tree rendering from bracket notation
- Pannable and zoomable canvas
- Bracket pair colorization in the editor
- Configurable: triangles, auto subscripts, terminal lines, coloring, alignment, fonts
- Export to PNG, SVG, or `.treestump` project file
- No login required — works entirely in the browser with auto-save

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173/TreeStump/](http://localhost:5173/TreeStump/).

## Build

```bash
npm run build
```

The production build outputs to `dist/`. Deployed to GitHub Pages automatically on push to `main`.

## Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Zustand](https://zustand.docs.pmnd.rs/) for state management
- [React Router](https://reactrouter.com/) for navigation
- [Geist](https://vercel.com/font) font family
