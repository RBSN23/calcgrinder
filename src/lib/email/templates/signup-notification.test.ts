import { describe, expect, it } from 'vitest';

import { signupNotification } from './signup-notification';

describe('signupNotification()', () => {
  it('renders subject + body with the new user, name, and both action URLs', () => {
    const result = signupNotification({
      newUserEmail: 'ada@example.com',
      newUserName: 'Ada Lovelace',
      approveUrl: 'https://calcgrinder.example/auth/admin/approve/tok-123',
      declineUrl: 'https://calcgrinder.example/auth/admin/decline/tok-123',
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "subject": "New Calcgrinder signup — ada@example.com",
        "text": "A new user has signed up for Calcgrinder and is waiting for approval.

      Name:  Ada Lovelace
      Email: ada@example.com

      Approve:
      https://calcgrinder.example/auth/admin/approve/tok-123

      Decline:
      https://calcgrinder.example/auth/admin/decline/tok-123",
      }
    `);
  });

  it('throws on a missing or invalid input field before building any string', () => {
    expect(() =>
      // @ts-expect-error — deliberately missing fields
      signupNotification({ newUserEmail: 'ada@example.com' }),
    ).toThrowError();

    expect(() =>
      signupNotification({
        newUserEmail: 'not-an-email',
        newUserName: 'x',
        approveUrl: 'https://x',
        declineUrl: 'https://x',
      }),
    ).toThrowError(/newUserEmail/);
  });
});
