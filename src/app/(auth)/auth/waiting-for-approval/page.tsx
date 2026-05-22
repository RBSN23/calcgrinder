import { redirect } from 'next/navigation';

import { AuthGlyph, AuthIcons, AuthMessage } from '@/components/auth';
import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';

export const metadata = {
  title: 'Waiting for approval · Calcgrinder',
};

export default async function WaitingForApprovalPage() {
  const current = await getCurrentProfile();
  // Anonymous → login. Approved → dashboard (already enforced by the
  // (auth) layout, repeated here so this page never silently shows the
  // wrong content if the layout assumption ever changes).
  if (!current) redirect('/auth/login');
  if (current.profile.status === 'approved') redirect('/dashboard');

  return (
    <div className="flex flex-col gap-5">
      <AuthGlyph icon={AuthIcons.Clock} variant="muted" />
      <AuthMessage title="Waiting for approval">
        Your request is being reviewed. You&apos;ll receive an email when your
        account is approved.
      </AuthMessage>
      <div className="mt-2 text-center text-[12.5px] text-muted-foreground">
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
