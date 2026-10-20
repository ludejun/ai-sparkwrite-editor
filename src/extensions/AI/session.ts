import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { aiPluginKey, type AIAction, type AISession, type AIState } from './state';

import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { Mappable } from '@tiptap/pm/transform';

/**
 * Where the Ask-AI panel lives. `inline`: a block widget under the
 * selection, inside the document flow. `external`: nothing is inserted into
 * the document; the host renders the panel elsewhere (a side bar, a drawer).
 */
export type AIPlacement = 'inline' | 'external';

let lastSessionId = 0;

/** A fresh id for a newly opened session (mapped copies keep theirs). */
export function nextAISessionId(): number {
  lastSessionId += 1;
  return lastSessionId;
}

/**
 * An external session's range after a document change: text typed right
 * before the selection pushes it along, text typed right after it stays out.
 * The id is kept, so the panel showing the session is not remounted.
 */
export function mapAISession(session: AISession, mapping: Mappable): AISession {
  const from = mapping.map(session.from, 1);
  const to = Math.max(from, mapping.map(session.to, -1));
  return from === session.from && to === session.to ? session : { ...session, from, to };
}

/** The AI plugin state after `tr`. */
export function nextAIState(
  previous: AIState,
  tr: Transaction,
  placement: AIPlacement = 'inline'
): AIState {
  const action = tr.getMeta(aiPluginKey) as AIAction | undefined;
  let next = previous;
  if (action?.type === 'session') next = { ...next, session: action.session };
  else if (action?.type === 'writing') next = { ...next, writing: action.writing };
  else if (action?.type === 'composer') next = { ...next, composer: action.open };

  if (tr.docChanged) {
    // Inline: a document edit invalidates the preview, including remote
    // collaborative edits. External: the panel is not in the document, so
    // the range follows the edit and the conversation stays open.
    if (action?.type !== 'session' && next.session) {
      next = {
        ...next,
        session: placement === 'external' ? mapAISession(next.session, tr.mapping) : null,
      };
    }
    // The span being written moves with the edit, unless the writer itself
    // set it just now.
    if (action?.type !== 'writing' && next.writing) {
      next = {
        ...next,
        writing: {
          from: tr.mapping.map(next.writing.from, -1),
          to: tr.mapping.map(next.writing.to, 1),
        },
      };
    }
  }
  return next;
}

/**
 * What marks the AI's work in the document: the span being written (with a
 * caret), the selection a session is about and, for `inline`, the block
 * widget the panel mounts into (`createMount` builds it on first render).
 */
export function aiDecorations(
  state: EditorState,
  placement: AIPlacement,
  createMount: () => HTMLElement
): DecorationSet {
  const { session, writing } = aiPluginKey.getState(state) ?? {};
  const decorations: Decoration[] = [];
  if (writing) {
    decorations.push(
      Decoration.inline(writing.from, writing.to, { class: 'richtext-ai-writing' }),
      Decoration.widget(
        writing.to,
        () => {
          const caret = document.createElement('span');
          caret.className = 'richtext-ai-writing-caret';
          caret.setAttribute('aria-hidden', 'true');
          return caret;
        },
        { key: 'ai-writing-caret', side: 1, ignoreSelection: true }
      )
    );
  }
  if (!session) {
    return decorations.length ? DecorationSet.create(state.doc, decorations) : DecorationSet.empty;
  }
  const size = state.doc.content.size;
  const from = Math.min(session.from, size);
  const to = Math.min(Math.max(session.to, from), size);
  const $pos = state.doc.resolve(to);
  if (from !== to) {
    decorations.push(Decoration.inline(from, to, { class: 'richtext-ai-selection' }));
  } else if ($pos.depth) {
    const empty = $pos.parent.content.size === 0;
    // Inline: an empty line is replaced by the panel. External: the line
    // stays visible, so an empty one has nothing to highlight.
    if (placement === 'inline' || !empty) {
      decorations.push(
        Decoration.node($pos.before(), $pos.after(), {
          class: empty ? 'richtext-ai-empty-anchor' : 'richtext-ai-selection',
        })
      );
    }
  }
  if (placement === 'inline') {
    // A block widget participates in editor layout but is excluded from its
    // document/HTML/history. Long previews push following content down.
    decorations.push(
      Decoration.widget($pos.depth ? $pos.after() : to, createMount, {
        key: 'ai-panel',
        side: -1,
        stopEvent: () => true,
        ignoreSelection: true,
      })
    );
  }
  return DecorationSet.create(state.doc, decorations);
}

/**
 * The session to keep after `applyAI` replaced `range` in `tr`: `inline`
 * closes it; `external` keeps it on the inserted text, so the user sees what
 * changed and a refinement can replace it again.
 */
export function sessionAfterApply(
  session: AISession,
  tr: Transaction,
  placement: AIPlacement
): AISession | null {
  if (placement !== 'external') return null;
  const from = tr.mapping.map(session.from, -1);
  const to = Math.max(from, tr.mapping.map(session.to, 1));
  return { ...session, from, to };
}
