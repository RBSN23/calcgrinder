import 'server-only';

import { z } from 'zod';

/**
 * PROJ-3 — Single source of truth for the public-facing app origin.
 *
 * `APP_URL` is consumed exclusively server-side (email URL builders,
 * server-action redirects, route-handler origin check). Outside
 * `NODE_ENV=development` the protocol MUST be `https:`; this is the
 * single enforcement point for PROJ-2 finding L2 ("caller must produce
 * https: URLs only") — every outgoing-mail URL in PROJ-3 is derived
 * from this base, so one check at the boundary covers them all.
 *
 * No other module is permitted to read `process.env.APP_URL`. Import
 * `APP_URL` (the validated string) or `appUrl()` (the URL builder) from
 * this module instead.
 */

const isDev = process.env.NODE_ENV === 'development';

const schema = z
  .string({ message: 'APP_URL is required' })
  .url('APP_URL must be a valid absolute URL')
  .refine(
    (raw) => {
      const u = new URL(raw);
      if (isDev) return u.protocol === 'http:' || u.protocol === 'https:';
      return u.protocol === 'https:';
    },
    {
      message: isDev
        ? 'APP_URL must use http:// or https:// (development)'
        : 'APP_URL must use https:// outside development',
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
