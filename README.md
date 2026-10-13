# GM Notebook

React application for campaign notes, a graph-based notebook tree, and free-positioned text/image blocks.

## Project structure

```text
src/
  app/                    Application shell and component-level Sass partials
    styles/               Sidebar, graph view, drawer, dialog, and status styles
  domain/                 Notebook types, tree operations, and sample data
  features/
    editor/               Note canvas and NoteEditor.scss
    graph/                React Flow tree visualization and TreeGraph.scss
  styles/
    _tokens.scss          Shared Sass and runtime CSS design tokens
    _global.scss          Browser reset and global typography
  storage/                IndexedDB persistence and storage tests
  test/                   Shared test setup
  App.tsx                 Stable application entry re-export
  main.tsx                React DOM bootstrap
  index.scss              Global Sass entry point
```

`App.tsx` is kept as a small compatibility entry point. The application implementation lives in `app/App.tsx`.
Styles use Sass modules and BEM class names (`block__element--modifier`). Shared colors, surfaces, shadows, and breakpoints are defined in `styles/_tokens.scss`.

## Commands

- `npm run dev` starts the Vite development server.
- `npm test` runs the Vitest suite once.
- `npm run test:watch` runs Vitest in watch mode.
- `npm run build` runs the TypeScript check and production build.
- `npm run lint` runs ESLint.
