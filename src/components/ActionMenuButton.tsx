import { Slot } from '@radix-ui/react-slot';
import React from 'react';

import { Button, Tooltip, TooltipContent, TooltipTrigger, icons } from '@/components';
import { cn } from '@/lib/utils';
import { getShortcutKeys } from '@/utils/plateform';

import type { ButtonViewReturnComponentProps } from '@/types';
import type { TooltipContentProps } from '@radix-ui/react-tooltip';

export interface ActionMenuButtonProps {
  /** Icon name to display */
  icon?: string;
  /** Button title text */
  title?: string;
  /** Tooltip text */
  tooltip?: string;
  /** Tooltip options */
  tooltipOptions?: TooltipContentProps;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Keyboard shortcut keys */
  shortcutKeys?: string[];
  /** Button color */
  color?: string;
  /** Click action handler */
  action?: React.MouseEventHandler<HTMLButtonElement>;
  /** Active state checker */
  isActive?: ButtonViewReturnComponentProps['isActive'];
  /** Whether to render as child */
  asChild?: boolean;
  dataState?: boolean;
  className?: string;
  /**
   * Every title this button may show. The widest one sets the width, so
   * switching the title (Paragraph → Heading 1) no longer shifts the toolbar.
   */
  reserve?: string[];
}

const ActionMenuButton = React.forwardRef<HTMLButtonElement, ActionMenuButtonProps>(
  (
    {
      asChild = false,
      tooltip,
      // Pulled out of the spread below: `title` would otherwise reach the DOM
      // and the browser would draw its own tooltip next to this one's, and the
      // rest are not valid button attributes. Everything else has to keep
      // flowing through, since a `DropdownMenuTrigger asChild` injects its
      // handlers and aria state as props on this component.
      title,
      icon,
      isActive,
      dataState,
      shortcutKeys,
      color,
      action,
      tooltipOptions,
      className,
      reserve,
      ...props
    },
    ref
  ) => {
    const Icon = icons[icon ?? ''];
    const Comp = asChild ? Slot : Button;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Comp
            // Without visible text the tooltip names the button.
            aria-label={title ? undefined : tooltip}
            className={cn(
              'richtext-h-[32px] richtext-min-w-0 richtext-max-w-32 richtext-overflow-hidden richtext-px-1.5 richtext-py-0',
              className
            )}
            data-state={dataState ? 'on' : 'off'} // active background control
            disabled={props?.disabled}
            ref={ref}
            variant='ghost'
            {...props}
          >
            <div className='richtext-flex richtext-h-full richtext-items-center richtext-font-normal'>
              {title && (
                <div className='richtext-grid richtext-grow richtext-text-left richtext-text-sm'>
                  <div className='richtext-col-start-1 richtext-row-start-1 richtext-truncate'>
                    {title}
                  </div>

                  {reserve?.map((text) => (
                    <div
                      aria-hidden='true'
                      className='richtext-invisible richtext-col-start-1 richtext-row-start-1 richtext-truncate'
                      key={text}
                    >
                      {text}
                    </div>
                  ))}
                </div>
              )}

              {Icon && (
                <Icon className='richtext-ml-0.5 richtext-size-3 richtext-shrink-0 richtext-text-zinc-500' />
              )}
            </div>
          </Comp>
        </TooltipTrigger>

        {tooltip && (
          <TooltipContent>
            <div className='richtext-flex richtext-max-w-24 richtext-flex-col richtext-items-center richtext-text-center'>
              {tooltip && <div>{tooltip}</div>}

              <div className='richtext-flex'>
                {!!shortcutKeys?.length && <span>{getShortcutKeys(shortcutKeys)}</span>}
              </div>
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    );
  }
);

export { ActionMenuButton };
