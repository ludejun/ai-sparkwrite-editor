import { NodeSelection } from '@tiptap/pm/state';

import { isEditorEditable } from '@/utils/editable';

import type { Editor } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';

/**
 * True when the selection is that one node (a NodeSelection of one of
 * `names`). A range that merely contains such a node, Select All included,
 * is not: its menu would act on the whole range.
 */
export function isNodeSelected(state: EditorState, names: readonly string[]): boolean {
  const { selection } = state;

  return selection instanceof NodeSelection && names.includes(selection.node.type.name);
}

/** Deletes the selected node if it is one of `names`; never a wider range. */
export function deleteSelectedNode(editor: Editor, names: readonly string[]): boolean {
  const { state, dispatch } = editor.view;

  if (!isEditorEditable(editor) || !isNodeSelected(state, names)) return false;

  const { from, to } = state.selection;

  dispatch(state.tr.delete(from, to).scrollIntoView());

  return true;
}
