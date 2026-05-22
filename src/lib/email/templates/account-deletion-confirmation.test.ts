import { describe, expect, it } from 'vitest';

import { accountDeletionConfirmation } from './account-deletion-confirmation';

describe('accountDeletionConfirmation()', () => {
  it('renders the full body in the spec-mandated order with retentionDays substituted', () => {
    const result = accountDeletionConfirmation({
      recipientName: 'Ada',
      confirmDeletionUrl:
        'https://calcgrinder.example/settings/delete/confirm/tok-xyz',
      retentionDays: 30,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "subject": "Confirm your Calcgrinder account deletion",
        "text": "Hi Ada,

      You requested to delete your Calcgrinder account. To confirm, click the link below:

      https://calcgrinder.example/settings/delete/confirm/tok-xyz

      After you confirm, your account will be scheduled for deletion in 30 days. Sign back in during that window to cancel.

      If you didn't request this, ignore this email — your account stays active.

      — Calcgrinder",
      }
    `);
  });

  it('throws on a missing or invalid input field', () => {
    expect(() =>
      // @ts-expect-error — deliberately missing fields
      accountDeletionConfirmation({ recipientName: 'Ada' }),
    ).toThrowError();

    expect(() =>
      accountDeletionConfirmation({
        recipientName: 'Ada',
        confirmDeletionUrl: 'https://x',
        retentionDays: -1,
      }),
    ).toThrowError(/retentionDays/);
  });
});
