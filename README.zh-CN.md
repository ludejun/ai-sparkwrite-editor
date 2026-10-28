<p align="center">
  <img src="./docs/public/logo.svg" alt="SparkWrite" width="88" />
</p>

<h1 align="center">ai-sparkwrite-editor</h1>

<p align="center">
  <b>告诉编辑器你要什么，它直接写在页面里。</b><br/>
  基于 Tiptap 的 AI 优先富文本编辑器 SDK，支持 React 与 Vue：正文、表格、代码、任务列表、公式、图表都由模型产出，并以真正可编辑的块落进文档。
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ai-sparkwrite-editor"><img alt="npm" src="https://img.shields.io/npm/v/ai-sparkwrite-editor.svg?label=npm&color=804dff" /></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
</p>

<p align="center">
  <a href="https://ludejun.github.io/ai-sparkwrite-editor/"><b>📘 文档网站</b></a>
  &nbsp;·&nbsp;
  <a href="https://ludejun.github.io/ai-sparkwrite-editor/playground/"><b>🎮 在线 Playground</b></a>
  &nbsp;·&nbsp;
  <a href="https://ludejun.github.io/ai-sparkwrite-editor/guide/getting-started"><b>🚀 快速开始</b></a>
  &nbsp;·&nbsp;
  <a href="./README.md"><b>🇬🇧 English</b></a>
</p>

![打开 AI 写作台的编辑器](./screenshot/screenshot.png)

## 特性

**AI 在文档里**

- **写作台**——在编辑器底部输入需求，回答流式写进页面，落地成标题、列表、表格、代码块。可保留、撤销、重试或就地追问；整段只占一步撤销。工具栏 ✨、`⌘J` 或 `/ai` 呼出。
- **整篇文档操作**——续写、总结、生成大纲、拟标题、提取待办、全文纠错、翻译全文，各一键；文档以 Markdown 发给模型，结构不丢。
- **选区菜单**——润色、缩写、扩写、简化、换语气、解释、翻译、转表格、转列表。全选后同样可用。
- **灰色续写**——打字停顿后出现下一句的建议，Tab 接受；空行按空格呼出 AI。
- **一句话出公式和图表**——Katex 与 Mermaid 对话框写出源码并实时渲染。
- **接口即模型**——前端只配一个 `endpoint`：对话以 JSON 发到你的服务端，返回文本或 SSE 流即可，用哪家模型由后端决定；也可直连 OpenAI/Anthropic 或自定义 `generate`。回答经编辑器 schema 解析：不是粘贴，也不会带进未知内容。

**文档需要的其他一切**

- 50+ 扩展：标题、列表、表格、带语言识别的代码块、可裁剪加题注的图片、分割线、分栏、提示块、折叠块、Katex、Mermaid、Excalidraw、视频、iframe、附件、emoji、提及、目录、搜索替换、Word/PDF/Markdown 导入导出。
- 从 Word、Google Docs、Excel、代码编辑器粘贴保持格式。
- 16 种语言按需加载，配套中日韩、天城文、孟加拉文字体。
- 基于 Yjs 的实时协作：共享文档、远端光标、各自独立的撤销，传输层随意。
- 录制并回放一次书写过程。
- 每个框架一个入口，`RichTextKit` 一行注册全部功能；打包器按需 tree-shake，只打包你真正用到的功能。
- 带前缀的 Tailwind 类和少量 CSS 变量，融入你的设计系统。

## 快速接入

每个框架只需一个入口。`RichTextKit` 把整个编辑器打包成一个扩展；`RichTextKitToolbar` 和 `RichTextKitMenus` 会按已注册的功能渲染工具栏、AI 写作台、气泡菜单和斜杠菜单。所有 `@tiptap/*` 包保持同一版本（`^3.29`）。

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
    // 只配一个服务端地址，用哪家模型由后端决定。
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

Kit 的每个选项对应一个功能：`false` 去掉它（按钮和菜单一并消失），传对象则配置它（`image: { upload }`、`codeBlock: { defaultLanguage: 'ts' }`），需要密钥或回调的功能传入对象后才启用（`imageGif: { GIPHY_API_KEY }`、`mention: { suggestion }`、`excalidraw: {}`）。想自己组装？同一个入口导出全部扩展和控件——`Bold` 与 `RichTextBold`、`Table` 与 `RichTextTable`——[快速开始](https://ludejun.github.io/ai-sparkwrite-editor/zh/guide/getting-started)里两种方式都有示例，Kit 的全部选项见 [RichTextKit 页面](https://ludejun.github.io/ai-sparkwrite-editor/zh/guide/kit)。

你的 `/api/ai` 收到 `{ messages, systemPrompt, stream }`，返回 `{ text }` 或一串 `data: {"text"}` 事件即可——接口约定和十行的示例服务见 [AI 文档](https://ludejun.github.io/ai-sparkwrite-editor/zh/extensions/AI/)。

## 实时协作

多人同时编辑一篇文档，能看到彼此的光标，撤销只撤自己的。编辑器通过 [Yjs](https://yjs.dev) 同步；`YSyncProvider` 在你自己持有的 socket 上收发 `y-websocket` 格式的报文，`collaborationKitOptions` 把它接进 kit（kit 随即去掉自带的历史记录，改用 Yjs 的撤销管理器）：

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
  // 不传 `content`：文档内容就是 Y.Doc
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
```

Vue 的 kit 用同样的选项；`y-websocket`、Hocuspocus 的 provider 也能同样接入。完整的 React / Vue 组件写法、如何保存而不重复保存远端改动（`isChangeOrigin`）、只读成员，以及自建服务端要处理的报文格式，见[协作编辑指南](https://ludejun.github.io/ai-sparkwrite-editor/zh/guide/collaboration)。

## 文档

全部在文档站：**[ludejun.github.io/ai-sparkwrite-editor](https://ludejun.github.io/ai-sparkwrite-editor/)**——[快速开始](https://ludejun.github.io/ai-sparkwrite-editor/guide/getting-started)、[AI](https://ludejun.github.io/ai-sparkwrite-editor/extensions/AI/)、[全部功能与导入路径](https://ludejun.github.io/ai-sparkwrite-editor/guide/features)、[多框架](https://ludejun.github.io/ai-sparkwrite-editor/guide/frameworks)、[协作编辑](https://ludejun.github.io/ai-sparkwrite-editor/zh/guide/collaboration)、[自定义](https://ludejun.github.io/ai-sparkwrite-editor/guide/customization)、[体积](https://ludejun.github.io/ai-sparkwrite-editor/guide/bundle-size)。先去 **[在线 Playground](https://ludejun.github.io/ai-sparkwrite-editor/playground/)** 试：内置演示模型，不配密钥也能走完所有 AI 流程。

## 配合 AI 编程助手使用

仓库自带一份面向 Claude Code、Cursor、Codex 等助手的 skill——接入规则、AI 后端契约、上传与图片删除的做法、排错清单——npm 包内也附带一份：`node_modules/ai-sparkwrite-editor/skills/ai-sparkwrite-editor/SKILL.md`。

```bash
npx skills add ludejun/ai-sparkwrite-editor
```

文档同时以 [llms.txt](https://ludejun.github.io/ai-sparkwrite-editor/llms.txt) 和 [llms-full.txt](https://ludejun.github.io/ai-sparkwrite-editor/llms-full.txt) 发布；[AI 编程助手](https://ludejun.github.io/ai-sparkwrite-editor/zh/guide/ai-agents)一页说明还有哪些材料可以交给助手。

## 开发

```bash
pnpm install
pnpm build:lib      # playground 引用构建产物 lib/
pnpm playground     # http://localhost:8000，顶部可切换 React ⇄ Vue
pnpm type-check && pnpm lint
pnpm docs:dev
```

提交规范与如何引入上游修复见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 来源

代码源自 hunghg255 及贡献者的 [reactjs-tiptap-editor](https://github.com/hunghg255/reactjs-tiptap-editor)，此后经过大幅重构。感谢他们以及 [Tiptap](https://tiptap.dev) 与 [shadcn/ui](https://ui.shadcn.com/)。MIT 许可。
