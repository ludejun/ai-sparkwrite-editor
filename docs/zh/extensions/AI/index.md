---
description: AI

next:
  text: Attachment
  link: /zh/extensions/Attachment/index.md
---

# AI

模型是把内容**写进文档**，而不是写进聊天窗口。回答以 Markdown 流式返回，并通过编辑器自身的 schema 渲染，所以一个 `|` 表格会变成编辑器的表格，一段围栏代码会变成代码块，`- [ ]` 会变成任务列表——都是可以继续编辑的真实节点，而不是粘贴进来的文本。

一共有五种进入方式，它们共享同一个扩展：

| 入口                                     | 会发生什么                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **选中文本 → 改进**                      | 选区菜单可以改写、缩短、翻译、解释文本，或把它转换为表格或列表；先预览，再点击应用。             |
| **在空行按空格键**                       | 在光标处打开 Ask AI（Notion 式手势）。设置 `spaceTrigger: false` 可关闭该功能。                  |
| **`/ai`、`/continue`**                   | 斜杠命令入口：Ask AI、继续写作、打开写作台。                                                     |
| **AI 工具栏按钮、`⌘/Ctrl+J`**            | 在编辑器下方打开 **AI 写作台**：输入你想要的内容，答案会流式写入上方的页面。可保留、撤销、精修。 |
| **输入时的灰色续写**（`AIAutocomplete`） | 在某个块末尾停顿后，接下来的几个词会以灰色显示；按 Tab 采纳，按 Escape 或继续输入则取消。        |

## 安装与注册

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
  AI.configure({ endpoint: '/api/ai' }), // 你自己的后端；由哪个提供方、哪个模型来回答是它的事
  AIAutocomplete, // 可选：灰色续写建议
  SlashCommand,
];

// 在 <RichTextProvider editor={editor}> 内部：
//   <RichTextToolbar><RichTextAI /> …</RichTextToolbar>
//   <EditorContent editor={editor} />
//   <RichTextAIComposer />      ← 写作台面板，由 RichTextAI / ⌘J / "/ai" 打开
//   <RichTextBubbleText />      ← 包含“改进”菜单
//   <SlashCommandList />
```

前端只需要一个 `endpoint`：编辑器会把对话内容以 JSON 形式 POST 到这个 URL，并读取返回的答案，无论是否流式——契约细节参见[你的接口地址](#你的接口地址)。浏览器中不配置任何协议、模型或密钥。直连 OpenAI 或 Anthropic，以及完全自定义的 `generate`，仍然可用于实验和特殊传输层。

## AI 写作台

`RichTextAIComposer` 位于编辑器下方，直接写入编辑器。可以通过 `RichTextAI` 工具栏按钮、`⌘/Ctrl+J`、`/ai` 斜杠命令、“改进”菜单中的“打开 AI 写作台”，或 `editor.commands.toggleAIComposer(true)` 打开它。

- **快捷动作**运行文档级预设：继续写作、总结、拟大纲、建议标题、提取待办事项（把所有决定和待解决问题整理成任务列表）、通篇修正语法、翻译整篇文档。每一项都知道自己的答案该写到哪里（末尾、顶部、光标处，或整篇文档）。
- **输入框**可以输入任何内容；写入位置选择器可选 _替换选区_ / _光标处_ / _顶部_ / _末尾_ / _整篇文档_。图片和文本文件可以一并发送——点回形针、拖到输入框上，或直接粘贴——遵循与面板相同的 `enableImageInput` / `enableFileInput` / `maxAttachmentSize` 规则。
- **快捷动作保持在一行内。** 放不下的会收进一个 `+N` 按钮里。将鼠标悬停在某个快捷动作上，会显示它实际发送的完整提示词；这些提示词就是 `AI_COMPOSER_ACTIONS` 的 `prompt` 字段。
- **答案流式返回时**，正在填充的那一段会被高亮着色，并跟随其他位置发生的编辑而移动；点击 Stop 会保留已经到达的部分。
- **完成之后**：可以保留、撤销（把原文恢复）、重试，或输入一句追问——同一段内容会结合迄今为止的对话被重写。最终答案只占一个撤销步骤。

预设本身是数据，因此可以修改它们：

```tsx
import { AI_COMPOSER_ACTIONS, RichTextAIComposer } from 'ai-sparkwrite-editor';

<RichTextAIComposer
  actions={[
    ...AI_COMPOSER_ACTIONS,
    {
      key: 'editor.ai.compose.tweet', // 本地化 key 或普通文本标签
      icon: 'PenLine',
      target: 'end',
      prompt: 'Write a tweet announcing this document.',
    },
  ]}
/>;
```

### 关闭写作台或重新设计样式

`AI.configure({ composer: false })` 会移除写作台面板**以及所有进入方式**：`RichTextAI` 工具栏按钮不再渲染任何内容，`⌘/Ctrl+J` 和 `/ai composer` 消失，“改进”菜单中不再有“打开 AI 写作台”，`toggleAIComposer()` 也变成空操作。选区菜单、空格唤起和自动续写不受影响。

写作台面板本身接受以下 props（Vue 中名称相同）：

| Prop                 | 默认值                | 作用                                               |
| -------------------- | --------------------- | -------------------------------------------------- |
| `actions`            | `AI_COMPOSER_ACTIONS` | 快捷动作；传入 `[]` 会隐藏整行                     |
| `showTarget`         | `true`                | “文本写入位置”选择器                               |
| `hint`               | `true`                | 底部提示行；`false` 隐藏它，传入字符串可替换其内容 |
| `placeholder`        | 本地化字符串          | 输入框的占位文字                                   |
| `rows`               | `2`                   | 输入框显示的行数                                   |
| `gradient`           | `true`                | 渐变边框与背景晕染；`false` 时为纯色面板           |
| `accent`             | `#804dff`             | 主题色；会设置 `--ai-accent` 变量                  |
| `className`、`style` | —                     | 传给根节点                                         |

如需更精细的控制，样式表在 `.richtext-ai-composer` 上暴露了 `--ai-accent`、`--ai-accent-2`、`--ai-accent-3` 变量，各组成部分也都是普通的 class：`richtext-ai-composer-head`（快捷动作行，或保留/撤销/重试的结果提示，以及关闭按钮）、`-chipline`、`-chips`、`-more`、`-menu`、`-box`（输入框）、`-input`、`-bar`（写入位置选择器与发送按钮）、`-send`、`-close`、`-foot`、`-hint`。

### 从你自己的界面写入文档

写作台背后的引擎是独立导出的，且与框架无关：

```ts
import { writeWithAI } from 'ai-sparkwrite-editor';
// 或 'ai-sparkwrite-editor/core'

const result = await writeWithAI(editor, {
  prompt: 'Turn the meeting notes into a table of decisions.',
  target: 'selection', // 'selection' | 'cursor' | 'start' | 'end' | 'document' | { from, to }
  signal: controller.signal,
  onProgress: (markdown) => console.log(markdown.length),
});
result.keep(); // 或调用 result.discard() 把原文恢复
// result.messages 是完整对话；把它作为 `history` 传入即可继续精修。
```

文档级的写入位置（`cursor`、`start`、`end`）会把文档内容作为 Markdown 上下文发送，并裁剪到 `documentContext` 个字符（默认 12000；设为 `0` 则不发送）。`selection` 和 `document` 发送的是受影响的文本本身——当它跨越多个块时会以 Markdown 形式发送，以便重写后结构依然保留。

### 把快捷动作的结果交给宿主

有些预设动作的结果不该进正文："建议标题"更适合填进你应用自己的标题输入框，而不是在文档顶部插一个 `h1`。`onComposeResult` 会在快捷动作写完后被调用，参数包含该动作的 `key`、Markdown 形式的回答、写入位置以及 `writeWithAI` 返回的句柄。返回 `true` 表示宿主已处理：写作台会撤回刚插入的内容（文档恢复原样）并清空提示词；不返回则照常进入保留 / 撤销 / 重试流程。自由输入的提示词和后续精修不会触发它。

```ts
AI.configure({
  endpoint: '/api/ai',
  onComposeResult: ({ action, markdown }) => {
    if (action === 'editor.ai.compose.title.suggest') {
      setTitle(markdown.replace(/^#+\s*/, '').trim());
      return true; // 已处理：编辑器把刚插入的标题撤回
    }
  },
});
```

## 灰色续写自动补全

`AIAutocomplete` 是一个独立的扩展，不注册就不产生任何开销。选项包括：`enabled`（是否默认开启；`toggleAIAutocomplete()` 可切换）、`delay`（900 毫秒的静默判定）、`minChars`（块内至少 24 个字符）、`contextChars`（发送 1500 个字符）、`maxTokens`（48）、`prompt`。它使用 `AI` 扩展的传输层，只在光标位于非代码块末尾且编辑器处于聚焦状态时才会发起请求，并会丢弃过时的答案。`acceptAISuggestion()` 与 `dismissAISuggestion()` 是对应命令；Tab 和 Escape 已绑定好快捷键。

## 改进选中文本

当 AI 已注册时，`RichTextBubbleText` 会包含**改进**功能：_编辑选区_（改进写作、修正拼写与语法、缩短、加长、简化、调整语气）和 _生成_（总结、解释、**转换为表格**、**转换为列表**、翻译）。改写会保留原有语言，因此翻译只有一个入口，默认目标是读者浏览器的语言；设置 `translateLanguages: ['English', 'Deutsch']` 可以固定一份子菜单。**向 AI 提问**会打开一个空白输入框。全选之后同样可用。

面板会在文档流中于选区下方打开，以文档自身的样式流式显示答案，并提供重试、放弃和应用。回车发送，Shift+回车换行，Escape 关闭。以编程方式调用：`editor.commands.openAI('Make this more concise.')`。

预设都是普通的提示词；自定义 `buttonBubble` 可以把 `RichTextAIImprove`（来自 `ai-sparkwrite-editor/bubble/ai`）放在任意位置。

## 你的接口地址

前端从不知道由哪个提供方或哪个模型来作答。每次请求都会发送：

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

`messages` 是目前为止的对话（`user` / `assistant` 轮次；用户附加的文本文件已经内联进 `content`，图片则以 data URL 的形式放在 `attachments` 中）。只要界面能够逐段渲染增量内容，`stream` 就是 `true`。

用以下任意一种方式作答：

- **JSON** —— `{ "text": "…markdown…" }`（也接受 `content` 或 `markdown` 字段），或
- **服务器推送事件**（`Content-Type: text/event-stream`）—— 每个增量对应一条 `data: {"text":"…"}` 事件，末尾以 `data: [DONE]` 结束。

纯文本响应体，或原样透传的 OpenAI Chat Completions / Anthropic Messages 响应或流，同样能被读取。所以最简单的服务端实现，就是一个添加密钥并转发提供方流式输出的代理：

```ts
// Node / Express 搭配 OpenAI SDK 的示例——换成任何其他提供方或 Agent 框架，思路都一样。
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

`headers` 用于添加请求头（CSRF token、租户 id 等）；同源请求会照常携带 cookie。请求失败时只会显示带状态码的通用提示——响应体本身永远不会被展示，因此代理不会通过它泄露凭据。扩展上设置 `stream: false` 时，总是要求返回 JSON 格式的答案。

## 直连模型服务商与自定义传输层

如果不设置 `endpoint`，扩展会自行调用 [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat) 或 [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create)：需要设置 `protocol`、`model`，以及可选的 `baseURL`（包含 `/v1` 的 API 根地址）和 `apiKey`（字符串或异步取值函数）。浏览器打包产物中的密钥对浏览器是可见的，所以这种方式仅适合本地实验，或者搭配一个注入密钥的同源代理（`baseURL: '/api/openai'`，不设置 `apiKey`）。

`generate(request, onChunk)` 会完全替换传输层——适用于 SDK 客户端、WebSocket，或 Agent 框架：

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
      onChunk?.(chunk); // 流式写入面板 / 文档
    }
    return text; // 完整答案
  },
});
```

`generate` 会在 `message.attachments` 上接收附件；每收到一段文本就调用一次 `onChunk`，并在结束时用完整文本 resolve。你抛出的错误信息会显示在界面上。

## 选项

| 选项                                           | 默认值                         | 作用                                                                                                                                                                    |
| ---------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `endpoint`                                     | `''`                           | **推荐的配置方式。** 你的后端 URL：以 JSON 形式接收 `{ messages, systemPrompt, stream, maxTokens }`，返回 `{ text }`，或一个 `{ text }` 增量组成的 `text/event-stream`  |
| `generate`                                     | `null`                         | 自定义传输层 `(request, onChunk?) => Promise<string>`；会替代 `endpoint` 与直连模型服务商的调用                                                                         |
| `protocol`                                     | `'openai'`                     | 仅用于直连模型服务商：OpenAI Chat Completions 或 Anthropic Messages                                                                                                     |
| `model`                                        | `''`                           | 仅用于直连模型服务商：模型 ID                                                                                                                                           |
| `apiKey`                                       | `''`                           | 仅用于直连模型服务商：密钥，或异步获取密钥的函数                                                                                                                        |
| `baseURL`                                      | 提供方的 `/v1` 根地址          | 仅用于直连模型服务商：包含 `/v1` 的 API 根地址                                                                                                                          |
| `maxTokens`                                    | `2048`                         | 最大生成 token 数                                                                                                                                                       |
| `headers`                                      | `{}`                           | 额外或覆盖的请求头                                                                                                                                                      |
| `systemPrompt`                                 | 写作助手提示词                 | 要求使用用户所用的语言，并只输出 Markdown                                                                                                                               |
| `stream`                                       | `true`                         | 请求服务器推送事件；设为 `false` 则等待一次性的 JSON 答案                                                                                                               |
| `spaceTrigger`                                 | `true`                         | 在空行按空格键唤起 Ask AI                                                                                                                                               |
| `documentContext`                              | `12000`                        | 文档级提示词随请求发送的文档字符数                                                                                                                                      |
| `placement`                                    | `'inline'`                     | `'external'`：Ask AI 对话框不插入正文，由你的 `mountPanel` 渲染到别处（侧栏、抽屉），选区范围随编辑移动                                                                 |
| `serializeDocument`                            | 编辑器自带的 Markdown 导出逻辑 | `(editor, range) => string`：把一段内容转换成发给模型的文本。跨多个块的片段与整篇文档都会以 Markdown 形式发送，以保留表格、列表和代码的结构；可重写以做脱敏或重新格式化 |
| `onComposeResult`                              | —                              | `({ action, markdown, target, editor, result }) => boolean \| void`：写作台快捷动作完成后调用；返回 `true` 表示宿主已接管，编辑器撤回刚插入的内容                       |
| `translateLanguages`                           | `[]`                           | 固定的翻译目标语言；为空则使用浏览器语言                                                                                                                                |
| `enableImageInput`                             | `true`                         | 允许附加图片（模型需要支持接收图片）                                                                                                                                    |
| `enableFileInput`                              | `true`                         | 允许附加文本文件，内容会内联进提示词                                                                                                                                    |
| `imageMimes`、`fileMimes`、`maxAttachmentSize` | 见源码                         | 允许的附件类型与大小限制（4 MB）                                                                                                                                        |
| `renderResult`                                 | —                              | React：替换面板展示答案的方式（`{ markdown, html, streaming }`）                                                                                                        |
| `components.Panel`                             | —                              | React：替换整个面板                                                                                                                                                     |
| `mountPanel`                                   | React/Vue 的渲染器             | 框架挂载钩子：`(mount, props) => unmount`；core 入口默认导出为 `null`                                                                                                   |

只有选中的文本（或你允许发送的文档上下文）、你的提示词，以及已经成功完成的对话轮次会被发送出去。面板会话期间如果文档发生了编辑——包括协同编辑——会话会关闭，其请求也会被中止。关闭面板、点击 Stop，或销毁编辑器，都会中止请求。

## 流式输出与富文本回答

使用 `endpoint` 时，增量内容就是你的服务端发送的 `data: {"text"}` 事件；使用直连模型服务商时，会向提供方请求服务器推送事件（OpenAI 的 `stream: true`，Anthropic 的 `content_block_delta`）。每个增量到达时都会立即显示；`stream: false` 时会等待完整答案返回。答案是**通过编辑器自身的 schema** 渲染的 Markdown：预览显示的正是编辑器最终会保存的那份 HTML，并套用文档自身的样式，点击应用后会插入真实节点。只有一个段落的答案会合并进正在编辑的段落；带有块级结构的答案则会替换整个块。未知标签、脚本和属性在进入编辑器的过程中会被丢弃。

## 自定义渲染（React）

- `renderResult({ markdown, html, streaming })` 只替换答案的展示方式——可以换成你自己的 Markdown 组件、字数统计，或与选区内容的差异对比。
- `components.Panel` 替换整个对话框。它接收 `editor`、`options`、`selectedText`、`initialPrompt`、`apply(markdown)` 和 `close()`；调用 `generateAIText(options, request, onChunk)` 即可使用传输层。

以下辅助函数均已导出：`markdownToHTML`、`markdownToFragment(editor, md)`、`markdownToSlice(editor, md)`、`markdownToPreviewHTML(editor, md)`。

## Core 与 Vue

`ai-sparkwrite-editor/core` 导出与 `AI` 相同的扩展（无 UI：命令、装饰、`writeWithAI`、`AIAutocomplete`、`AI_COMPOSER_ACTIONS`、`generateAIText`，以及各个 Markdown 辅助函数），`mountPanel` 为 `null`——你可以提供自己的实现，在任意框架中挂载面板。`ai-sparkwrite-editor/vue` 导出的 `AI` 自带 Vue 面板，并附带 `RichTextAI`、`RichTextAIComposer`、`RichTextAIImprove` 和 `RichTextBubbleText`；参见[框架集成](/zh/guide/frameworks)。

所有文案都经过本地化系统（`editor.ai.*`、`editor.ai.compose.*`）；playground 无需密钥即可自行作答，方便体验完整流程（`VITE_AI_MODEL` 等变量可切换到真实模型，参见 `playground/.env.example`）。
