'use client';

// PROJ-15 — Shared +Add picker options.
//
// The Builder toolbar and the Grid-panel header both expose the same 4-option
// +Add picker (Cell · Chart · Text block · Section) with consistent enabled /
// disabled states. Hoisting the option list here keeps the two surfaces in
// lock-step — if PROJ-16 enables Text block, both pickers pick it up via
// this hook.

import * as React from 'react';

import { MAX_CHARTS } from '@/lib/charts/limits';
import { useEditor } from '@/lib/editor/EditorProvider';
import { MAX_TEXT_BLOCKS } from '@/lib/text-blocks/limits';

import { type AddPickerOption } from './add-picker';
import { Icons } from '../shell/icons';

export function useAddPickerOptions(): AddPickerOption[] {
  const { state, addSection, addCell, addChart, addTextBlock } = useEditor();

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

  const handleAddChart = React.useCallback(() => {
    const last = state.sections[state.sections.length - 1];
    if (last) {
      void addChart(last.id);
    } else {
      void addSection().then((section) => {
        if (section) void addChart(section.id);
      });
    }
  }, [state.sections, addChart, addSection]);

  const handleAddTextBlock = React.useCallback(() => {
    const last = state.sections[state.sections.length - 1];
    if (last) {
      void addTextBlock(last.id);
    } else {
      void addSection().then((section) => {
        if (section) void addTextBlock(section.id);
      });
    }
  }, [state.sections, addTextBlock, addSection]);

  const handleAddSection = React.useCallback(() => {
    void addSection();
  }, [addSection]);

  const atChartCap = state.charts.length >= MAX_CHARTS;
  const atTextBlockCap = state.text_blocks.length >= MAX_TEXT_BLOCKS;

  return React.useMemo<AddPickerOption[]>(
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
        disabled: atChartCap,
        tooltipWhenDisabled: atChartCap
          ? `Limit of ${MAX_CHARTS} charts reached.`
          : undefined,
        onSelect: atChartCap ? undefined : handleAddChart,
      },
      {
        id: 'text',
        label: 'Text block',
        subtitle: 'Write Markdown content',
        icon: <Icons.Menu size={14} />,
        disabled: atTextBlockCap,
        tooltipWhenDisabled: atTextBlockCap
          ? `Limit of ${MAX_TEXT_BLOCKS} text blocks reached.`
          : undefined,
        onSelect: atTextBlockCap ? undefined : handleAddTextBlock,
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
    [
      handleAddCell,
      handleAddChart,
      handleAddTextBlock,
      handleAddSection,
      atChartCap,
      atTextBlockCap,
    ],
  );
}
