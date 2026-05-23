'use client';

// PROJ-9 — Memoised live formula evaluation hook.
//
// Maps the editor's CellRow[] (database shape) onto the formula
// engine's lighter `Cell[]` shape, runs `evaluateCalculator`, and
// returns the per-cell result map.

import * as React from 'react';

import type { CellRow } from '@/lib/cells/types';
import { evaluateCalculator, type Cell, type EvaluationResult, type Inputs } from '@/lib/formula';

function toEngineKind(cell: CellRow): Cell {
  if (cell.kind === 'input') {
    return {
      name: cell.name,
      kind: 'input',
      input_type: cell.value_type === 'select' ? 'text' : (cell.value_type as Cell['input_type']),
      default_value: cell.default_value ?? undefined,
    };
  }
  return {
    name: cell.name,
    kind: 'output',
    formula: cell.formula ?? '',
  };
}

export function useEvaluation(
  cells: CellRow[],
  inputs: Inputs,
): EvaluationResult {
  const engineCells = React.useMemo(() => cells.map(toEngineKind), [cells]);
  return React.useMemo(
    () => evaluateCalculator(engineCells, inputs),
    [engineCells, inputs],
  );
}
