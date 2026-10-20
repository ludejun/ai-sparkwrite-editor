---
description: AI

next:
  text: Attachment
  link: /extensions/Attachment/index.md
---

# AI

The model writes **into the document**, not into a chat window. Answers stream in as Markdown and are rendered through the editor's own schema, so a `|` table becomes the editor's table, a fenced block a code block, `- [ ]` a task list — real nodes you can keep editing, never pasted text.

There are five ways in, and they share one extension:

| Entry point                                    | What happens                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Select text → Improve**                      | The selection menu rewrites, shortens, translates, explains, turns the text into a table or a list; preview, then Apply.      |
| **Space on an empty line**                     | Opens Ask AI at the caret (Notion's gesture). `spaceTrigger: false` turns it off.                                             |
| **`/ai`, `/continue`**                         | Slash entries: Ask AI, Continue writing, open the composer.                                                                   |
| **The AI toolbar button, `⌘/Ctrl+J`**          | Opens the **composer dock** under the editor: type what you want, the answer streams into the page above. Keep, undo, refine. |
| **Ghost text while typing** (`AIAutocomplete`) | After a pause at the end of a block the next few words appear in grey; Tab keeps them, Escape or typing dismisses.            |

## Setup

```tsx
import {
  AI,
  AIAutocomplete,
  RichTextAI,
  RichTextAIComposer,
  SlashCommand,
  SlashCommandList,
  RichTextBubbleText,
} from 'ai-sparkwrite-editor';
import 'ai-sparkwrite-editor/style.css';

const extensions = [
  // Document, Paragraph, Text, History, …
  AI.configure({ endpoint: '/api/ai' }), // your backend; which provider and model answer is its business
  AIAutocomplete, // optional: ghost-text suggestions
  SlashCommand,
];

// Inside <RichTextProvider editor={editor}>:
//   <RichTextToolbar><RichTextAI /> …</RichTextToolbar>
//   <EditorContent editor={editor} />
//   <RichTextAIComposer />      ← the dock, opened by RichTextAI / ⌘J / "/ai"
//   <RichTextBubbleText />      ← includes the Improve menu
//   <SlashCommandList />
```

`endpoint` is all the frontend needs: the editor POSTs the conversation as JSON to that URL and reads the answer back, streamed or not — see [Your endpoint](#your-endpoint) for the contract. No protocol, model or key is configured in the browser. A direct call to OpenAI or Anthropic and a fully custom `generate` remain available for experiments and special transports.

## The composer dock

`RichTextAIComposer` sits under the editor and writes straight into it. It opens from the `RichTextAI` toolbar button, `⌘/Ctrl+J`, the `/ai` slash entry, the Improve menu ("Open AI composer") or `editor.commands.toggleAIComposer(true)`.

- **Chips** run the document-level presets: Continue writing, Summarize, Outline, Suggest a title, Action items (a task list of every decision and open question), Fix grammar everywhere, Translate document. Each knows where its answer goes (end, top, caret, or the whole document).
- **The prompt** takes anything; a target selector chooses _Replace selection_ / _At cursor_ / _Top_ / _End_ / _Whole document_. Images and text files go with it — the paperclip, a drop onto the box, or a paste — under the same `enableImageInput` / `enableFileInput` / `maxAttachmentSize` rules as the panel.
- **The chips stay on one line.** Whatever does not fit sits behind a `+N` button. Hovering a chip shows the exact prompt it sends; the prompts are the `prompt` fields of `AI_COMPOSER_ACTIONS`.
- **While the answer streams** the span it is filling is tinted and follows edits made elsewhere; Stop keeps what has arrived.
- **Afterwards**: Keep, Undo (puts the original back), Retry, or type a follow-up — the same span is rewritten with the conversation so far. The finished answer is a single undo step.

The presets are data, so you can change them:

```tsx
import { AI_COMPOSER_ACTIONS, RichTextAIComposer } from 'ai-sparkwrite-editor';

<RichTextAIComposer
  actions={[
    ...AI_COMPOSER_ACTIONS,
    {
      key: 'editor.ai.compose.tweet', // a locale key or a plain label
      icon: 'PenLine',
      target: 'end',
      prompt: 'Write a tweet announcing this document.',
    },
  ]}
/>;
```

### Turning the composer off, or restyling it

`AI.configure({ composer: false })` removes the dock **and every way in**: the `RichTextAI` toolbar button renders nothing, `⌘/Ctrl+J` and `/ai composer` disappear, the Improve menu loses "Open AI Composer", and `toggleAIComposer()` is a no-op. The selection menu, Space-to-ask and autocomplete are unaffected.

The dock itself takes props (same names in Vue):

| Prop                 | Default               | Effect                                                      |
| -------------------- | --------------------- | ----------------------------------------------------------- |
| `actions`            | `AI_COMPOSER_ACTIONS` | The chips; `[]` hides the row                               |
| `showTarget`         | `true`                | The "where the text goes" selector                          |
| `hint`               | `true`                | Footer line; `false` hides it, a string replaces it         |
| `placeholder`        | locale string         | Prompt box placeholder                                      |
| `rows`               | `2`                   | Visible lines of the prompt box                             |
| `gradient`           | `true`                | Gradient border and background wash; `false` is a flat dock |
| `accent`             | `#804dff`             | Accent colour; sets the `--ai-accent` variable              |
| `className`, `style` | —                     | Passed to the root                                          |

For finer control the stylesheet exposes `--ai-accent`, `--ai-accent-2`, `--ai-accent-3` on `.richtext-ai-composer`, and the parts are plain classes: `richtext-ai-composer-head` (chips or the Keep/Undo/Retry verdict, plus the close button), `-chipline`, `-chips`, `-more`, `-menu`, `-box` (the prompt), `-input`, `-bar` (target selector and send), `-send`, `-close`, `-foot`, `-hint`.

### Writing into the document from your own UI

The engine behind the dock is exported and framework-free:

```ts
import { writeWithAI } from 'ai-sparkwrite-editor';
// or 'ai-sparkwrite-editor/core'

const result = await writeWithAI(editor, {
  prompt: 'Turn the meeting notes into a table of decisions.',
  target: 'selection', // 'selection' | 'cursor' | 'start' | 'end' | 'document' | { from, to }
  signal: controller.signal,
  onProgress: (markdown) => console.log(markdown.length),
});
result.keep(); // or result.discard() to put the original back
// result.messages is the conversation; pass it as `history` to refine.
```

Document-level targets (`cursor`, `start`, `end`) send the document as Markdown context, trimmed to `documentContext` characters (default 12 000; `0` sends none). `selection` and `document` send the affected text itself — as Markdown when it spans more than one block, so structure survives a rewrite.

### Taking a chip's answer somewhere else

Sometimes a preset's answer belongs outside the document: "Suggest a title" should fill your app's title field, not prepend an `h1`. The `onComposeResult` option is called after a chip has finished writing, with the chip's `key`, the answer as Markdown, where it landed and the `writeWithAI` handle. Return `true` and the composer discards what it just inserted (the document is back to how it was) and clears the prompt; return nothing and the usual Keep / Undo / Retry flow follows. Free-form prompts and follow-up refinements never call it.

```ts
AI.configure({
  endpoint: '/api/ai',
  onComposeResult: ({ action, markdown }) => {
    if (action === 'editor.ai.compose.title.suggest') {
      setTitle(markdown.replace(/^#+\s*/, '').trim());
      return true; // handled: the editor takes the heading back out
    }
  },
});
```

## Ghost-text autocomplete

`AIAutocomplete` is a separate extension so it costs nothing unless registered. Options: `enabled` (start on/off; `toggleAIAutocomplete()` flips it), `delay` (900 ms of quiet), `minChars` (24 characters in the block), `contextChars` (1 500 sent), `maxTokens` (48), `prompt`. It uses the `AI` extension's transport, asks only when the caret is at the end of a non-code block and the editor is focused, and drops stale answers. `acceptAISuggestion()` and `dismissAISuggestion()` are commands; Tab and Escape are bound.

## Improve selected text

`RichTextBubbleText` includes **Improve** when AI is registered: _Edit selection_ (improve writing, fix spelling & grammar, shorter, longer, simplify, change tone) and _Generate_ (summarize, explain, **turn into table**, **turn into list**, translate). Rewrites keep the original language, so translation is one entry that targets the reader's browser language; set `translateLanguages: ['English', 'Deutsch']` for a fixed submenu. **Ask AI anything** opens an empty prompt. It works after Select All too.

The panel opens in the document flow under the selection, streams the answer with the document's own styles, and offers Retry, Discard and Apply. Enter sends, Shift+Enter is a newline, Escape closes. Programmatically: `editor.commands.openAI('Make this more concise.')`.

Presets are plain prompts; a custom `buttonBubble` can place `RichTextAIImprove` (from `ai-sparkwrite-editor/bubble/ai`) anywhere.

## Your endpoint

The frontend never knows which provider or model answers. For every request it sends:

```http
POST /api/ai
Content-Type: application/json

{
  "messages": [{ "role": "user", "content": "Summarize:\n\n…", "attachments": [] }],
  "systemPrompt": "You are a writing assistant…",
  "stream": true,
  "maxTokens": 2048
}
```

`messages` is the conversation so far (`user` / `assistant` turns; text files the user attached are already inlined into `content`, images travel on `attachments` as data URLs). `stream` is `true` whenever the UI can render deltas as they arrive.

Answer with either:

- **JSON** — `{ "text": "…markdown…" }` (`content` or `markdown` are accepted too), or
- **Server-sent events** (`Content-Type: text/event-stream`) — one `data: {"text":"…"}` event per delta, `data: [DONE]` at the end.

A plain-text body, or an OpenAI Chat Completions / Anthropic Messages response or stream piped through unchanged, is read as well. So the simplest server is a proxy that adds the key and forwards the provider's stream:

```ts
// Node / Express with the OpenAI SDK — any provider or agent framework works the same way.
app.post('/api/ai', async (req, res) => {
  const { messages, systemPrompt, stream, maxTokens } = req.body;
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_completion_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(({ role, content }) => ({ role, content })),
    ],
    stream,
  });
  if (!stream) return res.json({ text: completion.choices[0].message.content });
  res.setHeader('Content-Type', 'text/event-stream');
  for await (const chunk of completion) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
});
```

`headers` adds request headers (a CSRF token, a tenant id); cookies travel with same-origin requests as usual. A failed request is shown as a generic message with the status code — the response body is never displayed, so a proxy cannot leak credentials through it. `stream: false` on the extension always asks for a JSON answer.

## Direct provider calls and custom transports

Without `endpoint` the extension speaks [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat) or [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create) itself: `protocol`, `model`, optional `baseURL` (API root including `/v1`) and `apiKey` (a string or an async getter). A key in a browser bundle is visible to the browser, so keep this for local experiments or a same-origin proxy that injects the key (`baseURL: '/api/openai'`, no `apiKey`).

`generate(request, onChunk)` replaces the transport entirely — for an SDK client, a WebSocket, or an agent framework:

```tsx
AI.configure({
  generate: async ({ messages, systemPrompt, signal }, onChunk) => {
    const response = await fetch('/api/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, systemPrompt }),
      signal,
    });
    if (!response.ok) throw new Error('Unable to generate text.');
    let text = '';
    for await (const chunk of readLines(response.body)) {
      text += chunk;
      onChunk?.(chunk); // streams into the panel / document
    }
    return text; // the full answer
  },
});
```

`generate` receives attachments on `message.attachments`; call `onChunk` with each piece of text to stream and resolve with the full text. Error messages you throw are shown in the UI.

## Options

| Option                                         | Default                      | Purpose                                                                                                                                                                                                       |
| ---------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `endpoint`                                     | `''`                         | **The recommended setup.** Your backend URL: receives `{ messages, systemPrompt, stream, maxTokens }` as JSON, answers `{ text }` or a `text/event-stream` of `{ text }` deltas                               |
| `generate`                                     | `null`                       | Custom transport `(request, onChunk?) => Promise<string>`; replaces `endpoint` and the provider calls                                                                                                         |
| `protocol`                                     | `'openai'`                   | Direct provider calls only: OpenAI Chat Completions or Anthropic Messages                                                                                                                                     |
| `model`                                        | `''`                         | Direct provider calls only: model ID                                                                                                                                                                          |
| `apiKey`                                       | `''`                         | Direct provider calls only: key or async key getter                                                                                                                                                           |
| `baseURL`                                      | provider `/v1` root          | Direct provider calls only: API root including `/v1`                                                                                                                                                          |
| `maxTokens`                                    | `2048`                       | Maximum generated tokens                                                                                                                                                                                      |
| `headers`                                      | `{}`                         | Extra or overridden request headers                                                                                                                                                                           |
| `systemPrompt`                                 | writing-assistant prompt     | Asks for the user's language and Markdown-only output                                                                                                                                                         |
| `stream`                                       | `true`                       | Ask for server-sent events; `false` waits for a JSON answer                                                                                                                                                   |
| `spaceTrigger`                                 | `true`                       | Space on an empty line opens Ask AI                                                                                                                                                                           |
| `documentContext`                              | `12000`                      | Characters of the document sent with document-level prompts                                                                                                                                                   |
| `placement`                                    | `'inline'`                   | `'external'`: the Ask-AI panel is not inserted into the document; your `mountPanel` renders it elsewhere (side bar, drawer) and the selection range follows edits                                             |
| `serializeDocument`                            | the editor's Markdown export | `(editor, range) => string`: how a span is turned into text for the model. Multi-block spans and the whole document go as Markdown so tables, lists and code keep their shape; override to redact or reformat |
| `onComposeResult`                              | —                            | `({ action, markdown, target, editor, result }) => boolean \| void`: called after a composer chip finishes; return `true` to take the answer over and have the editor discard what it inserted                |
| `translateLanguages`                           | `[]`                         | Fixed Translate targets; empty means the browser language                                                                                                                                                     |
| `enableImageInput`                             | `true`                       | Attach images (the model has to accept them)                                                                                                                                                                  |
| `enableFileInput`                              | `true`                       | Attach text files, inlined into the prompt                                                                                                                                                                    |
| `imageMimes`, `fileMimes`, `maxAttachmentSize` | see source                   | Accepted attachment types and size (4 MB)                                                                                                                                                                     |
| `renderResult`                                 | —                            | React: replace how the panel shows the answer (`{ markdown, html, streaming }`)                                                                                                                               |
| `components.Panel`                             | —                            | React: replace the whole panel                                                                                                                                                                                |
| `mountPanel`                                   | React/Vue renderer           | Framework hook: `(mount, props) => unmount`; the core entry ships it as `null`                                                                                                                                |

Only the selected text (or the document context you allow), your prompt and successful turns are sent. Document edits during a panel session — including collaborative ones — close the session and abort its request. Closing, stopping or destroying the editor aborts requests.

## Streaming and rich answers

With `endpoint` the deltas are the `data: {"text"}` events your server sends; with direct provider calls the provider is asked for server-sent events (OpenAI `stream: true`, Anthropic `content_block_delta`). Each delta is shown as it arrives; `stream: false` waits for the whole answer. The answer is Markdown rendered **through the editor's own schema**: the preview is the exact HTML the editor would save, with the document's styles, and Apply inserts real nodes. A single-paragraph answer merges into the paragraph being edited; anything with block structure replaces whole blocks. Unknown tags, scripts and attributes are dropped on the way in.

## Custom rendering (React)

- `renderResult({ markdown, html, streaming })` replaces only how the answer is shown — your own Markdown component, a word count, a diff against the selection.
- `components.Panel` replaces the whole dialog. It receives `editor`, `options`, `selectedText`, `initialPrompt`, `apply(markdown)` and `close()`; call `generateAIText(options, request, onChunk)` for the transport.

The helpers are exported: `markdownToHTML`, `markdownToFragment(editor, md)`, `markdownToSlice(editor, md)`, `markdownToPreviewHTML(editor, md)`.

## Core and Vue

`ai-sparkwrite-editor/core` exports the same extension as `AI` (headless: commands, decorations, `writeWithAI`, `AIAutocomplete`, `AI_COMPOSER_ACTIONS`, `generateAIText`, the Markdown helpers) with `mountPanel: null` — supply your own to mount a panel in any framework. `ai-sparkwrite-editor/vue` exports `AI` with the Vue panel plus `RichTextAI`, `RichTextAIComposer`, `RichTextAIImprove` and `RichTextBubbleText`; see [Frameworks](/guide/frameworks).

All strings go through the locale system (`editor.ai.*`, `editor.ai.compose.*`); the playground answers itself without a key so the whole flow can be tried (`VITE_AI_MODEL` etc. switch to a real model, see `playground/.env.example`).
