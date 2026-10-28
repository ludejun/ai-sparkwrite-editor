---
description: CodeView

next:
  text: Color
  link: /extensions/Color/index.md
---

# CodeView

Toggle between rich text and editable HTML source in the document area.

## Setup

Start with the packages in [Getting Started](/guide/getting-started). The complete example below registers the feature and renders its UI — pick the React or the Vue tab. In an existing editor, merge the imports and extension entries into your setup, and place the controls inside your existing `RichTextProvider`.

::: code-group

```tsx [React]
'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { RichTextProvider, CodeView, RichTextCodeView } from 'ai-sparkwrite-editor';
import 'ai-sparkwrite-editor/style.css';

const extensions = [Document, Paragraph, Text, CodeView];

export default function CodeViewExample() {
  const editor = useEditor({
    extensions,
    content: '<p>Try this feature here.</p>',
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <RichTextProvider editor={editor}>
      <RichTextCodeView />
      <EditorContent editor={editor} />
    </RichTextProvider>
  );
}
```

```vue [Vue]
<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { CodeView, RichTextProvider } from 'ai-sparkwrite-editor/vue';
import 'ai-sparkwrite-editor/style.css';

const extensions = [Document, Paragraph, Text, CodeView];

const editor = useEditor({
  extensions,
  content: '<p>Try this feature here.</p>',
});
</script>

<template>
  <RichTextProvider :editor="editor">
    <EditorContent :editor="editor" />
  </RichTextProvider>
</template>
```

:::

::: tip Vue
Not in the Vue layer yet: `RichTextCodeView` — run the corresponding command from your own control, or see [Frameworks](/guide/frameworks).
:::

## How to use

Click the toolbar button to show the document's HTML in a source editor laid over the document. Opening it does not touch the document: no update is emitted, nothing is autosaved or broadcast to collaborators, and the editor's undo history is left alone. Click again to leave: if the source was edited, it is parsed back into the document as one undoable step; otherwise nothing changes. Until the source is edited it follows changes made elsewhere (for example by collaborators). Switching the editor to read-only closes the source view without applying it. Unsupported markup may be removed by the active schema. This is an HTML source view, not the [Code Block](/extensions/CodeBlock/) feature for displaying code in a document.
