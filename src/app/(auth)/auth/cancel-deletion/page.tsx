import { redirect } from 'next/navigation';

import { AuthGlyph, AuthIcons, AuthMessage } from '@/components/auth';
import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';

import { cancelDeletionAction } from './actions';
import { formatDeletionDate } from './format';

export const metadata = {
  title: 'Cancel deletion · Calcgrinder',
};

const RETENTION_DAYS = Number(process.env.RETENTION_PERIOD_DAYS) || 30;

export default async function CancelDeletionPage() {
  const current = await getCurrentProfile();
  if (!current) redirect('/auth/login');
  if (current.profile.status === 'approved') redirect('/dashboard');
  if (current.profile.status !== 'pending_deletion') {
    redirect('/auth/waiting-for-approval');
  }

  const softDeleteAt = current.profile.pending_deletion_at;
  const deletionDate = softDeleteAt
    ? formatDeletionDate(softDeleteAt, RETENTION_DAYS)
    : 'soon';

  return (
    <div className="flex flex-col gap-5">
      <AuthGlyph icon={AuthIcons.Clock} variant="destructive" />
      <AuthMessage title={`Your account will be deleted on ${deletionDate}`}>
        All calculators you own and every scenario saved against them will be
        permanently removed. You can cancel now to keep your account.
      </AuthMessage>

      <form action={cancelDeletionAction} className="mt-2 flex flex-col gap-3">
        <button
          type="submit"
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cg-accent"
        >
          Cancel deletion &amp; keep account
        </button>
      </form>

      <div className="text-center text-[12.5px] text-muted-foreground">
        <form action="/auth/sign-out" method="post" className="inline">
          <button
            type="submit"
            className="text-auth-link transition-opacity hover:opacity-80 focus-visible:underline focus-visible:outline-none"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
