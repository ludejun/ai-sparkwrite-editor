# Changelog

All notable changes to ai-sparkwrite-editor are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/).

## 1.4.0 — 2026-10-28

### Added

- Collaboration guide (docs, EN + zh) and a README section: wiring `YSyncProvider` and `collaborationKitOptions` into the React and Vue kits, other Yjs providers, saving, read-only members, and the frame format for your own server.
- `isChangeOrigin` is exported, to skip remote changes when saving from the client; `ai-sparkwrite-editor/vue` now exports the collaboration extensions, `YSyncProvider` and `collaborationKitOptions`.
- `Mod-K` opens link editing: the link bubble's card when `RichTextBubbleLink` is mounted, else the toolbar's form.

### Changed

- Links made from the toolbar form no longer always get `target="_blank"`: the form's "Open in new tab" box decides, and an unticked link has no `target`. The Link `button()` props no longer carry a `target` (the Tiptap default `_blank` was mistaken for a forced value, which hid the box).
- Code view does not rewrite the document any more, so no update (and no autosave) fires while it is open; the document changes once, when edited source is applied.
- Hosts that re-rendered after `editor.setEditable(x, false)` so the controls caught up can drop that workaround.

### Fixed

- Controls follow `editor.setEditable(x, false)` (no update event): the toolbar, bubbles, format painter, drag handle and node views re-render on every editability change, per editor instead of one module-wide value, so a read-only editor inside another editor's `RichTextProvider` reads its own state. Toolbar actions, link and table menus and node-view controls check editability again when they run.
- Node views in read-only: the code block keeps only Copy (no language picker, no Delete); cards, dividers and images, GIFs, Mermaid and drawings lose their editing handles, and a resize in progress ends.
- Code view is a source editor laid over the document: opening it emits no update and adds no undo step; leaving applies edited source as one undoable step. It closes without applying when the editor turns read-only.
- Image, GIF, video, Mermaid and drawing bubbles show only for a selected node of that kind (not for Select All), and their Delete removes only that node.
- Links: only a bare domain gets `https://` (and a bare address `mailto:`); relative paths, anchors, `mailto:` and `tel:` are kept, `javascript:` is refused. "Open in new tab" is honoured, and the toolbar, bubble and Vue forms share one path.
- Collaborative Redo is enabled right after a Yjs undo.
- The table context menu is anchored from `<body>`; the link hover bubble hides on typing or caret moves; search shows `0/0` without results and removes its highlights when closed.
- Details: read-only toggles no longer flip the stored `open` once editable; the toggle's label is translated. Pasted Markdown code blocks lose the trailing empty line. Icon buttons carry an `aria-label`.

## 1.3.0 — 2026-10-21

### Added

- `RichTextKitToolbar` (React) takes `ai`: a node that replaces the built-in AI control in the first slot of the row, for a host that answers AI elsewhere (a side panel). Like the built-in one it never collapses and is shown whether or not the AI extension is registered.
- The text bubble menu offers the styled-block look (heading / quote / card variant) for the selected block, so a host can drop the toolbar's block-style dropdown.

## 1.2.0 — 2026-10-19

### Added

- **Real-time co-editing (Yjs)**: `RichTextKit.configure({ collaboration: { document }, collaborationCaret: { provider, user } })` (or `...collaborationKitOptions({ document, provider, user })`). Both are opt-in; with `collaboration` on, `history` (UndoRedo) is left out and the toolbar's undo / redo drive Yjs's undo manager. `YSyncProvider` speaks the `y-websocket` binary protocol over any transport (`connect(send)` / `receive(bytes)` / `disconnect()`), with `synced` / `status` / `denied` events. Remote carets carry a name label in the user's colour (`.richtext-collab-caret`). `yjs` and `y-protocols` are now external in the build: the host must resolve one copy (e.g. Vite `resolve.dedupe: ['yjs', 'y-protocols', 'prosemirror-view', …]` — `@tiptap/y-tiptap` imports `prosemirror-*` directly). Also in `ai-sparkwrite-editor/core` and `ai-sparkwrite-editor/collaboration`. Golden fixtures for server-side Y ⇄ JSON converters: `node scripts/gen-collab-golden.mjs [--out dir] [--check]`; tests in `tests/collaboration.test.ts`.
- `RichTextKitToolbar` (React and Vue) takes `overflow='collapse'`: the toolbar stays on one line and, when the row is too narrow, moves whole groups into a "More tools" section at the top of the panel — pinned controls first, then colour/highlight/clear, alignment, font family, insert (link, image, table, code block), undo/redo; AI, paragraph style, bold/italic/underline/strike and lists never collapse. Collapsed rows stay usable and pinnable. Default `'wrap'` is unchanged. The root reports `data-overflow` and `data-collapsed="colors align …"`; the planning is `planToolbar()` in `src/kit/toolbarLayout.ts`, covered by `tests/kit-toolbar-layout.test.ts`. New locale key `editor.more.overflowGroup`.
- `AI.configure({ onComposeResult })`: a hook called after a composer chip (`AI_COMPOSER_ACTIONS` or your own) has written its answer, with `{ action, markdown, target, editor, result }`. Return `true` to take the answer over — the composer discards what it inserted and clears the prompt — so "Suggest a title" can fill your own title field instead of the document. React and Vue docks both honour it; free-form prompts and refinements do not call it.
- `AI.configure({ placement: 'external' })`: the Ask-AI panel is not inserted into the document. `mountPanel` gets a detached element and the host renders the panel where it likes (a side bar, a drawer); the selection stays highlighted, the session range follows edits (remote ones too) instead of closing, and `applyAI` keeps the session on the inserted text so a refinement can replace it again. Default `'inline'` is unchanged. Tests in `tests/ai-placement.test.ts`.
- **For AI coding agents**: the `skills/ai-sparkwrite-editor` skill is rewritten for 1.1.0 — kit-first setup, React/Vue/core entry points, every export, the AI `endpoint` contract with Express and Next.js server samples for OpenAI and Anthropic, image/video/attachment upload recipes, deleting orphaned uploads at save time, embeds, notices, locale and theme, a debugging checklist — and ships inside the npm package (`node_modules/ai-sparkwrite-editor/skills/…`). The docs site publishes `llms.txt` and `llms-full.txt`, and a new guide page, [AI Coding Agents](https://ludejun.github.io/ai-sparkwrite-editor/guide/ai-agents), lists what to hand an agent.
- **Styled blocks** (`StyledBlocks`, part of `RichTextKit`): magazine-style looks for long-form articles, stored as a `variant` on ordinary nodes so every exporter still sees plain headings, quotes and containers. Headings: `pill` `bar` `underline` `ornament` `step` `tag`; quotes: `card` `center` `line` `paper`; a new `card` block (`soft` `outline` `shadow` `accent` `ticket` `tip` `warn` `ask` `answer` `end` `dark` `stat`, with an optional label) holding ordinary editable blocks. Looks are CSS (`sn-h--*`, `sn-quote--*`, `sn-box--*`, accent via `--sn-accent`); `pill` / `step` numbering uses CSS counters. Toolbar and bubble-menu controls in React (`RichTextBlockStyle`). Tests in `tests/styled-blocks.test.mjs`.
- **Ornamental dividers**: `ORNAMENT_DIVIDERS` adds `fade` `gradient` `bar` `diamond` `trio` `dots` `wave` `stars` `starsea` `leaf` `pen` `ribbon` `ink` `end` on top of the divider's built-in looks; pass them (or a selection) as the divider's `variants` option.
- **Article themes**: the article root may carry `sn-theme sn-theme--<id>` to restyle plain headings, quotes, dividers, captions and body typography as a set (system fonts, plain CSS output); styled cards follow through `--sn-accent`. The same token map drives the static renderer and WeChat inline-style export. Tests in `tests/themes.test.mjs`.
- **Static rendering** (`ai-sparkwrite-editor/static`): `renderStaticHTML(json)` turns a Tiptap document into the HTML the editor shows — same schema, same node-view DOM, same highlighter token classes — without React or a DOM, so it runs in Node for published pages, feeds and server-side rendering. Also `parseStaticHTML`, `staticSchema`, `staticExtensions`, `highlightCode` / `tokensToHTML`, the escaping helpers, `CODE_THEME`, `loadKatex` / `loadKatexStyles`, and `markdownToHTML`. Style the output with the new `ai-sparkwrite-editor/content.css` (built by `scripts/build-content-css.mjs`) inside a `.sn-article` element. Tests in `tests/static-render.test.mjs`.
- `loadKatexStyles()` loads KaTeX's stylesheet next to the renderer (best effort; a host without CSS imports still gets the renderer).
- The slash menu's item, group and variant types are exported as `SlashCommandItem`, `SlashCommandGroup` and `SlashCommandVariant`.

### Fixed

- Code blocks in the kit kept the body font size and wrapped long lines (the kit's `pre { font-size: 1em }` reset beat `.shj`, and the node view set `white-space: pre-wrap` inline), so lines drifted away from their gutter numbers. They keep a 13px monospace font and scroll long lines, as designed.
- Divider styles target the divider's own `hr` (`> hr`) instead of any `hr` inside it, so ornamental dividers that contain their own markup render correctly.
- With Yjs collaboration on, the toolbar's undo / redo buttons drive the `collaboration` extension's undo manager instead of staying disabled.
- `RichTextToolbar` forwards its ref.
- The `commit-msg` hook (`pnpm verify-commit`) checks only the header line, so a body and a footer (`Closes #…`, `BREAKING CHANGE:`, `Co-Authored-By:`) are accepted; the check is `scripts/verify-commit-msg.mjs` and the `verify-commit-msg` dependency is gone.

## 1.1.0 — 2026-09-24

Everything since 1.0.0. (1.0.1 was bumped in `package.json` but never published; its changes are listed here.)

### Added

- **Embeds**: the Iframe block recognises 35 services — YouTube, Vimeo, Bilibili, Youku, Tencent Video, Loom, Descript, Spotify, SoundCloud, Google Maps, AMap, Baidu Maps, Figma, Canva, Miro, Whimsical, Excalidraw, dbdiagram, ProcessOn, Modao, Lanhu, Framer, CodePen, CodeSandbox, StackBlitz, JSFiddle, GitHub Gist, Google Docs/Sheets/Slides/Forms, Airtable, Trello, ClickUp, Typeform, Jinshuju — turning a pasted share link (or a copied `<iframe>` embed code) into the embeddable URL, with a sensible frame height per service. Every service shows its real brand mark in the prompt (drawn SVGs, Simple Icons, favicons; the ~29KB of marks beyond the built-in ten load on demand). `resolveEmbed()` and `EMBED_SERVICES` are exported; the prompt lists what works and shows a service's tips; `/embed` (or `/youtube`, `/figma`…) in the slash menu; the toolbar button is now called "Embed".
- `Notice`: info, success, warning and tip boxes holding ordinary editable blocks, saved as `<div class="notice" data-type="…">`. Toolbar dropdown and bubble menu in React and Vue, one slash-menu row with the four types inline, Markdown export as GitHub-style alerts, part of `RichTextKit`.
- **Cell background colour** in the table context menu (React and Vue): a palette, "No Fill" and a free colour input.
- The kit toolbar's panel is three columns with related controls side by side, and its rows can be **dragged onto the toolbar to pin them** (drag back to unpin); pins persist in `localStorage` (`pinnable`, `defaultPins`, `storageKey`). Blockquote moved to the main row; `RichTextIndent` takes `only='indent' | 'outdent'`.
- Links use `#2f54eb` (`#597ef7` in dark mode), overridable with `--richtext-link` / `--richtext-link-dark`.

### Fixed

- Editor padding is responsive: 16–24px on phones, 40px on tablets, the previous 80px from 1024px up — a phone no longer spends 160px of its width on margins.
- English UI labels use Title Case consistently ("Auto Detect", "Search Language", "Add Caption", "AI Prompt", "Table of Contents"…); code block language ids without a display name are capitalised ("Elixir") and the auto-detected marker reads "· Auto".
- `RichTextKit` registers `TextStyle`, so picking a font family, font size, colour or line height works in the kit (it threw "There is no mark type named 'textStyle'" and the menu appeared stuck).
- The link edit card no longer shares the screen with the text bubble, stays anchored to its link instead of following the caret, sits above the block drag handle, and closes on a click elsewhere.
- Links keep the surrounding text's weight; only the colour marks them.
- The heading and font pickers keep a fixed width, so changing a block's level no longer shifts the toolbar.
- Code View toggles inside one transaction instead of throwing "Applying a mismatched transaction".
- The docs site's favicon and touch icons resolve under the GitHub Pages base path.
- The link bubble no longer disappears when the pointer moves from the link onto its buttons (the editor's `mouseleave` fired after the menu's `mouseenter` and restarted the hide timer).
- Code block line numbers share the code's font and size, so every number sits on its line; the language picker, copy and delete controls are smaller and quieter.
- The table context menu is wider so "Paragraph After Table ⌘Enter" stays on one line; the kit's "More tools" panel shows one control per row (indent and outdent were overlapping their label).

### Changed

- Font family menu: the fonts of the interface language's script (微软雅黑, 宋体… under a Chinese UI) come right after Default, before the Latin fonts, each group separated by a hairline.
- Kit toolbar: tighter spacing so the default row fits a 1024px column on one line (the "⋯" trigger keeps its place at the right end of the last row when it does wrap); pinned controls show a small remove badge on hover and are listed in an "On the Toolbar" group at the bottom of the panel with a remove button; the drag hint moved below the groups. Code block line numbers are smaller (0.75em) and lighter, still on the code's line grid.

## 1.0.0 — 2026-09-23

First release of `ai-sparkwrite-editor`. The code base descends from reactjs-tiptap-editor 1.0.46 and was reworked extensively before this release; the history before this point lives in the `archive/reactjs-tiptap-editor` branch.

### Editing

- **Tables** follow the editor radius, shrink to their columns, and let the caret out: click beside or below a table, press ⌘/Ctrl+Enter, or use the context menu entry. Cells draw one edge each so the grid stays 1px with `border-collapse: separate`.
- **Dividers** replace the horizontal rule: line, dashed, dotted, double, short, three dots, stars, a rule with editable text, and a numbered rule that renumbers itself. Saved HTML keeps an `<hr>` inside for exports and unstyled contexts.
- **Headings** have smaller top margins and a click in the gap above a block goes to that block instead of the previous paragraph.
- **Slash menu** lists Insert (table, code block, image, divider) before Format; rarely used blocks appear only when searched, with a hint saying so. Opening the menu no longer scrolls the page.
- **Rich paste** rebuilds Word's list paragraphs as real nested lists and inserts code copied from VS Code, Sublime, Xcode or JetBrains as a code block with a guessed language.
- **Code blocks** get a React node view with a language picker and a signature-based detector that recognises JavaScript, TypeScript, Python, CSS and Rust; syntax colours follow a GitHub light/dark palette.
- **Images** share one source picker between toolbar and slash command, gain numbered captions and a rotate control, accept every browser image format, and report removed and orphaned uploads at save time (`getImageChanges`, `markImagesSaved`).
- **Links** open their bubble on hover. The code block and column bubbles are removed in favour of node views.
- **Drag handle** no longer refocuses and scrolls the page when the pointer returns to a blurred editor.

### AI

- **Composer dock** (`RichTextAIComposer` + the `RichTextAI` toolbar button, `⌘/Ctrl+J`, `/ai`): a prompt bar under the editor whose answers stream straight into the document as real blocks. Presets for the whole document — continue writing, summarize, outline, suggest a title, extract action items, fix grammar everywhere, translate — plus a target selector (selection, caret, top, end, whole document). Keep, undo, retry or refine in place; the answer is one undo step. Images and text files can be attached to a prompt (paperclip, drop or paste), as in the panel.
- Multi-block selections and the whole document reach the model as **Markdown** (the editor's own export), so "fix grammar everywhere" or "translate document" keep every heading, table and code block. `serializeDocument` overrides the serializer.
- The playground's stand-in model transforms the real text — fixes the page's typos, tabulates the selection, outlines the headings — so every AI entry can be tried without a key.
- `composer: false` on the AI extension removes the dock together with its toolbar button, shortcut, slash entry and menu item; the dock takes `actions`, `showTarget`, `hint`, `placeholder`, `rows`, `gradient`, `accent` props. Chips sit on one line with a `+N` menu for the rest; hovering shows the prompt.
- English tooltip and menu labels use Title Case throughout ("AI Composer", "Fix Grammar Everywhere").
- **`endpoint`** — the frontend configures one URL on your backend and nothing else. The editor POSTs `{ messages, systemPrompt, stream, maxTokens }` as JSON and reads `{ text }` or a `text/event-stream` of `{ text }` deltas; OpenAI/Anthropic responses piped through unchanged are understood too. `protocol` / `model` / `apiKey` stay for direct provider calls, `generate` for custom transports.
- **`writeWithAI(editor, { prompt, target })`**, the framework-free engine behind the dock: streams Markdown into a tracked span that follows other edits, and returns `keep()`/`discard()` and the conversation for follow-ups.
- **Ghost-text autocomplete** (`AIAutocomplete`): after a pause at the end of a block the next words appear in grey; Tab accepts.
- **Space on an empty line** opens Ask AI (`spaceTrigger`).
- The Improve menu gains **Turn into table**, **Turn into list** and **Open AI composer**, and works after Select All.
- The extension is split into a framework-free `AICore` (commands, state, decorations, `mountPanel` hook) and thin React/Vue layers; `ai-sparkwrite-editor/core` exports the headless `AI`.
- Answers stream (OpenAI and Anthropic server-sent events, or a custom `generate` with `onChunk`).
- Answers are markdown, rendered through the editor schema: the preview is the exact HTML the editor would save, and Apply inserts real nodes. Single paragraphs merge into the current paragraph.
- Translate targets the browser language by default.
- `renderResult` customises the answer view; `components.Panel` replaces the whole dialog.
- Katex and Mermaid dialogs can generate their source from a one-line description.

### Toolbar and UI

- Exported toolbar primitives: `RichTextToolbar`, `RichTextToolbarDivider`, `RichTextToolbarMore` (a labelled overflow panel), `RichTextToolbarMoreGroup`, `RichTextToolbarMoreRow`, `RichTextToolbarButton`.
- `RichTextFontSize` has a compact icon variant; `ActionMenuButton` is narrower and no longer draws a second tooltip.
- Font family lists Chinese, Japanese, Korean, Devanagari and Bengali stacks when the UI language or the document uses that script. Long menus scroll instead of clipping.
- Colour picker rows, a fixed checkbox radius, and no browser focus ring around the editor.

### Internationalization

- 16 bundled languages ordered by speaker population: zh-CN, hi, es, fr, bn, pt-BR, ru, id, de, ja, tr, vi, ko, it, hu, fi, plus English. Load them on demand from `ai-sparkwrite-editor/locales/<code>`.

### Recording

- `Recorder` records every edit as timestamped ProseMirror steps; `replayRecording` plays a session back at any speed.

### Frameworks

- **One import per framework.** `ai-sparkwrite-editor` exports every extension, control, bubble menu and the AI layer for React; `ai-sparkwrite-editor/vue` does the same for Vue, framework-free extensions included. Each feature keeps its own chunk, so tree-shaking bundlers ship only what is referenced; the per-feature subpaths stay for the rest.
- **`RichTextKit`** — the whole editor as one extension (like StarterKit): `false` drops a feature, an object configures it, opt-in features (GIPHY, mentions, Excalidraw, drawer, Twitter, emoji, recorder…) switch on when given one. `RichTextKitToolbar` and `RichTextKitMenus` render a full toolbar, the AI composer dock, every bubble menu, the drag handle and the slash menu for whatever is registered — in React and in Vue. The playground runs on the kit by default, with a "Setup" switch to the assembled toolbar, for both UI layers.

- `ai-sparkwrite-editor/core`: the framework-agnostic layer (extensions without node views, paste rules, recorder, AI transport and markdown rendering, image bookkeeping, translations). A build check fails if React becomes reachable from it.
- `ai-sparkwrite-editor/vue`: Vue 3 provider, composables, toolbar primitives and controls on the same stylesheet as the React ones — now including the AI layer (`AI` with the Vue panel, `RichTextAI`, `RichTextAIComposer`, `RichTextAIImprove`), bubble menus (text, table, link, image), dialogs (link, image, video, attachment, Katex and Mermaid with AI generation, iframe) and Vue node views for divider, code block, callout, iframe, image, GIF, Katex, Mermaid, attachment and table of contents. `examples/vue` shows everything; the playground switches between the React and Vue layers.
- Every block extension is split into a framework-free `<Name>Core` and a thin React `<Name>` that only adds the node view; `ai-sparkwrite-editor/core` exports the cores. Excalidraw, Drawer and Twitter stay React-only (they wrap React libraries).
- Translations moved to a dependency-free store; `useLocale` (React) subscribes with `useSyncExternalStore`.
- The AI panel's tone selector was removed.

### Bundle size

- Icons are a registry: each control registers the Lucide icons it uses, so a host that imports one feature no longer pays for ~90 icons. `registerIcons` is exported for custom icon names.
- The `cn` class merger is a 25-line local helper; the shared stores use `useSyncExternalStore` instead of `reactjs-signal`.
- Importing `ai-sparkwrite-editor/bold` now reaches 30 KB of library code (was 88 KB) and one icon (was 87). `pnpm measure:entries` prints the per-entry figures; see the Bundle size guide.

### Documentation

- A RichTextKit guide page (every option, the toolbar and the menus) in both languages; `pnpm check:docs` type-checks every import the docs show against the built entries.
- The docs site has an English and a Simplified Chinese locale (language menu in the header), a new theme, React and Vue tabs on every extension page, and the favicon, logo and social image of the new brand.

### Build

- GitHub Pages workflow (`pages.yml`) publishes the docs at `/ai-sparkwrite-editor/` and the live playground at `/ai-sparkwrite-editor/playground/` on every push to `main`; the upstream surge preview workflows are gone.

- Named imports from `@tiptap/*` packages so the CommonJS bundles load.
- Package renamed to `ai-sparkwrite-editor`; subpaths keep their shape (`ai-sparkwrite-editor/table`, `ai-sparkwrite-editor/bubble/text`, `ai-sparkwrite-editor/locales/es`, plus `ai-sparkwrite-editor/core` and `ai-sparkwrite-editor/vue`). The root CSS class is `.sparkwrite`.
