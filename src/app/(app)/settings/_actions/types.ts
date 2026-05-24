/**
 * Common return shape for Settings server actions.
 *
 * Each Settings mutation returns this shape so the client component can
 * render inline captions next to the affected control. Captions auto-
 * dismiss client-side ~3 s after `ok: true`.
 *
 * On `ok: false`:
 *   - `error` is a stable machine-readable discriminator (kebab or
 *     snake_case). Existing actions still pass human copy here as a
 *     fallback; new branches should prefer a discriminator code and
 *     put the human copy in `message`.
 *   - `message` is the optional human-readable caption. UI consumers
 *     should prefer `message` when present and fall back to `error`.
 */
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; message?: string };
