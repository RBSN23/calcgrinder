import 'server-only';

/**
 * Production-side entry point for sendMail(). The `server-only` marker
 * above turns any client-component import of this file into a build
 * error.
 *
 * The actual SMTP logic lives in `./_internal/transport` so that
 * Node-context callers (the smoke CLI, the Vitest test runner) can
 * exercise the exact same code without tripping the marker. Do NOT
 * import from `_internal/transport` in production code paths —
 * always go through this file.
 *
 * Failure contract: sendMail() throws on any nodemailer / Cyon SMTP
 * error. No retry, no queue, no fallback. The caller decides what to
 * do. DB transactions in the calling code are NOT rolled back by
 * sendMail() — see the PROJ-2 spec's "dashboard is source of truth,
 * email is push trigger" reasoning.
 */

export { sendMail, type SendMailInput } from './_internal/transport';
