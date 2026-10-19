import { useEditorState } from '@tiptap/react';
import { PaletteIcon, SquareDashedIcon } from 'lucide-react';

import {
  ActionButton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconComponent,
} from '@/components';
import { registerIcons } from '@/components/icons/icons';
import { cardStyleLabel } from '@/extensions/StyledBlocks/components/NodeViewCard';
import {
  activeStyledBlock,
  CARD_STYLES,
  HEADING_STYLES,
  QUOTE_STYLES,
} from '@/extensions/StyledBlocks/StyledBlocks';
import { useActive } from '@/hooks/useActive';
import { cn } from '@/lib/utils';
import { useLocale } from '@/locales';
import { useEditorInstance } from '@/store/editor';

// Icons this module (and the extensions' `button()` options) resolve by name.
registerIcons({ BlockStyle: PaletteIcon, SquareDashed: SquareDashedIcon });

function styleLabel(group: 'heading' | 'quote', value: string, t: (key: string) => string) {
  const key = `editor.blockStyle.${group}.${value}`;
  const label = t(key);
  return label === key ? value : label;
}

/** A small rendered sample of a look, drawn with the same CSS as the document. */
function Sample({
  kind,
  value,
  t,
}: {
  kind: 'heading' | 'quote' | 'card';
  value: string | null;
  t: (key: string) => string;
}) {
  if (kind === 'heading') {
    return (
      <span className={cn('sn-style-sample sn-style-sample--h', value && `sn-h sn-h--${value}`)}>
        {t('editor.blockStyle.sampleHeading')}
      </span>
    );
  }
  if (kind === 'quote') {
    return (
      <span
        className={cn(
          'sn-style-sample sn-style-sample--q blockquote',
          value && `sn-quote sn-quote--${value}`
        )}
      >
        {t('editor.blockStyle.sampleQuote')}
      </span>
    );
  }
  return (
    <span className={cn('sn-box sn-box-sample', `sn-box--${value ?? 'soft'}`)}>
      <span className='sn-box-sample__line' />
      <span className='sn-box-sample__line sn-box-sample__line--short' />
    </span>
  );
}

/**
 * Toolbar control for styled blocks: in a heading it offers the heading looks,
 * in a quote the quote looks, in a card the card looks; anywhere else it wraps
 * the selected blocks in a card or a styled quote.
 */
export function RichTextBlockStyle() {
  const editor = useEditorInstance();
  const { t } = useLocale();
  const { editorDisabled } = useActive(undefined);
  const active = useEditorState({
    editor,
    selector: (ctx) => (ctx.editor ? activeStyledBlock(ctx.editor.state) : null),
    equalityFn: (a, b) => a?.type === b?.type && a?.variant === b?.variant && a?.label === b?.label,
  });

  if (!editor || !editor.extensionManager.extensions.some((ext) => ext.name === 'blockStyles')) {
    return <></>;
  }

  const hasCard = !!editor.schema.nodes.card;
  const run = (fn: () => void) => () => fn();
  const item = (
    key: string,
    selected: boolean,
    onSelect: () => void,
    children: React.ReactNode
  ) => (
    <DropdownMenuItem
      className={cn('sn-style-menu__item', { 'is-active': selected })}
      key={key}
      onClick={onSelect}
    >
      {children}
    </DropdownMenuItem>
  );

  let body: React.ReactNode;
  if (active?.type === 'heading') {
    body = (
      <>
        <DropdownMenuLabel>{t('editor.blockStyle.heading')}</DropdownMenuLabel>
        <div className='sn-style-menu__grid sn-style-menu__grid--wide'>
          {[null, ...HEADING_STYLES].map((value) =>
            item(
              value ?? 'default',
              (active.variant ?? null) === value,
              run(() => editor.chain().focus().setBlockVariant('heading', value).run()),
              <>
                <Sample kind='heading' t={t} value={value} />
                <span className='sn-style-menu__label'>
                  {value ? styleLabel('heading', value, t) : t('editor.blockStyle.default')}
                </span>
              </>
            )
          )}
        </div>
      </>
    );
  } else if (active?.type === 'blockquote') {
    body = (
      <>
        <DropdownMenuLabel>{t('editor.blockStyle.quote')}</DropdownMenuLabel>
        <div className='sn-style-menu__grid sn-style-menu__grid--wide'>
          {[null, ...QUOTE_STYLES].map((value) =>
            item(
              value ?? 'default',
              (active.variant ?? null) === value,
              run(() => editor.chain().focus().setBlockVariant('blockquote', value).run()),
              <>
                <Sample kind='quote' t={t} value={value} />
                <span className='sn-style-menu__label'>
                  {value ? styleLabel('quote', value, t) : t('editor.blockStyle.default')}
                </span>
              </>
            )
          )}
        </div>
      </>
    );
  } else {
    const inCard = active?.type === 'card';
    body = (
      <>
        <DropdownMenuLabel>
          {inCard ? t('editor.card.style') : t('editor.blockStyle.wrapCard')}
        </DropdownMenuLabel>
        {hasCard ? (
          <div className='sn-style-menu__grid'>
            {CARD_STYLES.map((value) =>
              item(
                value,
                inCard && active?.variant === value,
                run(() =>
                  inCard
                    ? editor.chain().focus().updateCard({ variant: value }).run()
                    : editor.chain().focus().setCard({ variant: value }).run()
                ),
                <>
                  <Sample kind='card' t={t} value={value} />
                  <span className='sn-style-menu__label'>{cardStyleLabel(value, t)}</span>
                </>
              )
            )}
          </div>
        ) : null}
        {inCard ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().unsetCard().run()}>
              {t('editor.card.remove')}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('editor.blockStyle.wrapQuote')}</DropdownMenuLabel>
            <div className='sn-style-menu__grid sn-style-menu__grid--wide'>
              {QUOTE_STYLES.map((value) =>
                item(
                  value,
                  false,
                  run(() =>
                    editor
                      .chain()
                      .focus()
                      .setBlockquote()
                      .setBlockVariant('blockquote', value)
                      .run()
                  ),
                  <>
                    <Sample kind='quote' t={t} value={value} />
                    <span className='sn-style-menu__label'>{styleLabel('quote', value, t)}</span>
                  </>
                )
              )}
            </div>
            <p className='sn-style-menu__hint'>{t('editor.blockStyle.hint')}</p>
          </>
        )}
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={editorDisabled}>
        <ActionButton
          customClass='!richtext-w-12 richtext-h-12'
          disabled={editorDisabled}
          icon='BlockStyle'
          tooltip={t('editor.blockStyle.tooltip')}
        >
          <IconComponent
            className='richtext-ml-1 richtext-size-3 richtext-text-zinc-500'
            name='MenuDown'
          />
        </ActionButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='sn-style-menu sn-style-menu--dropdown'>
        {body}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
