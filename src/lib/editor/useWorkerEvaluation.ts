'use client';

import * as React from 'react';

import type { CellRow } from '@/lib/cells/types';
import { evaluateCalculator, type Cell, type EvaluationResult, type Inputs } from '@/lib/formula';
import type { WorkerRequest, WorkerResponse } from '@/lib/formula/worker';

function toEngineCell(cell: CellRow): Cell {
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

let requestCounter = 0;

export function useWorkerEvaluation(
  cells: CellRow[],
  inputs: Inputs,
): EvaluationResult {
  const engineCells = React.useMemo(() => cells.map(toEngineCell), [cells]);
  const workerRef = React.useRef<Worker | null>(null);
  const latestRequestId = React.useRef(0);
  const [workerAvailable, setWorkerAvailable] = React.useState<boolean | null>(null);

  const syncResults = React.useMemo(
    () => evaluateCalculator(engineCells, inputs),
    [engineCells, inputs],
  );

  const [asyncResults, setAsyncResults] = React.useState<EvaluationResult | null>(null);

  React.useEffect(() => {
    if (typeof Worker === 'undefined') {
      setWorkerAvailable(false);
      return;
    }

    try {
      const w = new Worker(
        new URL('@/lib/formula/worker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = w;
      setWorkerAvailable(true);

      w.onmessage = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.id === latestRequestId.current) {
          setAsyncResults(e.data.results);
        }
      };

      w.onerror = () => {
        setWorkerAvailable(false);
        w.terminate();
        workerRef.current = null;
      };

      return () => {
        w.terminate();
        workerRef.current = null;
      };
    } catch {
      setWorkerAvailable(false);
    }
  }, []);

  React.useEffect(() => {
    if (!workerRef.current || workerAvailable !== true) return;
    const id = ++requestCounter;
    latestRequestId.current = id;
    workerRef.current.postMessage({
      id,
      cells: engineCells,
      inputs,
    } satisfies WorkerRequest);
  }, [engineCells, inputs, workerAvailable]);

  if (workerAvailable === false || asyncResults === null) {
    return syncResults;
  }

  return asyncResults;
}
