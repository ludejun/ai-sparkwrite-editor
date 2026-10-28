import type { Editor } from '@tiptap/core';

type Listener = (editable: boolean) => void;

interface EditableWatch {
  value: boolean;
  listeners: Set<Listener>;
}

const watches = new WeakMap<Editor, EditableWatch>();

/** Whether the editor accepts edits right now. Read it again when a command runs. */
export function isEditorEditable(editor?: Editor | null): boolean {
  return !!editor && !editor.isDestroyed && !!editor.isEditable;
}

function viewDom(editor: Editor): HTMLElement | null {
  try {
    // Before mount `editor.view` is a stub that throws for `dom`.
    return editor.view.dom ?? null;
  } catch {
    return null;
  }
}

function createWatch(editor: Editor): EditableWatch {
  const watch: EditableWatch = { value: isEditorEditable(editor), listeners: new Set() };
  let observer: MutationObserver | null = null;

  const sync = () => {
    const next = isEditorEditable(editor);

    if (next === watch.value) return;

    watch.value = next;
    watch.listeners.forEach((listener) => listener(next));
  };

  // `setEditable(x, false)` emits nothing and `useEditor({ editable })` only
  // calls `setOptions`, but ProseMirror rewrites `contenteditable` on the view's
  // DOM for every change, so observing that attribute catches all of them.
  const observe = () => {
    observer?.disconnect();
    observer = null;

    const dom = viewDom(editor);

    if (!dom || typeof MutationObserver === 'undefined') return;

    observer = new MutationObserver(sync);
    observer.observe(dom, { attributes: true, attributeFilter: ['contenteditable'] });
  };

  const onMount = () => {
    observe();
    sync();
  };
  const onUnmount = () => {
    observer?.disconnect();
    observer = null;
  };
  const onDestroy = () => {
    onUnmount();
    sync();
    editor.off('mount', onMount);
    editor.off('unmount', onUnmount);
    editor.off('destroy', onDestroy);
    events.forEach((event) => editor.off(event, sync));
  };
  const events = ['create', 'transaction', 'update', 'focus', 'blur'] as const;

  editor.on('mount', onMount);
  editor.on('unmount', onUnmount);
  editor.on('destroy', onDestroy);
  events.forEach((event) => editor.on(event, sync));
  observe();

  return watch;
}

function getWatch(editor: Editor): EditableWatch {
  let watch = watches.get(editor);

  if (!watch) {
    watch = createWatch(editor);
    watches.set(editor, watch);
  }

  return watch;
}

/**
 * Calls `listener` whenever `editor.isEditable` changes, including through
 * `setEditable(x, false)`, which emits no event. Returns the unsubscribe function.
 * One observer per editor is shared by every subscriber.
 */
export function watchEditable(editor: Editor, listener: Listener): () => void {
  const watch = getWatch(editor);

  watch.listeners.add(listener);

  return () => {
    watch.listeners.delete(listener);
  };
}
