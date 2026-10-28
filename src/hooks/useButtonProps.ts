import { useMemo } from 'react';

import { useExtension } from '@/hooks/useExtension';
import { useLocale } from '@/locales';
import { useEditorInstance } from '@/store/editor';
import { isEditorEditable } from '@/utils/editable';
import { isFunction } from '@/utils/utils';

import type { ButtonViewReturnComponentProps, ButtonViewReturn } from '@/types';
import type { Editor } from '@tiptap/core';

type Props = Record<string, unknown>;

function guardAction(editor: Editor, props: Props): Props {
  const { action } = props;

  if (!isFunction(action)) return props;

  return {
    ...props,
    action: (...args: unknown[]) => {
      if (!isEditorEditable(editor)) return;
      return (action as (...a: unknown[]) => unknown)(...args);
    },
  };
}

/**
 * Re-checks editability when an action runs, not only when the button last
 * rendered: covers `action` itself, nested `undo`/`redo`/`indent` props and
 * dropdown `items`.
 */
export function guardButtonActions<P>(editor: Editor, componentProps: P): P {
  if (!componentProps || typeof componentProps !== 'object') return componentProps;

  const guarded = { ...guardAction(editor, componentProps as Props) };

  for (const [key, value] of Object.entries(guarded)) {
    if (Array.isArray(value)) {
      guarded[key] = value.map((item) =>
        item && typeof item === 'object' ? guardAction(editor, item as Props) : item
      );
    } else if (value && typeof value === 'object' && isFunction((value as Props).action)) {
      guarded[key] = guardAction(editor, value as Props);
    }
  }

  return guarded as P;
}

export function useButtonProps<P = ButtonViewReturnComponentProps>(extensionName: string) {
  const editor = useEditorInstance();
  const extension = useExtension(extensionName);
  const { t } = useLocale();

  return useMemo(() => {
    if (!editor || !extension || !t) {
      return null;
    }

    const { button } = extension.options;

    if (!button || !isFunction(button)) {
      return null;
    }

    const buttonProps = button({
      editor,
      extension,
      t,
    }) as ButtonViewReturn<P>;

    return buttonProps
      ? { ...buttonProps, componentProps: guardButtonActions(editor, buttonProps.componentProps) }
      : buttonProps;
  }, [editor, extension, t]);
}
