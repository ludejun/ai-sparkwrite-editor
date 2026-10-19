/* oxlint-disable react-hooks/rules-of-hooks -- Vue composables, not React hooks */
import { Extension } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { HardBreak } from '@tiptap/extension-hard-break';
import { ListItem } from '@tiptap/extension-list';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { Dropcursor, Gapcursor, Placeholder } from '@tiptap/extensions';
import { PinOff } from 'lucide-vue-next';
import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  watch,
  type PropType,
  type VNode,
} from 'vue';

import {
  Blockquote,
  Bold,
  BulletList,
  Clear,
  Code,
  CodeView,
  Color,
  Column,
  ColumnNode,
  Details,
  ExportMarkdown,
  ExportPdf,
  ExportWord,
  FontFamily,
  FontSize,
  Heading,
  Highlight,
  History,
  ImportWord,
  Indent,
  Italic,
  LineHeight,
  Link,
  MarkdownPaste,
  MoreMark,
  MultipleColumnNode,
  OrderedList,
  Recorder,
  RichPaste,
  SearchAndReplace,
  Strike,
  Table,
  TaskList,
  TextAlign,
  TextDirection,
  TextUnderline,
  Video,
  Notice,
} from '@/core';
import { Collaboration, CollaborationCaret } from '@/extensions/Collaboration/Collaboration';
import { buildKit, extensionNames, type KitOptions, type KitRegistry } from '@/kit/shared';
import {
  measureToolbar,
  planToolbar,
  segmentOf,
  TOOLBAR_DIVIDER_CLASS,
  TOOLBAR_GROUP_ATTR,
  type ToolbarGroupSpec,
} from '@/kit/toolbarLayout';

import { AI, AIAutocomplete, RichTextAI, RichTextAIComposer } from './ai';
import {
  RichTextBubbleImage,
  RichTextBubbleLink,
  RichTextBubbleNotice,
  RichTextBubbleTable,
  RichTextBubbleText,
} from './bubble';
import { useEditorInstance, useLocale } from './context';
import {
  RichTextAttachment,
  RichTextBlockquote,
  RichTextBold,
  RichTextBulletList,
  RichTextCallout,
  RichTextNotice,
  RichTextClear,
  RichTextCode,
  RichTextCodeBlock,
  RichTextColor,
  RichTextDetails,
  RichTextDivider,
  RichTextFontSize,
  RichTextHeading,
  RichTextHighlight,
  RichTextIframe,
  RichTextImage,
  RichTextIndent,
  RichTextItalic,
  RichTextKatex,
  RichTextLineHeight,
  RichTextLink,
  RichTextMermaid,
  RichTextOrderedList,
  RichTextOutdent,
  RichTextRedo,
  RichTextStrike,
  RichTextTable,
  RichTextTableOfContents,
  RichTextTaskList,
  RichTextTextAlign,
  RichTextUnderline,
  RichTextUndo,
  RichTextVideo,
} from './controls';
import { Divider } from './Divider';
import {
  Attachment,
  Callout,
  CodeBlock,
  Iframe,
  Image,
  ImageGif,
  Katex,
  Mermaid,
  TableOfContents,
} from './nodeviews';
import {
  RichTextToolbar,
  RichTextToolbarDivider,
  RichTextToolbarMore,
  RichTextToolbarMoreGroup,
  RichTextToolbarMoreRow,
} from './ui';

/** Columns are block-level siblings, so the document has to allow them. */
const DocumentWithColumns = /* @__PURE__ */ Document.extend({ content: '(block|columns)+' });

/**
 * Every feature the Vue kit knows, keyed by its option name. Blocks with a
 * node view use the Vue variants; React-only features (Excalidraw, Drawer,
 * Emoji, Mention, Twitter, the slash menu) are not part of it.
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
  link: { extension: Link },
  heading: { extension: Heading },
  bulletList: { extension: BulletList, with: [ListItem] },
  orderedList: { extension: OrderedList, with: [ListItem] },
  taskList: { extension: TaskList },
  blockquote: { extension: Blockquote },
  notice: { extension: Notice },
  table: { extension: Table },
  divider: { extension: Divider },
  details: { extension: Details },
  codeBlock: { extension: CodeBlock },
  callout: { extension: Callout },
  column: { extension: Column, with: [ColumnNode, MultipleColumnNode], optIn: true },
  tableOfContents: { extension: TableOfContents },
  image: { extension: Image },
  video: { extension: Video },
  iframe: { extension: Iframe },
  attachment: { extension: Attachment },
  katex: { extension: Katex },
  mermaid: { extension: Mermaid },
  imageGif: { extension: ImageGif, optIn: true },
  searchAndReplace: { extension: SearchAndReplace },
  richPaste: { extension: RichPaste },
  markdownPaste: { extension: MarkdownPaste },
  recorder: { extension: Recorder, optIn: true },
  exportMarkdown: { extension: ExportMarkdown },
  exportWord: { extension: ExportWord },
  importWord: { extension: ImportWord },
  exportPdf: { extension: ExportPdf },
  codeView: { extension: CodeView },
  ai: { extension: AI },
  aiAutocomplete: { extension: AIAutocomplete },
  // Real-time co-editing over a Y.Doc: opt-in; when on, `history` is left out (Yjs has its own undo).
  collaboration: { extension: Collaboration, optIn: true },
  collaborationCaret: { extension: CollaborationCaret, optIn: true },
} satisfies KitRegistry;

export type RichTextKitOptions = KitOptions<typeof REGISTRY>;

/**
 * The whole editor as one extension for Vue, like Tiptap's StarterKit: every
 * feature above with its Vue node views. `false` leaves a feature out, an
 * object configures it (`ai: { endpoint: '/api/ai' }`), and an object for an
 * opt-in feature switches it on (`imageGif: { GIPHY_API_KEY }`).
 */
export const RichTextKit = Extension.create<RichTextKitOptions>({
  name: 'richTextKit',

  addOptions() {
    return {};
  },

  addExtensions() {
    const registry = { ...REGISTRY } as typeof REGISTRY;
    if (this.options.column && this.options.column !== undefined) {
      registry.document = { extension: DocumentWithColumns } as typeof REGISTRY.document;
    }
    return buildKit(registry, this.options);
  },
});

type Maybe = VNode | null | false;

function withDividers(groups: Maybe[][]): VNode[] {
  const out: VNode[] = [];
  groups
    .map((group) => group.filter((node): node is VNode => !!node))
    .filter((group) => group.length)
    .forEach((group, index) => {
      if (index)
        out.push(
          h(RichTextToolbarDivider, { key: `divider-${index}`, class: TOOLBAR_DIVIDER_CLASS })
        );
      out.push(...group);
    });
  return out;
}

const DRAG_TYPE = 'application/x-richtext-kit-control';
const DEFAULT_PINS_KEY = 'ai-sparkwrite-editor:kit-toolbar-pins';

function readPins(key: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string') : [];
  } catch {
    return null;
  }
}

function writePins(key: string, pins: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(pins));
  } catch {
    // Storage may be unavailable; pins then last for the session.
  }
}

interface PanelEntry {
  key: string;
  name: string;
  label: string;
  control: Parameters<typeof h>[0];
}

/** A group of the main row: its collapse priority and the controls in it. */
interface RowGroup extends ToolbarGroupSpec {
  entries: PanelEntry[];
  /** A control the user pinned from the panel. */
  pin?: boolean;
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

/**
 * A complete Vue toolbar for `RichTextKit` (or any editor). Each control
 * appears only when its extension is registered. Rows of the "More tools"
 * panel can be dragged onto the toolbar to pin them there (and back to
 * unpin); the choice is remembered in localStorage. The default slot adds
 * controls before the panel. With `overflow="collapse"` the row never wraps:
 * groups it cannot hold move into the panel, least used first.
 */
export const RichTextKitToolbar = defineComponent({
  name: 'RichTextKitToolbar',
  props: {
    /** The "More tools" panel with the less frequent controls. Default true. */
    more: { type: Boolean, default: true },
    /** Let users drag panel rows onto the toolbar to keep them there. Default true. */
    pinnable: { type: Boolean, default: true },
    /** localStorage key for the pinned controls. */
    storageKey: { type: String, default: DEFAULT_PINS_KEY },
    /** Controls pinned before the user changes anything, by panel key. */
    defaultPins: { type: Array as PropType<string[]>, default: () => [] },
    /**
     * `wrap` (default) breaks a narrow row into further lines; `collapse`
     * keeps one line and moves whole groups into a "More tools" section at
     * the top of the panel (pins, colours, alignment, insert, undo/redo).
     * The toolbar reports the collapsed groups in `data-collapsed`.
     */
    overflow: { type: String as PropType<'wrap' | 'collapse'>, default: 'wrap' },
  },
  setup(props, { slots }) {
    const editor = useEditorInstance();
    const { t, lang } = useLocale();
    const names = computed(() => extensionNames(editor.value));
    const pins = ref<string[]>(readPins(props.storageKey) ?? props.defaultPins);
    const dropTarget = ref<'toolbar' | 'panel' | null>(null);
    const setPins = (next: string[]) => {
      pins.value = next;
      writePins(props.storageKey, next);
    };
    const dragKey = (event: DragEvent) =>
      event.dataTransfer?.types.includes(DRAG_TYPE) ? event.dataTransfer.getData(DRAG_TYPE) : '';
    const startDrag = (key: string) => (event: DragEvent) => {
      event.dataTransfer?.setData(DRAG_TYPE, key);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    };
    const accept = (target: 'toolbar' | 'panel') => (event: DragEvent) => {
      if (!props.pinnable || !event.dataTransfer?.types.includes(DRAG_TYPE)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      dropTarget.value = target;
    };

    // Overflow (`collapse`): the natural width of every group seen so far — a
    // collapsed group is not in the DOM to measure — and the current plan.
    const toolbar = ref<{ $el: HTMLElement } | null>(null);
    const collapsed = ref<string[]>([]);
    let widths: Record<string, number> = {};
    let specs: ToolbarGroupSpec[] = [];
    let measuredLang = lang();
    let observer: ResizeObserver | null = null;

    const relayout = () => {
      const root = toolbar.value?.$el;
      if (!root || props.overflow !== 'collapse') return;
      const metrics = measureToolbar(root);
      Object.assign(widths, metrics.widths);
      const plan = planToolbar({ ...metrics, groups: specs, widths });
      if (!sameList(collapsed.value, plan.collapsed)) collapsed.value = plan.collapsed;
      if (!observer) return;
      // Width changes of the row and of the groups on it (fonts loading, a dropdown's label).
      observer.disconnect();
      observer.observe(root);
      root
        .querySelectorAll(`:scope > [${TOOLBAR_GROUP_ATTR}]`)
        .forEach((group) => observer?.observe(group));
    };

    onMounted(() => {
      if (typeof ResizeObserver !== 'undefined') observer = new ResizeObserver(relayout);
      relayout();
    });
    onUpdated(relayout);
    onBeforeUnmount(() => observer?.disconnect());
    watch(
      () => props.overflow,
      (mode) => {
        if (mode !== 'collapse') {
          observer?.disconnect();
          collapsed.value = [];
        }
      }
    );

    return () => {
      const on = (name: string) => names.value.has(name);
      const collapse = props.overflow === 'collapse';
      // Read unconditionally, so the plan `relayout` sets always re-renders.
      const planned = collapsed.value;
      if (lang() !== measuredLang) {
        // Labels changed: every width is suspect, measure again.
        measuredLang = lang();
        widths = {};
      }
      const groups: { label: string; entries: PanelEntry[] }[] = [
        {
          label: t('editor.slash.format'),
          entries: [
            {
              key: 'fontSize',
              name: 'fontSize',
              label: t('editor.fontSize.tooltip'),
              control: RichTextFontSize,
            },
            {
              key: 'lineHeight',
              name: 'lineHeight',
              label: t('editor.lineheight.tooltip'),
              control: RichTextLineHeight,
            },
            {
              key: 'indent',
              name: 'richtextIndentOutdent',
              label: t('editor.indent.indent'),
              control: RichTextIndent,
            },
            {
              key: 'outdent',
              name: 'richtextIndentOutdent',
              label: t('editor.indent.outdent'),
              control: RichTextOutdent,
            },
          ],
        },
        {
          label: t('editor.slash.insert'),
          entries: [
            {
              key: 'codeBlock',
              name: 'codeBlock',
              label: t('editor.codeblock.tooltip'),
              control: RichTextCodeBlock,
            },
            {
              key: 'callout',
              name: 'callout',
              label: t('editor.callout.tooltip'),
              control: RichTextCallout,
            },
            {
              key: 'notice',
              name: 'notice',
              label: t('editor.notice.tooltip'),
              control: RichTextNotice,
            },
            {
              key: 'details',
              name: 'details',
              label: t('editor.details.tooltip'),
              control: RichTextDetails,
            },
            {
              key: 'tableOfContents',
              name: 'tableOfContents',
              label: t('editor.tableofcontents.tooltip'),
              control: RichTextTableOfContents,
            },
            {
              key: 'video',
              name: 'video',
              label: t('editor.video.tooltip'),
              control: RichTextVideo,
            },
            {
              key: 'iframe',
              name: 'iframe',
              label: t('editor.iframe.tooltip'),
              control: RichTextIframe,
            },
            {
              key: 'attachment',
              name: 'attachment',
              label: t('editor.attachment.tooltip'),
              control: RichTextAttachment,
            },
            {
              key: 'katex',
              name: 'katex',
              label: t('editor.katex.tooltip'),
              control: RichTextKatex,
            },
            {
              key: 'mermaid',
              name: 'mermaid',
              label: t('editor.mermaid.tooltip'),
              control: RichTextMermaid,
            },
          ],
        },
      ];
      // The main row, by group. Each group collapses as a whole; `null` never does.
      const row: RowGroup[] = [
        {
          id: 'ai',
          priority: null,
          entries: [{ key: 'ai', name: 'ai', label: t('editor.ai.title'), control: RichTextAI }],
        },
        {
          id: 'history',
          priority: 5,
          entries: [
            {
              key: 'undo',
              name: 'undoRedo',
              label: t('editor.undo.tooltip'),
              control: RichTextUndo,
            },
            {
              key: 'redo',
              name: 'undoRedo',
              label: t('editor.redo.tooltip'),
              control: RichTextRedo,
            },
          ],
        },
        {
          id: 'paragraph',
          priority: null,
          entries: [
            {
              key: 'heading',
              name: 'heading',
              label: t('editor.heading.tooltip'),
              control: RichTextHeading,
            },
          ],
        },
        {
          id: 'marks',
          priority: null,
          segment: 'marks',
          entries: [
            { key: 'bold', name: 'bold', label: t('editor.bold.tooltip'), control: RichTextBold },
            {
              key: 'italic',
              name: 'italic',
              label: t('editor.italic.tooltip'),
              control: RichTextItalic,
            },
            {
              key: 'underline',
              name: 'underline',
              label: t('editor.underline.tooltip'),
              control: RichTextUnderline,
            },
            {
              key: 'strike',
              name: 'strike',
              label: t('editor.strike.tooltip'),
              control: RichTextStrike,
            },
            { key: 'code', name: 'code', label: t('editor.code.tooltip'), control: RichTextCode },
          ],
        },
        {
          id: 'colors',
          priority: 1,
          segment: 'marks',
          entries: [
            {
              key: 'color',
              name: 'color',
              label: t('editor.color.tooltip'),
              control: RichTextColor,
            },
            {
              key: 'highlight',
              name: 'highlight',
              label: t('editor.highlight.tooltip'),
              control: RichTextHighlight,
            },
            {
              key: 'clear',
              name: 'clear',
              label: t('editor.clear.tooltip'),
              control: RichTextClear,
            },
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
              control: RichTextBulletList,
            },
            {
              key: 'orderedList',
              name: 'orderedList',
              label: t('editor.orderedlist.tooltip'),
              control: RichTextOrderedList,
            },
            {
              key: 'taskList',
              name: 'taskList',
              label: t('editor.tasklist.tooltip'),
              control: RichTextTaskList,
            },
            {
              key: 'blockquote',
              name: 'blockquote',
              label: t('editor.blockquote.tooltip'),
              control: RichTextBlockquote,
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
              control: RichTextTextAlign,
            },
          ],
        },
        {
          id: 'insert',
          priority: 4,
          entries: [
            { key: 'link', name: 'link', label: t('editor.link.tooltip'), control: RichTextLink },
            {
              key: 'image',
              name: 'image',
              label: t('editor.image.tooltip'),
              control: RichTextImage,
            },
            {
              key: 'table',
              name: 'table',
              label: t('editor.table.tooltip'),
              control: RichTextTable,
            },
            {
              key: 'divider',
              name: 'divider',
              label: t('editor.divider.tooltip'),
              control: RichTextDivider,
            },
          ],
        },
      ];

      const available = [
        ...groups.flatMap((group) => group.entries),
        ...row.flatMap((group) => group.entries),
      ].filter((entry) => on(entry.name));
      const pinned = pins.value
        .map((key) => available.find((entry) => entry.key === key))
        .filter((entry): entry is PanelEntry => !!entry);
      const panelGroups = groups
        .map((group) => ({
          ...group,
          entries: group.entries.filter(
            (entry) => on(entry.name) && !pins.value.includes(entry.key)
          ),
        }))
        .filter((group) => group.entries.length);
      const slot = (slots.default?.() ?? []) as VNode[];

      // Everything on the row, in order: the groups, the pins, then the slot.
      const rowGroups: RowGroup[] = [
        ...row
          .map((group) => ({
            ...group,
            entries: group.entries.filter(
              (entry) => on(entry.name) && !pins.value.includes(entry.key)
            ),
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
        ...(slot.length
          ? [{ id: 'children', priority: null, entries: [] } satisfies RowGroup]
          : []),
      ];
      specs = rowGroups.map(({ id, priority, segment }) => ({ id, priority, segment }));
      // A group without a known width forces a render with everything inline;
      // `onUpdated` then measures it and applies the plan before paint.
      const measuring = collapse && specs.some((group) => widths[group.id] === undefined);
      const hidden = collapse && !measuring ? planned : [];
      const collapsedGroups = hidden
        .map((id) => rowGroups.find((group) => group.id === id))
        .filter((group): group is RowGroup => !!group);
      const inlineGroups = rowGroups.filter((group) => !hidden.includes(group.id));
      const inlinePinned = pinned.filter((entry) => !hidden.includes(`pin:${entry.key}`));
      // In collapse mode the trigger is the way back to the collapsed groups, so it always shows.
      const showMore = collapse || (props.more && (panelGroups.length > 0 || pinned.length > 0));
      const unpin = (key: string) => setPins(pins.value.filter((item) => item !== key));

      const panelRow = (entry: PanelEntry) =>
        h(
          'div',
          {
            key: entry.key,
            class: 'richtext-kit-toolbar__row',
            draggable: props.pinnable,
            onDragstart: startDrag(entry.key),
          },
          [h(RichTextToolbarMoreRow, { label: entry.label }, () => h(entry.control))]
        );
      const pinnedRow = (entry: PanelEntry) =>
        h('div', { key: entry.key, class: 'richtext-kit-toolbar__pinned-row' }, [
          h(RichTextToolbarMoreRow, { label: entry.label }, () => h(entry.control)),
          h(
            'button',
            {
              type: 'button',
              class: 'richtext-kit-toolbar__unpin-row',
              'aria-label': t('editor.more.unpin'),
              title: t('editor.more.unpin'),
              onClick: () => unpin(entry.key),
            },
            [h(PinOff, { size: 14, 'aria-hidden': 'true' })]
          ),
        ]);
      /** A group of the main row, wrapped so its width can be measured. */
      const rowGroup = (group: RowGroup): VNode => {
        const attrs = { key: group.id, [TOOLBAR_GROUP_ATTR]: group.id };
        if (group.id === 'children')
          return h('span', { ...attrs, class: 'richtext-kit-toolbar__group' }, slot);
        if (group.pin) {
          // A control the user dragged out of the panel. Drag it back to unpin it.
          const [entry] = group.entries;
          return h(
            'span',
            {
              ...attrs,
              class: 'richtext-kit-toolbar__pinned',
              draggable: props.pinnable,
              title: entry.label,
              onDragstart: startDrag(entry.key),
            },
            [
              h(entry.control),
              h(
                'button',
                {
                  type: 'button',
                  class: 'richtext-kit-toolbar__unpin',
                  'aria-label': t('editor.more.unpin'),
                  title: t('editor.more.unpin'),
                  onClick: () => unpin(entry.key),
                },
                '×'
              ),
            ]
          );
        }
        return h(
          'span',
          { ...attrs, class: 'richtext-kit-toolbar__group' },
          group.entries.map((entry) => h(entry.control, { key: entry.key }))
        );
      };

      // Divider slots: consecutive groups of one segment share a slot.
      const segments: Maybe[][] = [];
      inlineGroups.forEach((group, index) => {
        const previous = inlineGroups[index - 1];
        if (!previous || segmentOf(previous) !== segmentOf(group)) segments.push([]);
        segments[segments.length - 1].push(rowGroup(group));
      });

      return h(
        RichTextToolbar,
        {
          ref: toolbar,
          class: [
            'richtext-kit-toolbar',
            collapse ? 'richtext-kit-toolbar--collapse' : null,
            dropTarget.value === 'toolbar' ? 'richtext-kit-toolbar--drop' : null,
          ],
          'data-overflow': props.overflow,
          'data-collapsed': collapse ? hidden.join(' ') : undefined,
          'data-pinnable': props.pinnable || undefined,
          onDragover: accept('toolbar'),
          onDragleave: (event: DragEvent) => {
            const root = event.currentTarget as HTMLElement;
            if (!root.contains(event.relatedTarget as Node | null)) dropTarget.value = null;
          },
          onDrop: (event: DragEvent) => {
            const key = dragKey(event);
            dropTarget.value = null;
            if (!key || !props.pinnable) return;
            event.preventDefault();
            if (!pins.value.includes(key)) setPins([...pins.value, key]);
          },
        },
        () => [
          ...withDividers(segments),
          showMore
            ? h(
                'div',
                {
                  class: [
                    'richtext-kit-toolbar-more',
                    dropTarget.value === 'panel' ? 'richtext-kit-toolbar-more--drop' : null,
                  ],
                  onDragover: accept('panel'),
                  onDrop: (event: DragEvent) => {
                    const key = dragKey(event);
                    dropTarget.value = null;
                    if (!key || !props.pinnable) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setPins(pins.value.filter((item) => item !== key));
                  },
                },
                [
                  h(RichTextToolbarMore, { label: t('editor.more'), width: '620px' }, () => [
                    collapsedGroups.length
                      ? // What the row could not hold, until it is wide enough again.
                        h(
                          RichTextToolbarMoreGroup,
                          { key: 'overflow', label: t('editor.more.overflowGroup'), columns: 3 },
                          () =>
                            collapsedGroups.flatMap((group) =>
                              group.entries.map((entry) =>
                                group.pin ? pinnedRow(entry) : panelRow(entry)
                              )
                            )
                        )
                      : null,
                    ...panelGroups.map((group) =>
                      h(
                        RichTextToolbarMoreGroup,
                        { key: group.label, label: group.label, columns: 3 },
                        () => group.entries.map(panelRow)
                      )
                    ),
                    props.pinnable && inlinePinned.length
                      ? // What is on the toolbar already, each with a one-click way back.
                        h(
                          RichTextToolbarMoreGroup,
                          { key: 'pinned', label: t('editor.more.pinned'), columns: 3 },
                          () => inlinePinned.map(pinnedRow)
                        )
                      : null,
                    props.pinnable
                      ? h('span', { class: 'richtext-kit-toolbar__hint' }, t('editor.more.pinHint'))
                      : null,
                  ]),
                ]
              )
            : null,
        ]
      );
    };
  },
});

/**
 * The floating UI for a Vue editor: the AI composer dock, the text bubble
 * with the Improve menu, and the table, link and image bubbles — each only
 * when its extension is registered. Place it after `EditorContent`.
 */
export const RichTextKitMenus = defineComponent({
  name: 'RichTextKitMenus',
  props: {
    /** The AI composer dock: `false` hides it, an object passes its props. Default true. */
    composer: {
      type: [Boolean, Object] as PropType<boolean | Record<string, unknown>>,
      default: true,
    },
  },
  setup(props) {
    const editor = useEditorInstance();
    const names = computed(() => extensionNames(editor.value));

    return () => {
      const on = (name: string) => names.value.has(name);
      return [
        on('ai') && props.composer !== false
          ? h(RichTextAIComposer, typeof props.composer === 'object' ? props.composer : {})
          : null,
        h(RichTextBubbleText),
        on('table') ? h(RichTextBubbleTable) : null,
        on('link') ? h(RichTextBubbleLink) : null,
        on('notice') ? h(RichTextBubbleNotice) : null,
        on('image') ? h(RichTextBubbleImage) : null,
      ];
    };
  },
});
