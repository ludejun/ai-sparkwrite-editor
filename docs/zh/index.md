---
layout: home

hero:
  name: ai-sparkwrite-editor
  text: 告诉它你想要什么，它就把内容写进页面。
  tagline: 一个基于 Tiptap 的 AI 优先编辑器 SDK。段落、表格、代码、任务列表、公式和图表均由模型生成，并以真实、可编辑的块落入文档——支持流式输出、可撤销，覆盖 16 种语言，并支持基于 Yjs 的实时协作。React 与 Vue 共享同一个框架无关的核心。
  image:
    src: /logo.svg
    alt: ai-sparkwrite-editor
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: 功能一览
      link: /zh/guide/features
    - theme: alt
      text: GitHub
      link: https://github.com/ludejun/ai-sparkwrite-editor
features:
  - title: 能写进文档的 AI 写作台
    details: 在编辑器下方输入需求，看着它以标题、列表、表格和代码的形式流入页面。可对同一段内容保留、撤销、重试或继续打磨。全程只占一个撤销步骤。
  - title: 整篇文档，一键搞定
    details: 继续写作、总结、拟大纲、建议标题、提取待办事项、通篇改语法、翻译——以文档为上下文，并保留其结构。
  - title: 改写选中内容，续写你的输入
    details: 从选区菜单中选择改进、缩短、翻译，或将其转换为表格或列表；在空行按空格键即可唤起 AI；灰色续写会补全你的句子，按 Tab 采纳。
  - title: 一句话生成公式与图表
    details: 描述一个公式或一个流程，Katex 和 Mermaid 对话框会写出源码并实时渲染。
  - title: 你的模型，你的规则
    details: 你后端的一个接口地址接收 JSON 形式的对话内容，并以文本或流的形式作答；由哪个提供方、哪个模型来回答由你决定。回答会经过编辑器 schema 解析，因此不会直接粘贴，也不会混入未知内容。
  - title: 可组合，支持 React 或 Vue
    details: 每个框架一个入口，或用 `RichTextKit` 一次拿到整个编辑器与现成的工具栏和菜单。AI 引擎与所有块共享同一个框架无关的核心，供两套 UI 使用。
  - title: 文档所需的一切
    details: 表格、分割线、带语言检测的代码块、支持裁剪与上传跟踪的图片、分栏、标注框、Katex、Mermaid、Excalidraw，以及 Word/PDF/Markdown 的导入导出。
  - title: 妥善处理粘贴与多语言
    details: Word 列表与代码编辑器片段可正确粘贴；16 种语言按需加载，并匹配相应的中日韩、天城文与孟加拉文字体。
  - title: 实时协作
    details: 基于 Yjs 多人同时编辑一篇文档，能看到彼此的光标，撤销只撤自己的。provider 在你自己的 socket 上收发 y-websocket 格式报文，也能接 y-websocket、Hocuspocus 的 provider。
    link: /zh/guide/collaboration
  - title: 录制与回放
    details: 每一次编辑都可被记录为带时间戳的步骤，并像屏幕录像一样回放整篇文档的编辑过程。
  - title: 适配你的设计系统
    details: 带前缀的 Tailwind 类、少量 CSS 变量，以及导出的工具栏原语，供自定义菜单和自定义块使用。
---
