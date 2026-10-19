import { Extension } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { HardBreak } from '@tiptap/extension-hard-break';
import { ListItem } from '@tiptap/extension-list';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { Dropcursor, Gapcursor, Placeholder } from '@tiptap/extensions';
import { PinOff } from 'lucide-react';
import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import {
  RichTextBubbleCallout,
  RichTextBubbleDrawer,
  RichTextBubbleExcalidraw,
  RichTextBubbleIframe,
  RichTextBubbleImage,
  RichTextBubbleImageGif,
  RichTextBubbleKatex,
  RichTextBubbleLink,
  RichTextBubbleMenuDragHandle,
  RichTextBubbleMermaid,
  RichTextBubbleNotice,
  RichTextBubbleTable,
  RichTextBubbleText,
  RichTextBubbleTwitter,
  RichTextBubbleVideo,
} from '@/components/Bubble';
import {
  RichTextToolbar,
  RichTextToolbarDivider,
  RichTextToolbarMore,
  RichTextToolbarMoreGroup,
  RichTextToolbarMoreRow,
} from '@/components/Toolbar';
import {
  AI,
  AIAutocomplete,
  RichTextAI,
  RichTextAIComposer,
  type RichTextAIComposerProps,
} from '@/extensions/AI';
import { Attachment, RichTextAttachment } from '@/extensions/Attachment';
import { Blockquote, RichTextBlockquote } from '@/extensions/Blockquote';
import { Bold, RichTextBold } from '@/extensions/Bold';
import { BulletList, RichTextBulletList } from '@/extensions/BulletList';
import { Callout, RichTextCallout } from '@/extensions/Callout';
import { Clear, RichTextClear } from '@/extensions/Clear';
import { Code, RichTextCode } from '@/extensions/Code';
import { CodeBlock, RichTextCodeBlock } from '@/extensions/CodeBlock';
import { CodeView, RichTextCodeView } from '@/extensions/CodeView';
import { Collaboration, CollaborationCaret } from '@/extensions/Collaboration/Collaboration';
import { Color, RichTextColor } from '@/extensions/Color';
import { Column, ColumnNode, MultipleColumnNode, RichTextColumn } from '@/extensions/Column';
import { Details, RichTextDetails } from '@/extensions/Details';
import { Divider, RichTextDivider } from '@/extensions/Divider';
import { Drawer, RichTextDrawer } from '@/extensions/Drawer';
import { Emoji, RichTextEmoji } from '@/extensions/Emoji';
import { Excalidraw, RichTextExcalidraw } from '@/extensions/Excalidraw';
import { ExportMarkdown, RichTextExportMarkdown } from '@/extensions/ExportMarkdown';
import { ExportPdf, RichTextExportPdf } from '@/extensions/ExportPdf';
import { ExportWord, RichTextExportWord } from '@/extensions/ExportWord';
import { FontFamily, RichTextFontFamily } from '@/extensions/FontFamily';
import { FontSize, RichTextFontSize } from '@/extensions/FontSize';
import { FormatPainter, RichTextFormatPainter } from '@/extensions/FormatPainter';
import { Heading, RichTextHeading } from '@/extensions/Heading';
import { Highlight, RichTextHighlight } from '@/extensions/Highlight';
import { History, RichTextRedo, RichTextUndo } from '@/extensions/History';
import { HorizontalRule } from '@/extensions/HorizontalRule';
import { Iframe, RichTextIframe } from '@/extensions/Iframe';
import { Image, RichTextImage } from '@/extensions/Image';
import { ImageGif, RichTextImageGif } from '@/extensions/ImageGif';
import { ImportWord, RichTextImportWord } from '@/extensions/ImportWord';
import { Indent, RichTextIndent } from '@/extensions/Indent';
import { Italic, RichTextItalic } from '@/extensions/Italic';
import { Katex, RichTextKatex } from '@/extensions/Katex';
import { LineHeight, RichTextLineHeight } from '@/extensions/LineHeight';
import { Link, RichTextLink } from '@/extensions/Link';
import { MarkdownPaste } from '@/extensions/MarkdownPaste';
import { Mention } from '@/extensions/Mention';
import { Mermaid, RichTextMermaid } from '@/extensions/Mermaid';
import { MoreMark, RichTextMoreMark } from '@/extensions/MoreMark';
import { Notice, RichTextNotice } from '@/extensions/Notice';
import { OrderedList, RichTextOrderedList } from '@/extensions/OrderedList';
import { Recorder } from '@/extensions/Recorder';
import { RichPaste } from '@/extensions/RichPaste';
import { RichTextSearchAndReplace, SearchAndReplace } from '@/extensions/SearchAndReplace';
import { ShortMessage } from '@/extensions/ShortMessage';
import { SlashCommand, SlashCommandList } from '@/extensions/SlashCommand';
import { RichTextStrike, Strike } from '@/extensions/Strike';
import { StyledBlocks } from '@/extensions/StyledBlocks';
import { RichTextTable, Table } from '@/extensions/Table';
import { RichTextTableOfContents, TableOfContents } from '@/extensions/TableOfContents';
import { RichTextTaskList, TaskList } from '@/extensions/TaskList';
import { RichTextAlign, TextAlign } from '@/extensions/TextAlign';
import { RichTextTextDirection, TextDirection } from '@/extensions/TextDirection';
import { RichTextUnderline, TextUnderline } from '@/extensions/TextUnderline';
import { RichTextTwitter, Twitter } from '@/extensions/Twitter';
import { RichTextVideo, Video } from '@/extensions/Video';
import { cn } from '@/lib/utils';
import { useLocale } from '@/locales';
import { useEditorInstance } from '@/store/editor';

import { buildKit, extensionNames, type KitOptions, type KitRegistry } from './shared';
import {
  measureToolbar,
  planToolbar,
  segmentOf,
  TOOLBAR_DIVIDER_CLASS,
  TOOLBAR_GROUP_ATTR,
  type ToolbarGroupSpec,
} from './toolbarLayout';

import type { Command } from '@/extensions/SlashCommand/types';
import type { ReactNode } from 'react';
import type React from 'react';

/** Columns are block-level siblings, so the document has to allow them. */
const DocumentWithColumns = /* @__PURE__ */ Document.extend({ content: '(block|columns)+' });

/**
 * Every feature the kit knows, keyed by its option name. Opt-in entries need
 * a key or a callback (GIPHY, mentions…) and stay out until configured.
 */
const REGISTRY = {
  document: { extension: Document },
  paragraph: { extension: Paragraph },
  text: { extension: Text },
  hardBreak: { extension: HardBreak },
  dropcursor: { extension: Dropcursor },
  gapcursor: { extension: Gapcursor },
  placeholder: { extension: Placeholder, optIn: true },
  history: { extension: History },
  // Marks and text style
  bold: { extension: Bold },
  italic: { extension: Italic },
  underline: { extension: TextUnderline },
  strike: { extension: Strike },
  code: { extension: Code },
  moreMark: { extension: MoreMark },
  // The mark that colours, fonts, sizes and line heights hang on.
  textStyle: { extension: TextStyle },
  color: { extension: Color },
  highlight: { extension: Highlight },
  fontFamily: { extension: FontFamily },
  fontSize: { extension: FontSize },
  lineHeight: { extension: LineHeight },
  textAlign: { extension: TextAlign },
  textDirection: { extension: TextDirection },
  indent: { extension: Indent },
  clear: { extension: Clear },
  formatPainter: { extension: FormatPainter },
  link: { extension: Link },
  // Blocks
  heading: { extension: Heading },
  bulletList: { extension: BulletList, with: [ListItem] },
  orderedList: { extension: OrderedList, with: [ListItem] },
  taskList: { extension: TaskList },
  blockquote: { extension: Blockquote },
  notice: { extension: Notice },
  table: { extension: Table },
  divider: { extension: Divider },
  horizontalRule: { extension: HorizontalRule, optIn: true },
  details: { extension: Details },
  codeBlock: { extension: CodeBlock },
  callout: { extension: Callout },
  // Heading / quote looks and the `card` block (article layouts).
  styledBlocks: { extension: StyledBlocks },
  column: { extension: Column, with: [ColumnNode, MultipleColumnNode] },
  tableOfContents: { extension: TableOfContents },
  // Media and embeds
  image: { extension: Image },
  video: { extension: Video },
  iframe: { extension: Iframe },
  attachment: { extension: Attachment },
  katex: { extension: Katex },
  mermaid: { extension: Mermaid },
  imageGif: { extension: ImageGif, optIn: true },
  emoji: { extension: Emoji, optIn: true },
  excalidraw: { extension: Excalidraw, optIn: true },
  drawer: { extension: Drawer, optIn: true },
  twitter: { extension: Twitter, optIn: true },
  mention: { extension: Mention, optIn: true },
  shortMessage: { extension: ShortMessage, optIn: true },
  // Behaviour
  slashCommand: { extension: SlashCommand },
  searchAndReplace: { extension: SearchAndReplace },
  richPaste: { extension: RichPaste },
  markdownPaste: { extension: MarkdownPaste },
  recorder: { extension: Recorder, optIn: true },
  exportMarkdown: { extension: ExportMarkdown },
  exportWord: { extension: ExportWord },
  importWord: { extension: ImportWord },
  exportPdf: { extension: ExportPdf },
  codeView: { extension: CodeView },
  // AI
  ai: { extension: AI },
  aiAutocomplete: { extension: AIAutocomplete },
  // Real-time co-editing over a Y.Doc: opt-in; when on, `history` is left out (Yjs has its own undo).
  collaboration: { extension: Collaboration, optIn: true },
  collaborationCaret: { extension: CollaborationCaret, optIn: true },
} satisfies KitRegistry;

export type RichTextKitOptions = KitOptions<typeof REGISTRY>;

/**
 * The whole editor as one extension, like Tiptap's StarterKit: register it
 * alone and every feature above is in, with its React node views. Pass
 * `false` for a key to leave that feature out, an object to configure it
 * (`ai: { endpoint: '/api/ai' }`, `image: { upload }`), and an object for an
 * opt-in feature to switch it on (`imageGif: { GIPHY_API_KEY }`).
 */
export const RichTextKit = Extension.create<RichTextKitOptions>({
  name: 'richTextKit',

  addOptions() {
    return {};
  },

  addExtensions() {
    const registry = { ...REGISTRY } as typeof REGISTRY;
    if (this.options.column !== false) {
      registry.document = { extension: DocumentWithColumns } as typeof REGISTRY.document;
    }
    return buildKit(registry, this.options);
  },
});

/** Renders `nodes` with a divider between non-empty groups. */
function withDividers(groups: ReactNode[][]): ReactNode[] {
  const out: ReactNode[] = [];
  groups
    .map((group) => group.filter(Boolean))
    .filter((group) => group.length)
    .forEach((group, index) => {
      if (index)
        out.push(
          <RichTextToolbarDivider className={TOOLBAR_DIVIDER_CLASS} key={`divider-${index}`} />
        );
      out.push(...group);
    });
  return out;
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

/**
 * The `collapse` overflow mode: measures the row and its groups, keeps the
 * natural width of every group it has seen (a collapsed group is not in the
 * DOM to measure), and returns which groups the row cannot hold right now.
 * A group without a known width forces a measuring render with everything
 * inline; it happens in a layout effect, so nothing overflowed is painted.
 */
function useToolbarOverflow(enabled: boolean, groups: ToolbarGroupSpec[], resetKey: string) {
  const root = useRef<HTMLDivElement>(null);
  const widths = useRef<Record<string, number>>({});
  const latest = useRef(groups);
  const lastReset = useRef(resetKey);
  const [collapsed, setCollapsed] = useState<string[]>([]);

  latest.current = groups;
  if (lastReset.current !== resetKey) {
    // Labels changed (locale): every width is suspect, measure again.
    lastReset.current = resetKey;
    widths.current = {};
  }

  const measuring = enabled && groups.some((group) => widths.current[group.id] === undefined);
  const groupsKey = groups.map((group) => group.id).join(' ');

  const relayout = useCallback(() => {
    const element = root.current;
    if (!element) return;
    const metrics = measureToolbar(element);
    Object.assign(widths.current, metrics.widths);
    const plan = planToolbar({ ...metrics, groups: latest.current, widths: widths.current });
    setCollapsed((current) => (sameList(current, plan.collapsed) ? current : plan.collapsed));
  }, []);

  useLayoutEffect(() => {
    if (!enabled) {
      setCollapsed((current) => (current.length ? [] : current));
      return;
    }
    relayout();
    const element = root.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    // Width changes of the row, and of the groups on it (fonts loading, a dropdown's label).
    const observer = new ResizeObserver(() => flushSync(relayout));
    observer.observe(element);
    element
      .querySelectorAll(`:scope > [${TOOLBAR_GROUP_ATTR}]`)
      .forEach((group) => observer.observe(group));
    return () => observer.disconnect();
  }, [enabled, relayout, collapsed, groupsKey, measuring, resetKey]);

  return { root, collapsed: enabled && !measuring ? collapsed : [] };
}

const DRAG_TYPE = 'application/x-richtext-kit-control';
const DEFAULT_PINS_KEY = 'ai-sparkwrite-editor:kit-toolbar-pins';

function readPins(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writePins(key: string, pins: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(pins));
  } catch {
    // Storage may be unavailable (private mode, quota); pins then last for the session.
  }
}

export interface RichTextKitToolbarProps {
  className?: string;
  /** Extra controls, placed before the overflow panel. */
  children?: ReactNode;
  /** The "More tools" panel with the less frequent controls. Default true. */
  more?: boolean;
  /**
   * Let users drag a row out of the panel onto the toolbar to keep it there
   * (and drag it back onto the panel to return it). Default true.
   */
  pinnable?: boolean;
  /** localStorage key the pinned controls are remembered under. Default `ai-sparkwrite-editor:kit-toolbar-pins`. */
  storageKey?: string;
  /** Controls pinned before the user changes anything, by panel key (`fontSize`, `katex`…). */
  defaultPins?: string[];
  /**
   * What happens when the row is too narrow. `wrap` (default) breaks it into
   * further lines; `collapse` keeps one line and moves whole groups into a
   * "More tools" section at the top of the panel, least used first: pinned
   * controls, then colour/highlight/clear, alignment, font family, insert
   * (link, image, table, code block), undo/redo. AI, paragraph style, bold/
   * italic/underline/strike and lists never collapse; the panel trigger is
   * always shown. The toolbar reports the collapsed groups in `data-collapsed`.
   */
  overflow?: 'wrap' | 'collapse';
}

/** One panel entry: the extension that has to be registered, its label and control. */
interface PanelEntry {
  key: string;
  name: string;
  label: string;
  node: ReactNode;
  /** A control wider than the icon slot; its row spans two columns. */
  wide?: boolean;
}

/** A group of the main row: its collapse priority and the controls in it. */
interface RowGroup extends ToolbarGroupSpec {
  entries: PanelEntry[];
  /** A control the user pinned from the panel. */
  pin?: boolean;
}

/**
 * A complete toolbar for `RichTextKit` (or any editor): AI, history, text
 * style, lists, insert, and a "More tools" panel — each control appears only
 * when its extension is registered, so switching a feature off in the kit
 * also removes its button. Rows of the panel can be dragged onto the toolbar
 * to pin them there; the choice is remembered in localStorage.
 */
export function RichTextKitToolbar({
  className,
  children,
  more = true,
  pinnable = true,
  storageKey = DEFAULT_PINS_KEY,
  defaultPins = [],
  overflow = 'wrap',
}: RichTextKitToolbarProps) {
  const editor = useEditorInstance();
  const { t, lang } = useLocale();
  const collapse = overflow === 'collapse';
  const has = useMemo(() => extensionNames(editor), [editor]);
  const on = (name: string) => has.has(name);
  const [pins, setPins] = useState<string[]>(() => {
    const stored = readPins(storageKey);
    return stored.length || window.localStorage.getItem(storageKey) ? stored : defaultPins;
  });
  const [dropTarget, setDropTarget] = useState<'toolbar' | 'panel' | null>(null);

  const updatePins = useCallback(
    (next: (current: string[]) => string[]) =>
      setPins((current) => {
        const value = next(current);
        writePins(storageKey, value);
        return value;
      }),
    [storageKey]
  );

  // Panel entries in display order; three per line, related ones side by side.
  const groups: { label: string; entries: PanelEntry[] }[] = [
    {
      label: t('editor.slash.format'),
      entries: [
        {
          key: 'fontSize',
          name: 'fontSize',
          label: t('editor.fontSize.tooltip'),
          node: <RichTextFontSize compact />,
        },
        {
          key: 'lineHeight',
          name: 'lineHeight',
          label: t('editor.lineheight.tooltip'),
          node: <RichTextLineHeight />,
        },
        {
          key: 'formatPainter',
          name: 'painter',
          label: t('editor.format'),
          node: <RichTextFormatPainter />,
        },
        {
          key: 'moreMark',
          name: 'moreMark',
          label: t('editor.superscript.tooltip'),
          node: <RichTextMoreMark />,
        },
        {
          key: 'indent',
          name: 'richtextIndentOutdent',
          label: t('editor.indent.indent'),
          node: <RichTextIndent only='indent' />,
        },
        {
          key: 'outdent',
          name: 'richtextIndentOutdent',
          label: t('editor.indent.outdent'),
          node: <RichTextIndent only='outdent' />,
        },
      ],
    },
    {
      label: t('editor.slash.insert'),
      entries: [
        { key: 'code', name: 'code', label: t('editor.code.tooltip'), node: <RichTextCode /> },
        {
          key: 'divider',
          name: 'divider',
          label: t('editor.divider.tooltip'),
          node: <RichTextDivider />,
        },
        {
          key: 'column',
          name: 'richtextColumnExtension',
          label: t('editor.columns.tooltip'),
          node: <RichTextColumn />,
        },
        {
          key: 'callout',
          name: 'callout',
          label: t('editor.callout.tooltip'),
          node: <RichTextCallout />,
        },
        {
          key: 'notice',
          name: 'notice',
          label: t('editor.notice.tooltip'),
          node: <RichTextNotice />,
        },
        {
          key: 'details',
          name: 'details',
          label: t('editor.details.tooltip'),
          node: <RichTextDetails />,
        },
        {
          key: 'tableOfContents',
          name: 'tableOfContents',
          label: t('editor.tableofcontents.tooltip'),
          node: <RichTextTableOfContents />,
        },
        {
          key: 'emoji',
          name: 'richTextEmojiWrapper',
          label: t('editor.emoji.tooltip'),
          node: <RichTextEmoji />,
        },
        { key: 'video', name: 'video', label: t('editor.video.tooltip'), node: <RichTextVideo /> },
        {
          key: 'imageGif',
          name: 'imageGif',
          label: t('editor.imageGif.tooltip'),
          node: <RichTextImageGif />,
        },
        {
          key: 'attachment',
          name: 'attachment',
          label: t('editor.attachment.tooltip'),
          node: <RichTextAttachment />,
        },
        {
          key: 'iframe',
          name: 'iframe',
          label: t('editor.iframe.tooltip'),
          node: <RichTextIframe />,
        },
        { key: 'katex', name: 'katex', label: t('editor.katex.tooltip'), node: <RichTextKatex /> },
        {
          key: 'mermaid',
          name: 'mermaid',
          label: t('editor.mermaid.tooltip'),
          node: <RichTextMermaid />,
        },
        {
          key: 'excalidraw',
          name: 'excalidraw',
          label: 'Excalidraw',
          node: <RichTextExcalidraw />,
        },
        { key: 'drawer', name: 'richTextDrawer', label: 'Drawer', node: <RichTextDrawer /> },
        {
          key: 'twitter',
          name: 'twitter',
          label: t('editor.twitter.tooltip'),
          node: <RichTextTwitter />,
        },
      ],
    },
    {
      label: t('editor.importExport'),
      entries: [
        {
          key: 'importWord',
          name: 'importWord',
          label: t('editor.importWord.tooltip'),
          node: <RichTextImportWord />,
        },
        {
          key: 'exportPdf',
          name: 'exportPdf',
          label: t('editor.exportPdf.tooltip'),
          node: <RichTextExportPdf />,
        },
        {
          key: 'exportWord',
          name: 'exportWord',
          label: t('editor.exportWord.tooltip'),
          node: <RichTextExportWord />,
        },
        {
          key: 'exportMarkdown',
          name: 'exportMarkdown',
          label: t('editor.exportMarkdown.tooltip'),
          node: <RichTextExportMarkdown />,
        },
      ],
    },
    {
      label: t('editor.settings'),
      entries: [
        {
          key: 'searchAndReplace',
          name: 'searchAndReplace',
          label: t('editor.searchAndReplace.tooltip'),
          node: <RichTextSearchAndReplace />,
        },
        {
          key: 'textDirection',
          name: 'richTextTextDirection',
          label: t('editor.textDirection.tooltip'),
          node: <RichTextTextDirection />,
        },
        {
          key: 'codeView',
          name: 'codeView',
          label: t('editor.codeView.tooltip'),
          node: <RichTextCodeView />,
        },
      ],
    },
  ];

  // The main row, by group. Each group collapses as a whole; `null` never does.
  // Pinned controls leave their group for the pins segment.
  const row: RowGroup[] = [
    {
      id: 'ai',
      priority: null,
      entries: [{ key: 'ai', name: 'ai', label: t('editor.ai.title'), node: <RichTextAI /> }],
    },
    {
      id: 'history',
      priority: 5,
      entries: [
        { key: 'undo', name: 'undoRedo', label: t('editor.undo.tooltip'), node: <RichTextUndo /> },
        { key: 'redo', name: 'undoRedo', label: t('editor.redo.tooltip'), node: <RichTextRedo /> },
      ],
    },
    {
      id: 'paragraph',
      priority: null,
      segment: 'text',
      entries: [
        {
          key: 'heading',
          name: 'heading',
          label: t('editor.heading.tooltip'),
          node: <RichTextHeading />,
        },
      ],
    },
    {
      id: 'font',
      priority: 3,
      segment: 'text',
      entries: [
        {
          key: 'fontFamily',
          name: 'fontFamily',
          label: t('editor.fontFamily.tooltip'),
          node: <RichTextFontFamily />,
        },
      ],
    },
    {
      id: 'marks',
      priority: null,
      segment: 'marks',
      entries: [
        { key: 'bold', name: 'bold', label: t('editor.bold.tooltip'), node: <RichTextBold /> },
        {
          key: 'italic',
          name: 'italic',
          label: t('editor.italic.tooltip'),
          node: <RichTextItalic />,
        },
        {
          key: 'underline',
          name: 'underline',
          label: t('editor.underline.tooltip'),
          node: <RichTextUnderline />,
        },
        {
          key: 'strike',
          name: 'strike',
          label: t('editor.strike.tooltip'),
          node: <RichTextStrike />,
        },
      ],
    },
    {
      id: 'colors',
      priority: 1,
      segment: 'marks',
      entries: [
        { key: 'color', name: 'color', label: t('editor.color.tooltip'), node: <RichTextColor /> },
        {
          key: 'highlight',
          name: 'highlight',
          label: t('editor.highlight.tooltip'),
          node: <RichTextHighlight />,
        },
        { key: 'clear', name: 'clear', label: t('editor.clear.tooltip'), node: <RichTextClear /> },
      ],
    },
    {
      id: 'lists',
      priority: null,
      segment: 'lists',
      entries: [
        {
          key: 'bulletList',
          name: 'bulletList',
          label: t('editor.bulletlist.tooltip'),
          node: <RichTextBulletList />,
        },
        {
          key: 'orderedList',
          name: 'orderedList',
          label: t('editor.orderedlist.tooltip'),
          node: <RichTextOrderedList />,
        },
        {
          key: 'taskList',
          name: 'taskList',
          label: t('editor.tasklist.tooltip'),
          node: <RichTextTaskList />,
        },
        {
          key: 'blockquote',
          name: 'blockquote',
          label: t('editor.blockquote.tooltip'),
          node: <RichTextBlockquote />,
        },
      ],
    },
    {
      id: 'align',
      priority: 2,
      segment: 'lists',
      entries: [
        {
          key: 'textAlign',
          name: 'textAlign',
          label: t('editor.textalign.tooltip'),
          node: <RichTextAlign />,
        },
      ],
    },
    {
      id: 'insert',
      priority: 4,
      entries: [
        { key: 'link', name: 'link', label: t('editor.link.tooltip'), node: <RichTextLink /> },
        { key: 'image', name: 'image', label: t('editor.image.tooltip'), node: <RichTextImage /> },
        { key: 'table', name: 'table', label: t('editor.table.tooltip'), node: <RichTextTable /> },
        {
          key: 'codeBlock',
          name: 'codeBlock',
          label: t('editor.codeblock.tooltip'),
          node: <RichTextCodeBlock />,
        },
      ],
    },
  ];

  const available = [
    ...groups.flatMap((group) => group.entries),
    ...row.flatMap((g) => g.entries),
  ].filter((entry) => on(entry.name));
  const pinned = pins
    .map((key) => available.find((entry) => entry.key === key))
    .filter((entry): entry is PanelEntry => !!entry);
  const panelGroups = groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => on(entry.name) && !pins.includes(entry.key)),
    }))
    .filter((group) => group.entries.length);

  // Everything on the row, in order: the groups, the pins, then `children`.
  const rowGroups: RowGroup[] = [
    ...row
      .map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => on(entry.name) && !pins.includes(entry.key)),
      }))
      .filter((group) => group.entries.length),
    ...pinned.map(
      (entry): RowGroup => ({
        id: `pin:${entry.key}`,
        priority: 0,
        segment: 'pins',
        pin: true,
        entries: [entry],
      })
    ),
    ...(children
      ? [
          {
            id: 'children',
            priority: null,
            entries: [{ key: 'children', name: '', label: '', node: children }],
          } satisfies RowGroup,
        ]
      : []),
  ];

  const { root, collapsed } = useToolbarOverflow(
    collapse,
    rowGroups.map(({ id, priority, segment }) => ({ id, priority, segment })),
    lang
  );
  const collapsedGroups = collapsed
    .map((id) => rowGroups.find((group) => group.id === id))
    .filter((group): group is RowGroup => !!group);
  const inlineGroups = rowGroups.filter((group) => !collapsed.includes(group.id));
  const inlinePinned = pinned.filter((entry) => !collapsed.includes(`pin:${entry.key}`));
  // In collapse mode the trigger is the way back to the collapsed groups, so it always shows.
  const showMore = collapse || (more && (panelGroups.length > 0 || pinned.length > 0));

  const dragKey = (event: React.DragEvent) =>
    event.dataTransfer.types.includes(DRAG_TYPE) ? event.dataTransfer.getData(DRAG_TYPE) : '';
  const startDrag = (key: string) => (event: React.DragEvent) => {
    event.dataTransfer.setData(DRAG_TYPE, key);
    event.dataTransfer.effectAllowed = 'move';
  };
  const accept = (target: 'toolbar' | 'panel') => (event: React.DragEvent) => {
    if (!pinnable || !event.dataTransfer.types.includes(DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dropTarget !== target) setDropTarget(target);
  };
  const dropOnToolbar = (event: React.DragEvent) => {
    const key = dragKey(event);
    setDropTarget(null);
    if (!key || !pinnable) return;
    event.preventDefault();
    updatePins((current) => (current.includes(key) ? current : [...current, key]));
  };
  const dropOnPanel = (event: React.DragEvent) => {
    const key = dragKey(event);
    setDropTarget(null);
    if (!key || !pinnable) return;
    event.preventDefault();
    event.stopPropagation();
    updatePins((current) => current.filter((item) => item !== key));
  };

  const unpin = (key: string) => updatePins((current) => current.filter((item) => item !== key));

  /** A row of the panel: draggable onto the toolbar when pinning is on. */
  const panelRow = (entry: PanelEntry) => (
    <div
      className='richtext-kit-toolbar__row'
      draggable={pinnable}
      key={entry.key}
      onDragStart={startDrag(entry.key)}
    >
      <RichTextToolbarMoreRow label={entry.label} wide={entry.wide}>
        {entry.node}
      </RichTextToolbarMoreRow>
    </div>
  );

  /** A pinned control listed in the panel, with a one-click way off the toolbar. */
  const pinnedRow = (entry: PanelEntry) => (
    <div className='richtext-kit-toolbar__pinned-row' key={entry.key}>
      <RichTextToolbarMoreRow label={entry.label}>{entry.node}</RichTextToolbarMoreRow>
      <button
        aria-label={t('editor.more.unpin')}
        className='richtext-kit-toolbar__unpin-row'
        onClick={() => unpin(entry.key)}
        title={t('editor.more.unpin')}
        type='button'
      >
        <PinOff size={14} />
      </button>
    </div>
  );

  /** A group of the main row, wrapped so its width can be measured. */
  const rowGroup = (group: RowGroup) => {
    const attrs = { [TOOLBAR_GROUP_ATTR]: group.id };
    if (group.pin) {
      // A control the user dragged out of the panel. Drag it back to unpin it.
      const [entry] = group.entries;
      return (
        <span
          className='richtext-kit-toolbar__pinned'
          draggable={pinnable}
          key={group.id}
          onDragStart={startDrag(entry.key)}
          title={entry.label}
          {...attrs}
        >
          {entry.node}
          <button
            aria-label={t('editor.more.unpin')}
            className='richtext-kit-toolbar__unpin'
            onClick={() => unpin(entry.key)}
            title={t('editor.more.unpin')}
            type='button'
          >
            ×
          </button>
        </span>
      );
    }
    return (
      <span className='richtext-kit-toolbar__group' key={group.id} {...attrs}>
        {group.entries.map((entry) => (
          <Fragment key={entry.key}>{entry.node}</Fragment>
        ))}
      </span>
    );
  };

  // Divider slots: consecutive groups of one segment share a slot.
  const segments: ReactNode[][] = [];
  inlineGroups.forEach((group, index) => {
    const previous = inlineGroups[index - 1];
    if (!previous || segmentOf(previous) !== segmentOf(group)) segments.push([]);
    segments[segments.length - 1].push(rowGroup(group));
  });

  return (
    <RichTextToolbar
      className={cn(
        'richtext-kit-toolbar',
        collapse && 'richtext-kit-toolbar--collapse',
        className,
        dropTarget === 'toolbar' && 'richtext-kit-toolbar--drop'
      )}
      data-collapsed={collapse ? collapsed.join(' ') : undefined}
      data-overflow={overflow}
      data-pinnable={pinnable || undefined}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
      }}
      onDragOver={accept('toolbar')}
      onDrop={dropOnToolbar}
      ref={root}
    >
      {withDividers(segments)}
      {showMore ? (
        <div
          className={cn(
            'richtext-kit-toolbar-more',
            dropTarget === 'panel' && 'richtext-kit-toolbar-more--drop'
          )}
          onDragOver={accept('panel')}
          onDrop={dropOnPanel}
        >
          <RichTextToolbarMore label={t('editor.more')} width={620}>
            {collapsedGroups.length ? (
              // What the row could not hold, until it is wide enough again.
              <RichTextToolbarMoreGroup columns={3} label={t('editor.more.overflowGroup')}>
                {collapsedGroups.flatMap((group) =>
                  group.entries.map((entry) => (group.pin ? pinnedRow(entry) : panelRow(entry)))
                )}
              </RichTextToolbarMoreGroup>
            ) : null}
            {panelGroups.map((group) => (
              <RichTextToolbarMoreGroup columns={3} key={group.label} label={group.label}>
                {group.entries.map(panelRow)}
              </RichTextToolbarMoreGroup>
            ))}
            {pinnable && inlinePinned.length ? (
              // What is on the toolbar already, each with a one-click way back.
              <RichTextToolbarMoreGroup columns={3} label={t('editor.more.pinned')}>
                {inlinePinned.map(pinnedRow)}
              </RichTextToolbarMoreGroup>
            ) : null}
            {pinnable ? (
              <span className='richtext-kit-toolbar__hint'>{t('editor.more.pinHint')}</span>
            ) : null}
          </RichTextToolbarMore>
        </div>
      ) : null}
    </RichTextToolbar>
  );
}

export interface RichTextKitMenusProps {
  /** The AI composer dock under the editor: `false` hides it, an object passes its props. Default true. */
  composer?: boolean | RichTextAIComposerProps;
  /** The block drag handle. Default true. */
  dragHandle?: boolean;
  /** Extra slash-menu entries, listed first under "Insert". Keep the array stable (memoize it). */
  slashCommands?: Command[];
}

/**
 * Every floating piece of UI the registered extensions can use: the AI
 * composer dock, the text bubble with the Improve menu, the table, link,
 * media and block bubbles, the drag handle and the slash menu. Place it
 * after `EditorContent` inside `RichTextProvider`.
 */
export function RichTextKitMenus({
  composer = true,
  dragHandle = true,
  slashCommands,
}: RichTextKitMenusProps) {
  const editor = useEditorInstance();
  const has = useMemo(() => extensionNames(editor), [editor]);
  const on = (name: string) => has.has(name);

  return (
    <>
      {on('ai') && composer !== false ? (
        <RichTextAIComposer {...(typeof composer === 'object' ? composer : {})} />
      ) : null}
      <RichTextBubbleText />
      {on('table') ? <RichTextBubbleTable /> : null}
      {on('link') ? <RichTextBubbleLink /> : null}
      {on('image') ? <RichTextBubbleImage /> : null}
      {on('video') ? <RichTextBubbleVideo /> : null}
      {on('imageGif') ? <RichTextBubbleImageGif /> : null}
      {on('callout') ? <RichTextBubbleCallout /> : null}
      {on('notice') ? <RichTextBubbleNotice /> : null}
      {on('iframe') ? <RichTextBubbleIframe /> : null}
      {on('katex') ? <RichTextBubbleKatex /> : null}
      {on('mermaid') ? <RichTextBubbleMermaid /> : null}
      {on('excalidraw') ? <RichTextBubbleExcalidraw /> : null}
      {on('richTextDrawer') ? <RichTextBubbleDrawer /> : null}
      {on('twitter') ? <RichTextBubbleTwitter /> : null}
      {dragHandle ? <RichTextBubbleMenuDragHandle /> : null}
      {on('richtextSlashCommand') ? <SlashCommandList extraCommands={slashCommands} /> : null}
    </>
  );
}
