'use client';

// PROJ-9 — Inline editable text primitive used by the hero, section
// header, and section description. Click → input/textarea, Enter / blur
// → commit via onCommit, Esc → revert. The visual surface in resting
// state is just `children` (text); the editing surface mirrors the
// resting-state styling so the swap is visually unobtrusive.

import * as React from 'react';

import { cn } from '@/lib/utils';

interface EditableTextProps {
  value: string;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  maxLength?: number;
  /** Called with the trimmed new value. */
  onCommit: (next: string) => void | Promise<void>;
  /**
   * Optional validator run on commit. When it returns `ok: false` the
   * input stays in edit mode, the value is re-selected, and the input
   * pulses red for 600ms (mirrors PROJ-8's BreadcrumbEditableSegment
   * "shake/border-red treatment" — see Section management UI in the
   * PROJ-9 spec for the empty-section-title edge case).
   */
  validate?: (next: string) => { ok: boolean };
  /** Optional renderer for the resting state (e.g. styled h1). */
  renderResting?: (props: { displayValue: string; isPlaceholder: boolean }) => React.ReactNode;
  /** Show the pencil hover affordance. Default true. */
  showHoverAffordance?: boolean;
}

export function EditableText({
  value,
  placeholder,
  ariaLabel,
  className,
  inputClassName,
  multiline = false,
  maxLength,
  onCommit,
  validate,
  renderResting,
  showHoverAffordance = true,
}: EditableTextProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [invalid, setInvalid] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  const startEdit = React.useCallback(() => {
    setDraft(value);
    setEditing(true);
    setInvalid(false);
  }, [value]);

  const commit = React.useCallback(async () => {
    const trimmed = multiline ? draft : draft.trim();
    if (validate && !validate(trimmed).ok) {
      // Mirror PROJ-8's BreadcrumbEditableSegment pattern: stay focused,
      // re-select, pulse red 600ms. Caller's onCommit is NOT invoked.
      setInvalid(true);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          if ('select' in el) el.select();
        }
      });
      window.setTimeout(() => setInvalid(false), 600);
      return;
    }
    setEditing(false);
    if (trimmed === value) return;
    await onCommit(trimmed);
  }, [draft, multiline, onCommit, value, validate]);

  const cancel = React.useCallback(() => {
    setDraft(value);
    setEditing(false);
    setInvalid(false);
  }, [value]);

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          ref={(el) => {
            inputRef.current = el;
          }}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          value={draft}
          maxLength={maxLength}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          className={cn(
            'w-full resize-none border-none bg-transparent outline-none ring-1 rounded px-1 py-0.5',
            invalid
              ? 'ring-2 ring-cg-danger animate-pulse'
              : 'ring-cg-accent/40',
            inputClassName ?? className,
          )}
          rows={3}
        />
      );
    }
    return (
      <input
        autoFocus
        ref={(el) => {
          inputRef.current = el;
        }}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        value={draft}
        maxLength={maxLength}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        className={cn(
          'border-none bg-transparent outline-none ring-1 rounded px-1',
          invalid
            ? 'ring-2 ring-cg-danger animate-pulse'
            : 'ring-cg-accent/40',
          inputClassName ?? className,
        )}
      />
    );
  }

  const isPlaceholder = value.length === 0;
  const displayValue = isPlaceholder ? placeholder ?? '' : value;

  return (
    <button
      type="button"
      aria-label={`${ariaLabel} — click to edit`}
      onClick={startEdit}
      className={cn(
        'group inline-flex w-full max-w-full items-baseline gap-1 rounded text-left transition-colors hover:bg-cg-surface-2/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cg-accent',
        className,
      )}
    >
      {renderResting ? (
        renderResting({ displayValue, isPlaceholder })
      ) : (
        <span
          className={cn(
            'truncate',
            isPlaceholder && 'italic text-cg-text-muted',
          )}
        >
          {displayValue}
        </span>
      )}
      {showHoverAffordance ? (
        <span
          aria-hidden
          className="ml-1 opacity-0 transition-opacity group-hover:opacity-60"
        >
          <PencilIcon />
        </span>
      ) : null}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
