/**
 * The React entry: everything the package offers from one import. Each
 * feature still lives in its own chunk, so a bundler that tree-shakes (Vite,
 * Rollup, webpack, esbuild) only ships what you reference; the per-feature
 * subpaths (`ai-sparkwrite-editor/bold`) remain available for tools that do
 * not.
 */
export * from '@/components/RichTextProvider';
export * from '@/components/Toolbar';
// Platform-aware shortcut labels (⌘ on macOS, Ctrl elsewhere) for your own UI and content.
export { getShortcutKeys, getShortcutKey } from './utils/plateform';
export { localeActions, useLocale } from './locales';
export { useTheme, themeActions } from './theme/theme';

// Floating UI: bubble menus, the selection AI menu, the drag handle.
export * from '@/components/Bubble';

// Extensions with their React controls and node views.
export * from '@/extensions/AI';
export * from '@/extensions/Attachment';
export * from '@/extensions/Blockquote';
export * from '@/extensions/Bold';
export * from '@/extensions/BulletList';
export * from '@/extensions/Callout';
export * from '@/extensions/Notice';
export * from '@/extensions/Clear';
export * from '@/extensions/Collaboration';
export * from '@/extensions/Code';
export * from '@/extensions/CodeBlock';
export * from '@/extensions/CodeView';
export * from '@/extensions/Color';
export * from '@/extensions/Column';
export * from '@/extensions/Details';
export * from '@/extensions/Divider';
export * from '@/extensions/Drawer';
export * from '@/extensions/Emoji';
export * from '@/extensions/Excalidraw';
export * from '@/extensions/ExportMarkdown';
export * from '@/extensions/ExportPdf';
export * from '@/extensions/ExportWord';
export * from '@/extensions/FontFamily';
export * from '@/extensions/FontSize';
export * from '@/extensions/FormatPainter';
export * from '@/extensions/Heading';
export * from '@/extensions/Highlight';
export * from '@/extensions/History';
export * from '@/extensions/HorizontalRule';
export * from '@/extensions/Iframe';
export * from '@/extensions/Image';
export * from '@/extensions/ImageGif';
export * from '@/extensions/ImportWord';
export * from '@/extensions/Indent';
export * from '@/extensions/Italic';
export * from '@/extensions/Katex';
export * from '@/extensions/LineHeight';
export * from '@/extensions/Link';
export * from '@/extensions/MarkdownPaste';
export * from '@/extensions/Mention';
export * from '@/extensions/Mermaid';
export * from '@/extensions/MoreMark';
export * from '@/extensions/OrderedList';
export * from '@/extensions/Recorder';
export * from '@/extensions/RichPaste';
export * from '@/extensions/SearchAndReplace';
export * from '@/extensions/ShortMessage';
export * from '@/extensions/SlashCommand';
export * from '@/extensions/Strike';
export * from '@/extensions/StyledBlocks';
export * from '@/extensions/Table';
export * from '@/extensions/TableOfContents';
export * from '@/extensions/TaskList';
export * from '@/extensions/TextAlign';
export * from '@/extensions/TextDirection';
export * from '@/extensions/TextUnderline';
export * from '@/extensions/Twitter';
export * from '@/extensions/Video';

// Several controls export an `Item` type and both image extensions a
// `SetImageAttrsOptions`; the explicit re-export picks the canonical one.
export type { Item } from '@/extensions/FontFamily';
export type { SetImageAttrsOptions } from '@/extensions/Image';

// The whole editor as one extension plus a ready-made toolbar and menus.
export * from './kit/react';
