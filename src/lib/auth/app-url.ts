import 'server-only';

import { z } from 'zod';

/**
 * PROJ-3 — Single source of truth for the public-facing app origin.
 *
 * `APP_URL` is consumed exclusively server-side (email URL builders,
 * server-action redirects, route-handler origin check).
 *
 * Validation policy:
 *   - Required, valid absolute URL, no trailing slash.
 *   - Localhost origins (`http://localhost(:port)?`) are always
 *     accepted — they cover both local dev (`next dev`) and `next
 *     build` runs on the dev machine where NODE_ENV is `production`
 *     but TLS isn't terminated.
 *   - Any other origin MUST use `https:`. This is the single
 *     enforcement point for PROJ-2 finding L2 ("caller must produce
 *     https: URLs only") — every outgoing-mail URL in PROJ-3 is
 *     derived from this base, so one check at the boundary covers
 *     them all.
 *
 * No other module is permitted to read `process.env.APP_URL`. Import
 * `APP_URL` (the validated string) or `appUrl()` (the URL builder)
 * from this module instead.
 */

function isLocalhost(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
      u.protocol === 'http:'
    );
  } catch {
    return false;
  }
}

const schema = z
  .string({ message: 'APP_URL is required' })
  .url('APP_URL must be a valid absolute URL')
  .refine(
    (raw) => {
      try {
        const u = new URL(raw);
        if (u.protocol === 'https:') return true;
        return isLocalhost(raw);
      } catch {
        return false;
      }
    },
    {
      message:
        'APP_URL must use https:// (only http://localhost is allowed for local dev / builds)',
    },
  )
  .refine((raw) => !raw.endsWith('/'), {
    message: 'APP_URL must not have a trailing slash',
  });

const parsed = schema.safeParse(process.env.APP_URL);

if (!parsed.success) {
  throw new Error(
    `Invalid APP_URL: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
  );
}

export const APP_URL = parsed.data;

/** Join a relative path to APP_URL. Path must start with '/'. */
export function appUrl(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`appUrl path must start with '/': ${path}`);
  }
  return `${APP_URL}${path}`;
}
