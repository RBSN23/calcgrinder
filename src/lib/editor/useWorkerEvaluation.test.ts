import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import type { CellRow } from '@/lib/cells/types';
import * as formula from '@/lib/formula';

import { useWorkerEvaluation } from './useWorkerEvaluation';

vi.mock('@/lib/formula', async (importOriginal) => {
  const actual = await importOriginal<typeof formula>();
  return {
    ...actual,
    evaluateCalculator: vi.fn(actual.evaluateCalculator),
  };
});

const CELL: CellRow = {
  id: 'cell-1',
  calculator_id: 'calc-1',
  section_id: 'sec-1',
  kind: 'input',
  name: 'price',
  label: 'Price',
  description: '',
  description_render: 'caption',
  value_type: 'number',
  visibility: 'visible',
  editability: 'editable',
  default_value: 100,
  formula: null,
  display_widget: 'number_field',
  display_format: 'auto',
  display_emphasis: 'plain',
  unit: null,
  numeric_min: null,
  numeric_max: null,
  numeric_step: null,
  select_options: null,
  currency_code: null,
  card_accent: 'theme',
  card_background_tint: 'none',
  card_border: 'none',
  card_size_hint: 'narrow',
  text_size: 'm',
  text_colour: 'default',
  tabular_columns: [],
  display_order: 0,
  created_at: '2026-05-25T00:00:00.000Z',
  updated_at: '2026-05-25T00:00:00.000Z',
};

const OUTPUT_CELL: CellRow = {
  ...CELL,
  id: 'cell-2',
  name: 'total',
  kind: 'output',
  formula: 'price * 2',
  editability: 'readonly',
  display_widget: 'number_field',
};

describe('useWorkerEvaluation', () => {
  const originalWorker = globalThis.Worker;

  beforeEach(() => {
    vi.mocked(formula.evaluateCalculator).mockClear();
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
  });

  it('falls back to synchronous evaluation when Worker is unavailable', () => {
    (globalThis as unknown as { Worker: undefined }).Worker = undefined;

    const { result } = renderHook(() =>
      useWorkerEvaluation([CELL, OUTPUT_CELL], { price: 50 }),
    );

    expect(result.current.total).toBeDefined();
    expect(result.current.total.value).toBe(100);
    expect(formula.evaluateCalculator).toHaveBeenCalled();
  });

  it('evaluates input cells with their provided input values', () => {
    (globalThis as unknown as { Worker: undefined }).Worker = undefined;

    const { result } = renderHook(() =>
      useWorkerEvaluation([CELL], { price: 42 }),
    );

    expect(result.current.price).toBeDefined();
    expect(result.current.price.value).toBe(42);
  });

  it('evaluates input cells with default_value when no input provided', () => {
    (globalThis as unknown as { Worker: undefined }).Worker = undefined;

    const { result } = renderHook(() =>
      useWorkerEvaluation([CELL], {}),
    );

    expect(result.current.price).toBeDefined();
    expect(result.current.price.value).toBe(100);
  });
});
