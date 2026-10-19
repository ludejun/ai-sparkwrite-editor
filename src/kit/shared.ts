import type { AnyExtension, Editor } from '@tiptap/core';

type OptionsOf<E> = E extends { options: infer O } ? O : Record<string, never>;

/** One entry of a kit registry: the extension, its companions, and whether it is opt-in. */
export interface KitEntry<E extends AnyExtension = AnyExtension> {
  /** The extension that receives the option object. */
  extension: E;
  /** Registered alongside it, unchanged (e.g. `ListItem` for lists). */
  with?: AnyExtension[];
  /** Left out unless an option object is given (features that need a key or a callback). */
  optIn?: boolean;
}

export type KitRegistry = Record<string, KitEntry>;

/**
 * Options of a kit: one key per feature. `false` leaves it out, an object
 * configures it, `undefined` takes the default (included unless opt-in).
 */
export type KitOptions<R extends KitRegistry> = {
  [K in keyof R]?: false | Partial<OptionsOf<R[K]['extension']>>;
};

/** Turns a registry and its options into the extension list for `useEditor`. */
export function buildKit<R extends KitRegistry>(
  registry: R,
  options: KitOptions<R> | undefined
): AnyExtension[] {
  const list: AnyExtension[] = [];
  const seen = new Set<string>();
  // Collaboration (Yjs) brings its own undo manager and conflicts with UndoRedo.
  const collaboration = (options as Record<string, unknown> | undefined)?.collaboration;
  const collaborating = Boolean(collaboration) && typeof collaboration === 'object';
  const push = (extension: AnyExtension) => {
    if (seen.has(extension.name)) return;
    seen.add(extension.name);
    list.push(extension);
  };

  for (const [key, entry] of Object.entries(registry)) {
    const option = (options as Record<string, unknown> | undefined)?.[key];
    if (option === false || (option === undefined && entry.optIn)) continue;
    if (collaborating && key === 'history') continue;
    push(
      option && typeof option === 'object'
        ? entry.extension.configure(option as Record<string, unknown>)
        : entry.extension
    );
    entry.with?.forEach(push);
  }

  return list;
}

/** Names of the extensions registered on an editor, for showing only the controls that apply. */
export function extensionNames(editor: Editor | null | undefined): Set<string> {
  const names = new Set(
    editor?.extensionManager.extensions.map((extension) => extension.name) ?? []
  );
  // Undo / redo controls work with either history implementation.
  if (names.has('collaboration')) names.add('undoRedo');
  return names;
}
