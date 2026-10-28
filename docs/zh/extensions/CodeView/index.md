---
description: CodeView

next:
  text: Color
  link: /zh/extensions/Color/index.md
---

# CodeView

在文档区域中切换富文本视图与可编辑的 HTML 源码视图。

## 安装与注册

从[快速开始](/zh/guide/getting-started)中的依赖包入手。下面的完整示例注册了该功能并渲染其界面——请选择 React 或 Vue 标签页。如果是在已有的编辑器中使用，把这些导入和扩展项合并进你自己的配置，并把控件放进你已有的 `RichTextProvider` 中。

::: code-group

```tsx [React]
'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { RichTextProvider, CodeView, RichTextCodeView } from 'ai-sparkwrite-editor';
import 'ai-sparkwrite-editor/style.css';

const extensions = [Document, Paragraph, Text, CodeView];

export default function CodeViewExample() {
  const editor = useEditor({
    extensions,
    content: '<p>Try this feature here.</p>',
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <RichTextProvider editor={editor}>
      <RichTextCodeView />
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
import { CodeView, RichTextProvider } from 'ai-sparkwrite-editor/vue';
import 'ai-sparkwrite-editor/style.css';

const extensions = [Document, Paragraph, Text, CodeView];

const editor = useEditor({
  extensions,
  content: '<p>Try this feature here.</p>',
});
</script>

<template>
  <RichTextProvider :editor="editor">
    <EditorContent :editor="editor" />
  </RichTextProvider>
</template>
```

:::

::: tip Vue
Vue 层尚未提供：`RichTextCodeView`——请通过自己的控件调用对应命令，或参见[框架集成](/zh/guide/frameworks)。
:::

## 使用方式

点击工具栏按钮，会在文档上方叠加一个显示文档 HTML 的源码编辑框。打开时不改动文档：不触发更新事件，不会被自动保存，也不会广播给协作者，编辑器的撤销历史也不受影响。再次点击即退出：如果源码被修改过，会解析回文档并作为一次可撤销的操作；未修改则什么都不变。源码在被编辑之前会跟随其他来源（例如协作者）的改动同步更新。编辑器切换为只读时，源码视图会关闭且不应用。当前 schema 不支持的标记可能会被移除。这是一个 HTML 源码视图，并非用于在文档中展示代码的 [Code Block](/zh/extensions/CodeBlock/) 功能。
