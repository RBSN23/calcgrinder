import { AuthGlyph, AuthIcons, AuthLink, AuthMessage } from '@/components/auth';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = {
  title: 'Check your email · Calcgrinder',
};

export default async function SentConfirmationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const type = typeof params.type === 'string' ? params.type : 'signup';
  const rawEmail = typeof params.email === 'string' ? params.email : undefined;
  const email = rawEmail?.trim();

  const isReset = type === 'reset';

  return (
    <div className="flex flex-col gap-5">
      <AuthGlyph icon={AuthIcons.Mail} variant="muted" />
      <AuthMessage title="Check your email">
        {isReset ? (
          <>
            We&apos;ve sent a password reset link
            {email ? (
              <>
                {' '}to <span className="font-mono text-foreground">{email}</span>.
              </>
            ) : (
              '.'
            )}
          </>
        ) : (
          <>
            We&apos;ve sent a verification link
            {email ? (
              <>
                {' '}to <span className="font-mono text-foreground">{email}</span>.
              </>
            ) : (
              '.'
            )}{' '}
            Once you confirm, you&apos;ll be reviewed for approval.
          </>
        )}
      </AuthMessage>
      <div className="mt-2 text-center text-[13px] text-muted-foreground">
        <AuthLink href="/auth/login">Back to sign in</AuthLink>
      </div>
    </div>
  );
}
