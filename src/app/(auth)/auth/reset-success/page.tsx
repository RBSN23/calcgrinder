import Link from 'next/link';

import { AuthGlyph, AuthIcons, AuthMessage } from '@/components/auth';

export const metadata = {
  title: 'Password updated · Calcgrinder',
};

export default function ResetSuccessPage() {
  return (
    <div className="flex flex-col gap-5">
      <AuthGlyph icon={AuthIcons.Check} variant="accent" />
      <AuthMessage title="Password updated">
        You can now sign in with your new password.
      </AuthMessage>
      <Link
        href="/auth/login"
        className="mt-1 inline-flex h-[42px] w-full items-center justify-center rounded-[7px] border border-auth-accent bg-auth-accent text-sm font-semibold tracking-[-0.1px] text-auth-accent-foreground transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-auth-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Sign in
      </Link>
    </div>
  );
}
