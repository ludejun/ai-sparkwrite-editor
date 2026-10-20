import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { PaletteIcon } from 'lucide-react';
import { useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components';
import { cn } from '@/lib/utils';
import { useLocale } from '@/locales';

import type { CardOptions } from '@/extensions/StyledBlocks/StyledBlocks';
import type { NodeViewProps } from '@tiptap/react';

/** Menu label of a card look: the translation, else the raw name. */
export function cardStyleLabel(variant: string, t: (key: string) => string): string {
  const key = `editor.card.variant.${variant}`;
  const label = t(key);
  return label === key ? variant : label;
}

/**
 * The card in the editor: the box itself plus a small style handle in its
 * top-right corner (look, badge text, remove the card but keep its content).
 */
export function NodeViewCard({ node, editor, extension, updateAttributes, getPos }: NodeViewProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const variant = String(node.attrs.variant || 'soft');
  const label = (node.attrs.label as string | null) || '';
  const variants = (extension.options as CardOptions).variants;

  const unwrap = () => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    setOpen(false);
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.replaceWith(pos, pos + node.nodeSize, node.content);
        return true;
      })
      .run();
  };

  return (
    <NodeViewWrapper
      className={cn('sn-box', `sn-box--${variant}`, { 'sn-box--menu-open': open })}
      data-label={label || undefined}
      data-type='card'
      data-variant={variant}
    >
      {editor.isEditable ? (
        <div className='sn-box__handle' contentEditable={false}>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                aria-label={t('editor.card.style')}
                className='sn-box__handle-btn'
                title={t('editor.card.style')}
                type='button'
                onMouseDown={(event) => event.preventDefault()}
              >
                <PaletteIcon size={14} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align='end'
              className='sn-style-menu'
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              <div className='sn-style-menu__title'>{t('editor.card.style')}</div>
              <div className='sn-style-menu__grid' role='radiogroup'>
                {variants.map((value) => (
                  <button
                    aria-checked={value === variant}
                    className='sn-style-menu__item'
                    key={value}
                    role='radio'
                    type='button'
                    onClick={() => updateAttributes({ variant: value })}
                  >
                    <span className={cn('sn-box sn-box-sample', `sn-box--${value}`)}>
                      <span className='sn-box-sample__line' />
                      <span className='sn-box-sample__line sn-box-sample__line--short' />
                    </span>
                    <span className='sn-style-menu__label'>{cardStyleLabel(value, t)}</span>
                  </button>
                ))}
              </div>
              <label className='sn-style-menu__field'>
                <span>{t('editor.card.label')}</span>
                <input
                  maxLength={12}
                  placeholder={t('editor.card.label.placeholder')}
                  value={label}
                  onChange={(event) => updateAttributes({ label: event.target.value || null })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === 'Escape') {
                      event.preventDefault();
                      setOpen(false);
                      editor.commands.focus();
                    }
                  }}
                />
              </label>
              <button className='sn-style-menu__remove' type='button' onClick={unwrap}>
                {t('editor.card.remove')}
              </button>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
      <NodeViewContent className='sn-box__body' />
    </NodeViewWrapper>
  );
}
