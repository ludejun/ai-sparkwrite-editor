import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { Check, Copy, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { IconComponent } from '@/components/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui';
import { guessLanguage } from '@/extensions/CodeBlock/detect-language';
import { LIST_LANG, languageLabel } from '@/extensions/CodeBlock/languages';
import { cn } from '@/lib/utils';
import { useLocale } from '@/locales';
import { useEditableEditor } from '@/store/store';
import { isEditorEditable } from '@/utils/editable';

import type { NodeViewProps } from '@tiptap/react';

export { LIST_LANG, MAP_LANGUAGE_LABEL } from '@/extensions/CodeBlock/languages';

const AUTO_VALUE = '__auto__';
const COPIED_FEEDBACK_MS = 1500;

const labelOf = languageLabel;

const toolbarButtonClass =
  'richtext-flex richtext-items-center richtext-justify-center richtext-rounded richtext-border-none richtext-bg-transparent richtext-p-1 richtext-text-[var(--shj-numbers)] richtext-transition-colors hover:richtext-text-[var(--shj-fg)] focus-visible:richtext-text-[var(--shj-fg)]';

/**
 * Code block node view.
 *
 * The controls live in the block's top-right corner and appear on hover, so
 * typing never moves them (GitHub / Notion behaviour), and a line-number gutter
 * is painted outside the scrolling code area.
 */
export function NodeViewCodeBlock({
  node,
  updateAttributes,
  deleteNode,
  extension,
  editor,
}: NodeViewProps) {
  const { t } = useLocale();
  // Node views do not re-render on `setEditable`; subscribe to it.
  const editable = useEditableEditor(editor);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const code = node.textContent;
  const explicitLanguage: string | null = node.attrs.language || null;

  // With no explicit choice, fall back to what the highlighter itself guessed,
  // so the label matches the colours on screen.
  const detected = useMemo(() => {
    if (explicitLanguage) {
      return null;
    }

    const guess = guessLanguage(code);
    return guess === 'plain' ? null : guess;
  }, [explicitLanguage, code]);

  const activeLanguage = explicitLanguage ?? detected ?? 'plain';
  const languageClassPrefix = extension.options.languageClassPrefix || 'language-';
  const lineCount = useMemo(() => code.split('\n').length, [code]);

  const languages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = LIST_LANG.filter((value) => {
      if (!needle) return true;
      return value.toLowerCase().includes(needle) || labelOf(value).toLowerCase().includes(needle);
    });

    return list;
  }, [query]);

  const autoMatchesQuery = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (
      !needle ||
      'auto'.includes(needle) ||
      t('editor.codeblock.auto').toLowerCase().includes(needle)
    );
  }, [query, t]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  useEffect(() => {
    if (!languageOpen) {
      setQuery('');
    }
  }, [languageOpen]);

  useEffect(() => {
    if (!editable) setLanguageOpen(false);
  }, [editable]);

  const onCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  const pick = (value: string) => {
    if (isEditorEditable(editor))
      updateAttributes({ language: value === AUTO_VALUE ? null : value });
    setLanguageOpen(false);
  };

  const onDelete = () => {
    if (isEditorEditable(editor)) deleteNode();
  };

  return (
    <NodeViewWrapper className='richtext-code-block'>
      <pre className={extension.options.HTMLAttributes?.class}>
        <NodeViewContent<'code'> as='code' className={`${languageClassPrefix}${activeLanguage}`} />
      </pre>

      <div aria-hidden className='richtext-code-block__gutter' contentEditable={false}>
        {Array.from({ length: lineCount }, (_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>

      {/* Readers keep Copy; the language picker and Delete are for editing. */}
      <div
        className='richtext-code-block__toolbar'
        contentEditable={false}
        data-open={languageOpen ? 'true' : 'false'}
        onMouseDown={(event) => event.preventDefault()}
      >
        {editable ? (
          <Popover modal onOpenChange={setLanguageOpen} open={languageOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  toolbarButtonClass,
                  'richtext-gap-0.5 richtext-px-1.5 richtext-text-xs'
                )}
                type='button'
              >
                {explicitLanguage ? labelOf(activeLanguage) : `${labelOf(activeLanguage)} · Auto`}

                <IconComponent className='richtext-size-3' name='MenuDown' />
              </button>
            </PopoverTrigger>

            <PopoverContent
              align='end'
              className='!richtext-w-[210px] !richtext-p-1'
              hideWhenDetached
              side='bottom'
            >
              <div className='richtext-relative richtext-mb-1'>
                <Search className='richtext-pointer-events-none richtext-absolute richtext-left-2 richtext-top-1/2 richtext-size-3.5 -richtext-translate-y-1/2 richtext-text-muted-foreground' />

                <input
                  autoFocus
                  className='richtext-h-7 richtext-w-full richtext-rounded-sm !richtext-border !richtext-border-solid !richtext-border-border richtext-bg-transparent richtext-pl-7 richtext-pr-2 richtext-text-sm richtext-text-foreground !richtext-outline-none'
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('editor.codeblock.search')}
                  value={query}
                />
              </div>

              <div className='richtext-max-h-[220px] richtext-overflow-auto'>
                {autoMatchesQuery ? (
                  <LanguageOption
                    active={!explicitLanguage}
                    label={
                      detected
                        ? `${t('editor.codeblock.auto')} · ${labelOf(detected)}`
                        : t('editor.codeblock.auto')
                    }
                    onSelect={() => pick(AUTO_VALUE)}
                  />
                ) : null}

                {languages.map((value) => (
                  <LanguageOption
                    active={explicitLanguage === value}
                    key={value}
                    label={labelOf(value)}
                    onSelect={() => pick(value)}
                  />
                ))}

                {!languages.length && !autoMatchesQuery ? (
                  <div className='richtext-px-2 richtext-py-3 richtext-text-center richtext-text-sm richtext-text-muted-foreground'>
                    {t('editor.codeblock.noResult')}
                  </div>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}

        <button
          aria-label={t('editor.copyToClipboard')}
          className={toolbarButtonClass}
          onClick={onCopy}
          title={t('editor.copyToClipboard')}
          type='button'
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>

        {editable ? (
          <button
            aria-label={t('editor.delete')}
            className={toolbarButtonClass}
            onClick={onDelete}
            title={t('editor.delete')}
            type='button'
          >
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}

function LanguageOption({
  active,
  label,
  onSelect,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      className='richtext-flex richtext-w-full richtext-items-center richtext-gap-3 richtext-rounded-sm !richtext-border-none !richtext-bg-transparent richtext-py-1.5 richtext-pl-2 richtext-pr-10 richtext-text-left richtext-text-sm richtext-text-foreground !richtext-outline-none richtext-transition-colors hover:!richtext-bg-accent'
      onClick={onSelect}
      type='button'
    >
      <span className='!richtext-min-w-[20px]'>{active ? <Check size={16} /> : null}</span>

      <span>{label}</span>
    </button>
  );
}
