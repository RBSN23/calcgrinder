import { z } from 'zod';

/**
 * User-facing confirmation that an account deletion was requested.
 * The user must click the link to actually start the deletion timer.
 * Until then, the account stays active — fail-safe by design.
 *
 * Body order (per spec):
 *   1. anchor: you requested deletion
 *   2. confirm URL
 *   3. "scheduled for deletion in N days" (not "permanently deleted",
 *      because the cancel window in step 4 contradicts that)
 *   4. cancel-by-signing-back-in path
 *   5. if-you-didnt-request hygiene line
 *   6. sign-off
 */

const inputSchema = z.object({
  recipientName: z.string().min(1, 'recipientName must not be empty'),
  confirmDeletionUrl: z
    .string()
    .url('confirmDeletionUrl must be a valid URL'),
  retentionDays: z
    .number()
    .int('retentionDays must be a whole number')
    .positive('retentionDays must be positive'),
});

export type AccountDeletionConfirmationInput = z.infer<typeof inputSchema>;

export function accountDeletionConfirmation(
  input: AccountDeletionConfirmationInput,
) {
  const { recipientName, confirmDeletionUrl, retentionDays } =
    inputSchema.parse(input);

  const subject = `Confirm your Calcgrinder account deletion`;

  const text = [
    `Hi ${recipientName},`,
    ``,
    `You requested to delete your Calcgrinder account. To confirm, click the link below:`,
    ``,
    confirmDeletionUrl,
    ``,
    `After you confirm, your account will be scheduled for deletion in ${retentionDays} days. Sign back in during that window to cancel.`,
    ``,
    `If you didn't request this, ignore this email — your account stays active.`,
    ``,
    `— Calcgrinder`,
  ].join('\n');

  return { subject, text };
}
