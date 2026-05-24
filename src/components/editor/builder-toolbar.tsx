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
import { getChartStructuralErrors } from '@/lib/charts/structural-errors';
import { useEditor } from '@/lib/editor/EditorProvider';
import { useEvaluationContext } from '@/lib/editor/EvaluationContext';
import { getStructuralErrors, type Cell as EngineCell } from '@/lib/formula';

import { AddPicker } from './add-picker';
import { HiddenCellsPill } from './hidden-cells-pill';
import { Icons } from '../shell/icons';
import { Pill } from '../shell/pill';
import { SharingPopover } from './sharing-popover';
import { UndoRedoButtons } from './undo-redo-buttons';
import { useAddPickerOptions } from './use-add-picker-options';
import { ViewportPicker } from './viewport-picker';

export function BuilderToolbar() {
  const { state, dispatch } = useEditor();
  const { results } = useEvaluationContext();
  const options = useAddPickerOptions();
  const [publishBusy, setPublishBusy] = React.useState(false);
  const calc = state.calculator;

  // PROJ-15 — Publish-gate: cell + chart structural errors block toggling
  // a draft → published. Tooltip surfaces a chart-only count per the AC.
  const engineCells = React.useMemo<EngineCell[]>(
    () =>
      state.cells.map((c) => {
        if (c.kind === 'input') {
          return {
            name: c.name,
            kind: 'input',
            input_type:
              c.value_type === 'select'
                ? 'text'
                : (c.value_type as EngineCell['input_type']),
            default_value: c.default_value ?? undefined,
          };
        }
        return { name: c.name, kind: 'output', formula: c.formula ?? '' };
      }),
    [state.cells],
  );
  const cellErrors = React.useMemo(
    () => getStructuralErrors(engineCells),
    [engineCells],
  );
  const cellMeta = React.useMemo(
    () => state.cells.map((c) => ({ id: c.id, name: c.name })),
    [state.cells],
  );
  const chartErrors = React.useMemo(
    () => getChartStructuralErrors(state.charts, results, cellMeta),
    [state.charts, results, cellMeta],
  );
  const chartsWithErrors = React.useMemo(() => {
    const ids = new Set<string>();
    for (const e of chartErrors) ids.add(e.chart_id);
    return ids.size;
  }, [chartErrors]);
  const hasBlockingErrors = cellErrors.length > 0 || chartErrors.length > 0;

  // Only gate the draft → published transition; unpublish must always
  // remain reachable so the maintainer can take a broken calc offline.
  const publishGateDisabled = !calc.published && hasBlockingErrors;
  const publishTooltip = publishGateDisabled
    ? chartsWithErrors > 0
      ? `${chartsWithErrors} chart${chartsWithErrors === 1 ? '' : 's'} ${
          chartsWithErrors === 1 ? 'has' : 'have'
        } errors that need fixing before publishing.`
      : 'Some cells have errors that need fixing before publishing.'
    : undefined;

  const handleTogglePublish = React.useCallback(async () => {
    if (publishBusy) return;
    if (publishGateDisabled) return;
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
  }, [
    calc.id,
    calc.published,
    calc.updated_at,
    dispatch,
    publishBusy,
    publishGateDisabled,
  ]);

  const previewHref = `/c/${calc.public_token}`;

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
        disabled={publishBusy || publishGateDisabled}
        aria-disabled={publishBusy || publishGateDisabled || undefined}
        title={publishTooltip}
        aria-label={
          calc.published
            ? 'Calculator is published — click to unpublish'
            : publishGateDisabled
              ? publishTooltip
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
