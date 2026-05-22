/**
 * SMTP smoke-test. Renders one of the three production templates with
 * hardcoded dummy values and sends it via real Cyon SMTP.
 *
 *   npm run email:smoke -- --to <addr> --template <name>
 *
 * Both flags are required. <name> is one of:
 *   signup-notification
 *   approval-confirmation
 *   account-deletion-confirmation
 *
 * No --dry-run, no generic-default mode. Per PROJ-2 spec: production
 * code does production things only; this CLI is a thin wrapper around
 * the same code path PROJ-3 / PROJ-14 will use.
 *
 * Runs via `tsx --env-file=.env.local` (matches PROJ-1's seed-sysadmin
 * pattern). The script imports nothing from `server-only`-marked code
 * paths directly — `src/lib/email/send.ts` is server-only-marked but
 * Node scripts under scripts/** are by definition server contexts;
 * the marker only blocks client-component imports, not Node entry
 * points.
 */

import { z } from 'zod';

// Imports the internal transport, not `../src/lib/email/send`. The
// production `send.ts` carries a `server-only` marker that is
// unresolvable in Node-script context (the marker lives only in
// next/dist/compiled). The transport module under _internal/ holds
// the actual SMTP logic and is shared between production sends
// (via send.ts) and this smoke CLI.
import { sendMail } from '../src/lib/email/_internal/transport';
import {
  accountDeletionConfirmation,
  approvalConfirmation,
  signupNotification,
} from '../src/lib/email/templates';

// ---------------------------------------------------------------------------
// Argv parsing — manual, matches scripts/seed-sysadmin.ts conventions
// ---------------------------------------------------------------------------
const TEMPLATE_NAMES = [
  'signup-notification',
  'approval-confirmation',
  'account-deletion-confirmation',
] as const;

type TemplateName = (typeof TEMPLATE_NAMES)[number];

function readFlag(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
}

const argv = process.argv.slice(2);
const rawTo = readFlag(argv, '--to');
const rawTemplate = readFlag(argv, '--template');

const argSchema = z.object({
  to: z
    .string({ error: '--to is required' })
    .email('--to must be a valid email address'),
  template: z.enum(TEMPLATE_NAMES, {
    error: `--template is required and must be one of: ${TEMPLATE_NAMES.join(', ')}`,
  }),
});

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function reportZodErrors(error: z.ZodError): never {
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    console.error(`error: ${path}${issue.message}`);
  }
  process.exit(1);
}

const parsed = argSchema.safeParse({ to: rawTo, template: rawTemplate });
if (!parsed.success) reportZodErrors(parsed.error);
const { to, template } = parsed.data;

// ---------------------------------------------------------------------------
// Dummies for each template — chosen to look obviously fake in the inbox
// so a real recipient knows this came from the smoke CLI, not production
// ---------------------------------------------------------------------------
function renderTemplate(name: TemplateName): { subject: string; text: string } {
  switch (name) {
    case 'signup-notification':
      return signupNotification({
        newUserEmail: 'smoke-test-user@example.com',
        newUserName: 'Smoke Test User',
        approveUrl: 'https://calcgrinder.example/auth/admin/approve/smoke-token',
        declineUrl: 'https://calcgrinder.example/auth/admin/decline/smoke-token',
      });

    case 'approval-confirmation':
      return approvalConfirmation({
        recipientName: 'Smoke Test User',
        loginUrl: 'https://calcgrinder.example/auth/login',
      });

    case 'account-deletion-confirmation':
      return accountDeletionConfirmation({
        recipientName: 'Smoke Test User',
        confirmDeletionUrl:
          'https://calcgrinder.example/settings/delete/confirm/smoke-token',
        retentionDays: 30,
      });
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const { subject, text } = renderTemplate(template);

  try {
    const result = await sendMail({ to, subject, text });
    console.log(`sent ${template} to ${to}`);
    console.log(`messageId: ${result.messageId}`);
  } catch (err) {
    if (err instanceof z.ZodError) {
      // Env-var Zod failures surface here (sendMail re-throws the
      // ZodError from its own envSchema.parse). Report per-issue
      // for the same readable format the argv path uses.
      reportZodErrors(err);
    }
    const msg = err instanceof Error ? err.message : String(err);
    fail(`smoke send failed: ${msg}`);
  }
}

void main();
