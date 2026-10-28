---
description: Link

next:
  text: Mention
  link: /extensions/Mention/index.md
---

# Link

Add or edit a hyperlink on text.

## Setup

Start with the packages in [Getting Started](/guide/getting-started). The complete example below registers the feature and renders its UI — pick the React or the Vue tab. In an existing editor, merge the imports and extension entries into your setup, and place the controls inside your existing `RichTextProvider`.

::: code-group

```tsx [React]
'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { RichTextProvider, Link, RichTextLink, RichTextBubbleLink } from 'ai-sparkwrite-editor';
import 'ai-sparkwrite-editor/style.css';

const extensions = [Document, Paragraph, Text, Link];

export default function LinkExample() {
  const editor = useEditor({
    extensions,
    content: '<p>Try this feature here.</p>',
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <RichTextProvider editor={editor}>
      <RichTextLink />
      <RichTextBubbleLink />
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
import { Link, RichTextProvider, RichTextLink, RichTextBubbleLink } from 'ai-sparkwrite-editor/vue';
import 'ai-sparkwrite-editor/style.css';

const extensions = [Document, Paragraph, Text, Link];

const editor = useEditor({
  extensions,
  content: '<p>Try this feature here.</p>',
});
</script>

<template>
  <RichTextProvider :editor="editor">
    <RichTextLink />
    <RichTextBubbleLink />
    <EditorContent :editor="editor" />
  </RichTextProvider>
</template>
```

:::


## How to use

Select the text to link, open the toolbar dialog, and enter a URL. Mount `RichTextBubbleLink` to edit a link after selecting it. Use `editor.chain().focus().setLink({ href: "https://example.com" }).run()` to apply a link to a selection, and `unsetLink()` to remove it.

The address is stored as typed, with one exception: a bare domain (`example.com/a`, `localhost:3000`) gets `https://` and a bare e-mail address gets `mailto:`. Paths (`/notes/abc`, `./a`), anchors (`#x`), queries and `mailto:` / `tel:` links are kept, and a disallowed scheme such as `javascript:` is refused. The form's **Open in new tab** sets `target="_blank"`; unticked, the link has no target. `Mod-K` opens the link card from the keyboard (the bubble's when `RichTextBubbleLink` is mounted, else the toolbar's): it edits the link under the caret or links the selection.
