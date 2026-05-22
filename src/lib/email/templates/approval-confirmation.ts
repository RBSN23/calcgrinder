import { z } from 'zod';

/**
 * User-facing confirmation after the sysadmin approves their signup.
 * Tells them the account is ready and links them to the sign-in page.
 *
 * No "reply for help" line — sender is noreply@. No tip about presets
 * either; that feature ships later (PROJ-18) and the hint would lie
 * until then.
 */

const inputSchema = z.object({
  recipientName: z.string().min(1, 'recipientName must not be empty'),
  loginUrl: z.string().url('loginUrl must be a valid URL'),
});

export type ApprovalConfirmationInput = z.infer<typeof inputSchema>;

export function approvalConfirmation(input: ApprovalConfirmationInput) {
  const { recipientName, loginUrl } = inputSchema.parse(input);

  const subject = `Your Calcgrinder account is ready`;

  const text = [
    `Hi ${recipientName},`,
    ``,
    `Your Calcgrinder account has been approved. You can now sign in and start building calculators:`,
    ``,
    loginUrl,
    ``,
    `— Calcgrinder`,
  ].join('\n');

  return { subject, text };
}
