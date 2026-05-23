// PROJ-8 — Client-side wrappers around the calculator API routes.
//
// Both surfaces (dashboard Hero, top-bar "+ New calculator", inline rename,
// theme picker) call into these helpers. The helpers are deliberately thin
// — they own only HTTP wiring + JSON shape, never UI side-effects (no
// toasts, no router.push). The callers stitch in their own UI behaviour.

import type { CalculatorRow } from './types';

export class CalculatorApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly serverUpdatedAt?: string;
  constructor(
    status: number,
    message: string,
    extra: { code?: string; serverUpdatedAt?: string } = {},
  ) {
    super(message);
    this.name = 'CalculatorApiError';
    this.status = status;
    this.code = extra.code;
    this.serverUpdatedAt = extra.serverUpdatedAt;
  }
}

async function parseError(res: Response): Promise<CalculatorApiError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const code =
    body && typeof body === 'object' && 'error' in body
      ? String((body as { error: unknown }).error)
      : undefined;
  const serverUpdatedAt =
    body && typeof body === 'object' && 'server_updated_at' in body
      ? String((body as { server_updated_at: unknown }).server_updated_at)
      : undefined;
  return new CalculatorApiError(
    res.status,
    code ?? `HTTP ${res.status}`,
    { code, serverUpdatedAt },
  );
}

export async function createCalculator(): Promise<CalculatorRow> {
  const res = await fetch('/api/calculators', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as CalculatorRow;
}

export interface PatchCalculatorBody {
  updated_at: string;
  title?: string;
  description?: string;
  theme_id?: string;
}

export async function patchCalculator(
  id: string,
  body: PatchCalculatorBody,
): Promise<CalculatorRow> {
  const res = await fetch(`/api/calculators/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as CalculatorRow;
}
