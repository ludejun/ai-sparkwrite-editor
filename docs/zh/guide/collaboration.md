# 协作编辑

多人同时编辑同一篇文档，每个人都能看到其他人的光标和选区，撤销时只撤销自己的改动。编辑器通过 [Yjs](https://yjs.dev) 共享文档：SDK 提供扩展（`Collaboration`、`CollaborationCaret`）和一个可跑在任意传输通道上、使用 `y-websocket` 报文格式的 provider；负责转发消息、保存文档的服务端由你提供。

## 准备

- 应用里安装 `yjs`。SDK 把它作为外部依赖，保证应用和编辑器用的是同一份：

  ```bash
  pnpm add yjs
  ```

- 一个服务端：在同一文档的各客户端之间转发 Yjs 的同步与 awareness 消息，并保存文档。任何支持 `y-websocket` 协议的服务端都能配合 `YSyncProvider` 使用；如果用 Hocuspocus 或 `y-websocket` 客户端库，就换用它们自带的 provider（见[其他 provider](#其他-provider)）。

## 使用 RichTextKit（React）

`collaborationKitOptions` 把 `Y.Doc`、provider 和当前用户转换成 kit 选项。传入后 kit 会加上 `Collaboration` 和 `CollaborationCaret`，并去掉 `history` 功能：Yjs 自带撤销管理器，工具栏的撤销 / 重做按钮会驱动它。

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

/** 每篇文档一个 Y.Doc，通过本组件自己持有的 WebSocket 同步。 */
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
      // 不传 `content`：文档内容就是 Y.Doc。
      extensions: [
        RichTextKit.configure({
          ...collaborationKitOptions({
            document: doc,
            provider,
            user: { name: '张三', color: '#7c3aed' },
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

provider 只需要传输层调用三个方法：连接打开后调 `connect(send)`，每收到一个二进制帧调 `receive(bytes)`，断开时调 `disconnect()`。断线期间的编辑会留在 `Y.Doc` 里；重连后用新连接的 `send` 再调一次 `connect`，下一轮同步就会把它们发出去（客户端会用服务端缺少的全部内容回应服务端的 SyncStep1）。doc 和 provider 在 effect 里创建，所以 React 开发模式下的二次挂载不会复用已经销毁的实例。

## 使用 RichTextKit（Vue）

Vue 的 kit 用同样的选项：

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
        user: { name: '张三', color: '#7c3aed' },
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

每篇文档给组件一个 `key`（`<Note :key="id" :id="id" />`），切换文档时就会得到新的 doc 和连接。

## 不用 kit

自己注册这两个扩展，并且不要加 `History`：

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
  CollaborationCaret.configure({ provider, user: { name: '张三', color: '#7c3aed' } }),
];
```

注册了 `Collaboration` 时，`RichTextUndo`、`RichTextRedo`（以及 kit 工具栏）驱动的是 Yjs 的撤销管理器。Vue 应用从 `ai-sparkwrite-editor/vue` 导入同名的导出。

## 其他 provider

`collaborationKitOptions` 只用到 `provider.awareness`，所以 Yjs 生态里的 provider 可以同样接入：

```ts
import { collaborationKitOptions } from 'ai-sparkwrite-editor';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

const doc = new Y.Doc();
const provider = new WebsocketProvider('wss://example.com/collab', 'note-42', doc);

const kitOptions = collaborationKitOptions({
  document: doc,
  provider,
  user: { name: '张三', color: '#7c3aed' },
});
```

用 Hocuspocus 时，传 `document: provider.document` 和 `HocuspocusProvider` 实例本身。`YSyncProvider` 适合应用已经自己持有连接的情况（同一条 socket 还承载在线状态或通知、`BroadcastChannel`、测试用的转发器）。

## 注意事项

- **内容来自协作文档。** 不要给 `useEditor` 传 `content`：首次同步时它会被再插入一遍。新文档的初始内容放在服务端生成，或者在 `provider.synced` 为 true 且编辑器为空时，由一个客户端写入一次。
- **保存。** 在服务端保存 Yjs 文档：它能收到所有客户端的每一次更新。如果客户端也要保存 JSON 或 HTML，记得跳过远端改动，否则每个打开的客户端都会把每次按键保存一遍：

  ```ts
  import { isChangeOrigin } from 'ai-sparkwrite-editor';

  useEditor({
    // …
    onUpdate: ({ editor, transaction }) => {
      if (isChangeOrigin(transaction)) return; // 来自其他客户端
      save(editor.getJSON());
    },
  });
  ```

- **撤销只针对自己。** 撤销和重做只回退你自己的改动，不会动协作者的。
- **连接状态。** `provider.on('status', (status) => …)`（`'connected'` / `'disconnected'`）和 `provider.on('synced', (synced) => …)`（服务端回应第一轮同步后为 true）都会返回取消订阅的函数；`provider.status` 和 `provider.synced` 是当前值。
- **只读成员。** 用 `editor.setEditable(false, false)` 切换：第二个参数表示不触发 update 事件，切换本身不会被保存，工具栏、菜单和节点视图都会跟着变化。服务端也可以用 auth 帧拒绝某个客户端的更新，provider 会通过 `provider.on('denied', (reason) => …)` 报告。
- **只能有一份 Yjs。** 两份 Yjs 会让文档出错（`Yjs was already imported`、`instanceof` 判断失败）。在应用里安装 `yjs`，并让打包工具只解析出一份，例如 Vite 里的 `resolve: { dedupe: ['yjs'] }`。
- **远端光标。** 远端光标是一条用户 `color` 颜色的竖线加名字标签；通过 `.richtext-collab-caret`、`.richtext-collab-caret__label` 和 `.richtext-collab-selection` 调整样式，或在 `collaborationCaret` 选项里传自己的 `render`。
- **一个文档，多个编辑器。** `collaborationKitOptions({ …, field })`（默认 `'default'`）指定 Yjs fragment 的名字，这样一个 `Y.Doc` 可以在两个编辑器里分别承载标题和正文。

## 自己实现服务端

`YSyncProvider` 收发的是 `y-websocket` 的二进制帧，服务端只需按文档转发，并把同步更新应用到自己的 `Y.Doc`：

| 第一个 varUint | 后续内容                   | 含义                                           |
| -------------- | -------------------------- | ---------------------------------------------- |
| `0` 同步       | varUint `0` + state vector | SyncStep1：“把我缺的发给我”，用 SyncStep2 回应 |
|                | varUint `1` + update       | SyncStep2：对 SyncStep1 的回应                 |
|                | varUint `2` + update       | 增量更新：应用并转发给其他客户端               |
| `1` awareness  | awareness update           | 光标和用户信息：转发给其他客户端               |
| `2` auth       | varUint `0` + 原因字符串   | 无权限：客户端会触发 `denied`                  |
| `3` 查询       | —                          | 客户端回应它知道的全部 awareness 状态          |

载荷带长度前缀（`varUint8Array`），与 `y-protocols` 一致。连接时客户端发送 SyncStep1，有本地 awareness 状态时一并发送；收到 SyncStep2 后视为已同步。服务端也应在客户端连上时发送自己的 SyncStep1（以及它保存的 awareness 状态）：客户端用 SyncStep2 回应时，会带上离线期间的编辑。
