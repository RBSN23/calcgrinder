'use client';

import * as React from 'react';

import { Icons } from '@/components/shell/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import {
  cancelPendingDeletionAction,
  requestDeletionAction,
  resendDeletionAction,
} from '../_actions/request-deletion';

interface Props {
  variant: 'default' | 'pending' | 'sysadmin';
  currentEmail: string;
  retentionDays: number;
}

export function DangerZone({ variant, currentEmail, retentionDays }: Props) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleRequest() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await requestDeletionAction();
      if (result.ok) {
        setDialogOpen(false);
      } else {
        setError(result.message ?? result.error);
      }
    });
  }

  function handleResend() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await resendDeletionAction();
      if (!result.ok) setError(result.message ?? result.error);
    });
  }

  function handleCancel() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelPendingDeletionAction();
      if (!result.ok) setError(result.message ?? result.error);
    });
  }

  if (variant === 'sysadmin') {
    return (
      <DangerCard>
        <DangerLabel />
        <p className="text-sm leading-relaxed text-cg-text-muted">
          Sysadmin accounts can&apos;t be deleted from Settings. Another
          sysadmin must remove the account directly in the Supabase Dashboard.
        </p>
        <Button
          type="button"
          disabled
          className="w-fit gap-2 bg-cg-danger/40 text-cg-danger-fg"
        >
          <Icons.Trash size={14} />
          Delete account
        </Button>
      </DangerCard>
    );
  }

  if (variant === 'pending') {
    return (
      <DangerCard>
        <DangerLabel />
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <p>
            <strong>Deletion pending.</strong> A confirmation link was sent to{' '}
            <span className="font-medium">{currentEmail}</span>. Your account
            will be deleted once you click it.{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={pending}
              className="font-medium underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none disabled:opacity-50"
            >
              Resend link
            </button>{' '}
            ·{' '}
            <button
              type="button"
              onClick={handleCancel}
              disabled={pending}
              className="font-medium text-cg-danger underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none disabled:opacity-50"
            >
              Cancel deletion
            </button>
          </p>
        </div>
        <p className="text-sm leading-relaxed text-cg-text-muted">
          Deleting your account permanently removes all calculators you own and
          every scenario saved against them — yours and anyone else&apos;s.
          Visitors will see your published calculators disappear. This cannot
          be undone after the grace window.
        </p>
        <Button
          type="button"
          disabled
          className="w-fit gap-2 bg-cg-danger/40 text-cg-danger-fg"
        >
          <Icons.Trash size={14} />
          Deletion pending
        </Button>
        {error ? (
          <p className="text-xs text-cg-danger-text" role="alert">
            {error}
          </p>
        ) : null}
      </DangerCard>
    );
  }

  return (
    <DangerCard>
      <DangerLabel />
      <p className="text-sm leading-relaxed text-cg-text-muted">
        Deleting your account permanently removes all calculators you own and
        every scenario saved against them — yours and anyone else&apos;s.
        Visitors will see your published calculators disappear. This cannot be
        undone after the grace window.
      </p>
      <Button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="w-fit gap-2 bg-cg-danger text-cg-danger-fg hover:bg-cg-danger-hov"
      >
        <Icons.Trash size={14} />
        Delete account
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-cg-danger-soft text-cg-danger">
              <Icons.Trash size={24} />
            </div>
            <DialogTitle className="text-center">
              Delete your account?
            </DialogTitle>
            <DialogDescription className="text-center">
              We&apos;ll send a confirmation link to{' '}
              <span className="font-medium">{currentEmail}</span>. Clicking it
              starts a {retentionDays}-day countdown. Until you click and the
              window closes, your account is intact. You can cancel anytime
              during the window by signing back in.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p
              className="text-center text-xs text-cg-danger-text"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={pending}
              className="sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRequest}
              disabled={pending}
              className={cn(
                'gap-2 bg-cg-danger text-cg-danger-fg hover:bg-cg-danger-hov sm:w-auto',
              )}
            >
              <Icons.Trash size={14} />
              {pending ? 'Sending…' : 'Send deletion link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DangerCard>
  );
}

function DangerCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-cg-danger-border bg-cg-danger-soft/30 p-5">
      {children}
    </div>
  );
}

function DangerLabel() {
  return (
    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.7px] text-cg-danger">
      Danger zone
    </span>
  );
}
