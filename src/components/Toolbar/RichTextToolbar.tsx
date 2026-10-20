import React, { forwardRef, useEffect, useRef, useState } from 'react';

import { ActionButton } from '@/components/ActionButton';
import { cn } from '@/lib/utils';

/**
 * Toolbar building blocks for a host that composes its own bar: a row, a
 * divider, a "More" panel with labelled rows, and a plain button for custom
 * actions. Every `RichText*` control from the extensions drops into any of
 * them, and so does anything of your own.
 */

export interface RichTextToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** The bar itself: wraps, pads, and separates itself from the document. */
export const RichTextToolbar = forwardRef<HTMLDivElement, RichTextToolbarProps>(
  function RichTextToolbar({ children, className, ...props }, ref) {
    return (
      <div
        className={cn(
          'richtext-flex richtext-flex-wrap richtext-items-center richtext-gap-0.5 richtext-border-0 richtext-border-b richtext-border-solid richtext-border-border richtext-bg-background richtext-px-2 richtext-py-1.5',
          className
        )}
        ref={ref}
        role='toolbar'
        {...props}
      >
        {children}
      </div>
    );
  }
);

/** A thin vertical line between groups of controls. */
export function RichTextToolbarDivider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'richtext-mx-1 richtext-h-5 richtext-w-px richtext-shrink-0 richtext-bg-border',
        className
      )}
    />
  );
}

export interface RichTextToolbarButtonProps {
  /** Name from the icon set, e.g. `'Bold'`; see the icons reference. */
  icon?: string;
  /** Text shown next to the icon, or instead of it. */
  label?: string;
  tooltip?: string;
  shortcutKeys?: string[];
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

/**
 * A toolbar button for an action of your own — a custom extension command, a
 * dialog, a save button — styled like the built-in controls.
 */
export function RichTextToolbarButton({
  icon,
  label,
  tooltip,
  shortcutKeys,
  active,
  disabled,
  onClick,
  children,
}: RichTextToolbarButtonProps) {
  return (
    <ActionButton
      action={onClick}
      customClass={label ? '!richtext-w-auto richtext-gap-1.5 richtext-px-2' : undefined}
      disabled={disabled}
      icon={icon}
      isActive={() => !!active}
      shortcutKeys={shortcutKeys}
      tooltip={tooltip ?? label}
    >
      {label ? <span className='richtext-text-sm'>{label}</span> : null}
      {children}
    </ActionButton>
  );
}

/**
 * Clicking the label should do what clicking the control does. Radix triggers
 * open on pointerdown and ignore click; plain buttons do the opposite, so the
 * two are told apart by `aria-haspopup`.
 */
function activateControl(row: HTMLElement | null) {
  const button = row?.querySelector('button');

  if (!button) {
    return;
  }

  if (button.getAttribute('aria-haspopup')) {
    for (const type of ['pointerdown', 'pointerup'] as const) {
      button.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0 }));
    }

    return;
  }

  button.click();
}

export interface RichTextToolbarMoreRowProps {
  children: React.ReactNode;
  /** Shown next to the control, so nothing hides behind a tooltip. */
  label: string;
  /** For a control wider than the icon slot: the row spans both columns. */
  wide?: boolean;
}

/**
 * One control in the More panel. The control sits in a fixed-width slot so
 * every label in a column starts at the same x.
 */
export function RichTextToolbarMoreRow({ children, label, wide }: RichTextToolbarMoreRowProps) {
  const row = useRef<HTMLDivElement>(null);

  const name = (
    <span
      className='richtext-min-w-0 richtext-flex-1 richtext-cursor-default richtext-truncate richtext-text-[13px] richtext-leading-5 richtext-text-foreground'
      onClick={() => activateControl(row.current)}
      title={label}
    >
      {label}
    </span>
  );

  return (
    <div
      className={cn(
        'richtext-flex richtext-min-w-0 richtext-items-center richtext-gap-1.5 richtext-rounded-md richtext-pr-1 hover:richtext-bg-accent/60',
        wide && 'richtext-col-span-2'
      )}
      ref={row}
    >
      {wide ? (
        <>
          <span className='richtext-w-12 richtext-shrink-0' />
          {name}
          {children}
        </>
      ) : (
        <>
          <span className='richtext-flex richtext-w-12 richtext-shrink-0 richtext-items-center'>
            {children}
          </span>
          {name}
        </>
      )}
    </div>
  );
}

const GROUP_COLUMNS = {
  2: 'richtext-grid-cols-2',
  3: 'richtext-grid-cols-3',
  4: 'richtext-grid-cols-4',
} as const;

/** A titled section of the More panel: rows in two (default), three or four columns. */
export function RichTextToolbarMoreGroup({
  children,
  label,
  columns = 2,
}: {
  children: React.ReactNode;
  label: string;
  /** Rows per line. Default 2; a wider panel fits 3. */
  columns?: 2 | 3 | 4;
}) {
  return (
    <div className='richtext-flex richtext-flex-col richtext-gap-0.5'>
      <span className='richtext-px-1 richtext-pb-0.5 richtext-text-[11px] richtext-font-medium richtext-uppercase richtext-tracking-wide richtext-text-muted-foreground'>
        {label}
      </span>

      <div className={cn('richtext-grid richtext-gap-x-2', GROUP_COLUMNS[columns])}>{children}</div>
    </div>
  );
}

export interface RichTextToolbarMoreProps {
  children: React.ReactNode;
  /** Accessible name of the trigger, e.g. `t('editor.more')`. */
  label: string;
  /** Panel width; the default fits two columns of labelled rows. */
  width?: number | string;
  /** Replace the default "⋯" trigger. */
  trigger?: React.ReactNode;
}

/**
 * The overflow panel: everything that does not earn a permanent slot in the
 * top row, shown with labels instead of tooltips. Menus opened from inside it
 * (font size, line height…) stay open while the panel is up.
 */
export function RichTextToolbarMore({
  children,
  label,
  width = 440,
  trigger,
}: RichTextToolbarMoreProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;

      // A control in the panel opens its own dropdown in a portal outside this
      // subtree; closing on those clicks would unmount its trigger.
      if (
        target?.closest(
          '[data-richtext-portal], [data-radix-popper-content-wrapper], [role="dialog"]'
        )
      ) {
        return;
      }

      if (target && container.current?.contains(target)) {
        return;
      }

      // While a Radix menu is open the body has `pointer-events: none`, so a
      // click on the panel reports <body>; test the geometry instead.
      const hit = [container.current, panel.current].some((element) => {
        const rect = element?.getBoundingClientRect();

        return (
          rect &&
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        );
      });

      if (!hit) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className='richtext-relative' ref={container}>
      <button
        aria-expanded={open}
        aria-haspopup='true'
        aria-label={label}
        className='richtext-flex richtext-size-8 richtext-items-center richtext-justify-center richtext-rounded-md richtext-border-none richtext-bg-transparent richtext-text-foreground/70 hover:richtext-bg-accent aria-expanded:richtext-bg-accent'
        onClick={() => setOpen((previous) => !previous)}
        title={label}
        type='button'
      >
        {trigger ?? (
          <svg fill='currentColor' height='16' viewBox='0 0 16 16' width='16'>
            <circle cx='3' cy='8' r='1.4' />
            <circle cx='8' cy='8' r='1.4' />
            <circle cx='13' cy='8' r='1.4' />
          </svg>
        )}
      </button>

      {open && (
        <div
          className='richtext-absolute richtext-right-0 richtext-top-10 richtext-z-20 richtext-flex richtext-max-h-[70vh] richtext-flex-col richtext-gap-3 richtext-overflow-y-auto richtext-rounded-xl richtext-border richtext-border-solid richtext-border-border richtext-bg-popover richtext-p-3 richtext-text-popover-foreground richtext-shadow-xl richtext-ring-1 richtext-ring-black/5'
          data-richtext-portal
          ref={panel}
          style={{ width }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
