'use client';

// PROJ-9 — Section block: header, toolbar, layout-pattern grid, hidden
// dots, empty placeholder. Hosts a nested DndContext for cell
// drag-reorder within the section.

import * as React from 'react';

import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyOrErrorState } from '@/components/shell';
import { useEditor, useEditorToast } from '@/lib/editor/EditorProvider';
import type { CellRow } from '@/lib/cells/types';
import type { SectionRow } from '@/lib/sections/types';
import { MAX_SECTION_TITLE_LENGTH, validateSectionTitle } from '@/lib/sections/types';
import { resolveLayoutPattern, type Theme } from '@/lib/themes';
import { cn } from '@/lib/utils';

import { CellCard } from './cell-card';
import { DestructiveConfirmSheet } from './destructive-confirm-sheet';
import { DragHandle, SortableItem, useEditorDndSensors } from './dnd-helpers';
import { EditableText } from './editable-text';
import { HiddenCellDot } from './hidden-cell-dot';
import { LayoutPatternPicker } from './layout-pattern-picker';

interface SectionBlockProps {
  section: SectionRow;
  cells: CellRow[];
  theme: Theme;
  /** True when the section can be deleted (i.e. not the only section). */
  canDelete: boolean;
  /** Drag-handle props from the parent SortableItem (section reorder). */
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  isDragging?: boolean;
}

export function SectionBlock({
  section,
  cells,
  theme,
  canDelete,
  dragHandleProps,
  isDragging,
}: SectionBlockProps) {
  const { patchSection, removeSection, addCell } = useEditor();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const { pattern, fellBack } = resolveLayoutPattern(theme.layoutPatterns, section.layout_pattern_id);

  const visibleCells = React.useMemo(
    () => cells.filter((c) => c.visibility === 'visible'),
    [cells],
  );
  const hiddenCells = React.useMemo(
    () => cells.filter((c) => c.visibility === 'hidden'),
    [cells],
  );

  return (
    <section
      data-section-id={section.id}
      className={cn(
        'group/section relative flex flex-col gap-2 rounded-md border border-dashed border-transparent p-2 transition-colors hover:border-cg-border',
        isDragging && 'border-cg-accent/40 bg-cg-surface',
      )}
    >
      <header className="flex items-start gap-2">
        <div className="opacity-0 transition-opacity group-hover/section:opacity-100">
          {dragHandleProps ? (
            <DragHandle ariaLabel={`Reorder section: ${section.title}`} {...dragHandleProps} />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <EditableText
            value={section.title}
            ariaLabel="Section title"
            maxLength={MAX_SECTION_TITLE_LENGTH}
            validate={(next) => ({ ok: validateSectionTitle(next).ok })}
            onCommit={async (next) => {
              await patchSection(section.id, { title: next });
            }}
            renderResting={({ displayValue }) => (
              <h2
                style={{
                  fontFamily: theme.font,
                  fontSize: 16,
                  fontWeight: 700,
                  color: theme.ink,
                }}
              >
                {displayValue}
              </h2>
            )}
            inputClassName="w-full font-bold"
          />
          <EditableText
            value={section.description}
            placeholder="Add a description"
            ariaLabel="Section description"
            multiline
            onCommit={async (next) => {
              await patchSection(section.id, { description: next });
            }}
            renderResting={({ displayValue, isPlaceholder }) => (
              <p
                className={cn(
                  'text-[12.5px] leading-snug',
                  isPlaceholder && 'italic opacity-60',
                )}
                style={{ color: theme.muted, whiteSpace: 'pre-wrap' }}
              >
                {displayValue}
              </p>
            )}
            inputClassName="w-full text-[12.5px]"
            showHoverAffordance={false}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/section:opacity-100">
          <LayoutPatternPicker
            patterns={theme.layoutPatterns}
            activeId={pattern.id}
            onPick={(id) => patchSection(section.id, { layout_pattern_id: id })}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Section options"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2"
              >
                <DotsVerticalIcon />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-cg-surface">
              <DropdownMenuItem
                disabled={!canDelete}
                onSelect={(e) => {
                  e.preventDefault();
                  if (!canDelete) return;
                  if (cells.length === 0) {
                    void removeSection(section.id);
                  } else {
                    setConfirmOpen(true);
                  }
                }}
                className="text-red-600 focus:bg-red-50 focus:text-red-700"
                title={!canDelete ? 'A calculator must have at least one section.' : undefined}
              >
                Delete section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {fellBack ? (
        <EmptyOrErrorState
          variant="error"
          framed={false}
          title={`Layout '${section.layout_pattern_id}' isn't available in this theme`}
          body="Using Single column. Pick a new layout to dismiss."
        />
      ) : null}

      {cells.length === 0 ? (
        <EmptySectionPlaceholder onAdd={() => addCell(section.id)} />
      ) : (
        <LayoutPatternGrid
          sectionId={section.id}
          columnSpans={pattern.columnSpans}
          visibleCells={visibleCells}
          hiddenCells={hiddenCells}
          theme={theme}
        />
      )}

      <DestructiveConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete section «${section.title}»?`}
        description={`Its ${cells.length} element${cells.length === 1 ? '' : 's'} will be removed too.`}
        onConfirm={() => removeSection(section.id, { confirmDeleteWithChildren: true })}
      />
    </section>
  );
}

interface LayoutPatternGridProps {
  sectionId: string;
  columnSpans: number[];
  visibleCells: CellRow[];
  hiddenCells: CellRow[];
  theme: Theme;
}

function LayoutPatternGrid({
  sectionId,
  columnSpans,
  visibleCells,
  hiddenCells,
  theme,
}: LayoutPatternGridProps) {
  const { state, patchCell } = useEditor();
  const toast = useEditorToast();
  const template = columnSpans.map((s) => `${s}fr`).join(' ');

  const sensors = useEditorDndSensors();
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Drag scope: only the visible cells of THIS section. Cross-section
  // drag is intentionally blocked at the API; we mirror that in the UI
  // by giving each section its own DndContext + SortableContext.
  const orderedIds = React.useMemo(
    () => visibleCells.map((c) => c.id),
    [visibleCells],
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;
      // Defensive: cross-section drops are nominally impossible (each
      // section is its own SortableContext), but if a stray id leaks
      // surface the spec-mandated toast and abort.
      const targetSectionId = state.cells.find((c) => c.id === over.id)?.section_id;
      if (targetSectionId && targetSectionId !== sectionId) {
        toast("Cross-section moves aren't supported yet.");
        return;
      }
      if (active.id === over.id) return;
      const oldIndex = visibleCells.findIndex((c) => c.id === active.id);
      const newIndex = visibleCells.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      // Server-side renumber repacks siblings; we only PATCH the
      // dragged cell's new index. The patchCell call enrolls an undo
      // entry so a single Cmd-Z restores the prior order.
      void patchCell(active.id as string, { display_order: newIndex });
    },
    [visibleCells, sectionId, state.cells, patchCell, toast],
  );

  const activeCell = activeId
    ? visibleCells.find((c) => c.id === activeId) ?? null
    : null;

  return (
    <div className="flex flex-col gap-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
          <div className="grid w-full gap-3" style={{ gridTemplateColumns: template }}>
            {visibleCells.map((cell) => (
              <SortableItem key={cell.id} id={cell.id}>
                {({ setNodeRef, style, dragHandleProps, isDragging }) => (
                  <div ref={setNodeRef} style={style} className="min-w-0">
                    <CellCard
                      cell={cell}
                      theme={theme}
                      dragHandleProps={dragHandleProps}
                      isDragging={isDragging}
                    />
                  </div>
                )}
              </SortableItem>
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeCell ? (
            <div className="rounded-md border border-cg-accent/40 bg-cg-surface p-3 shadow-lg">
              <p className="text-[12px] font-medium text-cg-text">{activeCell.label || activeCell.name}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {hiddenCells.length > 0 ? (
        <div className="-mt-1 flex flex-wrap items-center justify-center gap-1.5">
          {hiddenCells.map((c) => (
            <HiddenCellDot key={c.id} cell={c} accent={theme.accent} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptySectionPlaceholder({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex w-full items-center justify-center rounded-md border border-dashed border-cg-border bg-cg-surface/40 px-4 py-6 text-[12.5px] text-cg-text-muted transition-colors hover:bg-cg-surface-2"
    >
      Drop elements here, or use + Add
    </button>
  );
}

function DotsVerticalIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}
