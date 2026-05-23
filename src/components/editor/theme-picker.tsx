'use client';

// PROJ-8 — Calculator theme picker.
//
// Two surface wrappers (desktop popover, mobile bottom sheet) share one
// inner list. The list iterates `getThemeIds()` in registry order and
// emits a `setTheme` action on click — the EditorProvider PATCHes the
// server and enrolls the change into the undo stack.

import * as React from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useEditor } from '@/lib/editor/EditorProvider';
import { ThemeSwatch, getTheme, getThemeIds } from '@/lib/themes';

import { Icons } from '../shell/icons';

interface ThemePickerListProps {
  activeId: string;
  onSelect: (id: string) => void;
}

function ThemePickerList({ activeId, onSelect }: ThemePickerListProps) {
  const ids = getThemeIds();
  return (
    <ul role="listbox" className="flex max-h-[60vh] flex-col overflow-y-auto py-1">
      {ids.map((id) => {
        const theme = getTheme(id);
        const isActive = id === activeId;
        return (
          <li key={id} role="option" aria-selected={isActive}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-cg-surface-2 focus:bg-cg-surface-2 focus:outline-none"
            >
              <ThemeSwatch theme={theme} size={36} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-semibold tracking-[-0.1px] text-cg-text">
                  {theme.displayName}
                </span>
                <span className="truncate text-[11.5px] text-cg-text-muted">
                  {theme.description}
                </span>
              </span>
              {isActive ? (
                <span aria-hidden className="text-cg-accent">
                  ✓
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function ThemePickerDesktop() {
  const { state, setTheme } = useEditor();
  const [open, setOpen] = React.useState(false);
  const theme = getTheme(state.calculator.theme_id);

  async function select(id: string) {
    setOpen(false);
    await setTheme(id);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Change calculator theme"
          className="inline-flex h-8 items-center gap-2 rounded-md border border-cg-border bg-cg-surface px-2 text-[13px] font-medium text-cg-text outline-none transition-colors hover:bg-cg-surface-2 focus-visible:ring-2 focus-visible:ring-cg-accent"
        >
          <ThemeSwatch theme={theme} size={22} />
          <span className="max-w-[140px] truncate">{theme.displayName}</span>
          <Icons.ChevD size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[300px] border-cg-border bg-cg-surface p-1"
      >
        <ThemePickerList activeId={state.calculator.theme_id} onSelect={select} />
      </PopoverContent>
    </Popover>
  );
}

export function ThemePickerMobile() {
  const { state, setTheme } = useEditor();
  const [open, setOpen] = React.useState(false);
  const theme = getTheme(state.calculator.theme_id);

  async function select(id: string) {
    setOpen(false);
    await setTheme(id);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Change calculator theme"
          className="inline-flex h-8 items-center gap-2 rounded-md border border-cg-border bg-cg-surface px-2 text-[13px] font-medium text-cg-text outline-none transition-colors hover:bg-cg-surface-2"
        >
          <ThemeSwatch theme={theme} size={22} />
          <span>Theme</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="border-cg-border bg-cg-surface p-3">
        <SheetTitle className="text-base font-semibold text-cg-text">
          Choose a theme
        </SheetTitle>
        <div className="mt-2">
          <ThemePickerList activeId={state.calculator.theme_id} onSelect={select} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
