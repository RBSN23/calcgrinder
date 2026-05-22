import { describe, expect, it } from 'vitest';

import { approvalConfirmation } from './approval-confirmation';

describe('approvalConfirmation()', () => {
  it('renders subject + body with the recipient name, login URL, and Calcgrinder sign-off', () => {
    const result = approvalConfirmation({
      recipientName: 'Ada',
      loginUrl: 'https://calcgrinder.example/auth/login',
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "subject": "Your Calcgrinder account is ready",
        "text": "Hi Ada,

      Your Calcgrinder account has been approved. You can now sign in and start building calculators:

      https://calcgrinder.example/auth/login

      — Calcgrinder",
      }
    `);
  });

  it('throws on a missing or invalid input field', () => {
    expect(() =>
      // @ts-expect-error — deliberately missing fields
      approvalConfirmation({ recipientName: 'Ada' }),
    ).toThrowError();

    expect(() =>
      approvalConfirmation({
        recipientName: 'Ada',
        loginUrl: 'not-a-url',
      }),
    ).toThrowError(/loginUrl/);
  });
});
