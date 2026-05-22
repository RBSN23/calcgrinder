import 'server-only';

import { randomBytes } from 'node:crypto';

/**
 * 32-byte random token, base64url-encoded (43 chars).
 *
 * Shared primitive for PROJ-3 (`signup_approvals.token`) and future
 * token consumers (scenario share tokens, calculator publish tokens).
 */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}
