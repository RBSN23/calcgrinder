// PROJ-16 — Server-side text-block field validation.
//
// The 50KB body cap is enforced via UTF-8 byte length, not codepoint
// count (multi-byte characters consume their byte cost). Boundary is
// exclusive of equality: byteLength <= 51200 accepted, > 51200 rejected.

import { MAX_TEXT_BLOCK_BODY_BYTES } from './limits';

export function bodyByteLength(body: string): number {
  return new TextEncoder().encode(body).byteLength;
}

export type TextBlockBodyValidation =
  | { ok: true }
  | { ok: false; status: 422; body: { error: 'body_too_large'; max_bytes: number } };

export function validateTextBlockBody(body: string): TextBlockBodyValidation {
  if (bodyByteLength(body) > MAX_TEXT_BLOCK_BODY_BYTES) {
    return {
      ok: false,
      status: 422,
      body: { error: 'body_too_large', max_bytes: MAX_TEXT_BLOCK_BODY_BYTES },
    };
  }
  return { ok: true };
}
