'use client';

// PROJ-16 / PROJ-23 — Text-block card (Builder + Visitor).
//
// Mounted via the SlotRenderer text_block registration. Renders the
// markdown body via <MarkdownRenderer> — identical between Builder and
// Visitor by construction.
//
// PROJ-23 Issue 5 changes the Builder editing model:
// - Resting state = rendered markdown (same as visitor).
// - Click on content = inline textarea (no split-pane).
// - Pencil hover icon = opens TextBlockVisualPanel (style controls).
// - Empty body shows an empty-state placeholder; clicking opens textarea.

import * as React from 'react';

import { useIsBuilder } from '@/components/calculator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEditor } from '@/lib/editor/EditorProvider';
import { useDebouncedCallback } from '@/lib/text-blocks/use-debounced-callback';
import { TextBlockApiError } from '@/lib/text-blocks/client';
import type { TextBlockRow } from '@/lib/text-blocks/types';
import { cardSurface, type Theme } from '@/lib/themes';
import { cn } from '@/lib/utils';

import { DragHandle } from './dnd-helpers';
import { MarkdownRenderer } from '@/components/markdown/markdown-renderer';
import { TextBlockVisualPanel } from './text-block-visual-panel';

interface TextBlockCardProps {
  textBlock: TextBlockRow;
  theme: Theme;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  isDragging?: boolean;
}

export function TextBlockCard({
  textBlock,
  theme,
  dragHandleProps,
  isDragging,
}: TextBlockCardProps) {
  const isBuilder = useIsBuilder();

  if (!isBuilder && textBlock.body.trim() === '') return null;

  const surface = cardSurface(theme, 'generic');
  const cardStyle: React.CSSProperties = {
    ...surface,
    padding: 14,
    position: 'relative',
  };
  if (textBlock.card_border === 'hairline') {
    cardStyle.border = `1px solid ${theme.border}`;
  } else if (textBlock.card_border === 'strong') {
    cardStyle.border = `2px solid ${theme.borderStr}`;
  }
  if (textBlock.card_background_tint === 'soft') {
    cardStyle.background = theme.cardAlt;
  } else if (textBlock.card_background_tint === 'strong') {
    cardStyle.background = theme.accentSoft;
  }

  const isEmpty = textBlock.body.trim() === '';

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2',
        isDragging && 'ring-2 ring-cg-accent/40',
      )}
      style={cardStyle}
      data-text-block-id={textBlock.id}
      aria-label="Text block"
    >
      {isBuilder && dragHandleProps ? (
        <div className="pointer-events-none absolute left-1.5 top-1.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <DragHandle ariaLabel="Reorder text block" {...dragHandleProps} />
        </div>
      ) : null}

      {isBuilder ? (
        <TextBlockEditAffordance textBlock={textBlock} theme={theme} isEmpty={isEmpty} />
      ) : (
        <MarkdownRenderer
          body={textBlock.body}
          textSize={textBlock.text_size}
          textColour={textBlock.text_colour}
          theme={theme}
        />
      )}
    </div>
  );
}

interface TextBlockEditAffordanceProps {
  textBlock: TextBlockRow;
  theme: Theme;
  isEmpty: boolean;
}

const PATCH_DEBOUNCE_MS = 500;

function TextBlockEditAffordance({
  textBlock,
  theme,
  isEmpty,
}: TextBlockEditAffordanceProps) {
  const { patchTextBlock, removeTextBlock } = useEditor();
  const [editing, setEditing] = React.useState(isEmpty);
  const [visualPanelOpen, setVisualPanelOpen] = React.useState(false);
  const [body, setBody] = React.useState(textBlock.body);
  const lastServerBody = React.useRef(textBlock.body);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (textBlock.body !== lastServerBody.current) {
      lastServerBody.current = textBlock.body;
      setBody(textBlock.body);
    }
  }, [textBlock.body]);

  React.useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id !== textBlock.id) return;
      setEditing(true);
    }
    window.addEventListener('cg:open-text-block', onOpen);
    return () => window.removeEventListener('cg:open-text-block', onOpen);
  }, [textBlock.id]);

  const debouncedSave = useDebouncedCallback((nextBody: string) => {
    void patchTextBlock(textBlock.id, { body: nextBody })
      .then(() => { lastServerBody.current = nextBody; })
      .catch((e: unknown) => {
        if (e instanceof TextBlockApiError && e.code === 'body_too_large') {
          // Silently cap — the user sees the textarea content.
        }
      });
  }, PATCH_DEBOUNCE_MS);

  const handleChange = (next: string) => {
    setBody(next);
    debouncedSave(next);
  };

  const exitEdit = () => {
    debouncedSave.flush();
    setEditing(false);
  };

  React.useEffect(() => {
    return () => debouncedSave.flush();
  }, [debouncedSave]);

  return (
    <>
      {/* Hover affordances: pencil (visual panel) + delete */}
      <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <TooltipProvider delayDuration={120}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Text block style"
                onClick={() => setVisualPanelOpen((v) => !v)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-cg-surface/90 text-cg-text-muted shadow-sm ring-1 ring-cg-border hover:text-cg-text"
              >
                <PencilIcon />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Style controls</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Delete text block"
                onClick={() => void removeTextBlock(textBlock.id)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-cg-surface/90 text-red-600 shadow-sm ring-1 ring-cg-border hover:bg-red-50"
              >
                <TrashIcon />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Delete</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {editing ? (
        <textarea
          ref={textareaRef}
          autoFocus
          value={body}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={exitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              exitEdit();
            }
          }}
          placeholder="Write Markdown here…"
          spellCheck
          className="w-full resize-none rounded-md border border-cg-border bg-cg-surface p-2 font-mono text-[12.5px] leading-snug text-cg-text outline-none focus-visible:ring-2 focus-visible:ring-cg-accent/40"
          style={{ fieldSizing: 'content' as never, minHeight: 60 }}
        />
      ) : (
        <div
          className="cursor-text"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('a') || target.closest('[data-drag-handle]')) return;
            setEditing(true);
          }}
        >
          {isEmpty ? (
            <p className="text-[12.5px] italic text-cg-text-muted">
              Empty text block — click to edit
            </p>
          ) : (
            <MarkdownRenderer
              body={textBlock.body}
              textSize={textBlock.text_size}
              textColour={textBlock.text_colour}
              theme={theme}
            />
          )}
        </div>
      )}

      {visualPanelOpen ? (
        <TextBlockVisualPanel
          textBlock={textBlock}
          theme={theme}
          onPatch={(patchBody) => patchTextBlock(textBlock.id, patchBody)}
        />
      ) : null}
    </>
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

function TrashIcon() {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
