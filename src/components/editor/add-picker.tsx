'use client';

// PROJ-8 — Builder "+ Add" picker.
//
// Registry-driven so PROJ-9 (Cell + Section) and P1 (Chart + Text-block)
// enable rows by passing `disabled: false` plus an `onSelect`. The picker
// shell never changes.

import * as React from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { Icons } from '../shell/icons';

export interface AddPickerOption {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  disabled: boolean;
  tooltipWhenDisabled?: string;
  onSelect?: () => void;
}

interface AddPickerProps {
  options: AddPickerOption[];
}

export function AddPicker({ options }: AddPickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Add element"
          className="inline-flex h-8 items-center gap-1 rounded-md bg-cg-accent px-3 text-[13px] font-semibold text-cg-accent-fg outline-none transition-colors hover:bg-cg-accent-hov focus-visible:ring-2 focus-visible:ring-cg-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cg-surface"
        >
          <Icons.Plus size={14} />
          <span>Add</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[260px] border-cg-border bg-cg-surface p-1"
      >
        <TooltipProvider delayDuration={150}>
          <ul role="menu" className="flex flex-col">
            {options.map((opt) => {
              const button = (
                <button
                  type="button"
                  role="menuitem"
                  disabled={opt.disabled}
                  aria-disabled={opt.disabled || undefined}
                  onClick={() => {
                    if (opt.disabled) return;
                    setOpen(false);
                    opt.onSelect?.();
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-md px-2 py-2 text-left text-[13px] transition-colors',
                    opt.disabled
                      ? 'cursor-not-allowed text-cg-text-subtle'
                      : 'text-cg-text hover:bg-cg-surface-2 focus:bg-cg-surface-2 focus:outline-none',
                  )}
                >
                  <span
                    className={cn(
                      'mt-[2px] flex h-6 w-6 items-center justify-center rounded-md',
                      opt.disabled
                        ? 'bg-cg-surface-2 text-cg-text-subtle'
                        : 'bg-cg-surface-2 text-cg-text-muted',
                    )}
                    aria-hidden
                  >
                    {opt.icon}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-medium leading-tight">{opt.label}</span>
                    <span className="text-[11.5px] text-cg-text-muted leading-tight">
                      {opt.subtitle}
                    </span>
                  </span>
                </button>
              );
              return (
                <li key={opt.id}>
                  {opt.disabled && opt.tooltipWhenDisabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block">{button}</span>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        {opt.tooltipWhenDisabled}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    button
                  )}
                </li>
              );
            })}
          </ul>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The fixed option list PROJ-8 ships. PROJ-9 will pass enabled overrides
 * for Cell + Section; P1 will enable Chart + Text-block.
 */
export const PROJ_8_OPTIONS: AddPickerOption[] = [
  {
    id: 'cell',
    label: 'Cell',
    subtitle: 'Add an input or output value',
    icon: <Icons.Plus size={14} />,
    disabled: true,
    tooltipWhenDisabled: 'Cell authoring ships next.',
  },
  {
    id: 'chart',
    label: 'Chart',
    subtitle: 'Visualise a calculation',
    icon: <Icons.LayoutGrid size={14} />,
    disabled: true,
    tooltipWhenDisabled: 'Charts ship in v1.1.',
  },
  {
    id: 'text',
    label: 'Text block',
    subtitle: 'Write Markdown content',
    icon: <Icons.Menu size={14} />,
    disabled: true,
    tooltipWhenDisabled: 'Text blocks ship in v1.1.',
  },
  {
    id: 'section',
    label: 'Section',
    subtitle: 'Group elements together',
    icon: <Icons.Menu size={14} />,
    disabled: true,
    tooltipWhenDisabled: 'Section management ships next.',
  },
];
