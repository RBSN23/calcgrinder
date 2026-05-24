// PROJ-16 — Client-side wrappers around the text-block API routes.
// Mirrors the shape PROJ-15's chart client established.

import type {
  TextBlockCardBackgroundTint,
  TextBlockCardBorder,
  TextBlockCardSizeHint,
  TextBlockRow,
  TextBlockTextColour,
  TextBlockTextSize,
} from './types';

export class TextBlockApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly serverUpdatedAt?: string;
  readonly max?: number;
  readonly maxBytes?: number;
  constructor(
    status: number,
    message: string,
    extra: {
      code?: string;
      serverUpdatedAt?: string;
      max?: number;
      maxBytes?: number;
    } = {},
  ) {
    super(message);
    this.name = 'TextBlockApiError';
    this.status = status;
    this.code = extra.code;
    this.serverUpdatedAt = extra.serverUpdatedAt;
    this.max = extra.max;
    this.maxBytes = extra.maxBytes;
  }
}

async function parseError(res: Response): Promise<TextBlockApiError> {
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
  return new TextBlockApiError(res.status, code ?? `HTTP ${res.status}`, {
    code,
    serverUpdatedAt:
      'server_updated_at' in obj ? String(obj.server_updated_at) : undefined,
    max: 'max' in obj && typeof obj.max === 'number' ? obj.max : undefined,
    maxBytes:
      'max_bytes' in obj && typeof obj.max_bytes === 'number'
        ? obj.max_bytes
        : undefined,
  });
}

export interface CreateTextBlockBody {
  body?: string;
  card_accent?: string;
  card_background_tint?: TextBlockCardBackgroundTint;
  card_border?: TextBlockCardBorder;
  card_size_hint?: TextBlockCardSizeHint;
  text_size?: TextBlockTextSize;
  text_colour?: TextBlockTextColour;
  display_order?: number;
  insert_after_element_id?: string;
  id?: string;
}

export interface CreateTextBlockResult {
  textBlock: TextBlockRow;
  calculatorUpdatedAt: string | null;
}

export interface DeleteTextBlockResult {
  calculatorUpdatedAt: string | null;
}

export interface PatchTextBlockBody
  extends Omit<CreateTextBlockBody, 'id' | 'insert_after_element_id'> {
  updated_at: string;
  // server rejects this with 422 (cross-section move unsupported).
  section_id?: string;
}

export interface PatchTextBlockResponse {
  textBlock: TextBlockRow;
  calculatorUpdatedAt: string | null;
}

export async function createTextBlock(
  sectionId: string,
  body: CreateTextBlockBody = {},
): Promise<CreateTextBlockResult> {
  const res = await fetch(
    `/api/sections/${encodeURIComponent(sectionId)}/text_blocks`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw await parseError(res);
  const payload = (await res.json()) as {
    text_block: TextBlockRow;
    calculator_updated_at: string | null;
  };
  return {
    textBlock: payload.text_block,
    calculatorUpdatedAt: payload.calculator_updated_at,
  };
}

export async function patchTextBlock(
  id: string,
  body: PatchTextBlockBody,
): Promise<PatchTextBlockResponse> {
  const res = await fetch(`/api/text_blocks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  const payload = (await res.json()) as {
    text_block: TextBlockRow;
    calculator_updated_at: string | null;
  };
  return {
    textBlock: payload.text_block,
    calculatorUpdatedAt: payload.calculator_updated_at,
  };
}

export async function deleteTextBlock(
  id: string,
): Promise<DeleteTextBlockResult> {
  const res = await fetch(`/api/text_blocks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw await parseError(res);
  const payload = (await res.json()) as { calculator_updated_at: string | null };
  return { calculatorUpdatedAt: payload.calculator_updated_at };
}
