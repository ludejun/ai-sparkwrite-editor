import { Redo2Icon, Undo2Icon } from 'lucide-react';
import React from 'react';

import { ActionButton, icons } from '@/components';
import { registerIcons } from '@/components/icons/icons';
import { History } from '@/extensions/History/History';
import { useActive } from '@/hooks/useActive';
import { useButtonProps } from '@/hooks/useButtonProps';

// Icons this module (and its extension's `button()` options) resolves by name.
registerIcons({ Redo2: Redo2Icon, Undo2: Undo2Icon });

export function RichTextUndo() {
  const historyProps = useButtonProps(History.name);
  // With Yjs collaboration the `collaboration` extension owns undo / redo.
  const collaborationProps = useButtonProps('collaboration');
  const buttonProps = historyProps ?? collaborationProps;

  const {
    icon = undefined,
    tooltip = undefined,
    shortcutKeys = undefined,
    tooltipOptions = {},
    action = undefined,
    isActive = undefined,
  } = buttonProps?.componentProps?.undo ?? {};

  const { disabled } = useActive(isActive);

  const Icon = icons[icon as string];

  const onAction = () => {
    if (disabled) return;

    if (action) action();
  };

  if (!buttonProps || !Icon) {
    return <></>;
  }

  return (
    <ActionButton
      action={onAction}
      disabled={disabled}
      icon={icon}
      shortcutKeys={shortcutKeys}
      tooltip={tooltip}
      tooltipOptions={tooltipOptions}
    />
  );
}

export function RichTextRedo() {
  const historyProps = useButtonProps(History.name);
  // With Yjs collaboration the `collaboration` extension owns undo / redo.
  const collaborationProps = useButtonProps('collaboration');
  const buttonProps = historyProps ?? collaborationProps;

  const {
    icon = undefined,
    tooltip = undefined,
    shortcutKeys = undefined,
    tooltipOptions = {},
    action = undefined,
    isActive = undefined,
  } = buttonProps?.componentProps?.redo ?? {};

  const { disabled } = useActive(isActive);

  const onAction = () => {
    if (disabled) return;

    if (action) action();
  };

  if (!buttonProps) {
    return <></>;
  }

  return (
    <ActionButton
      action={onAction}
      disabled={disabled}
      icon={icon}
      shortcutKeys={shortcutKeys}
      tooltip={tooltip}
      tooltipOptions={tooltipOptions}
    />
  );
}
