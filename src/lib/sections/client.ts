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

export async function createSection(
  calculatorId: string,
  body: CreateSectionBody = {},
): Promise<SectionRow> {
  const res = await fetch(
    `/api/calculators/${encodeURIComponent(calculatorId)}/sections`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as SectionRow;
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
): Promise<SectionRow> {
  const res = await fetch(`/api/sections/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as SectionRow;
}

export async function deleteSection(
  id: string,
  opts: { confirmDeleteWithChildren?: boolean } = {},
): Promise<void> {
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
}
