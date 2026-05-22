import { notFound } from 'next/navigation';

import {
  AuthErrorBanner,
  AuthGlyph,
  AuthIcons,
  AuthMessage,
  AuthShell,
} from '@/components/auth';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Result =
  | 'approved'
  | 'declined'
  | 'already-approved'
  | 'already-declined'
  | 'invalid';

const RESULT_SET: ReadonlySet<Result> = new Set([
  'approved',
  'declined',
  'already-approved',
  'already-declined',
  'invalid',
]);

function asResult(raw: string | string[] | undefined): Result | null {
  if (typeof raw !== 'string') return null;
  return RESULT_SET.has(raw as Result) ? (raw as Result) : null;
}

function isValidAction(action: string): action is 'approve' | 'decline' {
  return action === 'approve' || action === 'decline';
}

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export const metadata = {
  title: 'Calcgrinder admin',
};

/**
 * PROJ-3 admin landing.
 *
 * The route handler at `route.ts` performs the DB transaction (consume
 * token, update profile status, send confirmation mail). It then
 * redirects here with `?result=…` encoding the outcome. The page is a
 * pure renderer keyed by that query param plus the optional `name`,
 * `email`, `date`, `mailError` flags.
 */
export default async function AdminLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; action: string }>;
  searchParams: SearchParams;
}) {
  const { action } = await params;
  if (!isValidAction(action)) notFound();

  const sp = await searchParams;
  const result = asResult(sp.result) ?? 'invalid';
  const name = typeof sp.name === 'string' ? sp.name : '';
  const email = typeof sp.email === 'string' ? sp.email : '';
  const date = typeof sp.date === 'string' ? formatDate(sp.date) : '';
  const mailError = sp.mailError === '1';

  if (result === 'invalid') {
    return (
      <AuthShell>
        <AuthGlyph icon={AuthIcons.X} variant="muted" />
        <AuthMessage title="Link not valid">
          This approval link is not valid. It may have been mistyped or no
          longer exists.
        </AuthMessage>
      </AuthShell>
    );
  }

  if (result === 'approved') {
    return (
      <AuthShell>
        <AuthGlyph icon={AuthIcons.Check} variant="accent" />
        <AuthMessage title="Account approved">
          {name && (
            <span className="font-medium text-foreground">{name}</span>
          )}
          {name && ' '}
          {email && (
            <>
              (<span className="font-mono text-[12.5px]">{email}</span>){' '}
            </>
          )}
          can now sign in.
        </AuthMessage>
        {mailError && (
          <AuthErrorBanner variant="warning">
            We couldn&apos;t send the confirmation email — the user is approved
            but won&apos;t be notified automatically. They can sign in
            directly.
          </AuthErrorBanner>
        )}
      </AuthShell>
    );
  }

  if (result === 'declined') {
    return (
      <AuthShell>
        <AuthGlyph icon={AuthIcons.X} variant="muted" />
        <AuthMessage title="Account declined">
          {name && (
            <span className="font-medium text-foreground">{name}</span>
          )}
          {name && ' '}
          {email && (
            <>
              (<span className="font-mono text-[12.5px]">{email}</span>){' '}
            </>
          )}
          has been declined and will not be notified.
        </AuthMessage>
      </AuthShell>
    );
  }

  // already-approved | already-declined
  const wasApproved = result === 'already-approved';
  return (
    <AuthShell>
      <AuthGlyph
        icon={wasApproved ? AuthIcons.Check : AuthIcons.X}
        variant={wasApproved ? 'accent' : 'muted'}
      />
      <AuthMessage
        title={wasApproved ? 'Already approved' : 'Already declined'}
      >
        {name && (
          <>
            <span className="font-medium text-foreground">{name}</span>{' '}
          </>
        )}
        {email && (
          <>
            (<span className="font-mono text-[12.5px]">{email}</span>){' '}
          </>
        )}
        was {wasApproved ? 'approved' : 'declined'}
        {date ? ` on ${date}` : ''}.
      </AuthMessage>
    </AuthShell>
  );
}
