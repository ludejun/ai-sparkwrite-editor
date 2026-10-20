import { EditorContent, useEditor } from '@tiptap/react';
import {
  RichTextKit,
  RichTextKitMenus,
  RichTextKitToolbar,
  RichTextProvider,
} from 'ai-sparkwrite-editor';
import { useEffect } from 'react';

import { demoAIGenerate } from './demoAI';

import type { Editor } from '@tiptap/core';

/** Fake upload: the file as a blob URL after a short delay. */
function demoUpload(file: File): Promise<string> {
  return new Promise((resolve) => setTimeout(() => resolve(URL.createObjectURL(file)), 300));
}

/**
 * The same editor as the assembled playground, but from the kit: one
 * extension, one toolbar, one menus component — three imports in total.
 */
export function KitEditor({
  dark,
  content,
  shot = false,
  onEditor,
}: {
  dark: boolean;
  content: string;
  /** Screenshot mode: the composer starts open. */
  shot?: boolean;
  /** Hands the instance to the page header (editable toggle, recorder). */
  onEditor?: (editor: Editor | null) => void;
}) {
  const editor = useEditor({
    extensions: [
      RichTextKit.configure({
        // The playground answers itself; a real app sets `endpoint`.
        ai: { generate: demoAIGenerate },
        image: { upload: demoUpload },
        video: { upload: demoUpload },
        attachment: { upload: demoUpload },
        mermaid: { upload: demoUpload },
        // Opt-in features, switched on for the demo.
        drawer: { upload: demoUpload },
        excalidraw: {},
        twitter: {},
        emoji: {},
        recorder: {},
        placeholder: { placeholder: 'Type / for blocks, or Space on an empty line for AI…' },
      }),
    ],
    content,
  });

  useEffect(() => {
    (window as unknown as { kitEditor: unknown }).kitEditor = editor;
    onEditor?.(editor);
  }, [editor, onEditor]);

  return (
    <RichTextProvider editor={editor} dark={dark}>
      <div className='rounded-[0.5rem] bg-background shadow outline outline-1'>
        {/* One line whatever the width: narrow the window to see groups move into "More tools". */}
        <RichTextKitToolbar overflow='collapse' />
        <EditorContent editor={editor} />
        <RichTextKitMenus composer={{ defaultOpen: shot }} />
      </div>
    </RichTextProvider>
  );
}
