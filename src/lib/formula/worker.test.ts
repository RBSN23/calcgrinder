import { describe, expect, it, vi, beforeEach } from 'vitest';

import { evaluateCalculator } from './evaluator';
import type { Cell, Inputs } from './types';
import type { WorkerRequest, WorkerResponse } from './worker';

vi.mock('./evaluator', () => ({
  evaluateCalculator: vi.fn(() => ({ price: { value: 42, shape: 'scalar' } })),
}));

describe('Formula Worker message handler', () => {
  let handler: (e: MessageEvent<WorkerRequest>) => void;
  const postMessageSpy = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    postMessageSpy.mockReset();
    (globalThis as unknown as { self: unknown }).self = {
      onmessage: null,
      postMessage: postMessageSpy,
    };
  });

  async function loadWorker() {
    const mod = await import('./worker');
    handler = (globalThis as unknown as { self: { onmessage: typeof handler } }).self.onmessage;
    return mod;
  }

  it('calls evaluateCalculator with the received cells and inputs', async () => {
    await loadWorker();
    const cells: Cell[] = [
      { name: 'price', kind: 'input', input_type: 'number', default_value: 100 },
    ];
    const inputs: Inputs = { price: 42 };
    const event = { data: { id: 1, cells, inputs } } as MessageEvent<WorkerRequest>;
    handler(event);

    expect(evaluateCalculator).toHaveBeenCalledWith(cells, inputs);
  });

  it('posts back the result with the matching request id', async () => {
    await loadWorker();
    const cells: Cell[] = [];
    const inputs: Inputs = {};
    const event = { data: { id: 7, cells, inputs } } as MessageEvent<WorkerRequest>;
    handler(event);

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, results: expect.any(Object) }),
    );
  });
});
