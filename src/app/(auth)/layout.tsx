import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth';
import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';
import { routeGate } from '@/lib/auth/route-gate';

export default async function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hdrs, current] = await Promise.all([headers(), getCurrentProfile()]);

  // `x-pathname` is set by the Supabase middleware so server components can
  // consult `routeGate()` without re-deriving the request path. Fall back to
  // the empty string if the header is missing — `routeGate()` then treats
  // the request as the catch-all branch, which is a no-op for this layout.
  const pathname = hdrs.get('x-pathname') ?? '';
  const decision = routeGate(
    pathname,
    current
      ? {
          status: current.profile.status as
            | 'pending'
            | 'approved'
            | 'declined'
            | 'pending_deletion',
        }
      : null,
  );
  if (decision.kind === 'redirect') redirect(decision.to);

  return <AuthShell>{children}</AuthShell>;
}
