/* oxlint-disable react-hooks/rules-of-hooks -- Vue composables, not React hooks */
import { VueRenderer, type Editor as VueEditor } from '@tiptap/vue-3';
import {
  ArrowUp,
  Briefcase,
  Check,
  Heading1,
  Languages,
  List,
  ListOrdered,
  ListTodo,
  ListTree,
  Maximize2,
  MessageCircleQuestionMark,
  Minimize2,
  PanelBottomOpen,
  Paperclip,
  PenLine,
  RotateCcw,
  Smile,
  Sparkles,
  SpellCheck,
  Square,
  Table as TableIcon,
  Text,
  Undo2,
  Volume2,
  WandSparkles,
  X,
  ChevronDown,
} from 'lucide-vue-next';
import {
  computed,
  defineComponent,
  h,
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type Component,
  type PropType,
  type VNodeChild,
} from 'vue';

import { AICore } from '@/extensions/AI/AICore';
import { attachmentAccept, canAttach, filesOf, readAttachments } from '@/extensions/AI/attachments';
import { generateAIText } from '@/extensions/AI/client';
import {
  AI_COMPOSER_ACTIONS,
  browserLanguage,
  composerPrompt,
  fitChips,
  type AIComposerAction,
} from '@/extensions/AI/composer';
import { markdownToPreviewHTML } from '@/extensions/AI/markdown';
import { aiPluginKey } from '@/extensions/AI/state';
import { aiOptionsOf, writeWithAI, type WriteWithAIResult } from '@/extensions/AI/writer';
import { getShortcutKeys } from '@/utils/plateform';

import { useEditorInstance, useEditorState, useLocale } from './context';
import { RichTextToolbarButton, useDismiss } from './ui';

import type {
  AIAttachment,
  AIMessage,
  AIOptions,
  AIPanelComponentProps,
  AIResultContext,
  AIWriteTarget,
} from '@/extensions/AI/types';
import type { Editor, Range } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

// The framework-free pieces a Vue app needs alongside the components.
export type {
  AIOptions,
  AIProtocol,
  AIMessage,
  AIRequest,
  AIResultContext,
  AIPanelComponentProps,
  AIWriteTarget,
  AIAttachment,
} from '@/extensions/AI/types';
export {
  markdownToFragment,
  markdownToHTML,
  markdownToPreviewHTML,
  markdownToSlice,
} from '@/extensions/AI/markdown';
export { aiPluginKey } from '@/extensions/AI/state';
export type { AIState, AISession, AIWriting } from '@/extensions/AI/state';
export { AICore, DEFAULT_AI_SYSTEM_PROMPT } from '@/extensions/AI/AICore';
export {
  writeWithAI,
  aiOptionsOf,
  resolveWriteTarget,
  documentContext,
  rangeMarkdown,
} from '@/extensions/AI/writer';
export type { WriteWithAIOptions, WriteWithAIResult } from '@/extensions/AI/writer';
export { AI_COMPOSER_ACTIONS, composerPrompt, browserLanguage } from '@/extensions/AI/composer';
export type { AIComposerAction } from '@/extensions/AI/composer';
export { AIAutocomplete, aiAutocompleteKey } from '@/extensions/AI/Autocomplete';
export type {
  AIAutocompleteOptions,
  AIAutocompleteState,
  AISuggestion,
} from '@/extensions/AI/Autocomplete';
export { generateAIText } from '@/extensions/AI/client';

/* -------------------------------------------------------------------------- */
/* The panel                                                                   */
/* -------------------------------------------------------------------------- */

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${Math.round(bytes / (1024 * 1024))} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/** Options of the Vue `AI` extension: the core options plus Vue rendering hooks. */
export interface AIVueOptions extends AIOptions {
  /**
   * Replace how the answer is shown in the panel. Receives the markdown so
   * far, the HTML the editor would produce from it, and whether more is
   * coming. The default renders `html` with the document's own styles.
   */
  renderResult?: (context: AIResultContext) => VNodeChild;
  /** Replace UI pieces wholesale. `Panel` takes over the entire AI dialog. */
  components?: {
    Panel?: Component;
  };
}

const panelProps = {
  editor: { type: Object as PropType<Editor>, required: true },
  options: { type: Object as PropType<AIOptions>, required: true },
  /** Text the user had selected when the panel opened. */
  selectedText: { type: String, default: '' },
  /** Prompt preselected from a menu entry, if any. */
  initialPrompt: { type: String, default: undefined },
  /** Insert `markdown` in place of the selection and close. */
  apply: { type: Function as PropType<(markdown: string) => void>, required: true },
  close: { type: Function as PropType<() => void>, required: true },
} as const;

/**
 * The AI dialog: prompt, attachments, and the answer rendered as the document
 * would show it. Text streams in from the provider and is re-rendered through
 * the editor schema as it arrives, so a table or a code block takes its final
 * shape while still being written. Same DOM and classes as the React panel.
 */
export const AIPanel = defineComponent({
  name: 'AIPanel',
  props: panelProps,
  setup(props) {
    const { t } = useLocale();
    const prompt = ref(props.initialPrompt || '');
    const attachments = ref<AIAttachment[]>([]);
    const result = ref('');
    const streaming = ref(false);
    const busy = ref(false);
    const error = ref('');
    const input = ref<HTMLTextAreaElement | null>(null);
    const stopButton = ref<HTMLButtonElement | null>(null);
    const filePicker = ref<HTMLInputElement | null>(null);
    // Chunks arrive faster than the preview should re-render; batched per frame.
    let pending = '';
    let frame = 0;
    let controller: AbortController | null = null;
    let history: AIMessage[] = [];
    let lastRequest: AIMessage[] = [];

    const previewHtml = computed(() => {
      if (!result.value) return '';
      try {
        return markdownToPreviewHTML(props.editor, result.value);
      } catch {
        return '';
      }
    });

    const imageInput = props.options.enableImageInput !== false;
    const fileInput = props.options.enableFileInput !== false;
    const canAttach = imageInput || fileInput;
    const acceptedMimes = [
      ...(imageInput ? (props.options.imageMimes ?? []) : []),
      ...(fileInput ? (props.options.fileMimes ?? []) : []),
    ];

    onMounted(() => {
      // Slash command restores editor focus after its action completes.
      const start = requestAnimationFrame(() => {
        input.value?.focus();
        if (props.initialPrompt) void submit(false, props.initialPrompt);
      });
      onBeforeUnmount(() => cancelAnimationFrame(start));
    });
    onBeforeUnmount(() => {
      controller?.abort();
      cancelAnimationFrame(frame);
    });
    watch([busy, result], ([isBusy, text]) => {
      void nextTick(() => {
        if (isBusy && !text) stopButton.value?.focus();
        else if (!isBusy) input.value?.focus();
      });
    });

    function flushChunks() {
      frame = 0;
      if (!pending) return;
      result.value += pending;
      pending = '';
    }

    function onChunk(text: string) {
      pending += text;
      if (!frame) frame = requestAnimationFrame(flushChunks);
    }

    async function addFiles(files: File[]) {
      const maxSize = props.options.maxAttachmentSize ?? 4 * 1024 * 1024;
      const next: AIAttachment[] = [];

      for (const file of files) {
        const isImage = imageInput && file.type.startsWith('image/');
        const isFile = fileInput && (props.options.fileMimes ?? []).includes(file.type);

        if (!isImage && !isFile) {
          error.value = t('editor.ai.error.fileType', { name: file.name });
          continue;
        }
        if (file.size > maxSize) {
          error.value = t('editor.ai.error.fileTooBig', {
            name: file.name,
            size: formatSize(maxSize),
          });
          continue;
        }
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          mediaType: file.type,
          dataUrl: await readAsDataUrl(file),
          kind: isImage ? 'image' : 'file',
          text: isImage ? undefined : await file.text(),
        });
      }

      if (next.length) {
        const current = attachments.value;
        attachments.value = [
          ...current,
          ...next.filter((item) => !current.some((existing) => existing.id === item.id)),
        ];
      }
    }

    async function submit(retry = false, instruction = prompt.value) {
      if (busy.value || controller || (!retry && !instruction.trim() && !attachments.value.length))
        return;
      const messages: AIMessage[] = retry
        ? lastRequest
        : [
            ...history,
            {
              role: 'user',
              content: [
                history.length === 0 && props.selectedText
                  ? `Selected text:\n${props.selectedText}`
                  : '',
                instruction.trim(),
              ]
                .filter(Boolean)
                .join('\n\n'),
              attachments: attachments.value.length ? attachments.value : undefined,
            },
          ];
      if (!messages.length) return;
      lastRequest = messages;
      const active = new AbortController();
      controller = active;
      busy.value = true;
      streaming.value = true;
      error.value = '';
      // A new answer replaces the previous one from its first chunk.
      let started = false;
      const streamed = (text: string) => {
        if (active.signal.aborted) return;
        if (!started) {
          started = true;
          pending = '';
          result.value = '';
        }
        onChunk(text);
      };
      try {
        const text = await generateAIText(
          props.options,
          { messages, systemPrompt: props.options.systemPrompt, signal: active.signal },
          streamed
        );
        if (active.signal.aborted) return;
        if (!text.trim()) throw new Error(t('editor.ai.error.empty'));
        history = [...messages, { role: 'assistant', content: text }];
        cancelAnimationFrame(frame);
        frame = 0;
        pending = '';
        result.value = text;
        prompt.value = '';
        attachments.value = [];
      } catch (cause) {
        if (!active.signal.aborted)
          error.value = cause instanceof Error ? cause.message : t('editor.ai.error.generic');
      } finally {
        if (controller === active) {
          controller = null;
          busy.value = false;
          streaming.value = false;
          input.value?.focus();
        }
      }
    }

    function stop() {
      controller?.abort();
      controller = null;
      // Whatever arrived is kept; a partial answer is still worth reviewing.
      flushChunks();
      busy.value = false;
      streaming.value = false;
      input.value?.focus();
    }

    const renderResult = (props.options as AIVueOptions).renderResult;

    return () => {
      const hasResult = !!result.value;
      const working = busy.value;

      const preview = renderResult
        ? renderResult({
            markdown: result.value,
            html: previewHtml.value,
            streaming: streaming.value,
          })
        : h('div', {
            class: [
              'richtext-ai-rendered ProseMirror',
              streaming.value ? 'richtext-ai-streaming' : '',
            ],
            innerHTML: previewHtml.value,
          });

      const textarea = h('textarea', {
        ref: input,
        'aria-label': hasResult ? t('editor.ai.refine.label') : t('editor.ai.prompt.label'),
        placeholder: hasResult
          ? t('editor.ai.refine.placeholder')
          : t('editor.ai.prompt.placeholder'),
        value: prompt.value,
        disabled: working,
        rows: hasResult ? 1 : 3,
        onInput: (event: Event) => {
          prompt.value = (event.target as HTMLTextAreaElement).value;
        },
        onKeydown: (event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            void submit();
          }
        },
      });

      const form = h(
        'form',
        {
          class: ['richtext-ai-panel', hasResult ? 'richtext-ai-review' : ''],
          onSubmit: (event: Event) => {
            event.preventDefault();
            void submit();
          },
        },
        [
          !hasResult
            ? h('div', { class: 'richtext-ai-heading' }, [
                h('span', [h(Sparkles, { size: 16 }), ` ${t('editor.ai.title')}`]),
                h(
                  'button',
                  { type: 'button', 'aria-label': t('editor.ai.close'), onClick: props.close },
                  [h(X, { size: 16 })]
                ),
              ])
            : null,

          attachments.value.length
            ? h(
                'ul',
                { class: 'richtext-ai-attachments' },
                attachments.value.map((attachment) =>
                  h('li', { key: attachment.id }, [
                    attachment.kind === 'image'
                      ? h('img', { alt: '', src: attachment.dataUrl })
                      : h(Paperclip, { size: 13 }),
                    h('span', { title: attachment.name }, attachment.name),
                    h(
                      'button',
                      {
                        type: 'button',
                        'aria-label': t('editor.ai.attach.remove', { name: attachment.name }),
                        onClick: () => {
                          attachments.value = attachments.value.filter(
                            (item) => item.id !== attachment.id
                          );
                        },
                      },
                      [h(X, { size: 12 })]
                    ),
                  ])
                )
              )
            : null,

          h('div', { class: 'richtext-ai-prompt-row' }, [
            hasResult ? h(Sparkles, { class: 'richtext-ai-prompt-icon', size: 17 }) : null,
            textarea,
            hasResult
              ? h(
                  'button',
                  {
                    // In the review layout the send button doubles as Stop while streaming.
                    type: working ? 'button' : 'submit',
                    class: 'richtext-ai-send',
                    'aria-label': working ? t('editor.ai.stop') : t('editor.ai.send'),
                    disabled: !working && !prompt.value.trim(),
                    onClick: working ? stop : undefined,
                  },
                  [working ? h(Square, { size: 16 }) : h(ArrowUp, { size: 20 })]
                )
              : null,
          ]),

          !hasResult
            ? h('div', { class: 'richtext-ai-compose-actions' }, [
                canAttach
                  ? [
                      h(
                        'button',
                        {
                          type: 'button',
                          class: 'richtext-ai-attach',
                          'aria-label': t('editor.ai.attach'),
                          title: t('editor.ai.attach'),
                          disabled: working,
                          onClick: () => filePicker.value?.click(),
                        },
                        [h(Paperclip, { size: 16 })]
                      ),
                      h('input', {
                        ref: filePicker,
                        type: 'file',
                        hidden: true,
                        multiple: true,
                        accept: acceptedMimes.join(','),
                        onChange: (event: Event) => {
                          const target = event.target as HTMLInputElement;
                          void addFiles(Array.from(target.files ?? []));
                          target.value = '';
                        },
                      }),
                    ]
                  : null,
                // The error sits on this row rather than on a line of its own.
                h('span', { class: 'richtext-ai-error', role: 'alert' }, error.value),
                working
                  ? h(
                      'button',
                      { type: 'button', 'aria-label': t('editor.ai.stop'), onClick: stop },
                      [h(Square, { size: 16 })]
                    )
                  : h(
                      'button',
                      {
                        type: 'submit',
                        class: 'richtext-ai-send',
                        'aria-label': t('editor.ai.send'),
                        disabled: !prompt.value.trim() && !attachments.value.length,
                      },
                      [h(ArrowUp, { size: 20 })]
                    ),
              ])
            : null,

          hasResult && error.value
            ? h(
                'p',
                { class: 'richtext-ai-error richtext-ai-error-block', role: 'alert' },
                error.value
              )
            : null,

          // Only a result is worth keeping or discarding; an error just needs a retry.
          hasResult
            ? h('div', { class: 'richtext-ai-actions' }, [
                h(
                  'button',
                  { type: 'button', disabled: working, onClick: () => void submit(true) },
                  [h(RotateCcw, { size: 16 }), ` ${t('editor.ai.retry')}`]
                ),
                h('div', [
                  h('button', { type: 'button', onClick: props.close }, [
                    h(X, { size: 16 }),
                    ` ${t('editor.ai.discard')}`,
                  ]),
                  h(
                    'button',
                    {
                      type: 'button',
                      class: 'richtext-ai-apply',
                      disabled: working,
                      onClick: () => props.apply(result.value),
                    },
                    [h(Check, { size: 17 }), ` ${t('editor.ai.apply')}`]
                  ),
                ]),
              ])
            : null,
        ]
      );

      return h(
        'div',
        {
          class: 'richtext-ai',
          'data-richtext-portal': '',
          role: 'dialog',
          'aria-label': t('editor.ai.title'),
          onKeydown: (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              props.close();
            }
            event.stopPropagation();
          },
        },
        [
          hasResult
            ? h(
                'div',
                {
                  class: 'richtext-ai-preview',
                  'aria-label': t('editor.ai.preview'),
                  'aria-busy': streaming.value,
                },
                [preview]
              )
            : null,
          working && !hasResult
            ? h('div', { class: 'richtext-ai-loading' }, [
                h(
                  'span',
                  { class: 'richtext-ai-loading-label', role: 'status' },
                  t('editor.ai.writing')
                ),
                h('span', { class: 'richtext-ai-loading-dots', 'aria-hidden': 'true' }, [
                  h('i'),
                  h('i'),
                  h('i'),
                ]),
                h(
                  'button',
                  {
                    ref: stopButton,
                    type: 'button',
                    class: 'richtext-ai-loading-stop',
                    'aria-label': t('editor.ai.stop'),
                    title: t('editor.ai.stop'),
                    onClick: stop,
                  },
                  [h(Square, { size: 10, fill: 'currentColor' })]
                ),
              ])
            : form,
        ]
      );
    };
  },
});

function mountVuePanel(mount: HTMLElement, props: AIPanelComponentProps): () => void {
  const Panel = (props.options as AIVueOptions).components?.Panel ?? AIPanel;
  const renderer = new VueRenderer(Panel, {
    editor: props.editor as VueEditor,
    // The editor is a class instance full of internals; never make it reactive.
    props: { ...props, editor: markRaw(props.editor) },
  });
  const element = renderer.element;
  if (element) mount.appendChild(element);
  return () => {
    renderer.destroy();
    element?.remove();
  };
}

/**
 * The AI extension for Vue: `AICore` with the Vue panel. Register it once;
 * `RichTextAIImprove` (selection menu), `RichTextAIComposer` (the dock under
 * the editor) and `RichTextAI` (the toolbar button) all find it by name.
 */
export const AI = /* @__PURE__ */ AICore.extend<AIVueOptions>({
  addOptions() {
    const parent = this.parent?.() as AIVueOptions;
    return {
      ...parent,
      mountPanel: mountVuePanel,
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Toolbar button                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The toolbar's AI button: one click opens the composer dock under the editor
 * (`RichTextAIComposer`). `Mod-J` does the same. Renders nothing without the
 * AI extension.
 */
export const RichTextAI = defineComponent({
  name: 'RichTextAI',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const state = useEditorState(
      (current) => ({
        available: aiOptionsOf(current)?.composer !== false && !!aiOptionsOf(current),
        open: aiPluginKey.getState(current.state)?.composer ?? false,
        enabled: current.isEditable,
      }),
      { available: false, open: false, enabled: false }
    );

    return () =>
      state.value.available
        ? h(RichTextToolbarButton, {
            icon: Sparkles,
            label: t('editor.ai.compose.trigger'),
            tooltip: `${t('editor.ai.compose.title')} (${getShortcutKeys(['mod', 'J'])})`,
            active: state.value.open,
            disabled: !state.value.enabled,
            class: 'richtext-ai-trigger',
            onClick: () => editor.value?.commands.toggleAIComposer(),
          })
        : null;
  },
});

/* -------------------------------------------------------------------------- */
/* Composer dock                                                               */
/* -------------------------------------------------------------------------- */

const COMPOSER_ICONS: Record<string, Component> = {
  PenLine,
  ListTree,
  ListOrdered,
  Heading1,
  ListTodo,
  SpellCheck,
  Languages,
};

type ComposerTarget = 'selection' | 'cursor' | 'start' | 'end' | 'document';
const COMPOSER_TARGETS: ComposerTarget[] = ['selection', 'cursor', 'start', 'end', 'document'];

/**
 * The composer dock: a prompt bar that sits under the editor and writes
 * straight into the document. Type what you want (or pick a chip), watch the
 * answer stream into the page above as real blocks, then keep it, undo it or
 * ask for a change. Place it after `EditorContent` inside `RichTextProvider`.
 */
export const RichTextAIComposer = defineComponent({
  name: 'RichTextAIComposer',
  props: {
    /** Quick actions shown as chips. Defaults to `AI_COMPOSER_ACTIONS`; `[]` hides the row. */
    actions: { type: Array as PropType<AIComposerAction[]>, default: () => AI_COMPOSER_ACTIONS },
    /** Start open. Otherwise the `RichTextAI` button, `Mod-J` or `toggleAIComposer()` opens it. */
    defaultOpen: { type: Boolean, default: false },
    /** Placeholder of the prompt box before an answer exists. */
    placeholder: { type: String, default: '' },
    /** Visible lines of the prompt box. */
    rows: { type: Number, default: 2 },
    /** Show the "where the text goes" selector. */
    showTarget: { type: Boolean, default: true },
    /** The footer line: `false` hides it, a string replaces it. */
    hint: { type: [Boolean, String] as PropType<boolean | string>, default: true },
    /** The gradient border and background wash; `false` gives a flat dock. */
    gradient: { type: Boolean, default: true },
    /** Accent colour (any CSS colour). */
    accent: { type: String, default: '' },
  },
  setup(props) {
    const editor = useEditorInstance();
    const { t, lang } = useLocale();
    const state = useEditorState(
      (current) => ({
        available: aiOptionsOf(current)?.composer !== false && !!aiOptionsOf(current),
        open: aiPluginKey.getState(current.state)?.composer ?? false,
        hasSelection: !current.state.selection.empty,
        empty: current.state.doc.textContent.trim().length === 0,
        editable: current.isEditable,
      }),
      { available: false, open: false, hasSelection: false, empty: true, editable: false }
    );
    const prompt = ref('');
    const target = ref<ComposerTarget>('selection');
    const busy = ref(false);
    const error = ref('');
    const result = shallowRef<WriteWithAIResult | null>(null);
    const input = ref<HTMLTextAreaElement | null>(null);
    let controller: AbortController | null = null;
    let lastRequest: {
      prompt: string;
      target: AIWriteTarget;
      attachments: AIAttachment[];
      /** The composer action the request came from, when it came from a chip. */
      actionKey?: string;
    } | null = null;
    // Images and text files go with the prompt, like in the AI panel: picked,
    // dropped onto the box or pasted into the prompt.
    const attachments = ref<AIAttachment[]>([]);
    const dragging = ref(false);
    const filePicker = ref<HTMLInputElement | null>(null);
    const attachable = () => {
      const options = editor.value ? aiOptionsOf(editor.value) : null;
      return !!options && canAttach(options);
    };
    async function addFiles(files: File[]) {
      const options = editor.value ? aiOptionsOf(editor.value) : null;
      if (!files.length || !options || !canAttach(options)) return;
      const { attachments: next, error: problem } = await readAttachments(
        files,
        options,
        attachments.value
      );
      if (problem) error.value = problem;
      if (next.length) attachments.value = [...attachments.value, ...next];
    }
    // The chips stay on one line; the ones that do not fit go behind a "more" button.
    const chipRow = ref<HTMLElement | null>(null);
    const visibleChips = ref(Infinity);
    const moreOpen = ref(false);
    const moreMenu = ref<HTMLElement | null>(null);
    let observer: ResizeObserver | null = null;
    const measure = () => {
      if (chipRow.value) visibleChips.value = fitChips(chipRow.value);
    };
    // Labels change width when the language changes; the row does not.
    watch(lang, () => void nextTick(measure));
    watch(chipRow, (row) => {
      observer?.disconnect();
      observer = null;
      if (!row) return;
      measure();
      observer = new ResizeObserver(measure);
      observer.observe(row);
    });
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (!moreMenu.value?.contains(event.target as Node)) moreOpen.value = false;
    };
    watch(moreOpen, (open) => {
      if (open) document.addEventListener('pointerdown', onDocumentPointerDown, true);
      else document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    });
    onBeforeUnmount(() => {
      observer?.disconnect();
      document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    });

    watch(
      editor,
      (current) => {
        if (current && props.defaultOpen) current.commands.toggleAIComposer(true);
      },
      { immediate: true }
    );
    watch(
      () => state.value.open,
      (open) => {
        if (open) void nextTick(() => input.value?.focus());
      }
    );
    onBeforeUnmount(() => controller?.abort());

    async function run(
      instruction: string,
      where: AIWriteTarget,
      refineFrom?: WriteWithAIResult | null,
      files: AIAttachment[] = attachments.value,
      actionKey?: string
    ) {
      const current = editor.value;
      if (!current || busy.value || !instruction.trim()) return;
      // A refinement or retry rewrites the same span, so the previous answer
      // goes first and the conversation continues from it.
      let range: Range | null = null;
      if (refineFrom) range = refineFrom.discard();
      else result.value?.keep();
      result.value = null;
      const active = new AbortController();
      controller = active;
      busy.value = true;
      error.value = '';
      try {
        const next = await writeWithAI(current, {
          prompt: instruction,
          target: range ?? where,
          history: refineFrom?.messages,
          attachments: files,
          signal: active.signal,
        });
        if (!refineFrom)
          lastRequest = { prompt: instruction, target: where, attachments: files, actionKey };
        // A chip's answer is offered to the host first: `true` means it took
        // the answer somewhere else (a title field, say), so the document gets
        // its original content back and nothing is left to keep or undo.
        if (actionKey) {
          const handled = await aiOptionsOf(current)?.onComposeResult?.({
            action: actionKey,
            markdown: next.markdown,
            target: where,
            editor: current,
            result: next,
          });
          if (handled === true) {
            next.discard();
            prompt.value = '';
            attachments.value = [];
            return;
          }
        }
        result.value = next;
        prompt.value = '';
        attachments.value = [];
      } catch (cause) {
        if (!active.signal.aborted)
          error.value = cause instanceof Error ? cause.message : t('editor.ai.error.generic');
      } finally {
        if (controller === active) {
          controller = null;
          busy.value = false;
          input.value?.focus();
        }
      }
    }

    // "Replace selection" only exists while something is selected; without a
    // selection the same choice means "at the caret".
    const effectiveTarget = (): ComposerTarget =>
      target.value === 'selection' && !state.value.hasSelection ? 'cursor' : target.value;

    function submit() {
      const instruction = prompt.value.trim();
      if (!instruction) return;
      if (result.value) void run(instruction, result.value, result.value);
      else void run(instruction, effectiveTarget());
    }

    function stop() {
      controller?.abort();
    }

    function close() {
      stop();
      result.value?.keep();
      result.value = null;
      editor.value?.commands.toggleAIComposer(false);
      editor.value?.commands.focus();
    }

    return () => {
      const current = state.value;
      if (!current.available || !current.open) return null;
      const chips = props.actions.filter(
        (action) =>
          (!action.needsSelection || current.hasSelection) &&
          (!action.needsDocument || !current.empty)
      );
      const answer = result.value;
      const hasAutocomplete = !!editor.value?.extensionManager.extensions.some(
        (extension) => extension.name === 'aiAutocomplete'
      );
      const hintText =
        typeof props.hint === 'string'
          ? props.hint
          : hasAutocomplete
            ? t('editor.ai.compose.hint')
            : t('editor.ai.compose.hint.space');

      const chip = (action: AIComposerAction, index: number) => {
        const Icon = COMPOSER_ICONS[action.icon];
        const hidden = index >= visibleChips.value;
        return h(
          'button',
          {
            key: action.key,
            type: 'button',
            'data-chip': '',
            class: hidden ? 'richtext-ai-chip-hidden' : undefined,
            'aria-hidden': hidden ? 'true' : undefined,
            tabindex: hidden ? -1 : undefined,
            title: composerPrompt(action),
            disabled: !current.editable,
            onClick: () =>
              void run(
                composerPrompt(action),
                action.target,
                undefined,
                attachments.value,
                action.key
              ),
          },
          [Icon ? h(Icon, { size: 14 }) : null, t(action.key)]
        );
      };

      // Head: quick actions while idle, progress while writing, the verdict
      // after an answer — and the close button, always at the end.
      const head = busy.value
        ? h('span', { role: 'status', class: 'richtext-ai-composer-writing' }, [
            h('span', { class: 'richtext-ai-loading-dots', 'aria-hidden': 'true' }, [
              h('i'),
              h('i'),
              h('i'),
            ]),
            t('editor.ai.compose.writing'),
          ])
        : answer
          ? h('div', { class: 'richtext-ai-composer-actions' }, [
              h(
                'button',
                {
                  type: 'button',
                  class: 'richtext-ai-composer-keep',
                  onClick: () => {
                    answer.keep();
                    result.value = null;
                    editor.value?.commands.focus();
                  },
                },
                [h(Check, { size: 15 }), ` ${t('editor.ai.compose.keep')}`]
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => {
                    answer.discard();
                    result.value = null;
                    editor.value?.commands.focus();
                  },
                },
                [h(Undo2, { size: 15 }), ` ${t('editor.ai.compose.undo')}`]
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => {
                    if (lastRequest)
                      void run(
                        lastRequest.prompt,
                        lastRequest.target,
                        answer,
                        lastRequest.attachments,
                        lastRequest.actionKey
                      );
                  },
                },
                [h(RotateCcw, { size: 15 }), ` ${t('editor.ai.compose.retry')}`]
              ),
            ])
          : chips.length
            ? h('div', { class: 'richtext-ai-composer-chipline', ref: chipRow }, [
                h('div', { class: 'richtext-ai-composer-chips', role: 'group' }, chips.map(chip)),
                visibleChips.value < chips.length
                  ? h('div', { class: 'richtext-ai-composer-more', ref: moreMenu }, [
                      h(
                        'button',
                        {
                          type: 'button',
                          'aria-haspopup': 'menu',
                          'aria-expanded': moreOpen.value ? 'true' : 'false',
                          'aria-label': t('editor.more'),
                          title: t('editor.more'),
                          disabled: !current.editable,
                          onClick: () => {
                            moreOpen.value = !moreOpen.value;
                          },
                        },
                        [`+${chips.length - visibleChips.value}`, h(ChevronDown, { size: 13 })]
                      ),
                      moreOpen.value
                        ? h(
                            'div',
                            { class: 'richtext-ai-composer-menu', role: 'menu' },
                            chips.slice(visibleChips.value).map((action) => {
                              const Icon = COMPOSER_ICONS[action.icon];
                              return h(
                                'button',
                                {
                                  key: action.key,
                                  type: 'button',
                                  role: 'menuitem',
                                  title: composerPrompt(action),
                                  onClick: () => {
                                    moreOpen.value = false;
                                    void run(
                                      composerPrompt(action),
                                      action.target,
                                      undefined,
                                      attachments.value,
                                      action.key
                                    );
                                  },
                                },
                                [Icon ? h(Icon, { size: 14 }) : null, t(action.key)]
                              );
                            })
                          )
                        : null,
                    ])
                  : null,
              ])
            : h('span', { class: 'richtext-ai-composer-title' }, [
                h(Sparkles, { size: 14 }),
                ` ${t('editor.ai.compose.title')}`,
              ]);

      return h(
        'div',
        {
          class: ['richtext-ai-composer', { 'richtext-ai-composer--plain': !props.gradient }],
          style: props.accent ? { '--ai-accent': props.accent } : undefined,
          'data-richtext-portal': '',
          role: 'region',
          'aria-label': t('editor.ai.compose.title'),
          onKeydown: (event: KeyboardEvent) => {
            if (event.key === 'Escape' || ((event.metaKey || event.ctrlKey) && event.key === 'j')) {
              event.preventDefault();
              close();
            }
          },
        },
        [
          h('div', { class: 'richtext-ai-composer-head' }, [
            head,
            h(
              'button',
              {
                type: 'button',
                class: 'richtext-ai-composer-close',
                'aria-label': t('editor.ai.compose.close'),
                title: t('editor.ai.compose.close'),
                onClick: close,
              },
              [h(X, { size: 16 })]
            ),
          ]),

          // The box: prompt on top, the controls in a bar underneath.
          h(
            'form',
            {
              class: [
                'richtext-ai-composer-box',
                dragging.value ? 'richtext-ai-composer-box--dragging' : '',
              ],
              onSubmit: (event: Event) => {
                event.preventDefault();
                submit();
              },
              onDragover: (event: DragEvent) => {
                if (!attachable() || busy.value) return;
                event.preventDefault();
                dragging.value = true;
              },
              onDragleave: () => {
                dragging.value = false;
              },
              onDrop: (event: DragEvent) => {
                dragging.value = false;
                if (!attachable() || busy.value) return;
                event.preventDefault();
                void addFiles(filesOf(event.dataTransfer));
              },
            },
            [
              h('div', { class: 'richtext-ai-composer-input' }, [
                h(Sparkles, { class: 'richtext-ai-composer-icon', size: 18 }),
                h('textarea', {
                  ref: input,
                  rows: props.rows,
                  style: { minHeight: `calc(${props.rows} * 1.5em)` },
                  'aria-label': answer
                    ? t('editor.ai.compose.refine')
                    : props.placeholder || t('editor.ai.compose.placeholder'),
                  placeholder: answer
                    ? t('editor.ai.compose.refine')
                    : props.placeholder || t('editor.ai.compose.placeholder'),
                  value: prompt.value,
                  disabled: busy.value || !current.editable,
                  onInput: (event: Event) => {
                    prompt.value = (event.target as HTMLTextAreaElement).value;
                  },
                  onPaste: (event: ClipboardEvent) => {
                    const files = filesOf(event.clipboardData);
                    if (files.length && attachable()) {
                      event.preventDefault();
                      void addFiles(files);
                    }
                  },
                  onKeydown: (event: KeyboardEvent) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
                      event.preventDefault();
                      submit();
                    }
                  },
                }),
              ]),
              attachments.value.length
                ? h(
                    'ul',
                    { class: 'richtext-ai-attachments richtext-ai-composer-attachments' },
                    attachments.value.map((attachment) =>
                      h('li', { key: attachment.id }, [
                        attachment.kind === 'image'
                          ? h('img', { alt: '', src: attachment.dataUrl })
                          : h(Paperclip, { size: 13 }),
                        h('span', { title: attachment.name }, attachment.name),
                        h(
                          'button',
                          {
                            type: 'button',
                            'aria-label': t('editor.ai.attach.remove', { name: attachment.name }),
                            onClick: () => {
                              attachments.value = attachments.value.filter(
                                (item) => item.id !== attachment.id
                              );
                            },
                          },
                          [h(X, { size: 12 })]
                        ),
                      ])
                    )
                  )
                : null,
              h('div', { class: 'richtext-ai-composer-bar' }, [
                h('span', { class: 'richtext-ai-composer-tools' }, [
                  !answer && props.showTarget
                    ? // A pill that fits its label: the native <select> sits invisibly on
                      // top for the dropdown and keyboard, the label and chevron below it.
                      h('span', { class: 'richtext-ai-composer-target' }, [
                        h('span', t(`editor.ai.compose.target.${effectiveTarget()}`)),
                        h(ChevronDown, { size: 13, 'aria-hidden': 'true' }),
                        h(
                          'select',
                          {
                            'aria-label': t('editor.ai.compose.target'),
                            value: effectiveTarget(),
                            disabled: busy.value,
                            onChange: (event: Event) => {
                              target.value = (event.target as HTMLSelectElement)
                                .value as ComposerTarget;
                            },
                          },
                          COMPOSER_TARGETS.filter(
                            (value) => value !== 'selection' || current.hasSelection
                          ).map((value) =>
                            h(
                              'option',
                              { key: value, value, selected: value === effectiveTarget() },
                              t(`editor.ai.compose.target.${value}`)
                            )
                          )
                        ),
                      ])
                    : null,
                  attachable()
                    ? h(
                        'button',
                        {
                          type: 'button',
                          class: 'richtext-ai-attach',
                          'aria-label': t('editor.ai.attach'),
                          title: t('editor.ai.attach'),
                          disabled: busy.value || !current.editable,
                          onClick: () => filePicker.value?.click(),
                        },
                        [h(Paperclip, { size: 16 })]
                      )
                    : null,
                  attachable()
                    ? h('input', {
                        ref: filePicker,
                        type: 'file',
                        hidden: true,
                        multiple: true,
                        accept: attachmentAccept(aiOptionsOf(editor.value!)!),
                        onChange: (event: Event) => {
                          const picker = event.target as HTMLInputElement;
                          void addFiles(Array.from(picker.files ?? []));
                          picker.value = '';
                        },
                      })
                    : null,
                ]),
                busy.value
                  ? h(
                      'button',
                      {
                        type: 'button',
                        class: 'richtext-ai-composer-send',
                        'aria-label': t('editor.ai.stop'),
                        title: t('editor.ai.stop'),
                        onClick: stop,
                      },
                      [h(Square, { size: 14, fill: 'currentColor' })]
                    )
                  : h(
                      'button',
                      {
                        type: 'submit',
                        class: 'richtext-ai-composer-send',
                        'aria-label': t('editor.ai.send'),
                        title: t('editor.ai.send'),
                        disabled: !prompt.value.trim() || !current.editable,
                      },
                      [h(ArrowUp, { size: 18 })]
                    ),
              ]),
            ]
          ),

          error.value
            ? h('div', { class: 'richtext-ai-composer-foot' }, [
                h('span', { role: 'alert', class: 'richtext-ai-composer-error' }, error.value),
              ])
            : props.hint && !answer && !busy.value
              ? h('div', { class: 'richtext-ai-composer-foot' }, [
                  h('span', { class: 'richtext-ai-composer-hint' }, hintText),
                ])
              : null,
        ]
      );
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Selection menu                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Actions that rewrite the selection in place, in the order Notion, Craft and
 * Coda all settle on: fix, improve, resize, simplify. Prompts are identical to
 * the React menu's.
 */
const EDIT_ACTIONS = [
  {
    key: 'editor.ai.menu.improve',
    icon: WandSparkles,
    prompt:
      'Rewrite the selected text so it reads clearly and naturally. Preserve all facts, meaning, and the original language. Return only the rewritten text.',
  },
  {
    key: 'editor.ai.menu.grammar',
    icon: SpellCheck,
    prompt:
      'Correct spelling and grammar in the selected text. Preserve its meaning, language, and tone. Return only the corrected text.',
  },
  {
    key: 'editor.ai.menu.shorter',
    icon: Minimize2,
    prompt:
      'Make the selected text more concise while preserving its key information and original language. Return only the shortened text.',
  },
  {
    key: 'editor.ai.menu.longer',
    icon: Maximize2,
    prompt:
      'Expand the selected text with relevant detail, without inventing facts. Preserve its meaning and original language. Return only the expanded text.',
  },
  {
    key: 'editor.ai.menu.simplify',
    icon: Text,
    prompt:
      'Rewrite the selected text in plain, simple language a general reader can follow. Preserve its meaning and original language. Return only the rewritten text.',
  },
];

/** Rewrites that change voice rather than content. */
const TONES = [
  { key: 'editor.ai.tone.professional', tone: 'Professional', icon: Briefcase },
  { key: 'editor.ai.tone.casual', tone: 'Casual', icon: Smile },
  { key: 'editor.ai.tone.confident', tone: 'Confident', icon: Volume2 },
  { key: 'editor.ai.tone.friendly', tone: 'Friendly', icon: Sparkles },
];

/** Actions that produce new text about the selection. */
const GENERATE_ACTIONS = [
  {
    key: 'editor.ai.menu.summarize',
    icon: ListTree,
    prompt:
      'Summarise the selected text in a few sentences, in its original language. Return only the summary.',
  },
  {
    key: 'editor.ai.menu.explain',
    icon: MessageCircleQuestionMark,
    prompt:
      'Explain the selected text in plain terms, in its original language. Return only the explanation.',
  },
  // Structure changes: the answer is Markdown, so a table or a list arrives
  // as the real node, not as text that looks like one.
  {
    key: 'editor.ai.menu.table',
    icon: TableIcon,
    prompt:
      'Turn the selected text into a Markdown table with a header row, keeping every fact and its original language. Return only the table.',
  },
  {
    key: 'editor.ai.menu.list',
    icon: List,
    prompt:
      'Turn the selected text into a concise Markdown bullet list, one point per item, in its original language. Return only the list.',
  },
];

function translatePrompt(language: string) {
  return `Translate the selected text into ${language}. Preserve meaning and proper names. Return only the translation.`;
}

const MENU_ITEM =
  'richtext-ai-improve-item richtext-flex richtext-w-full richtext-items-center richtext-border-0 richtext-bg-transparent richtext-text-left richtext-text-sm richtext-text-foreground hover:richtext-bg-accent';
const MENU_LABEL =
  'richtext-px-3 richtext-py-1.5 richtext-text-xs richtext-font-normal richtext-text-muted-foreground';
const MENU_SEPARATOR = 'richtext-my-1 richtext-h-px richtext-bg-border';

/**
 * The "Improve" menu of the text bubble: edit the selection, change its tone,
 * generate from it, translate it, or ask anything. Each entry opens the AI
 * panel on the selection captured when the menu opened. Can also be used
 * inside a custom bubble.
 */
export const RichTextAIImprove = defineComponent({
  name: 'RichTextAIImprove',
  setup() {
    const editor = useEditorInstance();
    const { t } = useLocale();
    const open = ref(false);
    const root = ref<HTMLElement | null>(null);
    let selection: Range | null = null;
    let doc: ProseMirrorNode | null = null;
    const state = useEditorState(
      (current) => {
        const options = aiOptionsOf(current);
        return { available: !!options, languages: options?.translateLanguages ?? [] };
      },
      { available: false, languages: [] as string[] }
    );

    useDismiss(open, root);

    function toggle() {
      const current = editor.value;
      if (!open.value && current) {
        const { from, to } = current.state.selection;
        selection = from < to ? { from, to } : null;
        doc = current.state.doc;
      }
      open.value = !open.value;
    }

    function run(prompt?: string) {
      open.value = false;
      const current = editor.value;
      // Do not overwrite a selection captured before a collaborative edit.
      if (!current || !selection || doc !== current.state.doc || !current.isEditable) return;
      current.chain().setTextSelection(selection).openAI(prompt).run();
    }

    const item = (
      key: string,
      icon: Component | null,
      onSelect: () => void,
      label = t(key),
      trailing?: VNodeChild
    ) =>
      h(
        'button',
        {
          key,
          type: 'button',
          role: 'menuitem',
          class: MENU_ITEM,
          onMousedown: (event: MouseEvent) => event.preventDefault(),
          onClick: onSelect,
        },
        [icon ? h(icon, { size: 17 }) : null, label, trailing]
      );

    return () => {
      if (!state.value.available) return null;
      const languages = state.value.languages;
      const browserTarget = languages.length ? null : browserLanguage();

      return h('div', { ref: root, class: 'richtext-ai-improve-anchor richtext-relative' }, [
        h(RichTextToolbarButton, {
          icon: Sparkles,
          label: t('editor.ai.menu.trigger'),
          tooltip: t('editor.ai.menu.trigger'),
          class: 'richtext-ai-improve-trigger',
          'aria-haspopup': 'menu',
          'aria-expanded': open.value ? 'true' : 'false',
          onClick: toggle,
        }),
        open.value
          ? h(
              'div',
              {
                role: 'menu',
                class:
                  'richtext-ai-improve-menu richtext-absolute richtext-left-0 richtext-top-9 richtext-z-50 richtext-flex richtext-max-h-[70vh] richtext-flex-col richtext-overflow-y-auto richtext-border richtext-border-solid richtext-border-border richtext-bg-popover richtext-text-popover-foreground richtext-shadow-md',
              },
              [
                h('div', { class: MENU_LABEL }, t('editor.ai.menu.edit')),
                ...EDIT_ACTIONS.map(({ key, icon, prompt }) => item(key, icon, () => run(prompt))),
                h('div', { class: MENU_LABEL }, [
                  h(Volume2, { size: 12 }),
                  ` ${t('editor.ai.menu.tone')}`,
                ]),
                ...TONES.map(({ key, tone, icon }) =>
                  item(key, icon, () =>
                    run(
                      `Rewrite the selected text in a ${tone.toLowerCase()} tone. Preserve its meaning and original language. Return only the rewritten text.`
                    )
                  )
                ),
                h('div', { class: MENU_SEPARATOR }),
                h('div', { class: MENU_LABEL }, t('editor.ai.menu.generate')),
                ...GENERATE_ACTIONS.map(({ key, icon, prompt }) =>
                  item(key, icon, () => run(prompt))
                ),
                ...(languages.length
                  ? [
                      h('div', { class: MENU_LABEL }, t('editor.ai.menu.translate')),
                      ...languages.map((language) =>
                        item(
                          `translate-${language}`,
                          Languages,
                          () => run(translatePrompt(language)),
                          language
                        )
                      ),
                    ]
                  : []),
                browserTarget
                  ? item(
                      'editor.ai.menu.translate',
                      Languages,
                      () => run(translatePrompt(browserTarget.name)),
                      t('editor.ai.menu.translate'),
                      h('span', { class: 'richtext-ai-improve-target' }, browserTarget.label)
                    )
                  : null,
                h('div', { class: MENU_SEPARATOR }),
                item('editor.ai.menu.ask', Sparkles, () => run()),
                editor.value && aiOptionsOf(editor.value)?.composer === false
                  ? null
                  : item('editor.ai.menu.composer', PanelBottomOpen, () => {
                      open.value = false;
                      editor.value?.commands.toggleAIComposer(true);
                    }),
              ]
            )
          : null,
      ]);
    };
  },
});
