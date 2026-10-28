<p align="center">
  <img src="./docs/public/logo.svg" alt="SparkWrite" width="88" />
</p>

<h1 align="center">ai-sparkwrite-editor</h1>

<p align="center">
  <b>Tell the editor what you want. It writes it, right there in the page.</b><br/>
  An AI-first rich-text editor SDK on Tiptap for React and Vue: prose, tables, code, task lists, formulas and diagrams are produced by the model and land in the document as real, editable blocks — and several people can edit at once, with real-time collaboration on Yjs.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ai-sparkwrite-editor"><img alt="npm" src="https://img.shields.io/npm/v/ai-sparkwrite-editor.svg?label=npm&color=804dff" /></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
</p>

<p align="center">
  <a href="https://ludejun.github.io/ai-sparkwrite-editor/"><b>📘 Documentation</b></a>
  &nbsp;·&nbsp;
  <a href="https://ludejun.github.io/ai-sparkwrite-editor/playground/"><b>🎮 Live Playground</b></a>
  &nbsp;·&nbsp;
  <a href="https://ludejun.github.io/ai-sparkwrite-editor/guide/getting-started"><b>🚀 Getting Started</b></a>
  &nbsp;·&nbsp;
  <a href="./README.zh-CN.md"><b>🇨🇳 中文文档</b></a>
</p>

![The editor with the AI composer open under the document](./screenshot/screenshot.png)

## Features

**AI, in the document**

- **Composer dock** — type a request under the editor and the answer streams into the page as headings, lists, tables and code blocks. Keep, undo, retry, or refine the same span; one undo step. Toolbar ✨, `⌘J` or `/ai`.
- **Whole-document actions** — continue writing, summarize, outline, suggest a title, extract action items, fix grammar everywhere, translate. One click each; the document goes to the model as Markdown, so its structure survives.
- **Selection menu** — improve, shorten, expand, simplify, change tone, explain, translate, turn into a table or a list. Works after Select All.
- **Ghost text** — pause while typing and the next words appear in grey; Tab keeps them. Space on an empty line asks AI.
- **Formulas and diagrams from a sentence** — the Katex and Mermaid dialogs write the source and render it live.
- **Your backend, your model** — the frontend configures one `endpoint`. It receives the conversation as JSON and answers with text or a stream; which provider and model reply is your business. Direct OpenAI/Anthropic calls and a custom `generate` remain available. Answers are parsed through the editor schema: nothing is pasted, nothing unknown gets in.

**Everything else a document needs**

- 50+ extensions: headings, lists, tables, code blocks with language detection, images with cropping and captions, dividers, columns, callouts, notices, details, Katex, Mermaid, Excalidraw, video, iframe, attachments, emoji, mentions, table of contents, search & replace, Word/PDF/Markdown import and export.
- Paste from Word, Google Docs, Excel and code editors keeps its shape.
- 16 languages, loaded on demand, with matching CJK, Devanagari and Bengali fonts.
- Real-time collaboration over Yjs: shared document, remote carets, per-user undo, any transport.
- Record and replay a writing session as timestamped steps.
- One import per framework, `RichTextKit` for everything at once; bundlers tree-shake the rest, so you only ship the features you reference.
- Prefixed Tailwind classes and a handful of CSS variables, so it fits your design system.

## Quick start

One import per framework. `RichTextKit` is the whole editor as one extension; `RichTextKitToolbar` and `RichTextKitMenus` render the toolbar, the AI composer dock, the bubble menus and the slash menu for whatever is registered. Keep every `@tiptap/*` package on one version (`^3.29`).

### React

```bash
pnpm add ai-sparkwrite-editor @tiptap/react @tiptap/pm
```

```tsx
import { EditorContent, useEditor } from '@tiptap/react';
import {
  RichTextKit,
  RichTextKitMenus,
  RichTextKitToolbar,
  RichTextProvider,
} from 'ai-sparkwrite-editor';
import 'ai-sparkwrite-editor/style.css';

export function Editor() {
  const editor = useEditor({
    // One URL on your backend; it picks the provider and model.
    extensions: [RichTextKit.configure({ ai: { endpoint: '/api/ai' } })],
    content: '<p>Hello</p>',
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

### Vue

```bash
pnpm add ai-sparkwrite-editor @tiptap/vue-3 @tiptap/pm lucide-vue-next
```

```vue
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
  extensions: [RichTextKit.configure({ ai: { endpoint: '/api/ai' } })],
  content: '<p>Hello</p>',
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

Shape the kit with one option per feature: `false` leaves it out (button and menus go with it), an object configures it (`image: { upload }`, `codeBlock: { defaultLanguage: 'ts' }`), and features that need a key or a callback switch on when given one (`imageGif: { GIPHY_API_KEY }`, `mention: { suggestion }`, `excalidraw: {}`). Prefer to assemble it yourself? The same import has every extension and control — `Bold` and `RichTextBold`, `Table` and `RichTextTable` — and [Getting Started](https://ludejun.github.io/ai-sparkwrite-editor/guide/getting-started) shows both routes; every kit option is on the [RichTextKit page](https://ludejun.github.io/ai-sparkwrite-editor/guide/kit).

Your `/api/ai` receives `{ messages, systemPrompt, stream }` and answers `{ text }` or a stream of `data: {"text"}` events — the contract and a ten-line server are in the [AI docs](https://ludejun.github.io/ai-sparkwrite-editor/extensions/AI/).

## Real-time collaboration

Several people in one document, with each other's carets and their own undo. The editor syncs through [Yjs](https://yjs.dev); `YSyncProvider` speaks the `y-websocket` wire format over a socket you own, and `collaborationKitOptions` wires it into the kit (which then drops its own history for the Yjs undo manager):

```bash
pnpm add yjs
```

```tsx
import { useEditor } from '@tiptap/react';
import { RichTextKit, YSyncProvider, collaborationKitOptions } from 'ai-sparkwrite-editor';
import * as Y from 'yjs';

const doc = new Y.Doc();
const provider = new YSyncProvider(doc);
const socket = new WebSocket('wss://example.com/collab/note-42');
socket.binaryType = 'arraybuffer';
socket.onopen = () => provider.connect((data) => socket.send(data));
socket.onmessage = (event) => provider.receive(event.data);
socket.onclose = () => provider.disconnect();

const editor = useEditor({
  // no `content`: the Y.Doc is the content
  extensions: [
    RichTextKit.configure({
      ...collaborationKitOptions({
        document: doc,
        provider,
        user: { name: 'Ada', color: '#7c3aed' },
      }),
    }),
  ],
});
```

The same options work on the Vue kit, and `y-websocket` or Hocuspocus providers plug in the same way. React and Vue components, saving without echoing remote edits (`isChangeOrigin`), read-only members, and the frame format for your own server are in the [collaboration guide](https://ludejun.github.io/ai-sparkwrite-editor/guide/collaboration).

## Documentation

Everything is on the docs site: **[ludejun.github.io/ai-sparkwrite-editor](https://ludejun.github.io/ai-sparkwrite-editor/)** — [getting started](https://ludejun.github.io/ai-sparkwrite-editor/guide/getting-started), [AI](https://ludejun.github.io/ai-sparkwrite-editor/extensions/AI/), [every feature and its import path](https://ludejun.github.io/ai-sparkwrite-editor/guide/features), [frameworks](https://ludejun.github.io/ai-sparkwrite-editor/guide/frameworks), [collaboration](https://ludejun.github.io/ai-sparkwrite-editor/guide/collaboration), [customization](https://ludejun.github.io/ai-sparkwrite-editor/guide/customization), [bundle size](https://ludejun.github.io/ai-sparkwrite-editor/guide/bundle-size). Try it first in the **[live playground](https://ludejun.github.io/ai-sparkwrite-editor/playground/)**, which answers with a demo model so every AI flow works without a key.

## Using with AI coding agents

The repository ships a skill for Claude Code, Cursor, Codex and friends — integration rules, the AI backend contract, upload and image-deletion recipes, a debugging checklist — and the npm package carries a copy at `node_modules/ai-sparkwrite-editor/skills/ai-sparkwrite-editor/SKILL.md`.

```bash
npx skills add ludejun/ai-sparkwrite-editor
```

The docs are also published as [llms.txt](https://ludejun.github.io/ai-sparkwrite-editor/llms.txt) and [llms-full.txt](https://ludejun.github.io/ai-sparkwrite-editor/llms-full.txt); the [AI Coding Agents](https://ludejun.github.io/ai-sparkwrite-editor/guide/ai-agents) page explains what else to hand an agent.

## Development

```bash
pnpm install
pnpm build:lib      # the playground imports the built lib/
pnpm playground     # http://localhost:8000, React ⇄ Vue switch in the header
pnpm type-check && pnpm lint
pnpm docs:dev
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the commit convention and how upstream fixes are brought in.

## Origin

The code base started as a fork of [reactjs-tiptap-editor](https://github.com/hunghg255/reactjs-tiptap-editor) by hunghg255 and its contributors and has since been reworked extensively. Thank you to them and to the [Tiptap](https://tiptap.dev) and [shadcn/ui](https://ui.shadcn.com/) projects. MIT licensed.
