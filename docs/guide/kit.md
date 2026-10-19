---
description: RichTextKit — the whole editor as one extension, with a ready-made toolbar and menus

next:
  text: Toolbar
  link: /guide/toolbar.md
---

# RichTextKit

`RichTextKit` is every feature of the editor as **one Tiptap extension**, the way `StarterKit` bundles Tiptap's basics. `RichTextKitToolbar` renders a complete toolbar and `RichTextKitMenus` the floating UI — the AI composer dock, the text bubble with the Improve menu, the table, link, media and block bubbles, the drag handle and the slash menu — for whatever the kit registered. Three imports, one working editor; switch a feature off and its button and menus go with it.

::: code-group

```tsx [React]
'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import {
  RichTextKit,
  RichTextKitMenus,
  RichTextKitToolbar,
  RichTextProvider,
} from 'ai-sparkwrite-editor';
import 'ai-sparkwrite-editor/style.css';

export default function Editor() {
  const editor = useEditor({
    extensions: [
      RichTextKit.configure({
        ai: { endpoint: '/api/ai' }, // one URL on your backend
        image: { upload: (file) => uploadToYourStorage(file) },
        placeholder: { placeholder: 'Type / for blocks, Space on an empty line for AI…' },
        twitter: false,
      }),
    ],
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <RichTextProvider editor={editor}>
      <RichTextKitToolbar />
      <EditorContent editor={editor} />
      <RichTextKitMenus />
    </RichTextProvider>
  );
}
```

```vue [Vue]
<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3';
import {
  RichTextKit,
  RichTextKitMenus,
  RichTextKitToolbar,
  RichTextProvider,
} from 'ai-sparkwrite-editor/vue';
import 'ai-sparkwrite-editor/style.css';

const editor = useEditor({
  extensions: [
    RichTextKit.configure({
      ai: { endpoint: '/api/ai' },
      image: { upload: (file) => uploadToYourStorage(file) },
      placeholder: { placeholder: 'Type something, or press Space on an empty line for AI…' },
    }),
  ],
});
</script>

<template>
  <RichTextProvider :editor="editor">
    <RichTextKitToolbar />
    <EditorContent :editor="editor" />
    <RichTextKitMenus />
  </RichTextProvider>
</template>
```

:::

The kit is a convenience, not a lock-in: the same import exports every extension and control separately, and the `RichTextKit*` components work with an editor you assembled yourself — they only look at which extensions are registered. Because each feature keeps its own chunk, a kit with features switched off is not bigger than the same features imported one by one (see [Bundle size](/guide/bundle-size)).

## Options

One key per feature. Three values:

- **omitted** — the default: included, except for the opt-in features below;
- **`false`** — left out, together with its toolbar button and menus;
- **an object** — included and passed to that extension's `.configure()`; the object type is the extension's own options (`ai: { endpoint }`, `codeBlock: { defaultLanguage: 'ts' }`, `heading: { levels: [1, 2, 3] }`). For an opt-in feature the object switches it on — `{}` is enough when it needs nothing.

| Group            | Keys (default on)                                                                                                                                                                                                                                                                      | Opt-in keys (`{ … }` switches on)                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document         | `document`, `paragraph`, `text`, `hardBreak`, `dropcursor`, `gapcursor`, `history`                                                                                                                                                                                                     | `placeholder` (`{ placeholder: '…' }`)                                                                                                                                      |
| Text style       | `bold`, `italic`, `underline`, `strike`, `code`, `moreMark` (super/subscript), `textStyle` (the mark colours, fonts and sizes hang on), `color`, `highlight`, `fontFamily`, `fontSize`, `lineHeight`, `textAlign`, `textDirection`, `indent`, `clear`, `formatPainter` (React), `link` | —                                                                                                                                                                           |
| Blocks           | `heading`, `bulletList`, `orderedList`, `taskList`, `blockquote`, `table`, `divider`, `details`, `codeBlock`, `callout`, `notice`, `tableOfContents`, `column` (React; opt-in in Vue)                                                                                                  | `horizontalRule` (the divider replaces it)                                                                                                                                  |
| Media and embeds | `image`, `video`, `iframe`, `attachment`, `katex`, `mermaid`                                                                                                                                                                                                                           | `imageGif` (`{ GIPHY_API_KEY }`), `emoji`, `excalidraw`, `drawer`, `twitter`, `mention` (`{ suggestion }`), `shortMessage` (`{ messages }`) — React only, except `imageGif` |
| Behaviour        | `slashCommand` (React), `searchAndReplace`, `richPaste`, `markdownPaste`, `exportMarkdown`, `exportWord`, `importWord`, `exportPdf`, `codeView`                                                                                                                                        | `recorder`                                                                                                                                                                  |
| AI               | `ai` ([options](/extensions/AI/#options); set `endpoint`), `aiAutocomplete`                                                                                                                                                                                                            | —                                                                                                                                                                           |

Lists bring `ListItem` along, `column` widens the document schema to `(block|columns)+`, and every extension is registered once even when two keys share a companion. `RichTextKitOptions` is exported for typing a config you keep elsewhere.

## The toolbar

`<RichTextKitToolbar />` lays out: AI · undo, redo · heading · bold, italic, underline, strike, colour, highlight, clear · bullet, ordered and task lists, alignment · link, image, table, code block · a **More tools** panel with the rest (font family, font size, line height, super/subscript, indent, format painter; blockquote, inline code, divider, columns, callout, details, table of contents, emoji, video, GIF, attachment, iframe, Katex, Excalidraw, Mermaid, drawer, Twitter; import Word, export PDF / Word / Markdown; search & replace, text direction, source view). Every control appears only when its extension is registered.

The panel lays its rows out three per line, related ones side by side (font size · line height · format painter; indent · outdent…). **Drag a row onto the toolbar to pin it there** — it leaves the panel and gets a permanent button. To remove it, hover the button and click its × badge, use the "On the Toolbar" group at the bottom of the panel, or drag it back onto the panel. Pins are remembered per browser in `localStorage`.

| Prop          | Default                                 | Purpose                                                                           |
| ------------- | --------------------------------------- | --------------------------------------------------------------------------------- |
| `more`        | `true`                                  | The "More tools" panel                                                            |
| `pinnable`    | `true`                                  | Drag rows out of the panel onto the toolbar, and back                             |
| `defaultPins` | `[]`                                    | Panel keys pinned until the user changes them, e.g. `['fontSize', 'katex']`       |
| `storageKey`  | `ai-sparkwrite-editor:kit-toolbar-pins` | Where the pins are stored                                                         |
| `overflow`    | `'wrap'`                                | `'collapse'` keeps the toolbar on one line; see [Overflow](#overflow)             |
| `children`    | —                                       | Extra controls, placed after the built-in groups (React); the default slot in Vue |
| `className`   | —                                       | React: extra classes on the toolbar                                               |

For a different order or a hand-picked set, compose your own from the controls — see [Toolbar](/guide/toolbar).

### Overflow

By default a toolbar narrower than its controls wraps onto further lines. In a narrow column — a side panel, a split view — `overflow='collapse'` keeps it on **one line** and moves whole groups into a **More tools** section at the top of the panel instead, where they are ordinary rows: labelled, usable, and (with `pinnable`) draggable onto the toolbar.

```tsx
<RichTextKitToolbar overflow='collapse' />
```

```vue
<RichTextKitToolbar overflow="collapse" />
```

Groups leave the row least used first, and come back as soon as the row is wide enough again:

1. pinned controls (the last pinned first)
2. colour, highlight, clear format
3. alignment
4. font family
5. link, image, table, code block
6. undo, redo

AI, the paragraph style, bold/italic/underline/strike and the lists never collapse, and the panel trigger always stays at the right end — in this mode it is shown even with `more={false}`. The toolbar is measured with a `ResizeObserver`; each group is measured once (and again whenever its width changes, say after a web font loads), so resizing costs no re-render of the controls. The root carries `data-overflow="collapse"` and `data-collapsed="colors align …"` with the ids of the groups currently in the panel (`history`, `font`, `colors`, `align`, `insert`, `pin:<key>`), for styling and tests.

## The menus

`<RichTextKitMenus />` mounts, for the registered extensions: `RichTextAIComposer`, `RichTextBubbleText` (with the Improve menu), the table, link, image, video, GIF, callout, iframe, Katex, Mermaid, Excalidraw, drawer and Twitter bubbles, `RichTextBubbleMenuDragHandle` and `SlashCommandList` (React). In Vue: the composer and the text, table, link and image bubbles.

| Prop         | Default | Purpose                                                                                               |
| ------------ | ------- | ----------------------------------------------------------------------------------------------------- |
| `composer`   | `true`  | The AI composer dock; `false` hides it, an object passes its props (`{ defaultOpen: true, rows: 3 }`) |
| `dragHandle` | `true`  | The block drag handle (React)                                                                         |

## Playground

The [playground](https://ludejun.github.io/ai-sparkwrite-editor/playground/) runs on the kit by default; its **Setup** switch shows the same editor _Assembled_ control by control — in React and in Vue.
