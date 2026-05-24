import { describe, expect, it } from 'vitest';

import { MAX_TEXT_BLOCK_BODY_BYTES } from './limits';
import { bodyByteLength, validateTextBlockBody } from './validation';

describe('bodyByteLength', () => {
  it('counts UTF-8 bytes, not codepoints', () => {
    // Single emoji is 4 UTF-8 bytes (surrogate pair encoded as 4 bytes in UTF-8).
    expect(bodyByteLength('🚀')).toBe(4);
    // Two-byte UTF-8 (umlaut).
    expect(bodyByteLength('ä')).toBe(2);
    // Plain ASCII.
    expect(bodyByteLength('abc')).toBe(3);
    // Empty body.
    expect(bodyByteLength('')).toBe(0);
  });
});

describe('validateTextBlockBody', () => {
  it('accepts an empty body', () => {
    expect(validateTextBlockBody('')).toEqual({ ok: true });
  });

  it('accepts a body whose UTF-8 byte length is below the cap', () => {
    expect(validateTextBlockBody('hello world')).toEqual({ ok: true });
  });

  it('accepts a body whose UTF-8 byte length equals the cap exactly (boundary inclusive)', () => {
    const body = 'a'.repeat(MAX_TEXT_BLOCK_BODY_BYTES);
    expect(bodyByteLength(body)).toBe(MAX_TEXT_BLOCK_BODY_BYTES);
    expect(validateTextBlockBody(body)).toEqual({ ok: true });
  });

  it('rejects a body whose UTF-8 byte length is greater than the cap by one', () => {
    const body = 'a'.repeat(MAX_TEXT_BLOCK_BODY_BYTES + 1);
    const result = validateTextBlockBody(body);
    expect(result).toEqual({
      ok: false,
      status: 422,
      body: { error: 'body_too_large', max_bytes: MAX_TEXT_BLOCK_BODY_BYTES },
    });
  });

  it('rejects a multi-byte body that exceeds the cap by bytes even if codepoint count is lower', () => {
    // Each emoji is 4 bytes — 12,801 emoji = 51,204 bytes (over the 51,200 cap).
    const body = '🚀'.repeat(12_801);
    expect(bodyByteLength(body)).toBeGreaterThan(MAX_TEXT_BLOCK_BODY_BYTES);
    const result = validateTextBlockBody(body);
    expect(result.ok).toBe(false);
  });
});
