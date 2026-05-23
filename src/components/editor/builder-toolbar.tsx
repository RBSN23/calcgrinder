'use client';

// PROJ-9 — Builder toolbar (desktop).
//
// Layout: Undo · Redo · separator · ViewportPicker · HiddenCellsPill ·
// spacer · AddPicker. Cell + Section options are enabled in PROJ-9.

import * as React from 'react';

import { useEditor } from '@/lib/editor/EditorProvider';

import { AddPicker, type AddPickerOption } from './add-picker';
import { HiddenCellsPill } from './hidden-cells-pill';
import { Icons } from '../shell/icons';
import { UndoRedoButtons } from './undo-redo-buttons';
import { ViewportPicker } from './viewport-picker';

export function BuilderToolbar() {
  const { state, addSection, addCell } = useEditor();

  const handleAddCell = React.useCallback(() => {
    const last = state.sections[state.sections.length - 1];
    if (last) {
      void addCell(last.id);
    } else {
      void addSection().then((section) => {
        if (section) void addCell(section.id);
      });
    }
  }, [state.sections, addCell, addSection]);

  const handleAddSection = React.useCallback(() => {
    void addSection();
  }, [addSection]);

  const options = React.useMemo<AddPickerOption[]>(
    () => [
      {
        id: 'cell',
        label: 'Cell',
        subtitle: 'Add an input or output value',
        icon: <Icons.Plus size={14} />,
        disabled: false,
        onSelect: handleAddCell,
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
        disabled: false,
        onSelect: handleAddSection,
      },
    ],
    [handleAddCell, handleAddSection],
  );

  return (
    <div
      role="toolbar"
      aria-label="Builder toolbar"
      className="flex h-11 shrink-0 items-center gap-2 border-b border-cg-border bg-cg-surface px-3"
    >
      <UndoRedoButtons />
      <span className="mx-1 h-5 w-px bg-cg-border" aria-hidden />
      <ViewportPicker />
      <HiddenCellsPill />
      <span className="flex-1" />
      <AddPicker options={options} />
    </div>
  );
}
