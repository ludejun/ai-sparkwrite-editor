import { Extension } from '@tiptap/core';
import { AllSelection, Plugin } from '@tiptap/pm/state';

import { markdownToSlice } from './markdown';
import { aiDecorations, nextAISessionId, nextAIState, sessionAfterApply } from './session';
import { aiPluginKey, type AIAction, type AISession, type AIState } from './state';
import { rangeMarkdown } from './writer';

import type { AIOptions, AIPanelComponentProps } from './types';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ai: {
      /** Opens the Ask-AI panel on the selection, or at the caret. */
      openAI: (prompt?: string) => ReturnType;
      closeAI: () => ReturnType;
      /** Replaces the AI range with `markdown`, parsed through the editor schema. */
      applyAI: (markdown: string) => ReturnType;
      /** Shows or hides the composer dock (`RichTextAIComposer`) under the editor. */
      toggleAIComposer: (open?: boolean) => ReturnType;
    };
  }
}

export const DEFAULT_AI_SYSTEM_PROMPT =
  'You are a writing assistant inside a rich-text editor. Follow the user’s instructions. Reply in the user’s language. Return only the final text, formatted as Markdown where structure helps (headings, lists, tables, task lists, code blocks); never add commentary, preamble or explanations.';

/**
 * The framework-free half of the AI extension: the session state, the
 * decorations that mark what AI is working on, the commands, and the
 * keyboard entry points. The panel UI is mounted through `mountPanel`, which
 * the React and Vue extensions supply.
 */
export const AICore = Extension.create<AIOptions>({
  name: 'ai',
  addOptions() {
    return {
      endpoint: '',
      protocol: 'openai',
      apiKey: '',
      baseURL: '',
      model: '',
      maxTokens: 2048,
      headers: {},
      generate: null,
      stream: true,
      systemPrompt: DEFAULT_AI_SYSTEM_PROMPT,
      mountPanel: null,
      enableImageInput: true,
      enableFileInput: true,
      imageMimes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      fileMimes: ['text/plain', 'text/markdown', 'text/csv', 'application/json'],
      maxAttachmentSize: 1024 * 1024 * 4, // 4MB
      // Empty: "Translate" targets the reader's browser language. Set a list to
      // get a submenu of fixed targets instead.
      translateLanguages: [],
      composer: true,
      spaceTrigger: true,
      documentContext: 12000,
      onComposeResult: undefined,
      placement: 'inline',
    };
  },
  addCommands() {
    return {
      openAI:
        (prompt) =>
        ({ editor, tr, dispatch }) => {
          const { selection } = tr;
          // A caret needs a textblock to anchor the panel; a selection can
          // span anything, including the whole document after Select All.
          if (!editor.isEditable || (selection.empty && !selection.$from.parent.isTextblock))
            return false;
          if (dispatch)
            tr.setMeta(aiPluginKey, {
              type: 'session',
              session: { from: selection.from, to: selection.to, prompt, id: nextAISessionId() },
            } satisfies AIAction);
          return true;
        },
      closeAI:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch)
            tr.setMeta(aiPluginKey, { type: 'session', session: null } satisfies AIAction);
          return true;
        },
      applyAI:
        (markdown) =>
        ({ editor, state, tr, dispatch }) => {
          const range = aiPluginKey.getState(state)?.session;
          if (!editor.isEditable || !range || !markdown.trim()) return false;
          if (dispatch) {
            // Parsed through the schema: headings, lists, tables and code
            // blocks become real nodes; anything the schema does not know,
            // including any markup the model may have produced, is dropped.
            tr.replaceRange(range.from, range.to, markdownToSlice(editor, markdown));
            tr.setMeta(aiPluginKey, {
              type: 'session',
              session: sessionAfterApply(range, tr, this.options.placement ?? 'inline'),
            } satisfies AIAction);
            tr.scrollIntoView();
          }
          return true;
        },
      toggleAIComposer:
        (open) =>
        ({ state, tr, dispatch }) => {
          if (!this.options.composer) return false;
          const current = aiPluginKey.getState(state)?.composer ?? false;
          const next = open ?? !current;
          if (next === current) return true;
          if (dispatch)
            tr.setMeta(aiPluginKey, { type: 'composer', open: next } satisfies AIAction);
          return true;
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      // Notion's entry point: Space on an empty line asks AI.
      Space: ({ editor }) => {
        if (!this.options.spaceTrigger) return false;
        const { $from, empty } = editor.state.selection;
        if (!empty || !$from.parent.isTextblock || $from.parent.content.size > 0) return false;
        if ($from.parent.type.spec.code) return false;
        return editor.commands.openAI();
      },
      'Mod-j': ({ editor }) => editor.commands.toggleAIComposer(),
    };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;
    let mount: HTMLElement | null = null;
    const placement = options.placement ?? 'inline';
    return [
      new Plugin<AIState>({
        key: aiPluginKey,
        state: {
          init: () => ({ session: null, writing: null, composer: false }),
          apply: (tr, previous) => nextAIState(previous, tr, placement),
        },
        props: {
          decorations: (state) =>
            aiDecorations(state, placement, () => {
              mount = editor.view.dom.ownerDocument.createElement('div');
              mount.className = 'richtext-ai-mount';
              mount.contentEditable = 'false';
              return mount;
            }),
        },
        view(view) {
          let unmount: (() => void) | null = null;
          let current: AIState['session'] = null;
          const sameSession = (a: AISession | null, b: AISession | null) =>
            a === b ||
            (placement === 'external' && !!a && !!b && a.id !== undefined && a.id === b.id);
          function destroy() {
            unmount?.();
            unmount = null;
          }
          function update() {
            const next = editor.isEditable
              ? (aiPluginKey.getState(view.state)?.session ?? null)
              : null;
            if (next === current) return;
            // External: the same session mapped through an edit (or moved
            // onto the text it inserted) keeps its panel and conversation.
            if (sameSession(next, current)) {
              current = next;
              return;
            }
            current = next;
            destroy();
            if (!next || !options.mountPanel) return;
            // External: the panel is rendered by the host, outside the
            // document; it gets a detached element it is free to ignore.
            const target =
              placement === 'external' ? editor.view.dom.ownerDocument.createElement('div') : mount;
            if (!target) return;
            const session = next;
            // Multi-block selections go to the model as Markdown, so a table
            // or a list keeps its shape; the panel mounts once that is ready.
            void rangeMarkdown(editor, session).then((selectedText) => {
              if (!sameSession(current, session) || editor.isDestroyed) return;
              mountPanel(target, session, selectedText);
            });
          }
          function mountPanel(target: HTMLElement, session: AISession, selectedText: string) {
            if (!options.mountPanel) return;
            const props: AIPanelComponentProps = {
              editor,
              options,
              initialPrompt: session.prompt,
              selectedText,
              close: () => {
                editor.commands.closeAI();
                editor.commands.focus();
              },
              apply: (markdown: string) => {
                if (editor.commands.applyAI(markdown)) editor.commands.focus();
              },
            };
            unmount = options.mountPanel(target, props);
          }
          return { update, destroy };
        },
      }),
    ];
  },
});

/** Whole-document selection, as produced by Select All. */
export function isAllSelection(selection: unknown): selection is AllSelection {
  return selection instanceof AllSelection;
}
