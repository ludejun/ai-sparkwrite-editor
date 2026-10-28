/* oxlint-disable react-hooks/rules-of-hooks -- Vue composables, not React hooks */
import {
  ALargeSmall,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeftToLine,
  ArrowRightToLine,
  Baseline,
  Bold,
  CircleCheck,
  Code,
  Eraser,
  Frame,
  Heading as HeadingIcon,
  Highlighter,
  Image as ImageIcon,
  Info,
  Italic,
  Link as LinkIcon,
  List,
  ListCollapse,
  ListOrdered,
  ListTodo,
  ListTree,
  Megaphone,
  Paperclip,
  Redo2,
  SeparatorHorizontal,
  Sigma,
  Sparkles,
  Square,
  SquareCode,
  Star,
  Strikethrough,
  Table as TableIcon,
  TextQuote,
  TriangleAlert,
  Underline,
  Undo2,
  UnfoldVertical,
  Unlink,
  Video as VideoIcon,
  Workflow,
} from 'lucide-vue-next';
import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
  type Component,
  type PropType,
} from 'vue';

import { COLORS_LIST, DEFAULT_FONT_SIZE_LIST, DEFAULT_LINE_HEIGHT_LIST } from '@/constants';
import { generateAIText, hasAITransport } from '@/extensions/AI/client';
import { aiOptionsOf } from '@/extensions/AI/writer';
import { DIVIDER_VARIANTS } from '@/extensions/Divider/Divider';
import { resolveEmbed } from '@/extensions/Iframe/embeds';
import { rememberUploadedImage } from '@/extensions/Image/imageLifecycle';
import { loadKatex } from '@/extensions/Katex/katex-loader';
import { applyLinkEdit } from '@/extensions/Link/Link';
import { NOTICE_TYPES, type NoticeType } from '@/extensions/Notice/Notice';
import { dataURLtoFile, extractFileExtension, extractFilename } from '@/utils/file';
import { safeJSONParse } from '@/utils/json';
import { ensureNameValueOptions } from '@/utils/utils';

import { useEditorInstance, useEditorState, useLocale } from './context';
import {
  RichTextDialog,
  RichTextDropdown,
  RichTextPopover,
  RichTextToolbarButton,
  type DropdownItem,
} from './ui';

import type { AIOptions } from '@/extensions/AI/types';
import type { DividerVariantOption } from '@/extensions/Divider/Divider';
import type { KatexLoader, KatexRenderer } from '@/extensions/Katex/katex-loader';
import type { NameValueOption } from '@/types';
import type { Editor } from '@tiptap/core';
import type { Mark } from '@tiptap/pm/model';

/**
 * Ready-made controls for the core extensions. Each one reads state from the
 * provided editor and runs the same command the React control runs, so the
 * two toolbars behave identically. Dialogs and popovers are the Vue
 * primitives from `./ui`; the commands they run come from the extensions, so
 * a control needs nothing but the extension registered.
 */

/** The options of a registered extension, or null when it is absent. */
function extensionOptions<T extends object>(editor: Editor, name: string): T | null {
  const extension = editor.extensionManager.extensions.find((item) => item.name === name);
  return (extension?.options as T | undefined) ?? null;
}

/** True when `name` is a command some registered extension provides. */
function hasCommand(editor: Editor, name: string): boolean {
  return typeof (editor.commands as unknown as Record<string, unknown>)[name] === 'function';
}

/** The AI extension's options when it is registered and can answer, else null. */
export function usableAIOptions(editor: Editor | null | undefined): AIOptions | null {
  const options = editor ? aiOptionsOf(editor) : null;
  return options && hasAITransport(options) ? options : null;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${Math.round(bytes / (1024 * 1024))} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/** `image/*`, `.webp` and exact MIME types, the way `<input accept>` reads them. */
function acceptsFile(file: File, accept?: string[]): boolean {
  if (!accept?.length) return true;
  const name = file.name.toLowerCase();
  return accept.some((rule) => {
    const pattern = rule.trim().toLowerCase();
    if (pattern.endsWith('/*')) return file.type.toLowerCase().startsWith(pattern.slice(0, -1));
    if (pattern.startsWith('.')) return name.endsWith(pattern);
    return file.type.toLowerCase() === pattern;
  });
}

interface UploadRules {
  acceptMimes?: string[];
  maxSize?: number;
  multiple?: boolean;
  upload?: (file: File) => Promise<string>;
  onError?: (error: { type: 'size' | 'type' | 'upload'; message: string; file?: File }) => void;
}

/**
 * Filters `files` by the extension's accept list and size limit, reporting
 * each rejection through `onError` when the host set one, else through
 * `report`. Returns the sources: the host's `upload` result, or a blob URL
 * when there is no uploader.
 */
async function uploadFiles(
  files: File[],
  rules: UploadRules,
  t: (key: string, params?: Record<string, string | number>) => string,
  report: (message: string) => void
): Promise<string[]> {
  const fail = (type: 'size' | 'type' | 'upload', message: string, file?: File) => {
    if (rules.onError) rules.onError({ type, message, file });
    else report(message);
  };
  const valid = files.filter((file) => {
    if (!acceptsFile(file, rules.acceptMimes)) {
      fail('type', t('editor.upload.fileTypeNotSupported', { fileName: file.name }), file);
      return false;
    }
    if (rules.maxSize && file.size > rules.maxSize) {
      fail(
        'size',
        t('editor.upload.fileSizeTooBig', {
          fileName: file.name,
          size: Math.round(rules.maxSize / (1024 * 1024)),
        }),
        file
      );
      return false;
    }
    return true;
  });
  const selected = rules.multiple ? valid : valid.slice(0, 1);
  try {
    return await Promise.all(
      selected.map((file) => (rules.upload ? rules.upload(file) : URL.createObjectURL(file)))
    );
  } catch (error) {
    console.error('Error uploading file', error);
    fail('upload', t('editor.upload.error'));
    return [];
  }
}

function control(
  name: string,
  options: {
    icon: Component;
    tooltip: string;
    isActive?: (editor: Editor) => boolean;
    canRun?: (editor: Editor) => boolean;
    run: (editor: Editor) => void;
  }
) {
  return defineComponent({
    name,
    setup() {
      const editor = useEditorInstance();
      const { t } = useLocale();
      const state = useEditorState(
        (current) => ({
          active: options.isActive?.(current) ?? false,
          enabled: current.isEditable && (options.canRun?.(current) ?? true),
        }),
        { active: false, enabled: false }
      );

      return () =>
        h(RichTextToolbarButton, {
          icon: options.icon,
          tooltip: t(options.tooltip),
          active: state.value.active,
          disabled: !state.value.enabled,
          onClick: () => editor.value && options.run(editor.value),
        });
    },
  });
}

export const RichTextUndo = control('RichTextUndo', {
  icon: Undo2,
  tooltip: 'editor.undo.tooltip',
  canRun: (e) => e.can().undo(),
  run: (e) => e.chain().focus().undo().run(),
});
export const RichTextRedo = control('RichTextRedo', {
  icon: Redo2,
  tooltip: 'editor.redo.tooltip',
  canRun: (e) => e.can().redo(),
  run: (e) => e.chain().focus().redo().run(),
});
export const RichTextBold = control('RichTextBold', {
  icon: Bold,
  tooltip: 'editor.bold.tooltip',
  isActive: (e) => e.isActive('bold'),
  run: (e) => e.chain().focus().toggleBold().run(),
});
export const RichTextItalic = control('RichTextItalic', {
  icon: Italic,
  tooltip: 'editor.italic.tooltip',
  isActive: (e) => e.isActive('italic'),
  run: (e) => e.chain().focus().toggleItalic().run(),
});
export const RichTextUnderline = control('RichTextUnderline', {
  icon: Underline,
  tooltip: 'editor.underline.tooltip',
  isActive: (e) => e.isActive('underline'),
  run: (e) => e.chain().focus().toggleUnderline().run(),
});
export const RichTextStrike = control('RichTextStrike', {
  icon: Strikethrough,
  tooltip: 'editor.strike.tooltip',
  isActive: (e) => e.isActive('strike'),
  run: (e) => e.chain().focus().toggleStrike().run(),
});
export const RichTextCode = control('RichTextCode', {
  icon: Code,
  tooltip: 'editor.code.tooltip',
  isActive: (e) => e.isActive('code'),
  run: (e) => e.chain().focus().toggleCode().run(),
});
export const RichTextClear = control('RichTextClear', {
  icon: Eraser,
  tooltip: 'editor.clear.tooltip',
  run: (e) => e.chain().focus().clearNodes().unsetAllMarks().run(),
});
export const RichTextBlockquote = control('RichTextBlockquote', {
  icon: TextQuote,
  tooltip: 'editor.blockquote.tooltip',
  isActive: (e) => e.isActive('blockquote'),
  run: (e) => e.chain().focus().toggleBlockquote().run(),
});
/** Icon, colour and a text-colour class per notice type, shared with the notice bubble.
 *  The classes are spelled out so Tailwind generates them. */
export const NOTICE_ICONS: Record<
  NoticeType,
  { icon: Component; color: string; className: string }
> = {
  info: { icon: Info, color: '#1f6feb', className: '!richtext-text-[#1f6feb]' },
  success: { icon: CircleCheck, color: '#1a7f37', className: '!richtext-text-[#1a7f37]' },
  warning: { icon: TriangleAlert, color: '#bf8700', className: '!richtext-text-[#bf8700]' },
  // A star, like the icon painted in the box itself.
  tip: { icon: Star, color: '#8250df', className: '!richtext-text-[#8250df]' },
};

/** A dropdown of the notice types; picking one wraps the selection or retypes the notice. */
export const RichTextNotice = defineComponent({
  name: 'RichTextNotice',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const state = useEditorState(
      (current) => ({
        enabled: current.isEditable && hasCommand(current, 'setNotice'),
        active: current.isActive('notice')
          ? String(current.getAttributes('notice').type ?? 'info')
          : '',
      }),
      { enabled: false, active: '' }
    );

    return () =>
      h(RichTextDropdown, {
        icon: Megaphone,
        tooltip: t('editor.notice.tooltip'),
        width: '10rem',
        disabled: !state.value.enabled,
        items: NOTICE_TYPES.map(({ value }) => ({
          value,
          label: t(`editor.notice.${value}`),
          active: state.value.active === value,
          render: () =>
            h(NOTICE_ICONS[value].icon, { size: 16, style: { color: NOTICE_ICONS[value].color } }),
        })),
        onSelect: (value: string) =>
          editor.value
            ?.chain()
            .focus()
            .toggleNotice(value as NoticeType)
            .run(),
      });
  },
});
export const RichTextBulletList = control('RichTextBulletList', {
  icon: List,
  tooltip: 'editor.bulletlist.tooltip',
  isActive: (e) => e.isActive('bulletList'),
  run: (e) => e.chain().focus().toggleBulletList().run(),
});
export const RichTextOrderedList = control('RichTextOrderedList', {
  icon: ListOrdered,
  tooltip: 'editor.orderedlist.tooltip',
  isActive: (e) => e.isActive('orderedList'),
  run: (e) => e.chain().focus().toggleOrderedList().run(),
});
export const RichTextTaskList = control('RichTextTaskList', {
  icon: ListTodo,
  tooltip: 'editor.tasklist.tooltip',
  isActive: (e) => e.isActive('taskList'),
  run: (e) => e.chain().focus().toggleTaskList().run(),
});
export const RichTextTable = control('RichTextTable', {
  icon: TableIcon,
  tooltip: 'editor.table.tooltip',
  isActive: (e) => e.isActive('table'),
  canRun: (e) => e.can().insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
  run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
});
export const RichTextCodeBlock = control('RichTextCodeBlock', {
  icon: SquareCode,
  tooltip: 'editor.codeblock.tooltip',
  isActive: (e) => e.isActive('codeBlock'),
  canRun: (e) => hasCommand(e, 'setCodeBlock'),
  run: (e) => e.chain().focus().setCodeBlock({ language: 'plaintext' }).run(),
});
export const RichTextDetails = control('RichTextDetails', {
  icon: ListCollapse,
  tooltip: 'editor.details.tooltip',
  isActive: (e) => e.isActive('details'),
  canRun: (e) => hasCommand(e, 'setDetails') && e.can().setDetails(),
  run: (e) => e.chain().focus().setDetails().run(),
});
export const RichTextTableOfContents = control('RichTextTableOfContents', {
  icon: ListTree,
  tooltip: 'editor.tableofcontents.tooltip',
  canRun: (e) => hasCommand(e, 'insertTableOfContents'),
  run: (e) => e.chain().focus().insertTableOfContents().run(),
});
export const RichTextIndent = control('RichTextIndent', {
  icon: ArrowRightToLine,
  tooltip: 'editor.indent.tooltip',
  canRun: (e) => hasCommand(e, 'indent'),
  run: (e) => e.chain().focus().indent().run(),
});
export const RichTextOutdent = control('RichTextOutdent', {
  icon: ArrowLeftToLine,
  tooltip: 'editor.outdent.tooltip',
  canRun: (e) => hasCommand(e, 'outdent'),
  run: (e) => e.chain().focus().outdent().run(),
});

/* -------------------------------------------------------------------------- */
/* Link                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The link editor: text, address and "open in a new tab". Reads the link
 * under the caret (or the selected text) when it mounts and applies the link
 * on submit. Used by the toolbar popover and by the link bubble menu.
 */
export const RichTextLinkForm = defineComponent({
  name: 'RichTextLinkForm',
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
  },
  emits: ['done', 'cancel'],
  setup(props, { emit }) {
    const { t } = useLocale();
    const { state } = props.editor;
    const { from, to, empty } = state.selection;
    const node = state.doc.nodeAt(from);
    const mark = node?.marks.find((item: Mark) => item.type.name === 'link');
    const defaultTarget = extensionOptions<{ HTMLAttributes?: { target?: string } }>(
      props.editor,
      'link'
    )?.HTMLAttributes?.target;

    const text = ref(mark && empty ? (node?.text ?? '') : state.doc.textBetween(from, to, ' '));
    const href = ref<string>((mark?.attrs.href as string) ?? '');
    const newTab = ref((mark ? mark.attrs.target : defaultTarget) === '_blank');
    const textField = ref<HTMLInputElement | null>(null);
    const hrefField = ref<HTMLInputElement | null>(null);

    const submit = () => {
      const url = href.value.trim();
      if (!url) return;
      // The React form's path too: bare domains get https://, paths stay as typed.
      applyLinkEdit(props.editor, {
        link: url,
        text: text.value.trim(),
        openInNewTab: newTab.value,
      });
      emit('done');
    };

    return () =>
      h(
        'form',
        {
          class: 'richtext-flex richtext-flex-col richtext-gap-2',
          onSubmit: (event: Event) => {
            event.preventDefault();
            submit();
          },
        },
        [
          h('label', { class: 'richtext-vue-label' }, t('editor.link.dialog.text')),
          h('input', {
            ref: textField,
            class: 'richtext-vue-field',
            type: 'text',
            placeholder: t('editor.link.dialog.text.placeholder'),
            value: text.value,
            onInput: (event: Event) => {
              text.value = (event.target as HTMLInputElement).value;
            },
          }),
          h('label', { class: 'richtext-vue-label' }, t('editor.link.dialog.link')),
          h('input', {
            ref: hrefField,
            class: 'richtext-vue-field',
            type: 'url',
            required: true,
            autofocus: true,
            placeholder: t('editor.link.dialog.link.placeholder'),
            value: href.value,
            onInput: (event: Event) => {
              href.value = (event.target as HTMLInputElement).value;
            },
          }),
          h('label', { class: 'richtext-vue-check' }, [
            h('input', {
              type: 'checkbox',
              checked: newTab.value,
              onChange: (event: Event) => {
                newTab.value = (event.target as HTMLInputElement).checked;
              },
            }),
            t('editor.link.dialog.openInNewTab'),
          ]),
          h('div', { class: 'richtext-flex richtext-justify-end richtext-gap-2 richtext-pt-1' }, [
            h(
              'button',
              { type: 'button', class: 'richtext-vue-button', onClick: () => emit('cancel') },
              t('editor.link.dialog.button.cancel')
            ),
            h(
              'button',
              {
                type: 'submit',
                class: 'richtext-vue-button richtext-vue-button--primary',
                disabled: !href.value.trim(),
              },
              t('editor.link.dialog.button.apply')
            ),
          ]),
        ]
      );
  },
});

/** Opens the link editor in a popover; removes the link when the caret is in one. */
export const RichTextLink = defineComponent({
  name: 'RichTextLink',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const popover = ref<{ close: () => void } | null>(null);
    const state = useEditorState(
      (current) => ({ active: current.isActive('link'), enabled: current.isEditable }),
      { active: false, enabled: false }
    );

    return () =>
      h(
        RichTextPopover,
        {
          ref: popover,
          icon: LinkIcon,
          tooltip: t('editor.link.tooltip'),
          active: state.value.active,
          disabled: !state.value.enabled,
          width: '20rem',
        },
        {
          default: ({ close }: { close: () => void }) =>
            editor.value
              ? [
                  h(RichTextLinkForm, { editor: editor.value, onDone: close, onCancel: close }),
                  state.value.active
                    ? h(
                        'button',
                        {
                          type: 'button',
                          class: 'richtext-vue-button richtext-vue-button--danger',
                          onClick: () => {
                            editor.value?.chain().focus().extendMarkRange('link').unsetLink().run();
                            close();
                          },
                        },
                        [h(Unlink, { size: 14 }), t('editor.link.unlink.tooltip')]
                      )
                    : null,
                ]
              : null,
        }
      );
  },
});

/* -------------------------------------------------------------------------- */
/* Headings, alignment, divider                                               */
/* -------------------------------------------------------------------------- */

/** Paragraph and the heading levels the Heading extension is configured with. */
export const RichTextHeading = defineComponent({
  name: 'RichTextHeading',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const state = useEditorState(
      (current) => {
        const levels = (current.extensionManager.extensions.find((ext) => ext.name === 'heading')
          ?.options?.levels ?? [1, 2, 3]) as number[];
        const active = levels.find((level) => current.isActive('heading', { level }));

        return { levels, active: active ?? 0, enabled: current.isEditable };
      },
      { levels: [1, 2, 3], active: 0, enabled: false }
    );

    return () => {
      const items: DropdownItem[] = [
        { value: '0', label: t('editor.paragraph.tooltip'), active: state.value.active === 0 },
        ...state.value.levels.map((level) => ({
          value: String(level),
          label: t(`editor.heading.h${level}.tooltip`),
          active: state.value.active === level,
          render: () =>
            h(
              'span',
              { class: 'richtext-w-6 richtext-text-xs richtext-text-muted-foreground' },
              `H${level}`
            ),
        })),
      ];
      const current = items.find((item) => item.active) ?? items[0];

      return h(RichTextDropdown, {
        icon: HeadingIcon,
        label: current.label,
        reserve: items.map((item) => item.label),
        tooltip: t('editor.heading.tooltip'),
        items,
        disabled: !state.value.enabled,
        onSelect: (value: string) => {
          const level = Number(value);

          if (!editor.value) return;
          if (level === 0) editor.value.chain().focus().setParagraph().run();
          else
            editor.value
              .chain()
              .focus()
              .toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
              .run();
        },
      });
    };
  },
});

const ALIGNMENTS = [
  { value: 'left', icon: AlignLeft, key: 'editor.textalign.left.tooltip' },
  { value: 'center', icon: AlignCenter, key: 'editor.textalign.center.tooltip' },
  { value: 'right', icon: AlignRight, key: 'editor.textalign.right.tooltip' },
  { value: 'justify', icon: AlignJustify, key: 'editor.textalign.justify.tooltip' },
];

export const RichTextTextAlign = defineComponent({
  name: 'RichTextTextAlign',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const state = useEditorState(
      (current) => ({
        active: ALIGNMENTS.find((a) => current.isActive({ textAlign: a.value }))?.value ?? 'left',
        enabled: current.isEditable,
      }),
      { active: 'left', enabled: false }
    );

    return () =>
      h(RichTextDropdown, {
        icon: ALIGNMENTS.find((a) => a.value === state.value.active)?.icon ?? AlignLeft,
        tooltip: t('editor.textalign.tooltip'),
        width: '9rem',
        disabled: !state.value.enabled,
        items: ALIGNMENTS.map((a) => ({
          value: a.value,
          label: t(a.key),
          active: state.value.active === a.value,
          render: () => h(a.icon, { size: 14, class: 'richtext-text-muted-foreground' }),
        })),
        onSelect: (value: string) => editor.value?.chain().focus().setTextAlign(value).run(),
      });
  },
});

/** The divider styles the Divider extension is configured with, previewed. */
export const RichTextDivider = defineComponent({
  name: 'RichTextDivider',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const state = useEditorState(
      (current) => {
        const extension = current.extensionManager.extensions.find((ext) => ext.name === 'divider');
        const variants = (extension?.options?.variants as DividerVariantOption[] | undefined) ?? [];

        return { variants, enabled: current.isEditable && !!extension };
      },
      { variants: DIVIDER_VARIANTS.map((value) => ({ value })), enabled: false }
    );

    return () =>
      h(RichTextDropdown, {
        icon: SeparatorHorizontal,
        tooltip: t('editor.divider.tooltip'),
        width: '14rem',
        disabled: !state.value.enabled,
        items: state.value.variants.map((variant) => {
          const key = `editor.divider.variant.${variant.value}`;
          const label = variant.label ?? (t(key) === key ? String(variant.value) : t(key));

          return {
            value: String(variant.value),
            label,
            render: () =>
              h(
                'span',
                {
                  'aria-hidden': 'true',
                  class: `divider divider-preview divider--${variant.value} richtext-w-16 richtext-shrink-0`,
                },
                [
                  h('hr'),
                  variant.editable || variant.value === 'number'
                    ? [
                        h(
                          'span',
                          { class: 'divider__label' },
                          variant.value === 'number' ? '1' : 'Aa'
                        ),
                        h('hr'),
                      ]
                    : null,
                ]
              ),
          };
        }),
        onSelect: (value: string) =>
          editor.value?.chain().focus().setDivider({ variant: value }).run(),
      });
  },
});

/* -------------------------------------------------------------------------- */
/* Text style: colour, highlight, font size, line height                      */
/* -------------------------------------------------------------------------- */

/** A palette: "default", the swatches, and a native picker for anything else. */
export function colorPalette(
  colors: readonly string[],
  current: string | undefined,
  labels: { reset: string; more: string },
  /** `sweeping` is true while the native picker is being dragged. */
  pick: (color: string | null, sweeping?: boolean) => void
) {
  return [
    h(
      'button',
      {
        type: 'button',
        class: 'richtext-vue-button richtext-w-full',
        onMousedown: (event: MouseEvent) => event.preventDefault(),
        onClick: () => pick(null),
      },
      labels.reset
    ),
    h(
      'div',
      { class: 'richtext-vue-swatches', role: 'radiogroup' },
      colors.map((color) =>
        h('button', {
          type: 'button',
          role: 'radio',
          key: color,
          class: 'richtext-vue-swatch',
          style: { background: color },
          title: color,
          'aria-label': color,
          'aria-checked': current?.toLowerCase() === color.toLowerCase() ? 'true' : 'false',
          onMousedown: (event: MouseEvent) => event.preventDefault(),
          onClick: () => pick(color),
        })
      )
    ),
    h('label', { class: 'richtext-vue-check richtext-justify-between' }, [
      labels.more,
      h('input', {
        type: 'color',
        value: current && /^#[0-9a-f]{6}$/i.test(current) ? current : '#000000',
        onInput: (event: Event) => pick((event.target as HTMLInputElement).value, true),
      }),
    ]),
  ];
}

function colorControl(
  name: string,
  options: {
    icon: Component;
    extension: string;
    tooltip: string;
    read: (editor: Editor) => string | undefined;
    set: (editor: Editor, color: string) => void;
    unset: (editor: Editor) => void;
  }
) {
  return defineComponent({
    name,
    setup() {
      const editor = useEditorInstance();
      const { t } = useLocale();
      const state = useEditorState(
        (current) => {
          const ext = extensionOptions<{ colors?: string[] }>(current, options.extension);
          return {
            enabled: current.isEditable && !!ext,
            colors: (ext?.colors?.length ? ext.colors : COLORS_LIST) as readonly string[],
            current: options.read(current),
          };
        },
        {
          enabled: false,
          colors: COLORS_LIST as readonly string[],
          current: undefined as string | undefined,
        }
      );

      return () =>
        h(
          RichTextPopover,
          {
            tooltip: t(options.tooltip),
            active: !!state.value.current,
            disabled: !state.value.enabled,
            width: '17rem',
          },
          {
            trigger: () => [
              h(options.icon, { size: 16, 'aria-hidden': 'true' }),
              h('span', {
                class: 'richtext-vue-color-bar',
                'aria-hidden': 'true',
                style: { background: state.value.current ?? 'transparent' },
              }),
            ],
            default: ({ close }: { close: () => void }) =>
              colorPalette(
                state.value.colors,
                state.value.current,
                { reset: t('editor.default'), more: t('editor.color.more') },
                (color, sweeping) => {
                  if (!editor.value) return;
                  if (color) options.set(editor.value, color);
                  else options.unset(editor.value);
                  if (!sweeping) close();
                }
              ),
          }
        );
    },
  });
}

export const RichTextColor = colorControl('RichTextColor', {
  icon: Baseline,
  extension: 'color',
  tooltip: 'editor.color.tooltip',
  read: (e) => e.getAttributes('textStyle').color as string | undefined,
  set: (e, color) => e.chain().focus().setColor(color).run(),
  unset: (e) => e.chain().focus().unsetColor().run(),
});

export const RichTextHighlight = colorControl('RichTextHighlight', {
  icon: Highlighter,
  extension: 'highlight',
  tooltip: 'editor.highlight.tooltip',
  read: (e) => e.getAttributes('highlight').color as string | undefined,
  set: (e, color) => e.chain().focus().setHighlight({ color }).run(),
  unset: (e) => e.chain().focus().unsetHighlight().run(),
});

export const RichTextFontSize = defineComponent({
  name: 'RichTextFontSize',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const state = useEditorState(
      (current) => {
        const ext = extensionOptions<{ fontSizes?: (string | NameValueOption)[] }>(
          current,
          'fontSize'
        );
        return {
          enabled: current.isEditable && !!ext,
          sizes: ensureNameValueOptions(ext?.fontSizes ?? [...DEFAULT_FONT_SIZE_LIST]),
          current: (current.getAttributes('textStyle').fontSize as string | undefined) ?? '',
        };
      },
      { enabled: false, sizes: ensureNameValueOptions([...DEFAULT_FONT_SIZE_LIST]), current: '' }
    );

    return () =>
      h(RichTextDropdown, {
        icon: ALargeSmall,
        label: state.value.current || t('editor.fontSize.default.tooltip'),
        reserve: [t('editor.fontSize.default.tooltip')],
        tooltip: t('editor.fontSize.tooltip'),
        width: '9rem',
        disabled: !state.value.enabled,
        items: state.value.sizes.map((size) => ({
          value: String(size.value),
          label:
            size.value === 'Default' ? t('editor.fontSize.default.tooltip') : String(size.name),
          active:
            size.value === 'Default' ? !state.value.current : state.value.current === size.value,
        })),
        onSelect: (value: string) => {
          if (!editor.value) return;
          if (value === 'Default') editor.value.chain().focus().unsetFontSize().run();
          else editor.value.chain().focus().setFontSize(value).run();
        },
      });
  },
});

export const RichTextLineHeight = defineComponent({
  name: 'RichTextLineHeight',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const state = useEditorState(
      (current) => {
        const ext = extensionOptions<{ lineHeights?: string[] }>(current, 'lineHeight');
        return {
          enabled: current.isEditable && !!ext,
          heights: ext?.lineHeights ?? DEFAULT_LINE_HEIGHT_LIST,
          current: (current.getAttributes('textStyle').lineHeight as string | undefined) ?? '',
        };
      },
      { enabled: false, heights: DEFAULT_LINE_HEIGHT_LIST, current: '' }
    );

    return () =>
      h(RichTextDropdown, {
        icon: UnfoldVertical,
        tooltip: t('editor.lineheight.tooltip'),
        width: '8rem',
        disabled: !state.value.enabled,
        items: state.value.heights.map((height) => ({
          value: height,
          label: height === 'Default' ? t('editor.default') : height,
          active: height === 'Default' ? !state.value.current : state.value.current === height,
        })),
        onSelect: (value: string) => {
          if (!editor.value) return;
          if (value === 'Default') editor.value.chain().focus().unsetLineHeight().run();
          else editor.value.chain().focus().setLineHeight(value).run();
        },
      });
  },
});

/* -------------------------------------------------------------------------- */
/* AI generate field (Katex, Mermaid)                                          */
/* -------------------------------------------------------------------------- */

/** Models like to wrap source in ``` fences even when told not to. */
function stripFences(text: string): string {
  return text
    .replace(/^\s*```[\w-]*\s*\n?/, '')
    .replace(/\n?\s*```\s*$/, '')
    .trim();
}

/**
 * "Describe it, let the model write the source" — a one-line prompt for
 * dialogs that edit a language the model knows (LaTeX, Mermaid). Renders
 * nothing when the AI extension is absent or unconfigured. Emits `result`
 * with the text as it streams and once more when complete.
 */
export const RichTextAIGenerateField = defineComponent({
  name: 'RichTextAIGenerateField',
  props: {
    editor: { type: Object as PropType<Editor | null | undefined>, default: null },
    /** System prompt that pins the output format ("return only Mermaid source"). */
    instruction: { type: String, required: true },
    placeholder: { type: String, required: true },
    /** What is in the editor field now, sent along so "make it blue" works. */
    current: { type: String, default: '' },
  },
  emits: ['result'],
  setup(props, { emit }) {
    const { t } = useLocale();
    const prompt = ref('');
    const busy = ref(false);
    const error = ref('');
    let controller: AbortController | null = null;

    onBeforeUnmount(() => controller?.abort());

    async function submit() {
      const options = usableAIOptions(props.editor);
      if (busy.value || !prompt.value.trim() || !options) return;
      const active = new AbortController();
      controller = active;
      busy.value = true;
      error.value = '';
      let streamed = '';
      try {
        const content = props.current.trim()
          ? `Current source:\n${props.current}\n\nInstruction: ${prompt.value.trim()}`
          : prompt.value.trim();
        const text = await generateAIText(
          options,
          {
            messages: [{ role: 'user', content }],
            systemPrompt: props.instruction,
            signal: active.signal,
          },
          (chunk) => {
            streamed += chunk;
            emit('result', stripFences(streamed));
          }
        );
        if (!active.signal.aborted) emit('result', stripFences(text));
      } catch (cause) {
        if (!active.signal.aborted)
          error.value = cause instanceof Error ? cause.message : t('editor.ai.error.generic');
      } finally {
        if (controller === active) {
          controller = null;
          busy.value = false;
        }
      }
    }

    function stop() {
      controller?.abort();
      controller = null;
      busy.value = false;
    }

    return () =>
      usableAIOptions(props.editor)
        ? h('div', { class: 'richtext-mb-[10px]' }, [
            h(
              'div',
              {
                class:
                  'richtext-flex richtext-items-center richtext-gap-2 richtext-rounded-md richtext-border richtext-border-solid richtext-border-border richtext-bg-background richtext-px-2 richtext-py-1',
              },
              [
                h(Sparkles, { class: 'richtext-shrink-0 richtext-text-[#804dff]', size: 15 }),
                h('input', {
                  'aria-label': props.placeholder,
                  class:
                    'richtext-min-w-0 richtext-flex-1 richtext-border-0 richtext-bg-transparent richtext-py-1 richtext-text-sm richtext-text-foreground richtext-outline-none',
                  disabled: busy.value,
                  placeholder: props.placeholder,
                  value: prompt.value,
                  onInput: (event: Event) => {
                    prompt.value = (event.target as HTMLInputElement).value;
                  },
                  onKeydown: (event: KeyboardEvent) => {
                    if (event.key === 'Enter' && !event.isComposing) {
                      event.preventDefault();
                      void submit();
                    }
                  },
                }),
                busy.value
                  ? h(
                      'button',
                      {
                        type: 'button',
                        'aria-label': t('editor.ai.stop'),
                        class:
                          'richtext-flex richtext-size-7 richtext-items-center richtext-justify-center richtext-rounded richtext-border-0 richtext-bg-transparent richtext-text-foreground hover:richtext-bg-accent',
                        onClick: stop,
                      },
                      [h(Square, { size: 12, fill: 'currentColor' })]
                    )
                  : h(
                      'button',
                      {
                        type: 'button',
                        class:
                          'richtext-rounded richtext-border-0 richtext-bg-[#804dff] richtext-px-2.5 richtext-py-1 richtext-text-xs richtext-font-medium richtext-text-white disabled:richtext-opacity-50',
                        disabled: !prompt.value.trim(),
                        onClick: () => void submit(),
                      },
                      t('editor.ai.generate')
                    ),
              ]
            ),
            error.value
              ? h('p', { class: 'richtext-vue-error richtext-mt-1', role: 'alert' }, error.value)
              : null,
          ])
        : null;
  },
});

/* -------------------------------------------------------------------------- */
/* Katex                                                                       */
/* -------------------------------------------------------------------------- */

/** Formula, macros, a live preview, and an AI prompt to write the LaTeX. */
export const RichTextKatex = defineComponent({
  name: 'RichTextKatex',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const open = ref(false);
    const text = ref('');
    const macros = ref('');
    const renderer = shallowRef<KatexRenderer | null>(null);
    const failed = ref(false);
    const state = useEditorState(
      (current) => ({
        enabled: current.isEditable && hasCommand(current, 'setKatex'),
        active: current.isActive('katex'),
      }),
      { enabled: false, active: false }
    );

    watch(open, (value) => {
      if (!value || !editor.value) return;
      const attrs = editor.value.getAttributes('katex') as { text?: string; macros?: string };
      text.value = attrs.text ? decodeURIComponent(attrs.text) : '';
      macros.value = attrs.macros ? decodeURIComponent(attrs.macros) : '';
      failed.value = false;
      const loader = extensionOptions<{ loadKatex?: KatexLoader }>(
        editor.value,
        'katex'
      )?.loadKatex;
      void loadKatex(loader)
        .then((instance) => {
          renderer.value = instance;
        })
        .catch(() => {
          failed.value = true;
        });
    });

    const html = computed(() => {
      if (!renderer.value || !text.value.trim()) return null;
      try {
        return renderer.value.renderToString(text.value, {
          macros: safeJSONParse<Record<string, string>>(macros.value),
          throwOnError: false,
        });
      } catch {
        return null;
      }
    });

    const submit = () => {
      if (!editor.value || !text.value.trim()) return;
      editor.value
        .chain()
        .focus()
        .setKatex({
          text: encodeURIComponent(text.value),
          macros: encodeURIComponent(macros.value),
        })
        .run();
      open.value = false;
    };

    return () => [
      h(RichTextToolbarButton, {
        icon: Sigma,
        tooltip: t('editor.katex.tooltip'),
        active: state.value.active,
        disabled: !state.value.enabled,
        onClick: () => {
          open.value = true;
        },
      }),
      h(
        RichTextDialog,
        {
          open: open.value,
          title: t('editor.formula.dialog.text'),
          width: '56rem',
          closeLabel: t('editor.ai.close'),
          'onUpdate:open': (value: boolean) => {
            open.value = value;
          },
        },
        {
          default: () =>
            h(
              'div',
              {
                style: {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
                  gap: '12px',
                },
              },
              [
                h('div', [
                  h(RichTextAIGenerateField, {
                    editor: editor.value,
                    current: text.value,
                    instruction:
                      'You write LaTeX for KaTeX. Reply with the LaTeX expression only: no $ delimiters, no code fences, no explanation.',
                    placeholder: t('editor.ai.generate.katex'),
                    onResult: (value: string) => {
                      text.value = value;
                    },
                  }),
                  h('label', { class: 'richtext-vue-label' }, 'Expression'),
                  h('textarea', {
                    class: 'richtext-vue-field richtext-mb-2',
                    rows: 8,
                    placeholder: 'Text',
                    value: text.value,
                    onInput: (event: Event) => {
                      text.value = (event.target as HTMLTextAreaElement).value;
                    },
                  }),
                  h('label', { class: 'richtext-vue-label' }, 'Macros'),
                  h('textarea', {
                    class: 'richtext-vue-field',
                    rows: 5,
                    placeholder: '{"\\\\RR": "\\\\mathbb{R}"}',
                    value: macros.value,
                    onInput: (event: Event) => {
                      macros.value = (event.target as HTMLTextAreaElement).value;
                    },
                  }),
                ]),
                h(
                  'div',
                  { class: 'richtext-vue-preview', 'aria-live': 'polite' },
                  failed.value
                    ? h('span', { role: 'alert' }, text.value)
                    : html.value === null
                      ? h('span', { 'aria-busy': !renderer.value }, text.value)
                      : h('span', { innerHTML: html.value })
                ),
              ]
            ),
          footer: () =>
            h(
              'button',
              {
                type: 'button',
                class: 'richtext-vue-button richtext-vue-button--primary',
                disabled: !text.value.trim(),
                onClick: submit,
              },
              t('editor.link.dialog.button.apply')
            ),
        }
      ),
    ];
  },
});

/* -------------------------------------------------------------------------- */
/* Mermaid                                                                     */
/* -------------------------------------------------------------------------- */

const DEFAULT_MERMAID = 'graph TB\na-->b';

/** Mermaid source with a live preview; saved as an SVG image node. */
export const RichTextMermaid = defineComponent({
  name: 'RichTextMermaid',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const open = ref(false);
    const code = ref(DEFAULT_MERMAID);
    const svg = ref('');
    const saving = ref(false);
    const mermaid = shallowRef<import('mermaid').Mermaid | null>(null);
    const preview = ref<HTMLElement | null>(null);
    const state = useEditorState(
      (current) => ({ enabled: current.isEditable && hasCommand(current, 'setMermaid') }),
      { enabled: false }
    );
    let renderId = 0;

    async function render(value: string) {
      const instance = mermaid.value;
      if (!instance) return;
      const id = ++renderId;
      try {
        const result = await instance.render(`richtext-mermaid-${id}`, value);
        if (id === renderId) svg.value = result.svg;
      } catch {
        if (id === renderId) svg.value = '';
      }
    }

    watch(open, (value) => {
      if (!value) return;
      if (mermaid.value) {
        void render(code.value);
        return;
      }
      void import('mermaid').then((module) => {
        module.default.initialize({
          darkMode: false,
          startOnLoad: false,
          fontSize: 12,
          theme: 'base',
        });
        mermaid.value = module.default;
        void render(code.value);
      });
    });
    watch(code, (value) => {
      if (open.value) void render(value);
    });

    async function submit() {
      const element = preview.value?.querySelector('svg');
      if (!editor.value || !code.value.trim() || !element || saving.value) return;
      saving.value = true;
      try {
        const { width, height } = element.getBoundingClientRect();
        const name = `mermaid-${Date.now().toString(36)}.svg`;
        let src = `data:image/svg+xml;base64,${btoa(
          unescape(encodeURIComponent(element.outerHTML))
        )}`;
        const upload = extensionOptions<{ upload?: (file: File) => Promise<string> }>(
          editor.value,
          'mermaid'
        )?.upload;
        if (upload) src = await upload(dataURLtoFile(src, name));

        editor.value
          .chain()
          .focus()
          .setMermaid(
            { type: 'mermaid', src, alt: encodeURIComponent(code.value), width, height },
            true
          )
          .run();
        open.value = false;
      } finally {
        saving.value = false;
      }
    }

    return () => [
      h(RichTextToolbarButton, {
        icon: Workflow,
        tooltip: t('editor.mermaid.tooltip'),
        disabled: !state.value.enabled,
        onClick: () => {
          open.value = true;
        },
      }),
      h(
        RichTextDialog,
        {
          open: open.value,
          title: t('editor.mermaid.tooltip'),
          width: '56rem',
          closeLabel: t('editor.ai.close'),
          'onUpdate:open': (value: boolean) => {
            open.value = value;
          },
        },
        {
          default: () => [
            h(RichTextAIGenerateField, {
              editor: editor.value,
              current: code.value,
              instruction:
                'You write Mermaid diagrams. Reply with Mermaid source only: no code fences, no explanation.',
              placeholder: t('editor.ai.generate.mermaid'),
              onResult: (value: string) => {
                code.value = value;
              },
            }),
            h(
              'div',
              {
                style: {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
                  gap: '12px',
                },
              },
              [
                h('textarea', {
                  class: 'richtext-vue-field',
                  rows: 12,
                  placeholder: 'Text',
                  value: code.value,
                  onInput: (event: Event) => {
                    code.value = (event.target as HTMLTextAreaElement).value;
                  },
                }),
                h('div', {
                  ref: preview,
                  class: 'richtext-vue-preview',
                  'aria-busy': !mermaid.value,
                  innerHTML: svg.value,
                }),
              ]
            ),
          ],
          footer: () =>
            h(
              'button',
              {
                type: 'button',
                class: 'richtext-vue-button richtext-vue-button--primary',
                disabled: !mermaid.value || !svg.value || saving.value,
                onClick: () => void submit(),
              },
              t('editor.link.dialog.button.apply')
            ),
        }
      ),
    ];
  },
});

/* -------------------------------------------------------------------------- */
/* Image, video, attachment, iframe                                            */
/* -------------------------------------------------------------------------- */

interface ImageExtensionOptions extends UploadRules {
  resourceImage?: 'upload' | 'link' | 'both';
  defaultInline?: boolean;
  enableAlt?: boolean;
}

/** A hidden file input plus a drop zone that reports the chosen files. */
function dropzone(
  input: { value: HTMLInputElement | null },
  options: {
    accept?: string[];
    multiple?: boolean;
    busy: boolean;
    active: boolean;
    label: string;
    hint?: string;
    onFiles: (files: File[]) => void;
    onDragState: (active: boolean) => void;
  }
) {
  return [
    h('input', {
      ref: (el) => {
        input.value = el as HTMLInputElement | null;
      },
      type: 'file',
      hidden: true,
      accept: options.accept?.join(','),
      multiple: options.multiple,
      onChange: (event: Event) => {
        const target = event.target as HTMLInputElement;
        options.onFiles(Array.from(target.files ?? []));
        target.value = '';
      },
    }),
    h(
      'button',
      {
        type: 'button',
        class: ['richtext-vue-dropzone', options.active ? 'richtext-vue-dropzone--active' : null],
        disabled: options.busy,
        onClick: () => input.value?.click(),
        onDragover: (event: DragEvent) => {
          event.preventDefault();
          options.onDragState(true);
        },
        onDragleave: () => options.onDragState(false),
        onDrop: (event: DragEvent) => {
          event.preventDefault();
          options.onDragState(false);
          options.onFiles(Array.from(event.dataTransfer?.files ?? []));
        },
      },
      [
        h('span', options.label),
        options.hint ? h('span', { class: 'richtext-vue-hint' }, options.hint) : null,
      ]
    ),
  ];
}

/** Upload or link an image; inline or block; optional alt text. */
export const RichTextImage = defineComponent({
  name: 'RichTextImage',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const open = ref(false);
    const link = ref('');
    const alt = ref('');
    const inline = ref(false);
    const busy = ref(false);
    const dragging = ref(false);
    const error = ref('');
    const fileInput = { value: null as HTMLInputElement | null };
    const state = useEditorState(
      (current) => ({
        enabled: current.isEditable && hasCommand(current, 'setImageInline'),
        options: extensionOptions<ImageExtensionOptions>(current, 'image') ?? {},
      }),
      { enabled: false, options: {} as ImageExtensionOptions }
    );

    watch(open, (value) => {
      if (!value) return;
      link.value = '';
      alt.value = '';
      error.value = '';
      inline.value = state.value.options.defaultInline ?? false;
    });

    function insert(srcs: string[]) {
      const current = editor.value;
      if (!current || !srcs.length) return;
      // One insertContent for all of them: inserting one by one leaves each
      // new node selected, so the next would replace it.
      const type = !inline.value && current.schema.nodes.imageBlock ? 'imageBlock' : 'image';
      current
        .chain()
        .focus()
        .insertContent(
          srcs.map((src) => ({
            type,
            attrs: { src, inline: inline.value, alt: alt.value || null },
          }))
        )
        .run();
      open.value = false;
    }

    async function onFiles(files: File[]) {
      if (!editor.value || busy.value || !files.length) return;
      busy.value = true;
      error.value = '';
      try {
        const srcs = await uploadFiles(files, state.value.options, t, (message) => {
          error.value = message;
        });
        if (state.value.options.upload)
          srcs.forEach((src) => rememberUploadedImage(editor.value!, src));
        insert(srcs);
      } finally {
        busy.value = false;
      }
    }

    return () => {
      const options = state.value.options;
      const resource = options.resourceImage ?? 'both';
      return [
        h(RichTextToolbarButton, {
          icon: ImageIcon,
          tooltip: t('editor.image.tooltip'),
          disabled: !state.value.enabled,
          onClick: () => {
            open.value = true;
          },
        }),
        h(
          RichTextDialog,
          {
            open: open.value,
            title: t('editor.image.dialog.title'),
            width: '28rem',
            closeLabel: t('editor.ai.close'),
            'onUpdate:open': (value: boolean) => {
              open.value = value;
            },
          },
          {
            default: () => [
              resource !== 'link'
                ? dropzone(fileInput, {
                    accept: options.acceptMimes,
                    multiple: options.multiple,
                    busy: busy.value,
                    active: dragging.value,
                    label: busy.value
                      ? t('editor.imageUpload.uploading')
                      : dragging.value
                        ? t('editor.imageUpload.dropzoneActive')
                        : t('editor.imageUpload.dropzone'),
                    hint: options.maxSize
                      ? t('editor.imageUpload.dropzoneHint', {
                          formats: (options.acceptMimes ?? [])
                            .map((mime) => mime.split('/').pop()?.replace('*', '').toUpperCase())
                            .filter(Boolean)
                            .slice(0, 4)
                            .join(', '),
                          size: formatSize(options.maxSize),
                        })
                      : undefined,
                    onFiles: (files) => void onFiles(files),
                    onDragState: (active) => {
                      dragging.value = active;
                    },
                  })
                : null,
              resource !== 'upload'
                ? h(
                    'form',
                    {
                      class: 'richtext-flex richtext-flex-col richtext-gap-1',
                      onSubmit: (event: Event) => {
                        event.preventDefault();
                        if (link.value.trim()) insert([link.value.trim()]);
                      },
                    },
                    [
                      h(
                        'label',
                        { class: 'richtext-vue-label' },
                        t('editor.image.dialog.form.link')
                      ),
                      h('div', { class: 'richtext-flex richtext-gap-2' }, [
                        h('input', {
                          class: 'richtext-vue-field',
                          type: 'url',
                          placeholder: t('editor.image.dialog.placeholder'),
                          value: link.value,
                          onInput: (event: Event) => {
                            link.value = (event.target as HTMLInputElement).value;
                          },
                        }),
                        h(
                          'button',
                          {
                            type: 'submit',
                            class: 'richtext-vue-button richtext-vue-button--primary',
                            disabled: !link.value.trim() || busy.value,
                          },
                          t('editor.image.dialog.button.apply')
                        ),
                      ]),
                      h('p', { class: 'richtext-vue-hint' }, t('editor.imageUpload.linkHint')),
                    ]
                  )
                : null,
              options.enableAlt
                ? h('div', [
                    h(
                      'label',
                      { class: 'richtext-vue-label' },
                      t('editor.imageUpload.altOptional')
                    ),
                    h('input', {
                      class: 'richtext-vue-field',
                      type: 'text',
                      value: alt.value,
                      placeholder: t('editor.imageUpload.altHint'),
                      onInput: (event: Event) => {
                        alt.value = (event.target as HTMLInputElement).value;
                      },
                    }),
                  ])
                : null,
              h('label', { class: 'richtext-vue-check' }, [
                h('input', {
                  type: 'checkbox',
                  checked: inline.value,
                  onChange: (event: Event) => {
                    inline.value = (event.target as HTMLInputElement).checked;
                  },
                }),
                t('editor.link.dialog.inline'),
              ]),
              error.value
                ? h('p', { class: 'richtext-vue-error', role: 'alert' }, error.value)
                : null,
            ],
          }
        ),
      ];
    };
  },
});

interface VideoExtensionOptions extends UploadRules {
  resourceVideo?: 'upload' | 'link' | 'both';
}

/** Upload or embed a video (YouTube, Vimeo and Bilibili links are converted). */
export const RichTextVideo = defineComponent({
  name: 'RichTextVideo',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const open = ref(false);
    const link = ref('');
    const busy = ref(false);
    const dragging = ref(false);
    const error = ref('');
    const fileInput = { value: null as HTMLInputElement | null };
    const state = useEditorState(
      (current) => ({
        enabled: current.isEditable && hasCommand(current, 'setVideo'),
        options: extensionOptions<VideoExtensionOptions>(current, 'video') ?? {},
      }),
      { enabled: false, options: {} as VideoExtensionOptions }
    );

    watch(open, (value) => {
      if (value) {
        link.value = '';
        error.value = '';
      }
    });

    function insert(srcs: string[]) {
      const current = editor.value;
      if (!current || !srcs.length) return;
      current
        .chain()
        .focus()
        .insertContent(srcs.map((src) => ({ type: 'video', attrs: { src } })))
        .run();
      open.value = false;
    }

    async function onFiles(files: File[]) {
      if (!editor.value || busy.value || !files.length) return;
      busy.value = true;
      error.value = '';
      try {
        insert(
          await uploadFiles(files, state.value.options, t, (message) => {
            error.value = message;
          })
        );
      } finally {
        busy.value = false;
      }
    }

    return () => {
      const options = state.value.options;
      const resource = options.resourceVideo ?? 'both';
      return [
        h(RichTextToolbarButton, {
          icon: VideoIcon,
          tooltip: t('editor.video.tooltip'),
          disabled: !state.value.enabled,
          onClick: () => {
            open.value = true;
          },
        }),
        h(
          RichTextDialog,
          {
            open: open.value,
            title: t('editor.video.dialog.title'),
            width: '28rem',
            closeLabel: t('editor.ai.close'),
            'onUpdate:open': (value: boolean) => {
              open.value = value;
            },
          },
          {
            default: () => [
              resource !== 'link' && options.upload
                ? dropzone(fileInput, {
                    accept: options.acceptMimes,
                    multiple: options.multiple,
                    busy: busy.value,
                    active: dragging.value,
                    label: busy.value
                      ? t('editor.video.dialog.uploading')
                      : t('editor.video.dialog.tab.upload'),
                    onFiles: (files) => void onFiles(files),
                    onDragState: (active) => {
                      dragging.value = active;
                    },
                  })
                : null,
              resource !== 'upload'
                ? h(
                    'form',
                    {
                      class: 'richtext-flex richtext-flex-col richtext-gap-1',
                      onSubmit: (event: Event) => {
                        event.preventDefault();
                        if (link.value.trim()) insert([link.value.trim()]);
                      },
                    },
                    [
                      h('label', { class: 'richtext-vue-label' }, t('editor.video.dialog.link')),
                      h('div', { class: 'richtext-flex richtext-gap-2' }, [
                        h('input', {
                          class: 'richtext-vue-field',
                          type: 'url',
                          placeholder: t('editor.video.dialog.placeholder'),
                          value: link.value,
                          onInput: (event: Event) => {
                            link.value = (event.target as HTMLInputElement).value;
                          },
                        }),
                        h(
                          'button',
                          {
                            type: 'submit',
                            class: 'richtext-vue-button richtext-vue-button--primary',
                            disabled: !link.value.trim() || busy.value,
                          },
                          t('editor.video.dialog.button.apply')
                        ),
                      ]),
                    ]
                  )
                : null,
              error.value
                ? h('p', { class: 'richtext-vue-error', role: 'alert' }, error.value)
                : null,
            ],
          }
        ),
      ];
    };
  },
});

/** Picks a file, uploads it through the extension's `upload`, inserts the attachment. */
export const RichTextAttachment = defineComponent({
  name: 'RichTextAttachment',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const busy = ref(false);
    const input = ref<HTMLInputElement | null>(null);
    const state = useEditorState(
      (current) => ({ enabled: current.isEditable && hasCommand(current, 'setAttachment') }),
      { enabled: false }
    );

    async function onChange(event: Event) {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      target.value = '';
      const current = editor.value;
      if (!file || !current || busy.value) return;
      const upload = extensionOptions<{ upload?: (file: File) => Promise<string> }>(
        current,
        'attachment'
      )?.upload;
      busy.value = true;
      try {
        const url = upload ? await upload(file) : URL.createObjectURL(file);
        current
          .chain()
          .focus()
          .setAttachment({
            fileName: extractFilename(file.name),
            fileSize: file.size,
            fileType: file.type,
            fileExt: extractFileExtension(file.name),
            url,
          })
          .run();
      } catch (error) {
        console.error('Error uploading file', error);
      } finally {
        busy.value = false;
      }
    }

    return () => [
      h(RichTextToolbarButton, {
        icon: Paperclip,
        tooltip: busy.value ? t('editor.attachment.uploading') : t('editor.attachment.tooltip'),
        disabled: !state.value.enabled || busy.value,
        onClick: () => input.value?.click(),
      }),
      h('input', {
        ref: input,
        type: 'file',
        hidden: true,
        onChange: (e: Event) => void onChange(e),
      }),
    ];
  },
});

/** A URL field; known services (YouTube, Bilibili, maps…) become their embed address. */
export const RichTextIframe = defineComponent({
  name: 'RichTextIframe',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const link = ref('');
    const state = useEditorState(
      (current) => ({ enabled: current.isEditable && hasCommand(current, 'setIframe') }),
      { enabled: false }
    );

    const submit = (close: () => void) => {
      const url = link.value.trim();
      if (!url || !editor.value) return;
      const embed = resolveEmbed(url);
      if (!embed) return;
      editor.value
        .chain()
        .focus()
        .setIframe({ src: embed.src, service: embed.service.key, height: embed.height })
        .run();
      close();
    };

    return () =>
      h(
        RichTextPopover,
        {
          icon: Frame,
          tooltip: t('editor.iframe.tooltip'),
          disabled: !state.value.enabled,
          width: '20rem',
          onOpen: () => {
            link.value = '';
          },
        },
        {
          default: ({ close }: { close: () => void }) =>
            h(
              'form',
              {
                class: 'richtext-flex richtext-flex-col richtext-gap-2',
                onSubmit: (event: Event) => {
                  event.preventDefault();
                  submit(close);
                },
              },
              [
                h('label', { class: 'richtext-vue-label' }, t('editor.link.dialog.link')),
                h('input', {
                  class: 'richtext-vue-field',
                  type: 'url',
                  required: true,
                  placeholder: 'https://www.youtube.com/watch?v=…',
                  value: link.value,
                  onInput: (event: Event) => {
                    link.value = (event.target as HTMLInputElement).value;
                  },
                }),
                h(
                  'button',
                  {
                    type: 'submit',
                    class: 'richtext-vue-button richtext-vue-button--primary richtext-self-end',
                    disabled: !link.value.trim(),
                  },
                  t('editor.link.dialog.button.apply')
                ),
              ]
            ),
        }
      );
  },
});

/* -------------------------------------------------------------------------- */
/* Callout                                                                     */
/* -------------------------------------------------------------------------- */

const CALLOUT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'];

/** Type, title and body for a new callout block. */
export const RichTextCallout = defineComponent({
  name: 'RichTextCallout',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const type = ref('note');
    const title = ref('');
    const body = ref('');
    const state = useEditorState(
      (current) => ({
        enabled: current.isEditable && hasCommand(current, 'setCallout'),
        active: current.isActive('callout'),
      }),
      { enabled: false, active: false }
    );

    const submit = (close: () => void) => {
      editor.value
        ?.chain()
        .focus()
        .setCallout({ type: type.value, title: title.value, body: body.value })
        .run();
      close();
    };

    const field = (label: string, node: ReturnType<typeof h>) =>
      h('div', [h('label', { class: 'richtext-vue-label' }, label), node]);

    return () =>
      h(
        RichTextPopover,
        {
          icon: Info,
          tooltip: t('editor.callout.tooltip'),
          active: state.value.active,
          disabled: !state.value.enabled,
          width: '20rem',
          onOpen: () => {
            type.value = 'note';
            title.value = '';
            body.value = '';
          },
        },
        {
          default: ({ close }: { close: () => void }) =>
            h(
              'form',
              {
                class: 'richtext-flex richtext-flex-col richtext-gap-2',
                onSubmit: (event: Event) => {
                  event.preventDefault();
                  submit(close);
                },
              },
              [
                field(
                  t('editor.callout.dialog.type'),
                  h(
                    'select',
                    {
                      class: 'richtext-vue-field',
                      value: type.value,
                      onChange: (event: Event) => {
                        type.value = (event.target as HTMLSelectElement).value;
                      },
                    },
                    CALLOUT_TYPES.map((value) =>
                      h(
                        'option',
                        { value, selected: value === type.value },
                        t(`editor.callout.type.${value}`)
                      )
                    )
                  )
                ),
                field(
                  t('editor.callout.dialog.title.label'),
                  h('input', {
                    class: 'richtext-vue-field',
                    type: 'text',
                    placeholder: t('editor.callout.dialog.title.placeholder'),
                    value: title.value,
                    onInput: (event: Event) => {
                      title.value = (event.target as HTMLInputElement).value;
                    },
                  })
                ),
                field(
                  t('editor.callout.dialog.body.label'),
                  h('textarea', {
                    class: 'richtext-vue-field',
                    rows: 3,
                    style: { fontFamily: 'inherit', fontSize: '13px' },
                    placeholder: t('editor.callout.dialog.body.placeholder'),
                    value: body.value,
                    onInput: (event: Event) => {
                      body.value = (event.target as HTMLTextAreaElement).value;
                    },
                  })
                ),
                h('div', { class: 'richtext-flex richtext-justify-end richtext-gap-2' }, [
                  h(
                    'button',
                    { type: 'button', class: 'richtext-vue-button', onClick: close },
                    t('editor.callout.dialog.button.cancel')
                  ),
                  h(
                    'button',
                    { type: 'submit', class: 'richtext-vue-button richtext-vue-button--primary' },
                    t('editor.callout.dialog.button.apply')
                  ),
                ]),
              ]
            ),
        }
      );
  },
});
