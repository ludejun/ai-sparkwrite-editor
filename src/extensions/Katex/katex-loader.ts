export type KatexRenderer = typeof import('katex').default;
export type KatexLoader = () => Promise<KatexRenderer>;

/**
 * KaTeX's stylesheet, loaded with the renderer: without it a formula shows its
 * MathML and its HTML rendering side by side. Best effort (a host without CSS
 * imports, such as Node, still gets the renderer).
 */
export function loadKatexStyles(): Promise<void> {
  return import('katex/dist/katex.min.css').then(
    () => undefined,
    () => undefined
  );
}

const defaultLoader: KatexLoader = () =>
  Promise.all([import('katex'), loadKatexStyles()]).then(([module]) => module.default);
const pending = new WeakMap<KatexLoader, Promise<KatexRenderer>>();

/** Share a renderer across node views/dialogs, without caching failed loads. */
export function loadKatex(loader: KatexLoader = defaultLoader): Promise<KatexRenderer> {
  let result = pending.get(loader);
  if (!result) {
    result = Promise.resolve()
      .then(loader)
      .catch((error: unknown) => {
        pending.delete(loader);
        throw error;
      });
    pending.set(loader, result);
  }
  return result;
}
