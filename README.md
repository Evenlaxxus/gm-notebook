# GM Notebook

React application for campaign notes, a graph-based notebook tree, and free-positioned text/image blocks.

## Project structure

```text
src/
  app/                    Application shell and app-level styles
  domain/                 Notebook types, tree operations, and sample data
  features/
    editor/               Note canvas and its styles
    graph/                React Flow tree visualization
  storage/                IndexedDB persistence and storage tests
  test/                   Shared test setup
  App.tsx                 Stable application entry re-export
  main.tsx                React DOM bootstrap
  index.css               Global styles
```

`App.tsx` is kept as a small compatibility entry point. The application implementation lives in `app/App.tsx`.

## Commands

- `npm run dev` starts the Vite development server.
- `npm test` runs the Vitest suite once.
- `npm run test:watch` runs Vitest in watch mode.
- `npm run build` runs the TypeScript check and production build.
- `npm run lint` runs ESLint.
