import { evaluateCalculator } from './evaluator';
import type { Cell, EvaluationResult, Inputs } from './types';

export interface WorkerRequest {
  id: number;
  cells: Cell[];
  inputs: Inputs;
}

export interface WorkerResponse {
  id: number;
  results: EvaluationResult;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, cells, inputs } = e.data;
  const results = evaluateCalculator(cells, inputs);
  (self as unknown as Worker).postMessage({ id, results } satisfies WorkerResponse);
};
