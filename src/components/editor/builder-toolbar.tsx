'use client';

// PROJ-9 / PROJ-10 — Builder toolbar (desktop).
//
// Layout: Undo · Redo · separator · Preview · Status pill · Sharing ·
// separator · ViewportPicker · HiddenCellsPill · spacer · AddPicker.
// PROJ-9 owned Undo/Redo/Add. PROJ-10 inserts Preview / clickable
// Status pill / Sharing icon-button between the Undo/Redo block and
// the ViewportPicker.

import * as React from 'react';

import {
  CalculatorApiError,
  patchCalculator,
} from '@/lib/calculators/client';
import { useEditor } from '@/lib/editor/EditorProvider';

import { AddPicker, type AddPickerOption } from './add-picker';
import { HiddenCellsPill } from './hidden-cells-pill';
import { Icons } from '../shell/icons';
import { Pill } from '../shell/pill';
import { SharingPopover } from './sharing-popover';
import { UndoRedoButtons } from './undo-redo-buttons';
import { ViewportPicker } from './viewport-picker';

export function BuilderToolbar() {
  const { state, dispatch, addSection, addCell } = useEditor();
  const [publishBusy, setPublishBusy] = React.useState(false);
  const calc = state.calculator;

  const handleTogglePublish = React.useCallback(async () => {
    if (publishBusy) return;
    const next = !calc.published;
    setPublishBusy(true);
    try {
      const fresh = await patchCalculator(calc.id, {
        updated_at: calc.updated_at,
        published: next,
      });
      dispatch({
        type: 'SET_PUBLISHED',
        published: fresh.published,
        updated_at: fresh.updated_at,
      });
    } catch (err) {
      const { toast } = await import('sonner');
      if (err instanceof CalculatorApiError && err.status === 409) {
        toast.error('Calculator was updated elsewhere — refreshed.');
      } else {
        toast.error(
          next
            ? "Couldn't publish — please try again."
            : "Couldn't unpublish — please try again.",
        );
      }
    } finally {
      setPublishBusy(false);
    }
  }, [calc.id, calc.published, calc.updated_at, dispatch, publishBusy]);

  const previewHref = `/c/${calc.public_token}`;

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
      <a
        href={previewHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Preview calculator in a new tab"
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-cg-border bg-cg-surface px-2.5 text-[12px] font-medium text-cg-text hover:bg-cg-surface-2 focus-visible:ring-2 focus-visible:ring-cg-border"
      >
        <Icons.External size={14} aria-hidden />
        Preview
      </a>
      <button
        type="button"
        onClick={handleTogglePublish}
        disabled={publishBusy}
        aria-label={
          calc.published
            ? 'Calculator is published — click to unpublish'
            : 'Calculator is a draft — click to publish'
        }
        aria-pressed={calc.published}
        className="inline-flex items-center rounded-full focus-visible:ring-2 focus-visible:ring-cg-border disabled:opacity-60"
      >
        <Pill kind={calc.published ? 'published' : 'draft'}>
          {calc.published ? 'Published' : 'Draft'}
        </Pill>
      </button>
      <SharingPopover />
      <span className="mx-1 h-5 w-px bg-cg-border" aria-hidden />
      <ViewportPicker />
      <HiddenCellsPill />
      <span className="flex-1" />
      <AddPicker options={options} />
    </div>
  );
}
