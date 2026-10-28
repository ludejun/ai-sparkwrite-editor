# Quickstart

Setup and document lifecycle for **1.1.0 / Tiptap ^3.29.2**. Check the consumer's installed version first; declarations in `node_modules/ai-sparkwrite-editor/lib/*.d.ts` win.

## Dependencies

Use the host's package manager. Every `@tiptap/*` package on one version; `@tiptap/vue-3` pinned to the exact `@tiptap/core` version.

```bash
# React (18 or 19)
pnpm add ai-sparkwrite-editor @tiptap/react @tiptap/pm

# Vue 3
pnpm add ai-sparkwrite-editor @tiptap/vue-3 @tiptap/pm lucide-vue-next
```

`@tiptap/extension-document`, `-paragraph`, `-text` are only needed when assembling the editor yourself; the kit brings them. Feature-specific peers: `react-image-crop` (image crop UI, also import `react-image-crop/dist/ReactCrop.css`), `katex` (only when overriding `loadKatex`).

## Route 1 — the kit (whole editor, three components)

```tsx
'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import {
  RichTextKit,
  RichTextKitMenus,
  RichTextKitToolbar,
  RichTextProvider,
} from 'ai-sparkwrite-editor';
import 'ai-sparkwrite-editor/style.css';

export function Editor({
  initialContent,
  onChange,
}: {
  initialContent?: string;
  onChange?: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      RichTextKit.configure({
        ai: { endpoint: '/api/ai' }, // your backend; see ai-backend.md
        image: { upload: uploadImage }, // (file) => Promise<string>, app-owned
        placeholder: { placeholder: 'Type / for blocks, Space on an empty line for AI…' },
        twitter: false,
      }),
    ],
    content: initialContent ?? '<p></p>',
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
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

Vue: same four names from `ai-sparkwrite-editor/vue`, `useEditor`/`EditorContent` from `@tiptap/vue-3`, `<RichTextProvider :editor="editor">`.

### Kit options (`RichTextKit.configure({ key: false | {...} })`)

Omitted = on (except opt-in). `false` = out, with its button and menus. Object = `.configure()` options of that extension; for an opt-in feature the object switches it on (`{}` if it needs nothing). `RichTextKitOptions` is exported for typing.

| Group        | On by default                                                                                                                                                                                                            | Opt-in (object switches on)                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document     | `document`, `paragraph`, `text`, `hardBreak`, `dropcursor`, `gapcursor`, `history`                                                                                                                                       | `placeholder` (`{ placeholder }`)                                                                                                                                          |
| Text style   | `bold`, `italic`, `underline`, `strike`, `code`, `moreMark`, `textStyle`, `color`, `highlight`, `fontFamily`, `fontSize`, `lineHeight`, `textAlign`, `textDirection`, `indent`, `clear`, `formatPainter` (React), `link` | —                                                                                                                                                                          |
| Blocks       | `heading`, `bulletList`, `orderedList`, `taskList`, `blockquote`, `notice`, `table`, `divider`, `details`, `codeBlock`, `callout`, `tableOfContents`, `column` (React; opt-in in Vue)                                    | `horizontalRule` (superseded by `divider`)                                                                                                                                 |
| Media/embeds | `image`, `video`, `iframe` (Embed), `attachment`, `katex`, `mermaid`                                                                                                                                                     | `imageGif` (`{ GIPHY_API_KEY }`), `emoji`, `excalidraw`, `drawer`, `twitter`, `mention` (`{ suggestion }`), `shortMessage` (`{ messages }`) — React only except `imageGif` |
| Behaviour    | `slashCommand` (React), `searchAndReplace`, `richPaste`, `markdownPaste`, `exportMarkdown`, `exportWord`, `importWord`, `exportPdf`, `codeView`                                                                          | `recorder`                                                                                                                                                                 |
| AI           | `ai` (set `endpoint`), `aiAutocomplete`                                                                                                                                                                                  | —                                                                                                                                                                          |

`column` widens the document to `(block|columns)+`; lists bring `ListItem`; `textStyle` is the mark colour/font/size/line-height hang on (leave it on when any of those is on).

`<RichTextKitToolbar more pinnable defaultPins storageKey className>{extraControls}</RichTextKitToolbar>` — `more={false}` drops the "More tools" panel; panel rows can be dragged onto the toolbar to pin them (persisted in `localStorage` under `storageKey`, default `ai-sparkwrite-editor:kit-toolbar-pins`). `<RichTextKitMenus composer dragHandle />` — `composer={false}` hides the AI dock, an object passes `RichTextAIComposer` props; `dragHandle` is React-only.

The kit components only look at registered extension names, so they also work over an editor you assembled yourself.

## Route 2 — assembled

```tsx
'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { ListItem } from '@tiptap/extension-list';
import { TextStyle } from '@tiptap/extension-text-style';
import {
  AI,
  AIAutocomplete,
  RichTextAI,
  RichTextAIComposer,
  Bold,
  RichTextBold,
  Italic,
  RichTextItalic,
  Heading,
  RichTextHeading,
  BulletList,
  RichTextBulletList,
  Color,
  RichTextColor,
  Link,
  RichTextLink,
  History,
  RichTextUndo,
  RichTextRedo,
  RichTextBubbleText,
  RichTextBubbleLink,
  RichTextProvider,
  RichTextToolbar,
  RichTextToolbarDivider,
} from 'ai-sparkwrite-editor';
import 'ai-sparkwrite-editor/style.css';

const extensions = [
  Document,
  Paragraph,
  Text,
  ListItem,
  TextStyle,
  History,
  Heading.configure({ levels: [1, 2, 3] }),
  Bold,
  Italic,
  BulletList,
  Color,
  Link,
  AI.configure({ endpoint: '/api/ai' }),
  AIAutocomplete,
];

export function TextEditor() {
  const editor = useEditor({ extensions, content: '<p></p>', immediatelyRender: false });
  if (!editor) return null;
  return (
    <RichTextProvider editor={editor}>
      <RichTextToolbar>
        <RichTextAI />
        <RichTextToolbarDivider />
        <RichTextUndo />
        <RichTextRedo />
        <RichTextHeading />
        <RichTextBold />
        <RichTextItalic />
        <RichTextColor />
        <RichTextBulletList />
        <RichTextLink />
      </RichTextToolbar>
      <EditorContent editor={editor} />
      <RichTextAIComposer />
      <RichTextBubbleText />
      <RichTextBubbleLink />
    </RichTextProvider>
  );
}
```

Per-feature subpaths (`ai-sparkwrite-editor/bold`, `/ai`, `/bubble/text`…) give the same symbols for bundlers that do not tree-shake; the main entry is byte-identical after tree-shaking.

Do not register a library extension and a Tiptap/StarterKit extension with the same name; disable the overlap in StarterKit first.

## Route 3 — headless / plain JS

```ts
import { Editor } from '@tiptap/core';
import { Bold, Heading, Table, RichPaste, AI, writeWithAI } from 'ai-sparkwrite-editor/core';
```

`core` exports every framework-free extension (blocks without node views), the AI engine (`AI` with `mountPanel: null`, `writeWithAI`, `AIAutocomplete`, `generateAIText`, Markdown helpers), the recorder, image bookkeeping and translations. Nothing from React is reachable from it.

## Server rendering

Client component, `immediatelyRender: false`, null guard before the provider, stylesheet imported where the framework allows global CSS. A client directive alone does not stop server prerendering.

## Save, load, read-only

- Read in `onUpdate`, debounced for network saves: `editor.getHTML()` (what most backends store, renders anywhere the stylesheet is loaded), `editor.getJSON()` (exact round-trip), `getMarkdown(editor)` from ExportMarkdown, plain text with `getText()`.
- `content` initialises. For a document fetched later: `editor.commands.setContent(html, { emitUpdate: false })` once; not on every parent render, not echoing each local edit.
- Keep the extensions the stored content needs registered when loading it (a `notice`, `divider`, `callout`, `imageBlock` … the schema does not know is dropped).
- Read-only: `editable: false` in `useEditor` or `editor.setEditable(false)`; the AI dock, menus, Space/Tab entry points hide themselves. Hiding buttons alone does not prevent editing.
- Images at save time: see feature-recipes.md → "Deleting uploaded images".

## Collaboration (Yjs)

- Install `yjs` in the app (one copy: the SDK keeps it external; dedupe it in the bundler).
- Kit: `RichTextKit.configure({ ...collaborationKitOptions({ document: ydoc, provider, user: { name, color } }) })`. The kit then leaves `history` out; Undo / Redo drive the Yjs undo manager (own changes only). Same options on the Vue kit; everything is also exported from `ai-sparkwrite-editor/vue`.
- Assembled: `Collaboration.configure({ document })` + `CollaborationCaret.configure({ provider, user })`, no `History`.
- Provider: `new YSyncProvider(ydoc)` for a socket the app owns — `connect(send)` on open, `receive(bytes)` per binary frame, `disconnect()` on close, `destroy()` on unmount; events `status`, `synced`, `denied`. `y-websocket`'s `WebsocketProvider` or `HocuspocusProvider` work too (only `provider.awareness` is needed).
- No `content` with collaboration (it would be inserted again on first sync); seed on the server. Client-side saves skip remote transactions: `if (isChangeOrigin(transaction)) return`.
- Read-only members: `editor.setEditable(false, false)`; controls follow without an update event.
- Full guide: docs `guide/collaboration`.

## Provider

`RichTextProvider({ editor, children })` renders the `.sparkwrite` root the stylesheet keys off and gives the editor to every control. Its `dark` prop is accepted for compatibility and ignored; use `themeActions.setTheme('dark')`.
