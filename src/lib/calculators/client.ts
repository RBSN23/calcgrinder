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
  // PROJ-10 — extended whitelist: the publish toggle rides on PATCH so
  // it shares the same optimistic-concurrency contract as other field
  // edits. Dedicated token rotation and soft-delete live in their own
  // endpoints below.
  published?: boolean;
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

// PROJ-10 — token rotation. Overwrites public_token with a fresh
// 22-char URL-safe base64 string and bumps updated_at. The popover
// in the editor toolbar re-paints with the response; the old URL
// becomes 404 once PROJ-11 ships.
export async function regenerateCalculatorToken(
  id: string,
  updatedAt: string,
): Promise<CalculatorRow> {
  const res = await fetch(
    `/api/calculators/${encodeURIComponent(id)}/regenerate-token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ updated_at: updatedAt }),
    },
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as CalculatorRow;
}

// PROJ-10 — same-owner deep copy. Returns the new row (plus a
// `default_section_id` hint for the editor's first paint, same
// shape as POST /api/calculators).
export interface DuplicateResponse extends CalculatorRow {
  default_section_id: string;
}

export async function duplicateCalculator(
  id: string,
): Promise<DuplicateResponse> {
  const res = await fetch(
    `/api/calculators/${encodeURIComponent(id)}/duplicate`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    },
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as DuplicateResponse;
}

// PROJ-10 — soft-delete. Sets soft_delete_at = NOW(); recovery
// lives in PROJ-13. Echoes the new updated_at so any callers
// holding the row in memory can refresh their concurrency token.
export interface SoftDeleteResponse {
  updated_at: string;
}

export async function softDeleteCalculator(
  id: string,
  updatedAt: string,
): Promise<SoftDeleteResponse> {
  const res = await fetch(`/api/calculators/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ updated_at: updatedAt }),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as SoftDeleteResponse;
}

// PROJ-13 — restore a soft-deleted calculator. The server preserves
// `published` and `public_token`; if the original title collides with
// an active row, the response carries the auto-resolved title and
// `renamed: true` so the caller can toast the rename.
export interface RestoreResponse extends CalculatorRow {
  renamed: boolean;
}

export async function restoreCalculator(
  id: string,
  updatedAt: string,
): Promise<RestoreResponse> {
  const res = await fetch(
    `/api/calculators/${encodeURIComponent(id)}/restore`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ updated_at: updatedAt }),
    },
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as RestoreResponse;
}

// PROJ-13 — hard-delete (Delete permanently). Sends DELETE with
// `?hard=true`; the row must already be in Trash (`soft_delete_at IS
// NOT NULL`), otherwise the server returns 400 not_in_trash.
export interface HardDeleteResponse {
  ok: true;
  purged_orphan_count: number;
}

export async function hardDeleteCalculator(
  id: string,
  updatedAt: string,
): Promise<HardDeleteResponse> {
  const res = await fetch(
    `/api/calculators/${encodeURIComponent(id)}?hard=true`,
    {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ updated_at: updatedAt }),
    },
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as HardDeleteResponse;
}

// PROJ-13 — orphan-scenarios count for the Delete-permanently confirm
// sheet. Returns the total number of scenarios pointing at this
// calculator, regardless of who owns them.
export interface ScenariosCountResponse {
  count: number;
}

export async function getScenariosCount(
  id: string,
): Promise<ScenariosCountResponse> {
  const res = await fetch(
    `/api/calculators/${encodeURIComponent(id)}/scenarios-count`,
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as ScenariosCountResponse;
}
