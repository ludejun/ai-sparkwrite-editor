import {
  Collaboration as TiptapCollaboration,
  type CollaborationOptions as TiptapCollaborationOptions,
} from '@tiptap/extension-collaboration';
import {
  CollaborationCaret as TiptapCollaborationCaret,
  type CollaborationCaretOptions as TiptapCollaborationCaretOptions,
} from '@tiptap/extension-collaboration-caret';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { yUndoPluginKey } from '@tiptap/y-tiptap';

import type { ButtonViewParams, GeneralOptions } from '@/types';

export interface CollaborationOptions
  extends TiptapCollaborationOptions, GeneralOptions<CollaborationOptions> {}

/**
 * Real-time co-editing over a `Y.Doc` (Yjs). Registering it in the kit
 * (`RichTextKit.configure({ collaboration: { document } })`) leaves the
 * `history` (UndoRedo) feature out: Yjs brings its own undo manager, and the
 * toolbar's undo / redo buttons drive it through the same `undo` / `redo`
 * commands.
 *
 * The document must come from the same `yjs` copy the editor uses (the kit
 * keeps `yjs` external, so the host's bundler has to resolve one copy).
 */
/** Meta on the empty transaction that tells undo / redo buttons the Yjs stacks changed. */
export const undoStackChangedKey = new PluginKey('collaborationUndoStack');

const UNDO_STACK_EVENTS = ['stack-item-added', 'stack-item-popped', 'stack-cleared'] as const;

/**
 * `Y.UndoManager` updates its stacks after the transaction that changed the
 * document has been dispatched, so a toolbar that re-reads `can().redo()` on
 * that transaction sees the old stacks (Redo stays disabled after Undo).
 * Follow the stacks themselves and dispatch an empty transaction when they move.
 */
function undoStackPlugin() {
  return new Plugin({
    key: undoStackChangedKey,
    view(view) {
      const undoManager = yUndoPluginKey.getState(view.state)?.undoManager;
      let queued = false;

      if (!undoManager) return {};

      // Deferred: the stacks move inside a Yjs transaction that may itself run
      // while ProseMirror is applying a transaction.
      const notify = () => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => {
          queued = false;
          if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(undoStackChangedKey, true));
        });
      };

      UNDO_STACK_EVENTS.forEach((event) => undoManager.on(event, notify));

      return {
        destroy: () => UNDO_STACK_EVENTS.forEach((event) => undoManager.off(event, notify)),
      };
    },
  });
}

export const Collaboration = /* @__PURE__ */ TiptapCollaboration.extend<CollaborationOptions>({
  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), undoStackPlugin()];
  },

  // @ts-expect-error the parent options are complete; `button` adds the toolbar metadata
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t, extension }: ButtonViewParams<CollaborationOptions>) => ({
        componentProps: {
          undo: {
            action: () => {
              editor.chain().focus().undo().run();
            },
            shortcutKeys: extension.options.shortcutKeys?.[0] ?? ['mod', 'Z'],
            isActive: () => editor.can().undo(),
            icon: 'Undo2',
            tooltip: t('editor.undo.tooltip'),
          },
          redo: {
            action: () => {
              editor.chain().focus().redo().run();
            },
            shortcutKeys: extension.options.shortcutKeys?.[1] ?? ['shift', 'mod', 'Z'],
            isActive: () => editor.can().redo(),
            icon: 'Redo2',
            tooltip: t('editor.redo.tooltip'),
          },
        },
      }),
    };
  },
});

/** The user shown on remote carets: a name and a CSS colour, plus anything the host wants to carry. */
export interface CollaborationUser {
  name: string;
  color: string;
  [key: string]: unknown;
}

export type CollaborationCaretOptions = TiptapCollaborationCaretOptions;

/** Default caret: a thin bar in the user's colour with a name label (class `richtext-collab-caret`). */
export function renderCollaborationCaret(user: Record<string, unknown>): HTMLElement {
  const caret = document.createElement('span');
  caret.classList.add('collaboration-carets__caret', 'richtext-collab-caret');
  caret.style.setProperty('--richtext-collab-color', String(user.color ?? '#6918b4'));
  const label = document.createElement('span');
  label.classList.add('collaboration-carets__label', 'richtext-collab-caret__label');
  label.textContent = String(user.name ?? '');
  caret.appendChild(label);
  return caret;
}

/** Remote carets and selections from the provider's awareness (`provider.awareness`). */
export const CollaborationCaret =
  /* @__PURE__ */ TiptapCollaborationCaret.extend<CollaborationCaretOptions>({
    addOptions() {
      const parent = this.parent?.() as TiptapCollaborationCaretOptions;
      return {
        ...parent,
        render: renderCollaborationCaret,
        selectionRender: (user: Record<string, unknown>) => ({
          nodeName: 'span',
          class: 'collaboration-carets__selection richtext-collab-selection',
          style: `background-color: ${String(user.color ?? '#6918b4')}33`,
          'data-user': String(user.name ?? ''),
        }),
      };
    },
  });
