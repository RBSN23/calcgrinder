// PROJ-9 — Client-side wrappers around the section API routes.

import type { SectionRow } from './types';

export class SectionApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly serverUpdatedAt?: string;
  readonly childCount?: number;
  constructor(
    status: number,
    message: string,
    extra: {
      code?: string;
      serverUpdatedAt?: string;
      childCount?: number;
    } = {},
  ) {
    super(message);
    this.name = 'SectionApiError';
    this.status = status;
    this.code = extra.code;
    this.serverUpdatedAt = extra.serverUpdatedAt;
    this.childCount = extra.childCount;
  }
}

async function parseError(res: Response): Promise<SectionApiError> {
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
  const serverUpdatedAt =
    'server_updated_at' in obj ? String(obj.server_updated_at) : undefined;
  const childCount =
    'child_count' in obj && typeof obj.child_count === 'number'
      ? obj.child_count
      : undefined;
  return new SectionApiError(res.status, code ?? `HTTP ${res.status}`, {
    code,
    serverUpdatedAt,
    childCount,
  });
}

export interface CreateSectionBody {
  title?: string;
  description?: string;
  layout_pattern_id?: string;
  after_section_id?: string | null;
  /** Optional explicit id for undo-driven recreates. */
  id?: string;
}

// Every mutation response echoes the parent calculator's bumped
// `updated_at` so the client can refresh its optimistic-concurrency
// token in lock-step with the server's parent-bump trigger.
export interface SectionMutationResult {
  section: SectionRow;
  calculatorUpdatedAt: string | null;
}

export interface DeleteSectionResult {
  calculatorUpdatedAt: string | null;
}

export async function createSection(
  calculatorId: string,
  body: CreateSectionBody = {},
): Promise<SectionMutationResult> {
  const res = await fetch(
    `/api/calculators/${encodeURIComponent(calculatorId)}/sections`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw await parseError(res);
  const payload = (await res.json()) as {
    section: SectionRow;
    calculator_updated_at: string | null;
  };
  return {
    section: payload.section,
    calculatorUpdatedAt: payload.calculator_updated_at,
  };
}

export interface PatchSectionBody {
  updated_at: string;
  title?: string;
  description?: string;
  layout_pattern_id?: string;
  display_order?: number;
}

export async function patchSection(
  id: string,
  body: PatchSectionBody,
): Promise<SectionMutationResult> {
  const res = await fetch(`/api/sections/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  const payload = (await res.json()) as {
    section: SectionRow;
    calculator_updated_at: string | null;
  };
  return {
    section: payload.section,
    calculatorUpdatedAt: payload.calculator_updated_at,
  };
}

export async function deleteSection(
  id: string,
  opts: { confirmDeleteWithChildren?: boolean } = {},
): Promise<DeleteSectionResult> {
  const url = new URL(
    `/api/sections/${encodeURIComponent(id)}`,
    'http://placeholder',
  );
  if (opts.confirmDeleteWithChildren) {
    url.searchParams.set('confirm_delete_with_children', 'true');
  }
  const res = await fetch(
    url.pathname + (url.search || ''),
    { method: 'DELETE' },
  );
  if (!res.ok) throw await parseError(res);
  const payload = (await res.json()) as { calculator_updated_at: string | null };
  return { calculatorUpdatedAt: payload.calculator_updated_at };
}
