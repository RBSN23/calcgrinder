'use client';

// PROJ-9 — Section list (Builder canvas).
//
// Hosts the DndContext that drives section drag-reorder. Each section
// is a SortableItem keyed by its id; the drop event PATCHes
// display_order via the editor store (which transactionally renumbers
// siblings server-side).

import * as React from 'react';

import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { useEditor } from '@/lib/editor/EditorProvider';
import type { Theme } from '@/lib/themes';

import { SortableItem, useEditorDndSensors } from './dnd-helpers';
import { SectionBlock } from './section-block';

interface SectionListProps {
  theme: Theme;
}

export function SectionList({ theme }: SectionListProps) {
  const { state, addSection, patchSection } = useEditor();
  const { sections, cells } = state;
  const canDelete = sections.length > 1;

  const sensors = useEditorDndSensors();
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sectionIds = React.useMemo(() => sections.map((s) => s.id), [sections]);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      // Single PATCH on the dragged section — server-side renumber
      // repacks siblings transactionally. patchSection() enrolls a
      // single undo entry so Cmd-Z restores the prior order in one
      // step (spec line 612-613).
      void patchSection(active.id as string, { display_order: newIndex });
    },
    [sections, patchSection],
  );

  const activeSection = activeId
    ? sections.find((s) => s.id === activeId) ?? null
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3">
          {sections.map((section) => (
            <SortableItem key={section.id} id={section.id}>
              {({ setNodeRef, style, dragHandleProps, isDragging }) => (
                <div ref={setNodeRef} style={style}>
                  <SectionBlock
                    section={section}
                    cells={cells.filter((c) => c.section_id === section.id)}
                    theme={theme}
                    canDelete={canDelete}
                    dragHandleProps={dragHandleProps}
                    isDragging={isDragging}
                  />
                </div>
              )}
            </SortableItem>
          ))}
          <button
            type="button"
            onClick={() => addSection()}
            className="self-center inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-cg-border bg-cg-surface/60 px-3 text-[12.5px] font-medium text-cg-text-muted transition-colors hover:bg-cg-surface-2"
          >
            + Add section
          </button>
        </div>
      </SortableContext>
      <DragOverlay>
        {activeSection ? (
          <div className="rounded-md border border-cg-accent/40 bg-cg-surface p-2 shadow-lg">
            <p className="text-[13px] font-medium text-cg-text">{activeSection.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
