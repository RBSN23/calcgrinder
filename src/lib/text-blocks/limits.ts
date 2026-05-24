// PROJ-16 — Text-block limits. Canonical source of truth; matches
// MAX_CHARTS for the per-element cap convention.

/** Per-calculator cap on text-block count. */
export const MAX_TEXT_BLOCKS = 30;

/**
 * Server-side Zod cap on `body` UTF-8 byte length. Measured via
 * `new TextEncoder().encode(body).byteLength`. The cap is exclusive
 * of equality (`<= 51200` accepted, `> 51200` rejected).
 */
export const MAX_TEXT_BLOCK_BODY_BYTES = 51200;
