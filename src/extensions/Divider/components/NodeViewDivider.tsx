import { NodeViewWrapper } from '@tiptap/react';

import { cn } from '@/lib/utils';
import { useLocale } from '@/locales';
import { useEditableEditor } from '@/store/store';
import { isEditorEditable } from '@/utils/editable';

import type { DividerOptions, DividerVariantOption } from '@/extensions/Divider/Divider';
import type { NodeViewProps } from '@tiptap/react';

/** Menu label for a variant: the host's, else the built-in translation. */
export function variantLabel(option: DividerVariantOption, t: (key: string) => string): string {
  if (option.label) {
    return option.label;
  }

  const key = `editor.divider.variant.${option.value}`;
  const label = t(key);

  return label === key ? String(option.value) : label;
}

export function NodeViewDivider({
  node,
  selected,
  editor,
  extension,
  updateAttributes,
  getPos,
}: NodeViewProps) {
  const { t } = useLocale();
  const { variant, label } = node.attrs as { variant: string; label: string | null };
  const variants = (extension.options as DividerOptions).variants;
  const option = variants.find((item) => item.value === variant);
  const editorEditable = useEditableEditor(editor);
  const editable = !!option?.editable && editorEditable;
  const showLabel = editable || (label && variant !== 'line');
  const placeholder = t('editor.divider.label.placeholder');

  const update = (attributes: Record<string, unknown>) => {
    if (isEditorEditable(editor)) updateAttributes(attributes);
  };

  return (
    <NodeViewWrapper
      aria-label={t('editor.divider.tooltip')}
      className={cn('divider', `divider--${variant}`, {
        'divider--selected': selected,
        'divider--empty': editable && !label,
      })}
      data-variant={variant}
      role='separator'
    >
      <hr />

      {showLabel ? (
        editable ? (
          <input
            aria-label={placeholder}
            className='divider__label'
            placeholder={placeholder}
            size={Math.max(1, (label ?? '').length || placeholder.length)}
            value={label ?? ''}
            onChange={(event) => update({ label: event.target.value || null })}
            onKeyDown={(event) => {
              // Enter leaves the label and continues writing below the divider.
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.preventDefault();
                event.currentTarget.blur();
                const pos = getPos();

                if (typeof pos === 'number') {
                  editor.commands.focus(pos + node.nodeSize);
                }
              }
            }}
          />
        ) : (
          <span className='divider__label'>{label}</span>
        )
      ) : null}

      {showLabel ? <hr /> : null}

      {selected && editorEditable && variants.length > 1 ? (
        <div className='divider__picker' contentEditable={false} role='radiogroup'>
          {variants.map((item) => (
            <button
              aria-checked={item.value === variant}
              aria-label={variantLabel(item, t)}
              className={cn('divider__pick', `divider__pick--${item.value}`)}
              key={item.value}
              role='radio'
              title={variantLabel(item, t)}
              type='button'
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                update({
                  variant: item.value,
                  // A typed label only makes sense on a variant that shows one.
                  label: item.editable ? label : null,
                })
              }
            >
              <span className={cn('divider divider-preview', `divider--${item.value}`)}>
                <hr />
                {item.editable || item.value === 'number' ? (
                  <>
                    <span className='divider__label'>{item.value === 'number' ? '1' : 'Aa'}</span>
                    <hr />
                  </>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}
