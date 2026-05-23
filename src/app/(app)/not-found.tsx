// PROJ-4 — Per-group not-found surface.
// Rendered by Next.js for unmatched routes inside (app) AND when a
// child page calls `notFound()`. The (app) layout wraps this output in
// the AppShell, so we only render the body content here.
//
// Anonymous + non-approved users never reach this page — the middleware
// + layout gates redirect them earlier (PROJ-3 route-gate matrix).

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { EmptyOrErrorState, Icons } from '@/components/shell';

export const metadata = {
  title: 'Page not found · Calcgrinder',
};

export default function AppNotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-12">
      <EmptyOrErrorState
        variant="error"
        framed={false}
        icon={<Icons.NotFound size={28} />}
        title="Page not found"
        body="We couldn't find that page."
        action={
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
