// PROJ-15 — Client-side wrappers around the chart API routes.
// Mirrors the shape PROJ-9's cells client established.

import type {
  ChartCardBackgroundTint,
  ChartCardBorder,
  ChartCardSizeHint,
  ChartRow,
  ChartStyle,
  ChartType,
} from './types';
import type { ChartBindings } from './bindings';

export class ChartApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly serverUpdatedAt?: string;
  readonly conflictingChartId?: string;
  readonly reservedWord?: string;
  readonly max?: number;
  readonly allowedTokens?: string[];
  constructor(
    status: number,
    message: string,
    extra: {
      code?: string;
      serverUpdatedAt?: string;
      conflictingChartId?: string;
      reservedWord?: string;
      max?: number;
      allowedTokens?: string[];
    } = {},
  ) {
    super(message);
    this.name = 'ChartApiError';
    this.status = status;
    this.code = extra.code;
    this.serverUpdatedAt = extra.serverUpdatedAt;
    this.conflictingChartId = extra.conflictingChartId;
    this.reservedWord = extra.reservedWord;
    this.max = extra.max;
    this.allowedTokens = extra.allowedTokens;
  }
}

async function parseError(res: Response): Promise<ChartApiError> {
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
  return new ChartApiError(res.status, code ?? `HTTP ${res.status}`, {
    code,
    serverUpdatedAt:
      'server_updated_at' in obj ? String(obj.server_updated_at) : undefined,
    conflictingChartId:
      'conflicting_chart_id' in obj
        ? String(obj.conflicting_chart_id)
        : undefined,
    reservedWord:
      'reserved_word' in obj ? String(obj.reserved_word) : undefined,
    max: 'max' in obj && typeof obj.max === 'number' ? obj.max : undefined,
    allowedTokens:
      'allowed_tokens' in obj && Array.isArray(obj.allowed_tokens)
        ? (obj.allowed_tokens as unknown[]).map(String)
        : undefined,
  });
}

export interface CreateChartBody {
  chart_type?: ChartType;
  name?: string;
  title?: string;
  subtitle?: string;
  bindings?: ChartBindings;
  style?: Partial<ChartStyle>;
  card_accent?: string;
  card_background_tint?: ChartCardBackgroundTint;
  card_border?: ChartCardBorder;
  card_size_hint?: ChartCardSizeHint;
  display_order?: number;
  insert_after_element_id?: string;
  id?: string;
}

export interface CreateChartResult {
  chart: ChartRow;
  calculatorUpdatedAt: string | null;
}

export interface DeleteChartResult {
  calculatorUpdatedAt: string | null;
}

export interface PatchChartBody extends Omit<CreateChartBody, 'id' | 'insert_after_element_id'> {
  updated_at: string;
  section_id?: string; // server rejects this with 422 (cross-section move unsupported)
}

export interface PatchChartResponse {
  chart: ChartRow;
  calculatorUpdatedAt: string | null;
}

export async function createChart(
  sectionId: string,
  body: CreateChartBody = {},
): Promise<CreateChartResult> {
  const res = await fetch(
    `/api/sections/${encodeURIComponent(sectionId)}/charts`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw await parseError(res);
  const payload = (await res.json()) as {
    chart: ChartRow;
    calculator_updated_at: string | null;
  };
  return {
    chart: payload.chart,
    calculatorUpdatedAt: payload.calculator_updated_at,
  };
}

export async function patchChart(
  id: string,
  body: PatchChartBody,
): Promise<PatchChartResponse> {
  const res = await fetch(`/api/charts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  const payload = (await res.json()) as {
    chart: ChartRow;
    calculator_updated_at: string | null;
  };
  return {
    chart: payload.chart,
    calculatorUpdatedAt: payload.calculator_updated_at,
  };
}

export async function deleteChart(id: string): Promise<DeleteChartResult> {
  const res = await fetch(`/api/charts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw await parseError(res);
  const payload = (await res.json()) as { calculator_updated_at: string | null };
  return { calculatorUpdatedAt: payload.calculator_updated_at };
}
