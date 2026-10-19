import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Schema, Slice, Fragment } from '@tiptap/pm/model';
import { EditorState, Plugin } from '@tiptap/pm/state';

import { AICore } from '../src/extensions/AI/AICore';
import {
  aiDecorations,
  mapAISession,
  nextAISessionId,
  nextAIState,
  sessionAfterApply,
  type AIPlacement,
} from '../src/extensions/AI/session';
import {
  aiPluginKey,
  type AIAction,
  type AISession,
  type AIState,
} from '../src/extensions/AI/state';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*', toDOM: () => ['p', 0] },
    text: {},
  },
});

const p = (text: string) => schema.node('paragraph', null, text ? [schema.text(text)] : []);

/** An editor state with only the AI plugin's state handling, as `AICore` registers it. */
function stateWith(placement: AIPlacement, ...paragraphs: string[]) {
  const plugin = new Plugin<AIState>({
    key: aiPluginKey,
    state: {
      init: () => ({ session: null, writing: null, composer: false }),
      apply: (tr, previous) => nextAIState(previous, tr, placement),
    },
  });
  return EditorState.create({
    doc: schema.node('doc', null, paragraphs.map(p)),
    plugins: [plugin],
  });
}

function open(state: EditorState, from: number, to: number): EditorState {
  const session: AISession = { from, to, id: nextAISessionId() };
  return state.apply(
    state.tr.setMeta(aiPluginKey, { type: 'session', session } satisfies AIAction)
  );
}

const sessionOf = (state: EditorState) => aiPluginKey.getState(state)?.session ?? null;

test('placement defaults to inline', () => {
  assert.equal(AICore.options.placement, 'inline');
  assert.equal(AICore.configure({ placement: 'external' }).options.placement, 'external');
  // other defaults survive the merge
  assert.equal(AICore.configure({ placement: 'external' }).options.composer, true);
});

test('inline: a document edit closes the session (unchanged behaviour)', () => {
  let state = open(stateWith('inline', 'Hello world'), 1, 6);
  assert.ok(sessionOf(state));
  state = state.apply(state.tr.insertText('!', 12));
  assert.equal(sessionOf(state), null);
});

test('external: the session follows edits and keeps its id', () => {
  let state = open(stateWith('external', 'Hello world'), 7, 12); // "world"
  const opened = sessionOf(state)!;
  // typing before the selection pushes it along
  state = state.apply(state.tr.insertText('Oh, ', 1));
  let s = sessionOf(state)!;
  assert.deepEqual([s.from, s.to], [11, 16]);
  assert.equal(state.doc.textBetween(s.from, s.to), 'world');
  assert.equal(s.id, opened.id);
  // typing right after it stays outside
  state = state.apply(state.tr.insertText('!', 16));
  s = sessionOf(state)!;
  assert.equal(state.doc.textBetween(s.from, s.to), 'world');
  // a remote-style edit elsewhere keeps it too
  state = state.apply(state.tr.insertText('X', 1));
  s = sessionOf(state)!;
  assert.equal(state.doc.textBetween(s.from, s.to), 'world');
  assert.equal(s.id, opened.id);
});

test('external: deleting the selected text collapses the session to a caret', () => {
  let state = open(stateWith('external', 'Hello world'), 7, 12);
  state = state.apply(state.tr.delete(6, 12));
  const s = sessionOf(state)!;
  assert.equal(s.from, s.to);
});

test('mapAISession returns the same object when nothing moved', () => {
  const state = stateWith('external', 'Hello world');
  const session: AISession = { from: 1, to: 3, id: 1 };
  const tr = state.tr.insertText('!', 10);
  assert.equal(mapAISession(session, tr.mapping), session);
});

test('decorations: inline adds the panel widget, external only the highlight', () => {
  const mount = () => ({}) as HTMLElement;
  for (const placement of ['inline', 'external'] as const) {
    const state = open(stateWith(placement, 'Hello world'), 1, 6);
    const decos = aiDecorations(state, placement, mount).find();
    const widgets = decos.filter(
      (d) =>
        (d as unknown as { type: { side?: number } }).type.side !== undefined && d.from === d.to
    );
    const inline = decos.filter((d) => d.from !== d.to);
    assert.equal(inline.length, 1, `${placement}: the selection is highlighted`);
    assert.equal(widgets.length, placement === 'inline' ? 1 : 0, `${placement}: panel widget`);
  }
});

test('decorations: external does not hide an empty line the caret is on', () => {
  const mount = () => ({}) as HTMLElement;
  const inline = open(stateWith('inline', 'Hello', ''), 8, 8);
  const external = open(stateWith('external', 'Hello', ''), 8, 8);
  const anchor = (s: EditorState, placement: AIPlacement) =>
    aiDecorations(s, placement, mount)
      .find()
      .filter((d) => d.from !== d.to);
  assert.equal(anchor(inline, 'inline').length, 1);
  assert.equal(anchor(external, 'external').length, 0);
});

test('applyAI: inline closes the session, external keeps it on the inserted text', () => {
  const state = open(stateWith('external', 'Hello world'), 7, 12);
  const session = sessionOf(state)!;
  const slice = new Slice(Fragment.from(schema.text('there, friend')), 0, 0);
  const tr = state.tr.replaceRange(session.from, session.to, slice);
  assert.equal(sessionAfterApply(session, tr, 'inline'), null);
  const kept = sessionAfterApply(session, tr, 'external')!;
  assert.equal(tr.doc.textBetween(kept.from, kept.to), 'there, friend');
  assert.equal(kept.id, session.id);
  // the plugin keeps the session when the apply transaction sets it
  const next = state.apply(
    tr.setMeta(aiPluginKey, { type: 'session', session: kept } satisfies AIAction)
  );
  assert.deepEqual(sessionOf(next), kept);
});
