import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { AllSelection, NodeSelection } from '@tiptap/pm/state';
import { Editor, EditorContent } from '@tiptap/react';
import { createRoot } from 'react-dom/client';
import * as Y from 'yjs';

import { RichTextBubbleLink } from '../src/components/Bubble/RichTextBubbleLink';
import { RichTextBubbleImage } from '../src/components/Bubble/RichTextBubbleMedia';
import { RichTextBubbleTable } from '../src/components/Bubble/RichTextBubbleTable';
import { RichTextProvider } from '../src/components/RichTextProvider';
import { Bold, RichTextBold } from '../src/extensions/Bold';
import { CodeBlock } from '../src/extensions/CodeBlock';
import { CodeView } from '../src/extensions/CodeView';
import { Collaboration, isChangeOrigin } from '../src/extensions/Collaboration/Collaboration';
import { YSyncProvider, collaborationKitOptions } from '../src/extensions/Collaboration/provider';
import { Details } from '../src/extensions/Details';
import { History, RichTextRedo, RichTextUndo } from '../src/extensions/History';
import { Image } from '../src/extensions/Image';
import { Link } from '../src/extensions/Link';
import { Table } from '../src/extensions/Table';
import { RichTextKit } from '../src/kit/react';
import { useEditableEditor } from '../src/store/store';

/*
 * Every control against `setEditable(x, false)`, the switch StarNote uses so that
 * toggling does not autosave: it emits no `update` event and runs no transaction.
 */

const results: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  results.push(`PASS ${label}`);
}

async function waitFor(condition: () => unknown, label: string, timeout = 1500) {
  const start = performance.now();
  while (!condition()) {
    if (performance.now() - start > timeout) throw new Error(`timeout: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  results.push(`PASS ${label}`);
}

const tick = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

// The Image extension rejects data: URLs by default; the file need not exist.
const PIXEL = '/tests/pixel.png';

const editor = new Editor({
  extensions: [
    Document,
    Paragraph,
    Text,
    Bold,
    History,
    Link,
    CodeBlock,
    Image,
    CodeView,
    Table,
    Details,
  ],
  content: `
    <p>Hello <a href="/notes/abc">a note</a> world</p>
    <pre><code class="language-js">const a = 1;</code></pre>
    <table><tr><td><p>cell</p></td><td><p>two</p></td></tr></table>
    <details><summary>Summary</summary><div data-type="detailsContent"><p>Hidden</p></div></details>
  `,
});
editor.commands.insertContentAt(editor.state.doc.child(0).nodeSize, {
  type: 'imageBlock',
  attrs: { src: PIXEL, width: 40 },
});
// A ReadOnlyDoc-style viewer without a provider of its own, rendered inside the main one.
const viewer = new Editor({
  extensions: [Document, Paragraph, Text],
  content: '<p>viewer</p>',
  editable: false,
});

const seen = { main: true, viewer: true };
function Probe() {
  seen.main = useEditableEditor();
  seen.viewer = useEditableEditor(viewer);
  return null;
}

let updates = 0;
editor.on('update', () => updates++);

const root = createRoot(document.querySelector('#root')!);
root.render(
  <RichTextProvider editor={editor}>
    <div id='toolbar'>
      <RichTextBold />
      <RichTextUndo />
      <RichTextRedo />
    </div>
    <Probe />
    <EditorContent editor={editor} />
    <RichTextBubbleLink />
    <RichTextBubbleTable />
    <RichTextBubbleImage />
    <EditorContent editor={viewer} />
  </RichTextProvider>
);

const byLabel = (label: string, scope: ParentNode = document) =>
  scope.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const codeBlock = () => editor.view.dom.querySelector('.richtext-code-block')!;
const setEditable = async (value: boolean) => {
  editor.setEditable(value, false);
  await tick();
};

async function editableState() {
  const toolbar = () => document.querySelector('#toolbar');
  await waitFor(() => toolbar() && byLabel('Bold', toolbar()!), 'toolbar renders');
  const bold = byLabel('Bold', toolbar()!)!;
  check(seen.main && !bold.disabled, 'editable: toolbar enabled');
  check(!seen.viewer, 'a read-only editor inside the provider reads its own state');
  check(byLabel('Delete', codeBlock()), 'editable: code block offers Delete');

  updates = 0;
  await setEditable(false);
  check(!seen.main && bold.disabled, 'setEditable(false, false) disables the toolbar');
  check(!seen.viewer, 'the viewer stays read-only');
  check(updates === 0, 'no update event while switching');

  const before = editor.state.doc;
  editor.commands.setTextSelection({ from: 1, to: 6 });
  bold.disabled = false; // a stale button that still gets clicked
  bold.click();
  check(editor.state.doc.eq(before), 'a stale toolbar click does not change a read-only doc');

  check(!byLabel('Delete', codeBlock()), 'read-only: code block Delete is gone');
  check(byLabel('CopyToClipboard', codeBlock()), 'read-only: code block keeps Copy');
  check(!codeBlock().querySelector('[aria-haspopup="dialog"]'), 'read-only: no language picker');

  let imagePos = -1;
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name === 'imageBlock') imagePos = offset;
  });
  editor.view.dispatch(
    editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, imagePos))
  );
  await tick();
  check(
    !editor.view.dom.querySelector('.image-resizer__handler'),
    'read-only: a selected image has no resize handles'
  );

  await setEditable(true);
  check(seen.main && !bold.disabled, 'setEditable(true, false) re-enables the toolbar');
  check(byLabel('Delete', codeBlock()), 'editable again: code block Delete is back');
  await waitFor(
    () => editor.view.dom.querySelector('.image-resizer__handler'),
    'editable again: the selected image has resize handles'
  );
}

async function selectAllAndMedia() {
  // The image is still selected from the previous step.
  await waitFor(() => byLabel('Remove'), 'a selected image shows its bubble');
  editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)));
  await waitFor(() => !byLabel('Remove'), 'Select All shows no image bubble');
}

async function codeView() {
  const before = editor.getJSON();
  const undoable = editor.can().undo();
  updates = 0;

  editor.commands.toggleCodeView();
  const textarea = () => document.querySelector<HTMLTextAreaElement>('textarea.tiptap-code-view');
  check(textarea() && editor.view.dom.style.display === 'none', 'code view shows the source');
  check(updates === 0, 'opening code view emits no update');
  check(JSON.stringify(editor.getJSON()) === JSON.stringify(before), 'opening keeps the doc');
  check(editor.can().undo() === undoable, 'opening adds no undo step');
  check(textarea()!.value.includes('href="/notes/abc"'), 'the source is the document HTML');

  editor.commands.toggleCodeView();
  check(!textarea() && editor.view.dom.style.display === '', 'leaving restores the document');
  check(updates === 0, 'leaving unchanged source emits no update');

  editor.commands.toggleCodeView();
  textarea()!.value = '<p>changed <strong>here</strong></p>';
  editor.commands.toggleCodeView();
  check(editor.getText() === 'changed here' && updates === 1, 'leaving edited source applies it');
  editor.commands.undo();
  check(JSON.stringify(editor.getJSON()) === JSON.stringify(before), 'one undo restores the doc');

  editor.commands.toggleCodeView();
  await setEditable(false);
  check(!textarea(), 'turning read-only closes code view');
  check(JSON.stringify(editor.getJSON()) === JSON.stringify(before), '... without applying it');
  await setEditable(true);
}

async function links() {
  check(/<a [^>]*href="\/notes\/abc"/.test(editor.getHTML()), 'a relative link keeps its href');

  const anchor = editor.view.dom.querySelector('a')!;
  anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await waitFor(() => byLabel('Edit Link'), 'hovering a link shows its bubble');
  editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
  await waitFor(() => !byLabel('Edit Link'), 'typing hides the link bubble');

  anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await waitFor(() => byLabel('Edit Link'), 'link bubble shown again');
  await setEditable(false);
  check(!byLabel('Edit Link'), 'read-only hides the link bubble');
  await setEditable(true);

  editor.commands.setTextSelection({ from: 1, to: 6 });
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  editor.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', metaKey: mac, ctrlKey: !mac, bubbles: true })
  );
  await waitFor(() => document.querySelector('input[type="url"]'), 'Mod-K opens the link form');
  document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await waitFor(() => !document.querySelector('input[type="url"]'), 'a click outside closes it');
}

async function tableMenu() {
  const cell = editor.view.dom.querySelector('td')!;
  const rect = cell.getBoundingClientRect();
  cell.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 4,
      clientY: rect.top + 4,
    })
  );
  await waitFor(() => document.querySelector('[role="menu"]'), 'right click opens the table menu');
  const trigger = document.querySelector('[aria-haspopup="menu"][aria-expanded="true"]')!;
  check(trigger.parentElement === document.body, 'the menu anchor lives in <body>');
  check(!editor.view.dom.parentElement!.contains(trigger), '... not inside the editor');

  await setEditable(false);
  await waitFor(() => !document.querySelector('[role="menu"]'), 'read-only closes the table menu');
  await setEditable(true);
  check(!document.querySelector('[role="menu"]'), 'and it does not come back when editable');
}

async function details() {
  const dom = editor.view.dom.querySelector<HTMLElement>('[data-type="details"]')!;
  const toggle = dom.querySelector<HTMLButtonElement>(':scope > button')!;
  check(toggle.getAttribute('aria-label') === 'Expand', 'Details toggle label is translated');

  await setEditable(false);
  toggle.click();
  check(dom.classList.contains('is-open'), 'a reader can open Details');
  let stored: unknown;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'details') stored = node.attrs.open;
  });
  check(stored === false, '... without changing the document');

  await setEditable(true);
  check(!dom.classList.contains('is-open'), 'editable again: Details shows the stored state');
  toggle.click();
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'details') stored = node.attrs.open;
  });
  check(stored === true && dom.classList.contains('is-open'), 'then a click opens both');
}

async function collaborativeUndo() {
  const collab = new Editor({
    element: document.querySelector('#collab') as HTMLElement,
    extensions: [Document, Paragraph, Text, Collaboration.configure({ document: new Y.Doc() })],
  });
  const collabRoot = createRoot(document.querySelector('#collab-toolbar')!);
  collabRoot.render(
    <RichTextProvider editor={collab}>
      <RichTextUndo />
      <RichTextRedo />
    </RichTextProvider>
  );
  const scope = document.querySelector('#collab-toolbar')!;
  await waitFor(() => byLabel('Undo', scope), 'collaborative toolbar renders');
  // A document with content, and past Y.UndoManager's capture window: undoing
  // the very first edit of an empty fragment would remove its only paragraph,
  // which y-prosemirror writes back as a new step (clearing Redo).
  collab.commands.insertContent('seed ');
  await tick(600);

  collab.commands.insertContent('typed');
  await waitFor(() => !byLabel('Undo', scope)!.disabled, 'Undo enabled after typing');
  collab.commands.undo();
  await waitFor(() => !byLabel('Redo', scope)!.disabled, 'Redo enabled after a Yjs undo');
  collab.commands.redo();
  await waitFor(() => byLabel('Redo', scope)!.disabled, 'Redo disabled after redoing');

  collabRoot.unmount();
  collab.destroy();
}

// The setup the collaboration guide documents: the kit plus collaborationKitOptions,
// two clients whose providers are wired to each other in place of a socket.
async function collaborationKit() {
  const client = (name: string, color: string) => {
    const doc = new Y.Doc();
    const provider = new YSyncProvider(doc);
    const remote: boolean[] = [];
    const editor = new Editor({
      element: document.querySelector(`#kit-${name}`) as HTMLElement,
      extensions: [
        RichTextKit.configure({
          ...collaborationKitOptions({ document: doc, provider, user: { name, color } }),
        }),
      ],
      onUpdate: ({ transaction }) => remote.push(isChangeOrigin(transaction)),
    });
    return { doc, provider, editor, remote };
  };
  const a = client('ada', '#7c3aed');
  const b = client('bob', '#16a34a');
  a.provider.connect((data) => b.provider.receive(data));
  b.provider.connect((data) => a.provider.receive(data));
  a.provider.connect((data) => b.provider.receive(data));
  await waitFor(() => a.provider.synced && b.provider.synced, 'both kit clients sync');

  const names = a.editor.extensionManager.extensions.map((extension) => extension.name);
  check(
    names.includes('collaboration') &&
      names.includes('collaborationCaret') &&
      !names.includes('undoRedo'),
    'the kit swaps history for collaboration'
  );

  a.editor.commands.insertContent('from ada');
  await waitFor(() => b.editor.getText() === 'from ada', 'an edit reaches the other client');
  check(a.remote.at(-1) === false, 'isChangeOrigin is false for a local edit');
  check(b.remote.at(-1) === true, 'isChangeOrigin is true for the remote one');

  a.editor.commands.focus('end');
  await waitFor(
    () => b.editor.view.dom.querySelector('.richtext-collab-caret__label')?.textContent === 'ada',
    'the remote caret shows the user name'
  );

  for (const c of [a, b]) {
    c.editor.destroy();
    c.provider.destroy();
    c.doc.destroy();
  }
}

async function run() {
  await editableState();
  await selectAllAndMedia();
  await codeView();
  await links();
  await tableMenu();
  await details();
  await collaborativeUndo();
  await collaborationKit();
  document.querySelector('#results')!.textContent = `${results.join('\n')}\nALL PASS`;
}

run().catch((error) => {
  document.querySelector('#results')!.textContent = `${results.join('\n')}\nFAIL ${error.stack}`;
  console.error(error);
});
