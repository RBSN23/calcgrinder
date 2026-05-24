// PROJ-9 — Client-side wrappers around the cell API routes.

import type { CellRow, TabularColumn } from './types';

export class CellApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly serverUpdatedAt?: string;
  readonly conflictingCellId?: string;
  readonly reservedWord?: string;
  readonly affectedCellIds?: string[];
  readonly max?: number;
  readonly reason?: string;
  constructor(
    status: number,
    message: string,
    extra: {
      code?: string;
      serverUpdatedAt?: string;
      conflictingCellId?: string;
      reservedWord?: string;
      affectedCellIds?: string[];
      max?: number;
      reason?: string;
    } = {},
  ) {
    super(message);
    this.name = 'CellApiError';
    this.status = status;
    this.code = extra.code;
    this.serverUpdatedAt = extra.serverUpdatedAt;
    this.conflictingCellId = extra.conflictingCellId;
    this.reservedWord = extra.reservedWord;
    this.affectedCellIds = extra.affectedCellIds;
    this.max = extra.max;
    this.reason = extra.reason;
  }
}

async function parseError(res: Response): Promise<CellApiError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const obj = (body && typeof body === 'object' ? body : {}) as Record<
    string,
    unknown
  >;
  const code = 'error' in obj ? String(obj.error) : undefined;
  return new CellApiError(res.status, code ?? `HTTP ${res.status}`, {
    code,
    serverUpdatedAt:
      'server_updated_at' in obj ? String(obj.server_updated_at) : undefined,
    conflictingCellId:
      'conflicting_cell_id' in obj ? String(obj.conflicting_cell_id) : undefined,
    reservedWord:
      'reserved_word' in obj ? String(obj.reserved_word) : undefined,
    affectedCellIds:
      'affected_cell_ids' in obj && Array.isArray(obj.affected_cell_ids)
        ? (obj.affected_cell_ids as unknown[]).map(String)
        : undefined,
    max:
      'max' in obj && typeof obj.max === 'number' ? obj.max : undefined,
    reason: 'reason' in obj ? String(obj.reason) : undefined,
  });
}

export interface CreateCellBody {
  // All fields optional — the API fills sensible defaults if omitted.
  kind?: 'input' | 'output';
  name?: string;
  label?: string;
  description?: string;
  description_render?: 'caption' | 'tooltip';
  value_type?:
    | 'number'
    | 'currency'
    | 'percent'
    | 'date'
    | 'boolean'
    | 'select'
    | 'text';
  visibility?: 'visible' | 'hidden';
  editability?: 'editable' | 'readonly';
  default_value?: unknown;
  formula?: string;
  display_widget?: string;
  display_format?: string;
  display_emphasis?: 'plain' | 'kpi' | 'tabular';
  unit?: string;
  numeric_min?: number;
  numeric_max?: number;
  numeric_step?: number;
  select_options?: { id: string; label: string }[];
  currency_code?: string;
  card_accent?: string;
  card_background_tint?: 'none' | 'soft' | 'strong';
  card_border?: 'none' | 'hairline' | 'strong';
  card_size_hint?: 'narrow' | 'wide' | 'full';
  text_size?: string;
  text_colour?: string;
  tabular_columns?: TabularColumn[];
  display_order?: number;
  // Optional explicit id for undo-driven recreates.
  id?: string;
}

// Every mutation response echoes the parent calculator's bumped
// `updated_at` so the client can refresh its optimistic-concurrency
// token in lock-step with the server's parent-bump trigger.
export interface CreateCellResult {
  cell: CellRow;
  calculatorUpdatedAt: string | null;
}

export interface DeleteCellResult {
  calculatorUpdatedAt: string | null;
}

export async function createCell(
  sectionId: string,
  body: CreateCellBody = {},
): Promise<CreateCellResult> {
  const res = await fetch(
    `/api/sections/${encodeURIComponent(sectionId)}/cells`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw await parseError(res);
  const payload = (await res.json()) as {
    cell: CellRow;
    calculator_updated_at: string | null;
  };
  return {
    cell: payload.cell,
    calculatorUpdatedAt: payload.calculator_updated_at,
  };
}

export interface PatchCellBody extends Omit<CreateCellBody, 'id'> {
  updated_at: string;
  // For renames: rewrite dependent formulas in the same transaction.
  // Defaults to true server-side.
  rewrite_dependents?: boolean;
}

export interface PatchCellResponse {
  cell: CellRow;
  rewritten_cell_ids: string[];
  calculatorUpdatedAt: string | null;
}

export async function patchCell(
  id: string,
  body: PatchCellBody,
): Promise<PatchCellResponse> {
  const res = await fetch(`/api/cells/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  const payload = (await res.json()) as {
    cell: CellRow;
    rewritten_cell_ids: string[];
    calculator_updated_at: string | null;
  };
  return {
    cell: payload.cell,
    rewritten_cell_ids: payload.rewritten_cell_ids,
    calculatorUpdatedAt: payload.calculator_updated_at,
  };
}

export async function deleteCell(id: string): Promise<DeleteCellResult> {
  const res = await fetch(`/api/cells/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw await parseError(res);
  const payload = (await res.json()) as { calculator_updated_at: string | null };
  return { calculatorUpdatedAt: payload.calculator_updated_at };
}
