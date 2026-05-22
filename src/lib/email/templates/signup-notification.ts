import { z } from 'zod';

/**
 * Sysadmin-facing notification when a new user signs up. The body
 * carries the new user's email + claimed display name + the two
 * one-click approve / decline URLs. The sysadmin acts on either link
 * without logging in to the dashboard.
 *
 * URL construction is the caller's responsibility (PROJ-3). This
 * template stays pure — no env reads, no route knowledge.
 */

const inputSchema = z.object({
  newUserEmail: z.string().email('newUserEmail must be a valid email'),
  newUserName: z.string().min(1, 'newUserName must not be empty'),
  approveUrl: z.string().url('approveUrl must be a valid URL'),
  declineUrl: z.string().url('declineUrl must be a valid URL'),
});

export type SignupNotificationInput = z.infer<typeof inputSchema>;

export function signupNotification(input: SignupNotificationInput) {
  const { newUserEmail, newUserName, approveUrl, declineUrl } =
    inputSchema.parse(input);

  const subject = `New Calcgrinder signup — ${newUserEmail}`;

  const text = [
    `A new user has signed up for Calcgrinder and is waiting for approval.`,
    ``,
    `Name:  ${newUserName}`,
    `Email: ${newUserEmail}`,
    ``,
    `Approve:`,
    approveUrl,
    ``,
    `Decline:`,
    declineUrl,
  ].join('\n');

  return { subject, text };
}
