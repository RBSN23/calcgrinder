// PROJ-11 — Public calculator route.
//
// Server Component that fetches the calculator via the SECURITY DEFINER
// RPC (`fetchPublicCalculator`) and dispatches:
//   - { status: 'ok' } → render the visitor calculator (200)
//   - null             → call notFound() → not-found.tsx (404)
//
// The 410 (Gone) case is handled by middleware (`src/middleware.ts`)
// BEFORE this Server Component runs: when `fn_get_public_calculator`
// returns a row with `soft_delete_at IS NOT NULL`, middleware
// short-circuits with a 410 HTML response. Co-locating route.ts +
// page.tsx at the same dynamic segment is rejected by Next.js
// (Turbopack: "Conflicting route and page at /c/[token]"), so the
// architecture's "Route Handler shim" idea lives in middleware
// instead. See the spec's Implementation Notes — Frontend deviation.

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import {
  PublicCalculatorPage,
  VisitorShell,
} from '@/components/visitor';
import { fetchPublicCalculator } from '@/lib/calculators/public';
import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';

const PAGE_DESCRIPTION_MAX = 160;

// Spec note: the `?s=<token>` query parameter is intentionally ignored
// here — PROJ-12 will bind it to scenario loading. Passing through is
// safe (the page renders with stored defaults).

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const result = await fetchPublicCalculator(token);
  if (!result || result.status === 'gone') {
    return {
      title: 'Calculator not found — Calcgrinder',
      robots: { index: false, follow: false },
    };
  }
  const { calculator } = result;
  const description = truncate(
    calculator.description || '',
    PAGE_DESCRIPTION_MAX,
  );
  return {
    title: `${calculator.title} — Calcgrinder`,
    description: description || undefined,
    openGraph: {
      title: calculator.title,
      description: description || undefined,
    },
    robots: { index: false, follow: false },
  };
}

export default async function PublicCalculatorRoute({ params }: PageProps) {
  const { token } = await params;
  const [result, current] = await Promise.all([
    fetchPublicCalculator(token),
    getCurrentProfile(),
  ]);

  // Defensive: if the row went missing OR was soft-deleted between the
  // middleware probe and this Server Component fetch, fall back to 404.
  // Middleware normally short-circuits the 'gone' case with a real 410
  // before this code runs.
  if (!result || result.status === 'gone') {
    notFound();
  }

  const approvedUser =
    current && current.profile.status === 'approved'
      ? {
          name: current.profile.name,
          email: current.user.email,
          role: current.profile.role as 'registered' | 'sysadmin',
        }
      : null;
  const isAdmin = current?.profile.role === 'sysadmin';

  return (
    <VisitorShell token={token} approvedUser={approvedUser} isAdmin={isAdmin}>
      <PublicCalculatorPage calculator={result.calculator} />
    </VisitorShell>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
