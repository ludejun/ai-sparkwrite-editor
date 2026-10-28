---
name: ai-sparkwrite-editor
description: Integrate, configure, debug, migrate and review editors built on ai-sparkwrite-editor (SparkWrite), the AI-first Tiptap editor SDK for React and Vue. Use it for RichTextKit and hand-assembled setups, the AI backend contract (`endpoint`), image/video/attachment uploads and deleting orphaned uploads at save time, embeds, notices, toolbars, bubble menus, slash commands, saving and loading documents, real-time collaboration (Yjs), localization and theming. Applies whenever this package is requested or already installed; not to generic Tiptap integrations with other UI libraries.
---

# ai-sparkwrite-editor

Tiptap 3 extensions plus ready-made UI. One import per framework: `ai-sparkwrite-editor` (React), `ai-sparkwrite-editor/vue` (Vue 3), `ai-sparkwrite-editor/core` (framework-free extensions, no DOM components). The AI layer writes **into the document** as real nodes: the model answers in Markdown and the editor renders it through its own schema.

Implement the requested behaviour with the smallest compatible change. Preserve the host app's framework, package manager, saved document format and editor ownership. Do not change observable behaviour the user did not ask about.

## Establish the version and the route

1. Read the host's `package.json`/lockfile. These references describe **1.1.0 with Tiptap ^3.29.2**. The installed package's `lib/*.d.ts` declarations and its `package.json` `exports` win over anything written here.
2. Keep every `@tiptap/*` package on one version; `@tiptap/vue-3` must match `@tiptap/core` exactly, otherwise two schemas load and nodes are "unknown".
3. Pick the route:
   - **Kit** (default for new editors): `RichTextKit.configure({...})` + `RichTextKitToolbar` + `RichTextKitMenus`. One option per feature: `false` removes it with its buttons and menus, an object configures it, an object also switches an opt-in feature on.
   - **Assembled** (existing editors, custom toolbars, minimal bundles): register extensions one by one and place their `RichText*` controls inside `RichTextProvider`.
   - **Headless / other framework**: `ai-sparkwrite-editor/core` with `@tiptap/core`; supply your own UI.
4. Ask only for product decisions the code cannot reveal: the upload endpoint and response shape, where the AI backend lives, the persistence contract (HTML or JSON, when to save).

Never copy the library's private `@/` aliases into consumer code and never guess an import path from a component name: check `package.json` `exports` or the extension map.

## Load the relevant reference

| Task                                                                                                                                                                      | Reference                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Install, kit vs assembled, SSR, save/load, read-only, collaboration, kit option list                                                                                      | [quickstart.md](references/quickstart.md)             |
| Every export, entry point, companion node, bubble menu, React-only vs Vue                                                                                                 | [extension-map.md](references/extension-map.md)       |
| **AI backend** (`endpoint` request/response, streaming, server samples, direct provider calls, `generate`)                                                                | [ai-backend.md](references/ai-backend.md)             |
| Uploads (image/video/attachment/Word import), deleting orphaned images, embeds, notices, slash menu, mentions, export, locale, theme, custom toolbar and blocks, recorder | [feature-recipes.md](references/feature-recipes.md)   |
| Debugging, reviewing and verifying an integration                                                                                                                         | [review-checklist.md](references/review-checklist.md) |

Read only the sections you need. Recipes extend the quickstart; they are not standalone components.

## Rules that hold in every integration

- **One editor, one provider.** `useEditor` creates the instance; `RichTextProvider` and `EditorContent` share it; every `RichText*` control, bubble menu, the slash list and the AI composer render inside the provider. Guard the initial `null` editor (`if (!editor) return null`).
- **Register the extension and render its control.** A control alone enables nothing; an extension alone shows no button. `RichTextKitToolbar`/`RichTextKitMenus` do this pairing automatically from the registered extension names.
- **Styles**: `import 'ai-sparkwrite-editor/style.css'` once, at the host's global style boundary. The host does not need Tailwind. Root class is `.sparkwrite`; library utility classes are `richtext-` prefixed.
- **AI keys stay on the server.** Configure `ai: { endpoint: '/api/ai' }` (or `AI.configure({ endpoint })`) and implement that URL in the host's backend per [ai-backend.md](references/ai-backend.md). `protocol`/`model`/`apiKey` in the browser are for local experiments only; say so when a user asks for them.
- **Uploads return a durable URL.** `upload: (file) => Promise<string>` must resolve to a URL the saved document can reopen later and reject on failure. Object URLs, data URLs and short-lived signed URLs are previews, not saved media. Keep transport (fetch, auth, response mapping) in an app-owned adapter; pass it to `Image.configure({ upload })` / the kit's `image: { upload }`.
- **Deleting uploads is a save-time job.** `getImageChanges(editor)` returns `current`, `added`, `removed`, `orphaned`; delete `removed` + `orphaned` on the server after a successful save, then `markImagesSaved(editor)`. Never delete on every edit (undo can bring an image back).
- **Persistence**: save in `onUpdate` (debounced) with `editor.getHTML()` or `editor.getJSON()`; `content` only initialises. Replace an externally loaded document once with `editor.commands.setContent(next, { emitUpdate: false })`. Keep the schema stable between save and load, or content of removed extensions is lost.
- **SSR**: client component (`'use client'` in Next.js), `immediatelyRender: false`, no browser APIs during prerender.
- **Locale before language**: `localeActions.setMessage(code, dict)` then `setLang(code)`; only English is bundled, other 16 dictionaries load from `ai-sparkwrite-editor/locales/<file>`. Theme through `themeActions`, not a provider prop.
- **Vue** uses the same names from `ai-sparkwrite-editor/vue`; Excalidraw, Drawer, Emoji, Mention, Twitter, ShortMessage, FormatPainter and the slash menu are React-only. Do not promise them in Vue.
- Prefer static extension arrays outside the component; a callback that changes at runtime (auth token) should read current values through a ref/closure, not recreate the editor.

## Verify and deliver

Run the host's typecheck/build. For an executable change, exercise the interaction (open the dialog, upload, run the AI action) and inspect the console; for docs, check imports and links. Reproduce a bug and find the owning extension, command or state update before changing architecture.

Deliver complete imports, the CSS import, the dependency list and the app-specific contracts (upload endpoint, AI endpoint). State what was verified and what was not. For reviews, lead with actionable findings and file locations.
