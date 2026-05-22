export const runtime = 'nodejs';

import { notFound } from 'next/navigation';

import {
  AuthErrorBanner,
  AuthGlyph,
  AuthIcons,
  AuthMessage,
  AuthShell,
} from '@/components/auth';
import { appUrl } from '@/lib/auth/app-url';
import { sendMail } from '@/lib/email/send';
import { approvalConfirmation } from '@/lib/email/templates';
import { createAdminClient } from '@/lib/supabase/admin';

import { processApproval } from './process';

/**
 * PROJ-3 admin landing.
 *
 * Server Component that performs the DB transaction (consume token,
 * update profile status, send confirmation mail) and renders the
 * result. Architecture per Tech Design § F: the route's `page.tsx`
 * owns both the DB work and the UI. Next.js's "page can't share path
 * with route handler" rule forced this design — performing the DB
 * write directly in the page is cleaner than a self-redirect dance
 * across two distinct URL paths.
 *
 * Idempotency is enforced at the DB level (`WHERE consumed_at IS
 * NULL`), so refreshes / re-clicks render the "Already …" variant
 * without re-writing.
 *
 * The page itself is unauthenticated (the matrix routes /auth/admin/*
 * as public). Knowledge of the token IS the auth credential.
 */

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

export default async function AdminLandingPage({
  params,
}: {
  params: Promise<{ token: string; action: string }>;
}) {
  const { token, action } = await params;
  if (!isValidAction(action)) notFound();

  const outcome = await processApproval({
    token,
    action,
    deps: {
      admin: createAdminClient(),
      sendApprovalEmail: async ({ recipientName, recipientEmail }) => {
        const { subject, text } = approvalConfirmation({
          recipientName,
          loginUrl: appUrl('/auth/login'),
        });
        await sendMail({ to: recipientEmail, subject, text });
      },
    },
  });

  if (outcome.result === 'invalid') {
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

  const { result, name, email, date, mailError } = outcome;

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
  const dateLabel = formatDate(date);
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
        {dateLabel ? ` on ${dateLabel}` : ''}.
      </AuthMessage>
    </AuthShell>
  );
}
