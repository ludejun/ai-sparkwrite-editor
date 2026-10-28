import { useCallback, useSyncExternalStore } from 'react';

import { useEditorInstance } from '@/store/editor';
import { isEditorEditable, watchEditable } from '@/utils/editable';

import type { Editor } from '@tiptap/core';

const noop = () => {};

/**
 * Whether `editor` (or the provider's editor) is editable, re-rendering on every
 * change, `setEditable(x, false)` included. Node views pass their own `editor`:
 * a read-only editor rendered inside another editor's provider must not read
 * the outer one.
 */
function useEditableEditor(editor?: Editor | null) {
  const contextEditor = useEditorInstance();
  const target = editor === undefined ? contextEditor : editor;

  const subscribe = useCallback(
    (onChange: () => void) => (target ? watchEditable(target, onChange) : noop),
    [target]
  );
  const getSnapshot = () => isEditorEditable(target);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export { useEditableEditor };
