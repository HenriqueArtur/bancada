/// Types Monaco's ESM entry points do not ship for themselves.
///
/// `editor.main` has no `.d.ts` of its own, but it re-exports the same API
/// surface as the package root — so borrowing the root's types is accurate,
/// not a stub. `?worker` is Vite's own import suffix and nothing in
/// `@types` knows about it.
declare module "monaco-editor/esm/vs/editor/editor.main" {
  export * from "monaco-editor";
}

declare module "*?worker" {
  const Worker: new () => Worker;
  export default Worker;
}

interface Window {
  MonacoEnvironment?: { getWorker: () => Worker };
}
