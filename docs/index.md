---
layout: home

hero:
  name: ai-sparkwrite-editor
  text: Tell it what you want. It writes it in the page.
  tagline: An AI-first editor SDK on Tiptap. Prose, tables, code, task lists, formulas and diagrams are produced by the model and land in the document as real, editable blocks — streaming, undoable, in 16 languages, with real-time collaboration on Yjs. React and Vue on one framework-free core.
  image:
    src: /logo.svg
    alt: ai-sparkwrite-editor
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Features
      link: /guide/features
    - theme: alt
      text: GitHub
      link: https://github.com/ludejun/ai-sparkwrite-editor
features:
  - title: A composer that writes into the document
    details: Type a request under the editor and watch it stream into the page as headings, lists, tables and code. Keep, undo, retry, or refine the same span. One undo step.
  - title: The whole document, one click
    details: Continue writing, summarize, outline, suggest a title, extract action items, fix grammar everywhere, translate — with the document as context and its structure preserved.
  - title: Rewrite what you select, finish what you type
    details: Improve, shorten, translate, turn into a table or a list from the selection menu; Space on an empty line asks AI; ghost text completes your sentence, Tab keeps it.
  - title: Formulas and diagrams from a sentence
    details: Describe a formula or a flow; the Katex and Mermaid dialogs write the source and render it live.
  - title: Your model, your rules
    details: One URL on your backend receives the conversation as JSON and answers with text or a stream; which provider and model reply is your business. Answers are parsed through the editor schema, so nothing is pasted and nothing unknown gets in.
  - title: Composable, React or Vue
    details: One import per framework, or the whole editor as one `RichTextKit` with a ready-made toolbar and menus. The AI engine and every block live in a framework-free core shared by both UIs.
  - title: Everything a document needs
    details: Tables, dividers, code with language detection, images with cropping and upload tracking, columns, callouts, Katex, Mermaid, Excalidraw, Word/PDF/Markdown import and export.
  - title: Pastes and languages handled
    details: Word lists and code-editor snippets paste correctly; 16 languages load on demand with matching CJK, Devanagari and Bengali fonts.
  - title: Real-time collaboration
    details: Several people in one document over Yjs, with each other's carets and their own undo. The provider speaks the y-websocket format over a socket you own; y-websocket and Hocuspocus providers plug in too.
    link: /guide/collaboration
  - title: Record and replay
    details: Every edit can be recorded as timestamped steps and played back like a screen recording of the document.
  - title: Fits your design system
    details: Prefixed Tailwind classes, a handful of CSS variables, exported toolbar primitives for custom menus and custom blocks.
---
