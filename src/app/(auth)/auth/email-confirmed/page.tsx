import Link from 'next/link';

import { AuthGlyph, AuthIcons, AuthMessage } from '@/components/auth';

export const metadata = {
  title: 'Email updated · Calcgrinder',
};

export default function EmailConfirmedPage() {
  return (
    <div className="flex flex-col gap-5">
      <AuthGlyph icon={AuthIcons.Check} variant="accent" />
      <AuthMessage title="Email address updated">
        You can now sign in with your new email. The old address is no longer
        linked to your account.
      </AuthMessage>
      <div className="mt-2 text-center">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cg-accent"
        >
          Continue to dashboard
        </Link>
      </div>
    </div>
  );
}
