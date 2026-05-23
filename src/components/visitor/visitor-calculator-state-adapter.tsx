'use client';

// PROJ-11 — Visitor adapter: forwards a static `PublicCalculator`
// payload + the ephemeral `<VisitorInputProvider>` to the shared
// `<CalculatorStateProvider>` so the same `<CalculatorRenderer>` tree
// (PROJ-9 components, refactored to consume the contexts) renders on
// the public surface.

import * as React from 'react';

import {
  CalculatorStateProvider,
  type CalculatorStateValue,
} from '@/components/calculator';
import type {
  PublicCalculator,
  PublicSection,
  PublicSectionCell,
} from '@/lib/calculators/types';
import type { CellRow } from '@/lib/cells/types';
import type { SectionRow } from '@/lib/sections/types';
import {
  evaluateCalculator,
  type Cell as EngineCell,
} from '@/lib/formula';

import { useVisitorInputStore } from './visitor-input-store';

const EMPTY_TIMESTAMP = '';

interface VisitorCalculatorStateAdapterProps {
  calculator: PublicCalculator;
  children: React.ReactNode;
}

export function VisitorCalculatorStateAdapter({
  calculator,
  children,
}: VisitorCalculatorStateAdapterProps) {
  const sections = React.useMemo<SectionRow[]>(
    () => calculator.sections.map((s) => toSectionRow(s, calculator.id)),
    [calculator.id, calculator.sections],
  );
  const cells = React.useMemo<CellRow[]>(
    () =>
      calculator.sections.flatMap((s) =>
        s.cells.map((c) => toCellRow(c, calculator.id, s.id)),
      ),
    [calculator.id, calculator.sections],
  );

  const { inputs, setInput } = useVisitorInputStore();

  const engineCells = React.useMemo<EngineCell[]>(
    () => cells.map(toEngineCell),
    [cells],
  );
  const results = React.useMemo(
    () => evaluateCalculator(engineCells, inputs),
    [engineCells, inputs],
  );
  const getResult = React.useCallback(
    (name: string) => results[name],
    [results],
  );

  const value = React.useMemo<CalculatorStateValue>(
    () => ({
      calculator: {
        id: calculator.id,
        title: calculator.title,
        description: calculator.description,
        theme_id: calculator.theme_id,
        updated_at: calculator.updated_at,
      },
      sections,
      cells,
      inputs,
      setInput,
      results,
      getResult,
    }),
    [calculator, sections, cells, inputs, setInput, results, getResult],
  );

  return (
    <CalculatorStateProvider value={value}>{children}</CalculatorStateProvider>
  );
}

function toSectionRow(section: PublicSection, calculator_id: string): SectionRow {
  return {
    id: section.id,
    calculator_id,
    title: section.title,
    description: section.description,
    layout_pattern_id: section.layout_pattern_id,
    display_order: section.display_order,
    created_at: EMPTY_TIMESTAMP,
    updated_at: EMPTY_TIMESTAMP,
  };
}

function toCellRow(
  cell: PublicSectionCell,
  calculator_id: string,
  section_id: string,
): CellRow {
  return {
    ...cell,
    calculator_id,
    section_id,
    created_at: EMPTY_TIMESTAMP,
    updated_at: EMPTY_TIMESTAMP,
  };
}

function toEngineCell(cell: CellRow): EngineCell {
  if (cell.kind === 'input') {
    return {
      name: cell.name,
      kind: 'input',
      input_type:
        cell.value_type === 'select'
          ? 'text'
          : (cell.value_type as EngineCell['input_type']),
      default_value: cell.default_value ?? undefined,
    };
  }
  return {
    name: cell.name,
    kind: 'output',
    formula: cell.formula ?? '',
  };
}
