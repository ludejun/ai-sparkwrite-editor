import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Editor, Node } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { AllSelection, NodeSelection } from '@tiptap/pm/state';

import { deleteSelectedNode, isNodeSelected } from '../src/components/Bubble/nodeSelection';
import { changedSource, CodeView } from '../src/extensions/CodeView/CodeView';
import { Link, applyLinkEdit, normalizeLinkHref } from '../src/extensions/Link/Link';
import { markdownToPasteHTML } from '../src/extensions/MarkdownPaste/MarkdownPaste';
import { formatSearchResult } from '../src/extensions/SearchAndReplace/SearchAndReplace';
import { guardButtonActions } from '../src/hooks/useButtonProps';
import { isEditorEditable } from '../src/utils/editable';

import type { JSONContent } from '@tiptap/core';

// Headless editors (no DOM): content goes in as JSON, since parsing HTML needs a document.
const ImageBlock = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,
  selectable: true,
});

function paragraph(text: string): JSONContent {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

function makeEditor(content: JSONContent[], extensions = [Link]) {
  const editor = new Editor({
    extensions: [Document, Paragraph, Text, ImageBlock, ...extensions],
    content: { type: 'doc', content },
  });
  // Tiptap reports an editor without a view as destroyed, and the UI guards
  // treat that as not editable; stand in for a mounted one.
  Object.defineProperty(editor, 'isDestroyed', { get: () => false });
  return editor;
}

function linkMark(editor: Editor) {
  let attrs: Record<string, unknown> | undefined;
  editor.state.doc.descendants((node) => {
    attrs ??= node.marks.find((mark) => mark.type.name === 'link')?.attrs;
  });
  return attrs;
}

test('link hrefs: only bare domains and addresses get a scheme', () => {
  const cases: [string, string][] = [
    ['/notes/abc', '/notes/abc'],
    ['./a/b', './a/b'],
    ['#section', '#section'],
    ['?q=1', '?q=1'],
    ['notes/abc', 'notes/abc'],
    ['mailto:a@b.com', 'mailto:a@b.com'],
    ['tel:+8613800000000', 'tel:+8613800000000'],
    ['https://example.com/x', 'https://example.com/x'],
    ['HTTP://EXAMPLE.COM', 'HTTP://EXAMPLE.COM'],
    ['example.com', 'https://example.com'],
    ['www.example.com/a?b#c', 'https://www.example.com/a?b#c'],
    ['localhost:3000/notes', 'https://localhost:3000/notes'],
    ['a@b.com', 'mailto:a@b.com'],
    ['  example.com  ', 'https://example.com'],
    ['', ''],
  ];
  for (const [input, expected] of cases) assert.equal(normalizeLinkHref(input), expected, input);
});

test('applying a link keeps relative paths and honours "open in new tab"', () => {
  const editor = makeEditor([paragraph('hello world')]);
  editor.commands.setTextSelection({ from: 1, to: 6 });

  assert.equal(applyLinkEdit(editor, { link: '/notes/abc', text: 'hello' }), true);
  assert.deepEqual(
    { href: linkMark(editor)?.href, target: linkMark(editor)?.target },
    { href: '/notes/abc', target: null }
  );
  assert.equal(editor.state.doc.textContent, 'hello world');

  // Editing the link under the caret replaces the whole link.
  editor.commands.setTextSelection(3);
  applyLinkEdit(editor, { link: 'example.com', text: 'hello', openInNewTab: true });
  assert.deepEqual(
    { href: linkMark(editor)?.href, target: linkMark(editor)?.target },
    { href: 'https://example.com', target: '_blank' }
  );
  assert.equal(editor.state.doc.textContent, 'hello world');
  editor.destroy();
});

test('applying a link refuses javascript: and read-only editors', () => {
  const editor = makeEditor([paragraph('hello')]);
  const before = editor.state.doc;
  editor.commands.setTextSelection({ from: 1, to: 6 });

  assert.equal(applyLinkEdit(editor, { link: 'javascript:alert(1)', text: 'hello' }), false);
  assert.ok(editor.state.doc.eq(before));

  editor.setEditable(false, false);
  assert.equal(isEditorEditable(editor), false);
  assert.equal(applyLinkEdit(editor, { link: '/notes/abc', text: 'hello' }), false);
  assert.ok(editor.state.doc.eq(before));
  editor.destroy();
});

test('toolbar actions re-check editability when they run', () => {
  const calls: string[] = [];
  const editor = { isDestroyed: false, isEditable: true } as unknown as Editor;
  const props = guardButtonActions(editor, {
    icon: 'Bold',
    action: () => calls.push('action'),
    undo: { action: () => calls.push('undo') },
    items: [{ title: 'H1', action: () => calls.push('h1') }, 'divider'],
  });

  props.action();
  props.undo.action();
  (props.items[0] as { action: () => void }).action();
  assert.deepEqual(calls, ['action', 'undo', 'h1']);
  assert.equal(props.items[1], 'divider');
  assert.equal(props.icon, 'Bold');

  // Turned read-only after the button rendered (`setEditable(false, false)`).
  (editor as { isEditable: boolean }).isEditable = false;
  props.action();
  props.undo.action();
  (props.items[0] as { action: () => void }).action();
  assert.deepEqual(calls, ['action', 'undo', 'h1']);
});

test('media bubbles: Select All is not an image selection, and Delete removes only the node', () => {
  const blocks = Array.from({ length: 21 }, (_, i) => paragraph(`block ${i}`));
  const editor = makeEditor([...blocks.slice(0, 10), { type: 'imageBlock' }, ...blocks.slice(10)]);
  const { state } = editor;

  editor.view.dispatch(state.tr.setSelection(new AllSelection(state.doc)));
  assert.equal(isNodeSelected(editor.state, ['imageBlock']), false);
  assert.equal(deleteSelectedNode(editor, ['imageBlock']), false);
  assert.equal(editor.state.doc.childCount, 22);

  let imagePos = -1;
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name === 'imageBlock') imagePos = offset;
  });
  editor.view.dispatch(
    editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, imagePos))
  );
  assert.equal(isNodeSelected(editor.state, ['imageBlock']), true);
  assert.equal(isNodeSelected(editor.state, ['video']), false);
  assert.equal(deleteSelectedNode(editor, ['imageBlock']), true);
  assert.equal(editor.state.doc.childCount, 21);
  assert.equal(editor.state.doc.textContent, blocks.map((b) => b.content![0].text).join(''));
  editor.destroy();
});

test('code view applies only edited source and needs a mounted view', () => {
  assert.equal(changedSource({ isActive: true, originalContent: '<p>a</p>' }, '<p>a</p>'), null);
  assert.equal(
    changedSource({ isActive: true, originalContent: '<p>a</p>' }, '<p>b</p>'),
    '<p>b</p>'
  );

  const editor = makeEditor([paragraph('hello')], [CodeView]);
  const before = editor.state.doc;
  let updates = 0;
  editor.on('update', () => updates++);

  assert.equal(editor.can().toggleCodeView(), false);
  assert.equal(editor.commands.toggleCodeView(), false);
  assert.ok(editor.state.doc.eq(before));
  assert.equal(updates, 0);
  editor.destroy();
});

test('search counter reads 0/0 without results', () => {
  assert.equal(formatSearchResult(0, 0), '0/0');
  assert.equal(formatSearchResult(0, 3), '1/3');
  assert.equal(formatSearchResult(2, 3), '3/3');
  assert.equal(formatSearchResult(5, 3), '3/3');
});

test('pasted Markdown code blocks get no trailing empty line', () => {
  const html = markdownToPasteHTML(
    '```js\nconst a = 1;\nconst b = 2;\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |'
  );
  assert.match(html, /<pre><code class="language-js">const a = 1;\nconst b = 2;<\/code><\/pre>/);
  assert.doesNotMatch(html, /<\/?(thead|tbody)>/);
});
