<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3';
import {
  RichTextKit,
  RichTextKitMenus,
  RichTextKitToolbar,
  RichTextProvider,
} from 'ai-sparkwrite-editor/vue';

import { demoAIGenerate } from '../demoAI';

defineProps<{ dark: boolean }>();

/** Fake upload: the file as a blob URL after a short delay. */
function demoUpload(file: File): Promise<string> {
  return new Promise((resolve) => setTimeout(() => resolve(URL.createObjectURL(file)), 300));
}

// One import, one extension: every Vue feature with its node views.
const editor = useEditor({
  extensions: [
    RichTextKit.configure({
      ai: { generate: demoAIGenerate },
      image: { upload: demoUpload, enableAlt: true },
      video: { upload: demoUpload },
      attachment: { upload: demoUpload },
      column: {},
    }),
  ],
  content: [
    '<h1>ai-sparkwrite-editor in Vue, from the kit</h1>',
    '<p><code>RichTextKit</code> registers every Vue feature, <code>RichTextKitToolbar</code> and <code>RichTextKitMenus</code> render the UI — three imports from <code>ai-sparkwrite-editor/vue</code>.</p>',
    '<p>Select some text to see the bubble menu, right-click the table for its menu, or click the <strong>AI</strong> button.</p>',
    '<div class="notice" data-type="tip"><p>Notices are ordinary blocks in a coloured box; put the caret here to switch the type.</p></div>',
    '<table><tbody><tr><th><p>Import</p></th><th><p>Gives you</p></th></tr><tr><td><p>RichTextKit</p></td><td><p>every extension, configured in one place</p></td></tr><tr><td><p>RichTextKitToolbar</p></td><td><p>a toolbar for whatever is registered</p></td></tr><tr><td><p>RichTextKitMenus</p></td><td><p>the composer dock and the bubble menus</p></td></tr></tbody></table>',
  ].join(''),
});

(window as unknown as { vueEditor: unknown }).vueEditor = editor;
</script>

<template>
  <RichTextProvider :editor="editor" :dark="dark">
    <div class="rounded-[0.5rem] bg-background shadow outline outline-1">
      <RichTextKitToolbar overflow="collapse" />
      <EditorContent :editor="editor" />
      <RichTextKitMenus />
    </div>
  </RichTextProvider>
</template>
