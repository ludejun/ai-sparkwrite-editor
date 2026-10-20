---
description: RichTextKit——把整个编辑器装进一个扩展，并附带现成的工具栏和菜单

next:
  text: 工具栏
  link: /zh/guide/toolbar.md
---

# RichTextKit

`RichTextKit` 把编辑器的所有功能装进**一个 Tiptap 扩展**，就像 `StarterKit` 打包了 Tiptap 的基础功能。`RichTextKitToolbar` 渲染一条完整的工具栏，`RichTextKitMenus` 渲染浮动界面——AI 写作台、带“改进”菜单的文本气泡、表格/链接/媒体/块级气泡、拖拽手柄和斜杠菜单——只渲染 Kit 里注册了的部分。三个 import，一个可用的编辑器；关掉某个功能，它的按钮和菜单一起消失。

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
        ai: { endpoint: '/api/ai' }, // 服务端的一个地址
        image: { upload: (file) => uploadToYourStorage(file) },
        placeholder: { placeholder: '输入 / 插入块，空行按空格呼出 AI…' },
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
      placeholder: { placeholder: '写点什么，或在空行按空格呼出 AI…' },
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

Kit 只是省事，不是锁定：同一个入口也单独导出每个扩展和控件，而 `RichTextKit*` 组件同样适用于你自己组装的编辑器——它们只看注册了哪些扩展。每个功能仍是独立分块，关掉部分功能的 Kit 不会比逐个引入同样的功能更大（见[包体积](/zh/guide/bundle-size)）。

## 选项

每个键对应一个功能，取值有三种：

- **不写**——默认：包含在内，下表的“需显式开启”功能除外；
- **`false`**——去掉，工具栏按钮和菜单一并消失；
- **对象**——包含并传给该扩展的 `.configure()`；类型就是该扩展自己的选项（`ai: { endpoint }`、`codeBlock: { defaultLanguage: 'ts' }`、`heading: { levels: [1, 2, 3] }`）。对需显式开启的功能，传对象即开启，不需要配置时传 `{}` 即可。

| 分组     | 键（默认开启）                                                                                                                                                                                                                                                         | 需显式开启（传 `{ … }`）                                                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 文档     | `document`、`paragraph`、`text`、`hardBreak`、`dropcursor`、`gapcursor`、`history`                                                                                                                                                                                     | `placeholder`（`{ placeholder: '…' }`）                                                                                                                                  |
| 文本样式 | `bold`、`italic`、`underline`、`strike`、`code`、`moreMark`（上下标）、`textStyle`（颜色、字体、字号所依赖的标记）、`color`、`highlight`、`fontFamily`、`fontSize`、`lineHeight`、`textAlign`、`textDirection`、`indent`、`clear`、`formatPainter`（仅 React）、`link` | —                                                                                                                                                                        |
| 块       | `heading`、`bulletList`、`orderedList`、`taskList`、`blockquote`、`table`、`divider`、`details`、`codeBlock`、`callout`、`notice`、`tableOfContents`、`column`（React 默认开启；Vue 需显式开启）                                                                       | `horizontalRule`（分割线已取代它）                                                                                                                                       |
| 媒体嵌入 | `image`、`video`、`iframe`、`attachment`、`katex`、`mermaid`                                                                                                                                                                                                           | `imageGif`（`{ GIPHY_API_KEY }`）、`emoji`、`excalidraw`、`drawer`、`twitter`、`mention`（`{ suggestion }`）、`shortMessage`（`{ messages }`）——除 `imageGif` 外仅 React |
| 行为     | `slashCommand`（仅 React）、`searchAndReplace`、`richPaste`、`markdownPaste`、`exportMarkdown`、`exportWord`、`importWord`、`exportPdf`、`codeView`                                                                                                                    | `recorder`                                                                                                                                                               |
| AI       | `ai`（[选项](/zh/extensions/AI/#选项)；记得设置 `endpoint`）、`aiAutocomplete`                                                                                                                                                                                         | —                                                                                                                                                                        |

列表会自动带上 `ListItem`，`column` 会把文档 schema 放宽为 `(block|columns)+`，即使两个键共用同一个伴随扩展，每个扩展也只注册一次。`RichTextKitOptions` 类型已导出，方便把配置放在别处维护。

## 工具栏

`<RichTextKitToolbar />` 的布局：AI · 撤销、重做 · 标题 · 粗体、斜体、下划线、删除线、颜色、高亮、清除格式 · 无序/有序/任务列表、对齐 · 链接、图片、表格、代码块 · 一个**更多工具**面板放其余控件（字体、字号、行高、上下标、缩进、格式刷；引用、行内代码、分割线、分栏、提示块、折叠块、目录、emoji、视频、GIF、附件、iframe、Katex、Excalidraw、Mermaid、手绘、Twitter；导入 Word，导出 PDF / Word / Markdown；查找替换、文字方向、源码视图）。每个控件只在对应扩展已注册时出现。

面板每行排三个，相近的功能放在同一行（字号 · 行高 · 格式刷；增加缩进 · 减少缩进……）。**把某一行拖到工具栏上即可常驻**——它会离开面板变成一个固定按钮。要移除：悬停按钮点右上角的 × 角标，或在面板底部的“已放到工具栏”分组里点移除，也可以把它拖回面板。常驻项按浏览器记在 `localStorage` 里。

| 属性          | 默认值                                  | 作用                                                   |
| ------------- | --------------------------------------- | ------------------------------------------------------ |
| `more`        | `true`                                  | “更多工具”面板                                         |
| `pinnable`    | `true`                                  | 允许把面板里的行拖到工具栏，以及拖回去                 |
| `defaultPins` | `[]`                                    | 用户改动前默认常驻的面板项，如 `['fontSize', 'katex']` |
| `storageKey`  | `ai-sparkwrite-editor:kit-toolbar-pins` | 常驻项的存储键                                         |
| `overflow`    | `'wrap'`                                | `'collapse'` 让工具栏始终一行，见[溢出折叠](#溢出折叠) |
| `children`    | —                                       | 额外控件，放在内置分组之后（React）；Vue 用默认插槽    |
| `className`   | —                                       | React：工具栏的额外 class                              |

想换顺序或只挑几个控件，就用控件自己组合，见[工具栏](/zh/guide/toolbar)。

### 溢出折叠

默认情况下，工具栏比控件窄时会换行。放在窄列里（侧栏、分屏）时，传 `overflow='collapse'` 可以让它**始终保持一行**：放不下的分组整组收进面板顶部的**更多工具**分组，在那里是普通的面板行——带文字标签、可直接使用，开启 `pinnable` 时也能拖到工具栏上常驻。

```tsx
<RichTextKitToolbar overflow='collapse' />
```

```vue
<RichTextKitToolbar overflow="collapse" />
```

分组按“最不常用先走”的顺序离开工具栏，宽度够了立刻回来：

1. 常驻（pin）的控件（后 pin 的先走）
2. 颜色、高亮、清除格式
3. 对齐
4. 字体
5. 链接、图片、表格、代码块
6. 撤销、重做

AI、段落样式、粗体/斜体/下划线/删除线、列表永不折叠；“更多”触发按钮永远在最右侧——此模式下即使 `more={false}` 也会显示。宽度用 `ResizeObserver` 监听；每个分组只测量一次（宽度变化时再测，比如网页字体加载完成），所以拖动窗口不会让控件重新渲染。根元素带 `data-overflow="collapse"` 和 `data-collapsed="colors align …"`，列出当前收进面板的分组 id（`history`、`font`、`colors`、`align`、`insert`、`pin:<key>`），方便样式和测试断言。

## 菜单

`<RichTextKitMenus />` 会为已注册的扩展挂载：`RichTextAIComposer`、`RichTextBubbleText`（含“改进”菜单）、表格/链接/图片/视频/GIF/提示块/iframe/Katex/Mermaid/Excalidraw/手绘/Twitter 的气泡、`RichTextBubbleMenuDragHandle` 和 `SlashCommandList`（React）。Vue 里是写作台以及文本、表格、链接、图片气泡。

| 属性         | 默认值 | 作用                                                                                |
| ------------ | ------ | ----------------------------------------------------------------------------------- |
| `composer`   | `true` | AI 写作台；`false` 隐藏，传对象则作为它的 props（`{ defaultOpen: true, rows: 3 }`） |
| `dragHandle` | `true` | 块拖拽手柄（React）                                                                 |

## 在线体验

[Playground](https://ludejun.github.io/ai-sparkwrite-editor/playground/) 默认就跑在 Kit 上；顶部的 **Setup** 切换可以看到逐个控件组装（_Assembled_）的同一个编辑器——React 和 Vue 都有。
