/**
 * Framework-agnostic entry: everything here is Tiptap/ProseMirror only — no
 * React, no DOM components — so it works with `@tiptap/vue-3`, `@tiptap/core`
 * in a vanilla page, or any other binding. Controls and node views live in
 * the per-feature subpaths (`ai-sparkwrite-editor/<feature>`), which are React.
 *
 * A build check (`tests/core-headless.test.mjs`) fails if anything reachable
 * from this file imports react.
 */

// Marks and text formatting
export { Bold } from '@/extensions/Bold/Bold';
export { Italic } from '@/extensions/Italic/Italic';
export { TextUnderline } from '@/extensions/TextUnderline/TextUnderline';
export { Strike } from '@/extensions/Strike/Strike';
export { Code } from '@/extensions/Code/Code';
export { MoreMark } from '@/extensions/MoreMark/MoreMark';
export { Color } from '@/extensions/Color/Color';
export { Highlight } from '@/extensions/Highlight/Highlight';
export { FontFamily } from '@/extensions/FontFamily/FontFamily';
export { FontSize } from '@/extensions/FontSize/FontSize';
export { LineHeight } from '@/extensions/LineHeight/LineHeight';
export { TextAlign } from '@/extensions/TextAlign/TextAlign';
export { TextDirection } from '@/extensions/TextDirection/TextDirection';
export { Indent } from '@/extensions/Indent/Indent';
export { Clear } from '@/extensions/Clear/Clear';
export { Link } from '@/extensions/Link/Link';

// Blocks
export { Heading } from '@/extensions/Heading/Heading';
export { BulletList } from '@/extensions/BulletList/BulletList';
// Bullet and ordered lists need it; re-exported so a core setup is one import.
export { ListItem } from '@tiptap/extension-list';
export { OrderedList } from '@/extensions/OrderedList/OrderedList';
export { TaskList } from '@/extensions/TaskList/TaskList';
export { Blockquote } from '@/extensions/Blockquote/Blockquote';
export { Table } from '@/extensions/Table/Table';
export { DividerCore as Divider, DIVIDER_VARIANTS } from '@/extensions/Divider/Divider';
export type {
  DividerAttributes,
  DividerOptions,
  DividerVariant,
  DividerVariantOption,
} from '@/extensions/Divider/Divider';
export {
  StyledBlocksCore as StyledBlocks,
  BlockStyles,
  CardCore as Card,
  HEADING_STYLES,
  QUOTE_STYLES,
  CARD_STYLES,
  STYLED_TYPES,
  cleanVariant,
} from '@/extensions/StyledBlocks/StyledBlocks';
export type {
  StyledBlocksOptions,
  CardOptions,
  HeadingStyle,
  QuoteStyle,
  CardStyle,
} from '@/extensions/StyledBlocks/StyledBlocks';
export {
  ORNAMENT_DIVIDER_VARIANTS,
  ARTICLE_DIVIDER_VARIANTS,
} from '@/extensions/StyledBlocks/ornaments';
export { Details, DetailsContent, DetailsSummary } from '@/extensions/Details/Details';
export { Column, ColumnNode, MultipleColumnNode } from '@/extensions/Column/Column';
export type { DetailsOptions } from '@/extensions/Details/Details';
export {
  CodeBlockCore as CodeBlock,
  guessLanguage,
  LIST_LANG,
  MAP_LANGUAGE_LABEL,
  languageLabel,
} from '@/extensions/CodeBlock/CodeBlock';
export type { CodeBlockOptions } from '@/extensions/CodeBlock/CodeBlock';
export {
  CalloutCore as Callout,
  CALLOUT_TYPES,
  getCalloutType,
} from '@/extensions/Callout/Callout';
export type { CalloutOptions, CalloutType } from '@/extensions/Callout/Callout';
export {
  Notice,
  NOTICE_TYPES,
  DEFAULT_NOTICE_TYPE,
  getNoticeType,
} from '@/extensions/Notice/Notice';
export type { NoticeOptions, NoticeType } from '@/extensions/Notice/Notice';
export { Video, DEFAULT_VIDEO_OPTIONS } from '@/extensions/Video/Video';
export type {
  VideoOptions,
  VideoUploadContext,
  VideoUploadProgress,
} from '@/extensions/Video/Video';
export { IframeCore as Iframe } from '@/extensions/Iframe/Iframe';
export {
  EmbedServiceLink,
  getExampleUrl,
  getServiceSrc,
  EMBED_SERVICES,
  GENERIC_EMBED,
  resolveEmbed,
  embedServiceOf,
} from '@/extensions/Iframe/utils';
export type { EmbedService, EmbedKind, EmbedResolution } from '@/extensions/Iframe/embeds';
export { KatexCore as Katex, loadKatex } from '@/extensions/Katex/Katex';
export type {
  IKatexAttrs,
  IKatexOptions,
  KatexLoader,
  KatexRenderer,
} from '@/extensions/Katex/Katex';
export { MermaidCore as Mermaid } from '@/extensions/Mermaid/Mermaid';
export type { MermaidOptions } from '@/extensions/Mermaid/Mermaid';
export {
  AttachmentCore as Attachment,
  getFileTypeIconMarkup,
  getFileTypeIconSpec,
} from '@/extensions/Attachment/Attachment';
export type { AttachmentOptions } from '@/extensions/Attachment/Attachment';
export {
  TableOfContentsCore as TableOfContents,
  TableOfContentsNodeCore as TableOfContentsNode,
  getHierarchicalIndexes,
  getLinearIndexes,
  readTableOfContents,
  scrollToTableOfContentsItem,
  tableOfContentsIndexLabel,
} from '@/extensions/TableOfContents/TableOfContents';
export type {
  TableOfContentData,
  TableOfContentDataItem,
  TableOfContentsItem,
  TableOfContentsNodeOptions,
  TableOfContentsOptions,
} from '@/extensions/TableOfContents/TableOfContents';

// Images: the inline `image` + `imageBlock` nodes, the GIF node, and the
// upload bookkeeping. Node views come from the React or Vue layer.
export {
  ImageCore as Image,
  ImageBlockCore as ImageBlock,
  IMAGE_BLOCK_NAME,
  DEFAULT_OPTIONS as DEFAULT_IMAGE_OPTIONS,
  getImageInsertNodeName,
  migrateImageJSONToImageBlock,
  parseRotation,
  CAPTION_CLASS as IMAGE_CAPTION_CLASS,
  isImageCaptionEvent,
  isInsideImageCaption,
} from '@/extensions/Image/Image';
export type { IImageOptions, SetImageAttrsOptions } from '@/extensions/Image/Image';
export { ImageGifCore as ImageGif } from '@/extensions/ImageGif/ImageGif';
export type {
  ImageGifOptions,
  SetImageAttrsOptions as SetImageGifAttrsOptions,
} from '@/extensions/ImageGif/ImageGif';

// Behaviour
export { History } from '@/extensions/History/History';
export { SearchAndReplace } from '@/extensions/SearchAndReplace/SearchAndReplace';
export { RichPaste } from '@/extensions/RichPaste/RichPaste';
export { MarkdownPaste } from '@/extensions/MarkdownPaste/MarkdownPaste';
export { Recorder, getRecording, replayRecording } from '@/extensions/Recorder/Recorder';
export type { Recording, RecordingEntry, RecorderOptions } from '@/extensions/Recorder/Recorder';

// AI: the extension (headless — supply `mountPanel` or use the React/Vue
// layers for the panel), writing straight into the document, ghost-text
// autocomplete, the composer presets, transport and markdown rendering.
export { AICore as AI, DEFAULT_AI_SYSTEM_PROMPT } from '@/extensions/AI/AICore';
export { aiPluginKey } from '@/extensions/AI/state';
export type { AIState, AISession, AIWriting } from '@/extensions/AI/state';
export {
  writeWithAI,
  aiOptionsOf,
  resolveWriteTarget,
  documentContext,
  rangeMarkdown,
} from '@/extensions/AI/writer';
export type { WriteWithAIOptions, WriteWithAIResult } from '@/extensions/AI/writer';
export { AIAutocomplete, aiAutocompleteKey } from '@/extensions/AI/Autocomplete';
export type {
  AIAutocompleteOptions,
  AIAutocompleteState,
  AISuggestion,
} from '@/extensions/AI/Autocomplete';
export { AI_COMPOSER_ACTIONS, composerPrompt, browserLanguage } from '@/extensions/AI/composer';
export type { AIComposerAction } from '@/extensions/AI/composer';
export { generateAIText } from '@/extensions/AI/client';
export {
  markdownToFragment,
  markdownToHTML,
  markdownToPreviewHTML,
  markdownToSlice,
} from '@/extensions/AI/markdown';
export type {
  AIMessage,
  AIOptions,
  AIPanelComponentProps,
  AIProtocol,
  AIRequest,
  AIWriteTarget,
} from '@/extensions/AI/types';

// Image bookkeeping: which uploads are still in the document at save time
export {
  collectImageSources,
  getImageChanges,
  markImagesSaved,
  rememberUploadedImage,
} from '@/extensions/Image/imageLifecycle';

// Text and fonts
export { localeActions, translate, en, getLocaleState, subscribeLocale } from '@/locales/store';
export { DEFAULT_FONT_FAMILY_LIST, SCRIPT_FONT_FAMILY_LIST } from '@/constants';

// Import/export and source view (controls are React; the extensions and
// their commands work anywhere)
export { ExportMarkdown, getMarkdown } from '@/extensions/ExportMarkdown/ExportMarkdown';
export { ExportPdf } from '@/extensions/ExportPdf/ExportPdf';
export { ExportWord } from '@/extensions/ExportWord/ExportWord';
export { ImportWord } from '@/extensions/ImportWord/ImportWord';
export { CodeView } from '@/extensions/CodeView/CodeView';

// Real-time co-editing (Yjs): the extensions plus a transport-agnostic y-protocols provider
export {
  Collaboration,
  CollaborationCaret,
  renderCollaborationCaret,
} from '@/extensions/Collaboration/Collaboration';
export type {
  CollaborationOptions,
  CollaborationCaretOptions,
  CollaborationUser,
} from '@/extensions/Collaboration/Collaboration';
export { YSyncProvider, collaborationKitOptions } from '@/extensions/Collaboration/provider';
export type { YSyncStatus, YSyncProviderEvents } from '@/extensions/Collaboration/provider';
