'use client';

// PROJ-9 / PROJ-11 / PROJ-24 — Section list (shared by Builder and Visitor).
//
// In builder mode hosts two DndContext layers:
//   1. Outer: section-level drag-reorder (vertical list strategy).
//   2. Inner (ElementDndProvider): element-level drag across all sections.
//      Each section's BuilderLayoutGrid provides a SortableContext;
//      cross-section drops are handled by the shared onDragEnd.
//
// In visitor mode renders the sections read-only with no drag chrome.

import * as React from 'react';

import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import {
  useCalculatorState,
  useIsBuilder,
} from '@/components/calculator';
import { useEditor } from '@/lib/editor/EditorProvider';
import type { Theme } from '@/lib/themes';
import type { SectionRow } from '@/lib/sections/types';

import { SortableItem, useEditorDndSensors } from './dnd-helpers';
import { SectionBlock } from './section-block';

interface SectionListProps {
  theme: Theme;
}

export function SectionList({ theme }: SectionListProps) {
  const isBuilder = useIsBuilder();
  return isBuilder ? (
    <BuilderSectionList theme={theme} />
  ) : (
    <ReadOnlySectionList theme={theme} />
  );
}

function ReadOnlySectionList({ theme }: SectionListProps) {
  const { sections, cells } = useCalculatorState();
  return (
    <div className="flex flex-col gap-3">
      {sections.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          cells={cells.filter((c) => c.section_id === section.id)}
          theme={theme}
          canDelete={false}
        />
      ))}
    </div>
  );
}

const ElementDndContext = React.createContext<{
  activeElementId: string | null;
}>({ activeElementId: null });

export function useElementDnd() {
  return React.useContext(ElementDndContext);
}

function BuilderSectionList({ theme }: SectionListProps) {
  const { sections, cells, charts, text_blocks } = useCalculatorState();
  const { addSection, patchSection, patchCell, patchChart, patchTextBlock } = useEditor();
  const canDelete = sections.length > 1;

  const sectionSensors = useEditorDndSensors();
  const elementSensors = useEditorDndSensors();
  const [activeSectionId, setActiveSectionId] = React.useState<string | null>(null);
  const [activeElementId, setActiveElementId] = React.useState<string | null>(null);

  const sectionIds = React.useMemo(() => sections.map((s) => s.id), [sections]);

  const handleSectionDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      setActiveSectionId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      void patchSection(active.id as string, { display_order: newIndex });
    },
    [sections, patchSection],
  );

  const handleElementDragStart = React.useCallback(
    (event: DragStartEvent) => {
      setActiveElementId(event.active.id as string);
    },
    [],
  );

  const handleElementDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      setActiveElementId(null);
      const { active, over } = event;
      if (!over) return;
      if (active.id === over.id) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const sourceSectionId =
        (active.data.current as { sectionId?: string } | undefined)?.sectionId;
      const targetSectionId =
        (over.data.current as { sectionId?: string } | undefined)?.sectionId;

      if (!sourceSectionId || !targetSectionId) return;

      const activeType =
        (active.data.current as { type?: string } | undefined)?.type ?? 'cell';

      if (sourceSectionId === targetSectionId) {
        // Same-section reorder
        if (activeType === 'chart') {
          const sectionCharts = charts
            .filter((c) => c.section_id === sourceSectionId)
            .sort((a, b) => a.display_order - b.display_order);
          const newIndex = sectionCharts.findIndex((c) => c.id === overId);
          if (newIndex !== -1) {
            void patchChart(activeId, { display_order: newIndex });
          }
        } else if (activeType === 'text_block') {
          const sectionTbs = text_blocks
            .filter((t) => t.section_id === sourceSectionId)
            .sort((a, b) => a.display_order - b.display_order);
          const newIndex = sectionTbs.findIndex((t) => t.id === overId);
          if (newIndex !== -1) {
            void patchTextBlock(activeId, { display_order: newIndex });
          }
        } else {
          const sectionCells = cells
            .filter((c) => c.section_id === sourceSectionId && c.visibility === 'visible')
            .sort((a, b) => a.display_order - b.display_order);
          const newIndex = sectionCells.findIndex((c) => c.id === overId);
          if (newIndex !== -1) {
            void patchCell(activeId, { display_order: newIndex });
          }
        }
      } else {
        // Cross-section move — compute the target display_order from the
        // drop target's position in the target section.
        let targetOrder = 0;
        if (activeType === 'chart') {
          const targetCharts = charts
            .filter((c) => c.section_id === targetSectionId)
            .sort((a, b) => a.display_order - b.display_order);
          const overIdx = targetCharts.findIndex((c) => c.id === overId);
          targetOrder = overIdx !== -1 ? overIdx : targetCharts.length;
          void patchChart(activeId, { section_id: targetSectionId, display_order: targetOrder });
        } else if (activeType === 'text_block') {
          const targetTbs = text_blocks
            .filter((t) => t.section_id === targetSectionId)
            .sort((a, b) => a.display_order - b.display_order);
          const overIdx = targetTbs.findIndex((t) => t.id === overId);
          targetOrder = overIdx !== -1 ? overIdx : targetTbs.length;
          void patchTextBlock(activeId, { section_id: targetSectionId, display_order: targetOrder });
        } else {
          const targetCells = cells
            .filter((c) => c.section_id === targetSectionId && c.visibility === 'visible')
            .sort((a, b) => a.display_order - b.display_order);
          const overIdx = targetCells.findIndex((c) => c.id === overId);
          targetOrder = overIdx !== -1 ? overIdx : targetCells.length;
          void patchCell(activeId, { section_id: targetSectionId, display_order: targetOrder });
        }
      }
    },
    [cells, charts, text_blocks, patchCell, patchChart, patchTextBlock],
  );

  const activeSection: SectionRow | null = activeSectionId
    ? sections.find((s) => s.id === activeSectionId) ?? null
    : null;

  const activeElement = React.useMemo(() => {
    if (!activeElementId) return null;
    const cell = cells.find((c) => c.id === activeElementId);
    if (cell) return { type: 'cell' as const, label: cell.label || cell.name };
    const chart = charts.find((c) => c.id === activeElementId);
    if (chart) return { type: 'chart' as const, label: chart.title || chart.name };
    const tb = text_blocks.find((t) => t.id === activeElementId);
    if (tb) return { type: 'text_block' as const, label: 'Text block' };
    return null;
  }, [activeElementId, cells, charts, text_blocks]);

  const elementDndValue = React.useMemo(
    () => ({ activeElementId }),
    [activeElementId],
  );

  return (
    <DndContext
      sensors={sectionSensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveSectionId(e.active.id as string)}
      onDragCancel={() => setActiveSectionId(null)}
      onDragEnd={handleSectionDragEnd}
    >
      <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
        <ElementDndContext.Provider value={elementDndValue}>
          <DndContext
            sensors={elementSensors}
            collisionDetection={closestCenter}
            onDragStart={handleElementDragStart}
            onDragCancel={() => setActiveElementId(null)}
            onDragEnd={handleElementDragEnd}
          >
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
            <DragOverlay>
              {activeElement ? (
                <div className="rounded-md border border-cg-accent/40 bg-cg-surface p-3 shadow-lg">
                  <p className="text-[12px] font-medium text-cg-text">{activeElement.label}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </ElementDndContext.Provider>
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
