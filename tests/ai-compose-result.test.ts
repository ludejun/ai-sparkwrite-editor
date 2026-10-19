import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AICore } from '../src/extensions/AI/AICore';
import { AI_COMPOSER_ACTIONS } from '../src/extensions/AI/composer';
import { aiOptionsOf } from '../src/extensions/AI/writer';

import type { AIOptions } from '../src/extensions/AI/types';
import type { WriteWithAIResult } from '../src/extensions/AI/writer';
import type { Editor } from '@tiptap/core';

/** The slice of an editor `aiOptionsOf` looks at. */
function editorWith(extension: { name: string; options: unknown }): Editor {
  return { extensionManager: { extensions: [extension] } } as unknown as Editor;
}

test('onComposeResult defaults to undefined and is accepted by configure()', () => {
  assert.equal(AICore.options.onComposeResult, undefined);
  assert.equal(aiOptionsOf(editorWith(AICore))?.onComposeResult, undefined);

  const onComposeResult: NonNullable<AIOptions['onComposeResult']> = ({ action }) =>
    action === 'editor.ai.compose.title.suggest';
  const configured = AICore.configure({ onComposeResult });
  assert.equal(configured.options.onComposeResult, onComposeResult);
  // The other defaults survive the merge.
  assert.equal(configured.options.composer, true);
  assert.equal(configured.options.documentContext, 12000);

  const options = aiOptionsOf(editorWith(configured));
  assert.ok(options);
  assert.equal(options.onComposeResult, onComposeResult);
  assert.equal(aiOptionsOf(editorWith({ name: 'other', options: {} })), null);
});

test('the hook receives the chip key and decides whether the answer is handled', async () => {
  const seen: string[] = [];
  const configured = AICore.configure({
    onComposeResult: async ({ action, markdown, target, result }) => {
      seen.push(action, markdown, String(target), result.markdown);
      return action === 'editor.ai.compose.title.suggest';
    },
  });
  const editor = editorWith(configured);
  const hook = aiOptionsOf(editor)!.onComposeResult!;
  const result = {
    from: 0,
    to: 0,
    markdown: '# A title',
    messages: [],
    discard: () => null,
    keep: () => {},
  } satisfies WriteWithAIResult;

  const title = AI_COMPOSER_ACTIONS.find((a) => a.key === 'editor.ai.compose.title.suggest')!;
  assert.equal(
    await hook({
      action: title.key,
      markdown: result.markdown,
      target: title.target,
      editor,
      result,
    }),
    true
  );
  const summary = AI_COMPOSER_ACTIONS.find((a) => a.key === 'editor.ai.compose.summarize')!;
  assert.equal(
    await hook({ action: summary.key, markdown: 'x', target: summary.target, editor, result }),
    false
  );
  assert.deepEqual(seen, [
    'editor.ai.compose.title.suggest',
    '# A title',
    'start',
    '# A title',
    'editor.ai.compose.summarize',
    'x',
    'start',
    '# A title',
  ]);
});
