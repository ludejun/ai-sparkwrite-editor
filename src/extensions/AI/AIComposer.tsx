import { useEditorState } from '@tiptap/react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  Heading1,
  Languages,
  ListOrdered,
  ListTodo,
  ListTree,
  Paperclip,
  PenLine,
  RotateCcw,
  Sparkles,
  SpellCheck,
  Square,
  Undo2,
  X,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useLocale } from '@/locales';
import { useEditorInstance } from '@/store/editor';

import { attachmentAccept, canAttach, filesOf, readAttachments } from './attachments';
import { AI_COMPOSER_ACTIONS, composerPrompt, fitChips, type AIComposerAction } from './composer';
import { aiPluginKey } from './state';
import { aiOptionsOf, writeWithAI, type WriteWithAIResult } from './writer';

import type { AIAttachment, AIWriteTarget } from './types';
import type { Range } from '@tiptap/core';
import type { ComponentType, CSSProperties } from 'react';

const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  PenLine,
  ListTree,
  ListOrdered,
  Heading1,
  ListTodo,
  SpellCheck,
  Languages,
};

type Target = 'selection' | 'cursor' | 'start' | 'end' | 'document';
const TARGETS: Target[] = ['selection', 'cursor', 'start', 'end', 'document'];

export interface RichTextAIComposerProps {
  /** Quick actions shown as chips. Defaults to `AI_COMPOSER_ACTIONS`; `[]` hides the row. */
  actions?: AIComposerAction[];
  /** Start open. Otherwise the `RichTextAI` button, `Mod-J` or `toggleAIComposer()` opens it. */
  defaultOpen?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Placeholder of the prompt box before an answer exists. */
  placeholder?: string;
  /** Visible lines of the prompt box. Default 2. */
  rows?: number;
  /** Show the "where the text goes" selector. Default true. */
  showTarget?: boolean;
  /** The footer line: `false` hides it, a string replaces it. Default true. */
  hint?: boolean | string;
  /** The gradient border and background wash. `false` gives a flat dock. Default true. */
  gradient?: boolean;
  /** Accent colour (any CSS colour); the gradient derives its other stops from it. */
  accent?: string;
}

/**
 * The composer dock: a prompt bar that sits under the editor and writes
 * straight into the document. Type what you want (or pick a chip), watch the
 * answer stream into the page above as real blocks, then keep it, undo it or
 * ask for a change. Place it after `EditorContent` inside `RichTextProvider`.
 */
export function RichTextAIComposer({
  actions = AI_COMPOSER_ACTIONS,
  defaultOpen = false,
  className = '',
  style,
  placeholder,
  rows = 2,
  showTarget = true,
  hint = true,
  gradient = true,
  accent,
}: RichTextAIComposerProps) {
  const editor = useEditorInstance();
  const { t, lang } = useLocale();
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      open: aiPluginKey.getState(editor.state)?.composer ?? false,
      hasSelection: !editor.state.selection.empty,
      empty: editor.state.doc.textContent.trim().length === 0,
      editable: editor.isEditable,
    }),
  });
  const [prompt, setPrompt] = useState('');
  const [target, setTarget] = useState<Target>('selection');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<WriteWithAIResult | null>(null);
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const lastRequest = useRef<{
    prompt: string;
    target: AIWriteTarget;
    attachments: AIAttachment[];
    /** The composer action the request came from, when it came from a chip. */
    actionKey?: string;
  } | null>(null);
  // Images and text files go with the prompt, like in the AI panel: picked,
  // dropped onto the box or pasted into the prompt.
  const [attachments, setAttachments] = useState<AIAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const filePicker = useRef<HTMLInputElement>(null);
  // The chips stay on one line; the ones that do not fit go behind a "more" button.
  const chipRow = useRef<HTMLDivElement>(null);
  const [visibleChips, setVisibleChips] = useState(Infinity);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultOpen) editor.commands.toggleAIComposer(true);
  }, [defaultOpen, editor]);

  useEffect(() => {
    if (state?.open) input.current?.focus();
  }, [state?.open]);

  useEffect(() => () => controller.current?.abort(), []);

  const aiOptions = aiOptionsOf(editor);
  const open = !!state?.open && !!aiOptions && aiOptions.composer !== false;
  const showChips = open && !result;

  useLayoutEffect(() => {
    const row = chipRow.current;
    if (!showChips || !row) return;
    const measure = () => setVisibleChips(fitChips(row));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [showChips, actions, state?.hasSelection, state?.empty, lang]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!moreMenu.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [moreOpen]);

  if (!open) return null;

  const attachable = !!aiOptions && canAttach(aiOptions);

  async function addFiles(files: File[]) {
    if (!files.length || !attachable) return;
    const { attachments: next, error: problem } = await readAttachments(
      files,
      aiOptions!,
      attachments
    );
    if (problem) setError(problem);
    if (next.length) setAttachments((current) => [...current, ...next]);
  }

  async function run(
    instruction: string,
    where: AIWriteTarget,
    refineFrom?: WriteWithAIResult,
    files: AIAttachment[] = attachments,
    actionKey?: string
  ) {
    if (busy || !instruction.trim()) return;
    // A refinement or retry rewrites the same span, so the previous answer
    // goes first and the conversation continues from it.
    let range: Range | null = null;
    if (refineFrom) range = refineFrom.discard();
    else result?.keep();
    setResult(null);
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setError('');
    try {
      const next = await writeWithAI(editor, {
        prompt: instruction,
        target: range ?? where,
        history: refineFrom?.messages,
        attachments: files,
        signal: active.signal,
      });
      if (!refineFrom)
        lastRequest.current = {
          prompt: instruction,
          target: where,
          attachments: files,
          actionKey,
        };
      // A chip's answer is offered to the host first: `true` means it took
      // the answer somewhere else (a title field, say), so the document gets
      // its original content back and nothing is left to keep or undo.
      if (actionKey) {
        const handled = await aiOptionsOf(editor)?.onComposeResult?.({
          action: actionKey,
          markdown: next.markdown,
          target: where,
          editor,
          result: next,
        });
        if (handled === true) {
          next.discard();
          setPrompt('');
          setAttachments([]);
          return;
        }
      }
      setResult(next);
      setPrompt('');
      setAttachments([]);
    } catch (cause) {
      if (!active.signal.aborted)
        setError(cause instanceof Error ? cause.message : t('editor.ai.error.generic'));
    } finally {
      if (controller.current === active) {
        controller.current = null;
        setBusy(false);
        input.current?.focus();
      }
    }
  }

  // "Replace selection" only exists while something is selected; without a
  // selection the same choice means "at the caret".
  const effectiveTarget: Target = target === 'selection' && !state.hasSelection ? 'cursor' : target;

  function submit() {
    const instruction = prompt.trim();
    if (!instruction) return;
    if (result) void run(instruction, result, result);
    else void run(instruction, effectiveTarget);
  }

  function stop() {
    controller.current?.abort();
  }

  function close() {
    stop();
    result?.keep();
    setResult(null);
    editor.commands.toggleAIComposer(false);
    editor.commands.focus();
  }

  const chips = actions.filter(
    (action) =>
      (!action.needsSelection || state.hasSelection) && (!action.needsDocument || !state.empty)
  );

  const hasAutocomplete = editor.extensionManager.extensions.some(
    (extension) => extension.name === 'aiAutocomplete'
  );
  const hintText =
    typeof hint === 'string'
      ? hint
      : hasAutocomplete
        ? t('editor.ai.compose.hint')
        : t('editor.ai.compose.hint.space');

  return (
    <div
      className={`richtext-ai-composer ${gradient ? '' : 'richtext-ai-composer--plain'} ${className}`}
      style={accent ? ({ ...style, '--ai-accent': accent } as CSSProperties) : style}
      data-richtext-portal
      role='region'
      aria-label={t('editor.ai.compose.title')}
      onKeyDown={(event) => {
        // Escape and the toolbar shortcut both close the dock from inside it,
        // where the editor's own keymap cannot see them.
        if (event.key === 'Escape' || ((event.metaKey || event.ctrlKey) && event.key === 'j')) {
          event.preventDefault();
          close();
        }
      }}
    >
      {/* Head: the quick actions while idle, progress while writing, the
          verdict after an answer — and the close button, always at the end. */}
      <div className='richtext-ai-composer-head'>
        {busy ? (
          <span role='status' className='richtext-ai-composer-writing'>
            <span className='richtext-ai-loading-dots' aria-hidden='true'>
              <i />
              <i />
              <i />
            </span>
            {t('editor.ai.compose.writing')}
          </span>
        ) : result ? (
          <div className='richtext-ai-composer-actions'>
            <button
              type='button'
              className='richtext-ai-composer-keep'
              onClick={() => {
                result.keep();
                setResult(null);
                editor.commands.focus();
              }}
            >
              <Check size={15} /> {t('editor.ai.compose.keep')}
            </button>
            <button
              type='button'
              onClick={() => {
                result.discard();
                setResult(null);
                editor.commands.focus();
              }}
            >
              <Undo2 size={15} /> {t('editor.ai.compose.undo')}
            </button>
            <button
              type='button'
              onClick={() => {
                const last = lastRequest.current;
                if (last)
                  void run(last.prompt, last.target, result, last.attachments, last.actionKey);
              }}
            >
              <RotateCcw size={15} /> {t('editor.ai.compose.retry')}
            </button>
          </div>
        ) : chips.length ? (
          <div className='richtext-ai-composer-chipline' ref={chipRow}>
            <div className='richtext-ai-composer-chips' role='group'>
              {chips.map((action, index) => {
                const Icon = ICONS[action.icon];
                const hidden = index >= visibleChips;

                return (
                  <button
                    key={action.key}
                    type='button'
                    data-chip=''
                    className={hidden ? 'richtext-ai-chip-hidden' : undefined}
                    aria-hidden={hidden || undefined}
                    tabIndex={hidden ? -1 : undefined}
                    title={composerPrompt(action)}
                    disabled={!state.editable}
                    onClick={() =>
                      void run(
                        composerPrompt(action),
                        action.target,
                        undefined,
                        attachments,
                        action.key
                      )
                    }
                  >
                    {Icon ? <Icon size={14} /> : null}
                    {t(action.key)}
                  </button>
                );
              })}
            </div>
            {visibleChips < chips.length ? (
              <div className='richtext-ai-composer-more' ref={moreMenu}>
                <button
                  type='button'
                  aria-haspopup='menu'
                  aria-expanded={moreOpen}
                  aria-label={t('editor.more')}
                  title={t('editor.more')}
                  disabled={!state.editable}
                  onClick={() => setMoreOpen((value) => !value)}
                >
                  +{chips.length - visibleChips}
                  <ChevronDown size={13} />
                </button>
                {moreOpen ? (
                  <div className='richtext-ai-composer-menu' role='menu'>
                    {chips.slice(visibleChips).map((action) => {
                      const Icon = ICONS[action.icon];

                      return (
                        <button
                          key={action.key}
                          type='button'
                          role='menuitem'
                          title={composerPrompt(action)}
                          onClick={() => {
                            setMoreOpen(false);
                            void run(
                              composerPrompt(action),
                              action.target,
                              undefined,
                              attachments,
                              action.key
                            );
                          }}
                        >
                          {Icon ? <Icon size={14} /> : null}
                          {t(action.key)}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <span className='richtext-ai-composer-title'>
            <Sparkles size={14} /> {t('editor.ai.compose.title')}
          </span>
        )}
        <button
          type='button'
          className='richtext-ai-composer-close'
          aria-label={t('editor.ai.compose.close')}
          title={t('editor.ai.compose.close')}
          onClick={close}
        >
          <X size={16} />
        </button>
      </div>

      {/* The box: prompt on top, the controls in a bar underneath. */}
      <form
        className={`richtext-ai-composer-box ${dragging ? 'richtext-ai-composer-box--dragging' : ''}`}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        onDragOver={(event) => {
          if (!attachable || busy) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          setDragging(false);
          if (!attachable || busy) return;
          event.preventDefault();
          void addFiles(filesOf(event.dataTransfer));
        }}
      >
        <div className='richtext-ai-composer-input'>
          <Sparkles className='richtext-ai-composer-icon' size={18} />
          <textarea
            ref={input}
            rows={rows}
            style={{ minHeight: `calc(${rows} * 1.5em)` }}
            aria-label={
              result
                ? t('editor.ai.compose.refine')
                : (placeholder ?? t('editor.ai.compose.placeholder'))
            }
            placeholder={
              result
                ? t('editor.ai.compose.refine')
                : (placeholder ?? t('editor.ai.compose.placeholder'))
            }
            value={prompt}
            disabled={busy || !state.editable}
            onChange={(event) => setPrompt(event.target.value)}
            onPaste={(event) => {
              const files = filesOf(event.clipboardData);
              if (files.length && attachable) {
                event.preventDefault();
                void addFiles(files);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
          />
        </div>
        {attachments.length ? (
          <ul className='richtext-ai-attachments richtext-ai-composer-attachments'>
            {attachments.map((attachment) => (
              <li key={attachment.id}>
                {attachment.kind === 'image' ? (
                  <img alt='' src={attachment.dataUrl} />
                ) : (
                  <Paperclip size={13} />
                )}
                <span title={attachment.name}>{attachment.name}</span>
                <button
                  type='button'
                  aria-label={t('editor.ai.attach.remove', { name: attachment.name })}
                  onClick={() =>
                    setAttachments((current) => current.filter((item) => item.id !== attachment.id))
                  }
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className='richtext-ai-composer-bar'>
          <span className='richtext-ai-composer-tools'>
            {!result && showTarget ? (
              // A pill that fits its label: the native <select> sits invisibly on
              // top for the dropdown and keyboard, the label and chevron below it.
              <span className='richtext-ai-composer-target'>
                <span>{t(`editor.ai.compose.target.${effectiveTarget}`)}</span>
                <ChevronDown size={13} aria-hidden='true' />
                <select
                  aria-label={t('editor.ai.compose.target')}
                  value={effectiveTarget}
                  disabled={busy}
                  onChange={(event) => setTarget(event.target.value as Target)}
                >
                  {TARGETS.filter((value) => value !== 'selection' || state.hasSelection).map(
                    (value) => (
                      <option key={value} value={value}>
                        {t(`editor.ai.compose.target.${value}`)}
                      </option>
                    )
                  )}
                </select>
              </span>
            ) : null}
            {attachable ? (
              <>
                <button
                  type='button'
                  className='richtext-ai-attach'
                  aria-label={t('editor.ai.attach')}
                  title={t('editor.ai.attach')}
                  disabled={busy || !state.editable}
                  onClick={() => filePicker.current?.click()}
                >
                  <Paperclip size={16} />
                </button>
                <input
                  ref={filePicker}
                  type='file'
                  hidden
                  multiple
                  accept={attachmentAccept(aiOptions!)}
                  onChange={(event) => {
                    void addFiles(Array.from(event.target.files ?? []));
                    event.target.value = '';
                  }}
                />
              </>
            ) : null}
          </span>
          {busy ? (
            <button
              type='button'
              className='richtext-ai-composer-send'
              aria-label={t('editor.ai.stop')}
              title={t('editor.ai.stop')}
              onClick={stop}
            >
              <Square size={14} fill='currentColor' />
            </button>
          ) : (
            <button
              type='submit'
              className='richtext-ai-composer-send'
              aria-label={t('editor.ai.send')}
              title={t('editor.ai.send')}
              disabled={!prompt.trim() || !state.editable}
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </form>

      {error ? (
        <div className='richtext-ai-composer-foot'>
          <span role='alert' className='richtext-ai-composer-error'>
            {error}
          </span>
        </div>
      ) : hint && !result && !busy ? (
        <div className='richtext-ai-composer-foot'>
          <span className='richtext-ai-composer-hint'>{hintText}</span>
        </div>
      ) : null}
    </div>
  );
}
