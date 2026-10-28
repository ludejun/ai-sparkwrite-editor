# Collaboration

Several people edit one document at the same time, each sees the others' carets and selections, and each undoes only their own changes. The editor shares its document through [Yjs](https://yjs.dev): the SDK ships the extensions (`Collaboration`, `CollaborationCaret`) and a provider that speaks the `y-websocket` wire format over any transport. You bring the server that relays the messages and stores the document.

## What you need

- `yjs` in your app. The SDK keeps it external so your app and the editor share one copy:

  ```bash
  pnpm add yjs
  ```

- A server that relays Yjs sync and awareness messages between the clients of a document and keeps the document. Any server that speaks the `y-websocket` protocol works with `YSyncProvider`; with Hocuspocus or the `y-websocket` client library, use their provider instead (see [Other providers](#other-providers)).

## With RichTextKit (React)

`collaborationKitOptions` turns a `Y.Doc`, a provider and the local user into the kit options. With them the kit adds `Collaboration` and `CollaborationCaret` and leaves the `history` feature out: Yjs brings its own undo manager, and the toolbar's Undo / Redo drive it.

```tsx
'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import {
  RichTextKit,
  RichTextKitMenus,
  RichTextKitToolbar,
  RichTextProvider,
  YSyncProvider,
  collaborationKitOptions,
} from 'ai-sparkwrite-editor';
import 'ai-sparkwrite-editor/style.css';
import { useEffect, useState } from 'react';
import * as Y from 'yjs';

interface Session {
  doc: Y.Doc;
  provider: YSyncProvider;
}

/** One Y.Doc per document, synced over a WebSocket this component owns. */
function useCollaboration(url: string) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    const provider = new YSyncProvider(doc);
    const socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => provider.connect((data) => socket.send(data));
    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') provider.receive(event.data);
    };
    socket.onclose = () => provider.disconnect();
    setSession({ doc, provider });

    return () => {
      socket.close();
      provider.destroy();
      doc.destroy();
    };
  }, [url]);

  return session;
}

function CollaborativeEditor({ doc, provider }: Session) {
  const editor = useEditor(
    {
      // No `content`: the Y.Doc is the content.
      extensions: [
        RichTextKit.configure({
          ...collaborationKitOptions({
            document: doc,
            provider,
            user: { name: 'Ada', color: '#7c3aed' },
          }),
        }),
      ],
      immediatelyRender: false,
    },
    [doc]
  );

  if (!editor) return null;

  return (
    <RichTextProvider editor={editor}>
      <RichTextKitToolbar />
      <EditorContent editor={editor} />
      <RichTextKitMenus />
    </RichTextProvider>
  );
}

export default function Note({ id }: { id: string }) {
  const session = useCollaboration(`wss://example.com/collab/${id}`);

  return session ? <CollaborativeEditor key={id} {...session} /> : null;
}
```

The provider needs three calls from your transport: `connect(send)` once the socket is open, `receive(bytes)` for every binary frame, `disconnect()` when it drops. Edits made while disconnected stay in the `Y.Doc`; after a reconnect, call `connect` again with the new socket's `send`, and the next sync round delivers them (the server's SyncStep1 is answered with everything it is missing). The doc and the provider are created inside the effect, so React's development double-mount never reuses a destroyed one.

## With RichTextKit (Vue)

The same options on the Vue kit:

```vue
<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3';
import {
  RichTextKit,
  RichTextKitMenus,
  RichTextKitToolbar,
  RichTextProvider,
  YSyncProvider,
  collaborationKitOptions,
} from 'ai-sparkwrite-editor/vue';
import 'ai-sparkwrite-editor/style.css';
import { onBeforeUnmount } from 'vue';
import * as Y from 'yjs';

const props = defineProps<{ id: string }>();

const doc = new Y.Doc();
const provider = new YSyncProvider(doc);
const socket = new WebSocket(`wss://example.com/collab/${props.id}`);
socket.binaryType = 'arraybuffer';
socket.onopen = () => provider.connect((data) => socket.send(data));
socket.onmessage = (event) => {
  if (typeof event.data !== 'string') provider.receive(event.data);
};
socket.onclose = () => provider.disconnect();

const editor = useEditor({
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

onBeforeUnmount(() => {
  socket.close();
  provider.destroy();
  doc.destroy();
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

Give the component a `key` per document (`<Note :key="id" :id="id" />`) so another document gets a fresh doc and socket.

## Without the kit

Register the two extensions yourself, and leave `History` out:

```ts
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Bold, Collaboration, CollaborationCaret } from 'ai-sparkwrite-editor';

const extensions = [
  Document,
  Paragraph,
  Text,
  Bold,
  Collaboration.configure({ document: doc }),
  CollaborationCaret.configure({ provider, user: { name: 'Ada', color: '#7c3aed' } }),
];
```

`RichTextUndo` and `RichTextRedo` (and the kit toolbar) drive the Yjs undo manager when `Collaboration` is registered. Vue apps import the same names from `ai-sparkwrite-editor/vue`.

## Other providers

`collaborationKitOptions` only needs `provider.awareness`, so the providers of the Yjs ecosystem plug in the same way:

```ts
import { collaborationKitOptions } from 'ai-sparkwrite-editor';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

const doc = new Y.Doc();
const provider = new WebsocketProvider('wss://example.com/collab', 'note-42', doc);

const kitOptions = collaborationKitOptions({
  document: doc,
  provider,
  user: { name: 'Ada', color: '#7c3aed' },
});
```

With Hocuspocus, pass `document: provider.document` and the `HocuspocusProvider` itself. `YSyncProvider` is for the case where your app already owns the connection (one socket that also carries presence or notifications, a `BroadcastChannel`, a test relay).

## Things to know

- **Content comes from the document.** Do not pass `content` to `useEditor`: on the first sync it would be inserted a second time. Seed a new document on the server, or have one client set it once `provider.synced` is true and the editor is empty.
- **Saving.** Keep the Yjs document on the server: it sees every update from every client. If clients also save JSON or HTML, skip remote changes, or every open client saves every keystroke:

  ```ts
  import { isChangeOrigin } from 'ai-sparkwrite-editor';

  useEditor({
    // …
    onUpdate: ({ editor, transaction }) => {
      if (isChangeOrigin(transaction)) return; // applied from another client
      save(editor.getJSON());
    },
  });
  ```

- **Undo is per user.** Undo and Redo revert only your own changes, never a collaborator's.
- **Status.** `provider.on('status', (status) => …)` (`'connected'` / `'disconnected'`) and `provider.on('synced', (synced) => …)` (true once the server answered the first sync round) each return an unsubscribe function. `provider.status` and `provider.synced` hold the current values.
- **Read-only members.** Switch the editor with `editor.setEditable(false, false)`: the second argument skips the update event, so the switch is not saved, and the toolbar, menus and node views follow it. A server can also refuse a client's updates with an auth frame; the provider reports it through `provider.on('denied', (reason) => …)`.
- **One copy of Yjs.** Two copies break the document (`Yjs was already imported`, failing `instanceof` checks). Install `yjs` in the app and let the bundler resolve one copy, for example `resolve: { dedupe: ['yjs'] }` in Vite.
- **Carets.** Remote carets are a bar in the user's `color` with a name label; style them through `.richtext-collab-caret`, `.richtext-collab-caret__label` and `.richtext-collab-selection`, or pass your own `render` in the `collaborationCaret` options.
- **Several editors, one document.** `collaborationKitOptions({ …, field })` (default `'default'`) names the Yjs fragment, so one `Y.Doc` can hold a title and a body in two editors.

## Writing your own server

`YSyncProvider` sends and reads the `y-websocket` binary frames, so a server only has to relay them per document and apply sync updates to its own `Y.Doc`:

| First varUint | Then                        | Meaning                                                  |
| ------------- | --------------------------- | -------------------------------------------------------- |
| `0` sync      | varUint `0` + state vector  | SyncStep1: "send me what I miss"; answer with SyncStep2  |
|               | varUint `1` + update        | SyncStep2: the answer to SyncStep1                       |
|               | varUint `2` + update        | an incremental update; apply it and forward it to others |
| `1` awareness | awareness update            | carets and user info; forward to the others              |
| `2` auth      | varUint `0` + reason string | permission denied: the client emits `denied`             |
| `3` query     | —                           | the client answers with every awareness state it knows   |

Payloads are length-prefixed (`varUint8Array`), as in `y-protocols`. On connect the client sends SyncStep1 and, if it has one, its awareness state; it counts as synced once a SyncStep2 arrives. The server should send its own SyncStep1 when a client connects (and the awareness states it holds): the client's SyncStep2 answer carries the edits made offline.
