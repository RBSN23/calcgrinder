'use client';

// PROJ-16 — Text-block card (Builder + Visitor).
//
// Mounted via the SlotRenderer text_block registration. In resting state
// it renders the markdown body via the shared <MarkdownRenderer> — pixel-
// identical between Builder preview and visitor view by construction.
//
// In the Builder, hover affordances expose a drag handle, an edit icon,
// and a kebab (Delete). Clicking edit expands the card into the split-
// pane editor (desktop) / stacked editor (mobile). The visitor surface
// has no EditorProvider, so all edit-only state lives in the
// <TextBlockEditAffordance> child gated on `isBuilder`.
//
// Empty body in the visitor view renders NOTHING — no card, no spacer.

import * as React from 'react';

import { useIsBuilder } from '@/components/calculator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEditor } from '@/lib/editor/EditorProvider';
import type { TextBlockRow } from '@/lib/text-blocks/types';
import { cardSurface, type Theme } from '@/lib/themes';
import { cn } from '@/lib/utils';

import { DragHandle } from './dnd-helpers';
import { MarkdownRenderer } from '@/components/markdown/markdown-renderer';
import { TextBlockEditorPane } from './text-block-editor-pane';
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

  // Visitor view: empty body produces nothing — no card, no spacer.
  // PROJ-16 spec AC: "Other elements flow as if the text block didn't exist."
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

function TextBlockEditAffordance({
  textBlock,
  theme,
  isEmpty,
}: TextBlockEditAffordanceProps) {
  const { patchTextBlock, removeTextBlock } = useEditor();

  // Fresh blocks (empty body, never edited) auto-expand on creation so
  // the maintainer lands directly in the source editor. Once the body
  // has any content (or the maintainer collapses), it stays collapsed
  // across reloads.
  const [expanded, setExpanded] = React.useState(isEmpty);

  // Other surfaces (Grid drawer, +Add picker) can ask a specific block
  // to open by dispatching `cg:open-text-block` with the id. Mirrors
  // PROJ-15's `cg:open-chart-configurator` pattern.
  React.useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id !== textBlock.id) return;
      setExpanded(true);
    }
    window.addEventListener('cg:open-text-block', onOpen);
    return () => window.removeEventListener('cg:open-text-block', onOpen);
  }, [textBlock.id]);

  if (expanded) {
    return (
      <TextBlockExpandedView
        textBlock={textBlock}
        theme={theme}
        onCollapse={() => setExpanded(false)}
        onRemove={() => {
          setExpanded(false);
          void removeTextBlock(textBlock.id);
        }}
        onPatch={(body) => patchTextBlock(textBlock.id, body)}
      />
    );
  }

  return (
    <>
      <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <TooltipProvider delayDuration={120}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Edit text block"
                onClick={() => setExpanded(true)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-cg-surface/90 text-cg-text-muted shadow-sm ring-1 ring-cg-border hover:text-cg-text"
              >
                <PencilIcon />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Edit text block</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div
        className="cursor-text"
        onClick={(e) => {
          // Don't hijack clicks on links or the drag handle.
          const target = e.target as HTMLElement;
          if (target.closest('a') || target.closest('[data-drag-handle]')) return;
          setExpanded(true);
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
    </>
  );
}

interface TextBlockExpandedViewProps {
  textBlock: TextBlockRow;
  theme: Theme;
  onCollapse: () => void;
  onRemove: () => void;
  onPatch: (
    body: Parameters<
      ReturnType<typeof useEditor>['patchTextBlock']
    >[1],
  ) => Promise<unknown>;
}

function TextBlockExpandedView({
  textBlock,
  theme,
  onCollapse,
  onRemove,
  onPatch,
}: TextBlockExpandedViewProps) {
  return (
    <div className="relative flex flex-col gap-3">
      <div className="absolute right-0 top-0 flex items-center gap-1">
        <button
          type="button"
          onClick={onRemove}
          className="rounded px-2 py-1 text-[11.5px] font-medium text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
        <button
          type="button"
          aria-label="Collapse text block"
          onClick={onCollapse}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2"
        >
          <ChevronDownIcon />
        </button>
      </div>

      <TextBlockEditorPane
        textBlock={textBlock}
        theme={theme}
        onPatch={onPatch}
        onCollapse={onCollapse}
      />

      <TextBlockVisualPanel
        textBlock={textBlock}
        theme={theme}
        onPatch={onPatch}
      />
    </div>
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

function ChevronDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
