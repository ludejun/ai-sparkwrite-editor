import {
  Collaboration as TiptapCollaboration,
  type CollaborationOptions as TiptapCollaborationOptions,
} from '@tiptap/extension-collaboration';
import {
  CollaborationCaret as TiptapCollaborationCaret,
  type CollaborationCaretOptions as TiptapCollaborationCaretOptions,
} from '@tiptap/extension-collaboration-caret';

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
export const Collaboration = /* @__PURE__ */ TiptapCollaboration.extend<CollaborationOptions>({
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
