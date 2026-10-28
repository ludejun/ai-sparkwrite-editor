import { Extension } from '@tiptap/core';

import { watchEditable } from '@/utils/editable';

import type { GeneralOptions } from '@/types';
import type { Editor } from '@tiptap/core';

export interface CodeViewOptions extends GeneralOptions<CodeViewOptions> {
  isCodeViewMode?: boolean;
}

export interface CodeViewStorage {
  isActive: boolean;
  /** The HTML the source view opened with (or last synced to); unchanged text is not applied. */
  originalContent: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    codeView: {
      /**
       * Show the document's HTML in a source editor over the document, or leave
       * it: leaving parses the source back into the document, as one undoable
       * step, only when it was changed.
       */
      toggleCodeView: () => ReturnType;
    };
  }
}

interface SourceView {
  textarea: HTMLTextAreaElement;
  close: () => void;
}

const sourceViews = new WeakMap<Editor, SourceView>();

function storageOf(editor: Editor): CodeViewStorage {
  return (editor.storage as unknown as Record<string, CodeViewStorage>).codeView;
}

function viewDom(editor: Editor): HTMLElement | null {
  try {
    return editor.view.dom ?? null;
  } catch {
    return null;
  }
}

/** The text the source editor shows for the current document. */
export function documentSource(editor: Editor): string {
  return editor.getHTML();
}

/** What leaving the source view should write: the source if it was edited, else nothing. */
export function changedSource(storage: CodeViewStorage, source: string): string | null {
  return source === storage.originalContent ? null : source;
}

/**
 * The source editor is a textarea laid over the document, not document
 * content: opening it emits no update (no autosave, no collaboration
 * broadcast), and its own undo history stays out of the editor's.
 */
function openSourceView(editor: Editor): boolean {
  const dom = viewDom(editor);
  const parent = dom?.parentElement;

  if (!dom || !parent) return false;

  const storage = storageOf(editor);
  const textarea = dom.ownerDocument.createElement('textarea');

  textarea.className = 'tiptap-code-view';
  textarea.spellcheck = false;
  textarea.setAttribute('aria-label', 'HTML');
  textarea.value = storage.originalContent = documentSource(editor);
  textarea.readOnly = !editor.isEditable;

  const previousDisplay = dom.style.display;

  dom.style.display = 'none';
  parent.insertBefore(textarea, dom);

  // Remote or programmatic edits keep the source current until it is edited.
  const onUpdate = () => {
    if (textarea.value !== storage.originalContent) return;
    textarea.value = storage.originalContent = documentSource(editor);
  };
  // Turning read-only leaves the source view without applying it.
  const stopEditable = watchEditable(editor, (editable) => {
    if (!editable) close();
  });

  const close = () => {
    editor.off('update', onUpdate);
    editor.off('destroy', close);
    stopEditable();
    textarea.remove();
    dom.style.display = previousDisplay;
    sourceViews.delete(editor);
    storage.isActive = false;
  };

  editor.on('update', onUpdate);
  editor.on('destroy', close);
  sourceViews.set(editor, { textarea, close });
  storage.isActive = true;
  textarea.focus();

  return true;
}

export const CodeView = /* @__PURE__ */ Extension.create<CodeViewOptions, CodeViewStorage>({
  name: 'codeView',
  //@ts-expect-error
  addOptions() {
    return {
      ...this.parent?.(),
      button({ editor, t }: { editor: Editor; t: (path: string) => string }) {
        return {
          componentProps: {
            action: () => {
              editor.commands.toggleCodeView();
            },
            isActive: () => storageOf(editor).isActive,
            disabled: false,
            icon: 'Html',
            tooltip: t('editor.codeView.tooltip') || 'View HTML Code',
            customClass: 'tiptap-code-view-button',
          },
        };
      },
    };
  },

  addStorage() {
    return {
      isActive: false,
      originalContent: '',
    };
  },

  addCommands() {
    return {
      toggleCodeView:
        () =>
        ({ editor, commands, dispatch }) => {
          const open = sourceViews.get(editor);

          if (!open) {
            if (!dispatch) return !!viewDom(editor)?.parentElement;
            return openSourceView(editor);
          }

          if (!dispatch) return true;

          const source = changedSource(storageOf(editor), open.textarea.value);

          open.close();

          // `commands.setContent` joins this command's transaction, so the
          // applied source is a single undo step.
          return source === null || !editor.isEditable ? true : commands.setContent(source);
        },
    };
  },
});
