import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processApproval } from './process';

/**
 * Fluent mock of the chainable PostgREST query API. Each .from() call
 * returns a fresh builder whose final terminal method (maybeSingle /
 * select / etc.) resolves to whatever the test queued up.
 */
type Queued =
  | { kind: 'maybeSingle'; data: unknown; error?: unknown }
  | { kind: 'updateSelect'; data: unknown; error?: unknown };

function makeAdmin(queue: Queued[]) {
  const calls: Array<{ table: string; op: string; args: unknown }> = [];

  function builder(table: string) {
    let mode: 'select' | 'update' = 'select';
    let updatePayload: unknown = null;

    const b = {
      select(cols?: string) {
        calls.push({ table, op: 'select', args: cols });
        return b;
      },
      update(payload: unknown) {
        mode = 'update';
        updatePayload = payload;
        calls.push({ table, op: 'update', args: payload });
        return b;
      },
      eq() {
        return b;
      },
      is() {
        return b;
      },
      async maybeSingle() {
        const next = queue.shift();
        if (!next || next.kind !== 'maybeSingle') {
          throw new Error(
            `unexpected maybeSingle on ${table}; queue head=${JSON.stringify(next)}`,
          );
        }
        return { data: next.data, error: next.error ?? null };
      },
      // Used when an UPDATE chain ends in `.select('id')`.
      then(onFulfilled: (v: unknown) => unknown, onRejected?: unknown) {
        if (mode !== 'update') {
          throw new Error(
            `terminal then() on ${table} only supported on update chains`,
          );
        }
        const next = queue.shift();
        if (!next || next.kind !== 'updateSelect') {
          throw new Error(
            `unexpected update terminal on ${table}; queue head=${JSON.stringify(next)}, payload=${JSON.stringify(updatePayload)}`,
          );
        }
        return Promise.resolve({
          data: next.data,
          error: next.error ?? null,
        }).then(onFulfilled, onRejected as never);
      },
    };
    return b;
  }

  return {
    from(table: string) {
      return builder(table);
    },
    __calls: calls,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('processApproval — fresh approve', () => {
  it('consumes the token, sets profile.status=approved, sends confirmation mail', async () => {
    const admin = makeAdmin([
      // 1. lookup token
      {
        kind: 'maybeSingle',
        data: { id: 'a1', user_id: 'u1', consumed_at: null, outcome: null },
      },
      // 2. lookup profile
      {
        kind: 'maybeSingle',
        data: { name: 'Alice', email: 'alice@example.com' },
      },
      // 3. UPDATE signup_approvals … RETURNING id
      { kind: 'updateSelect', data: [{ id: 'a1' }] },
      // 4. UPDATE profiles … (no RETURNING) — the builder doesn't queue
      //    one because the code does `.update(…).eq(…)` and awaits the
      //    builder directly. We re-use updateSelect to emit { error: null }.
      { kind: 'updateSelect', data: null },
    ]);

    const sendApprovalEmail = vi.fn().mockResolvedValue(undefined);

    const result = await processApproval({
      token: 'tok',
      action: 'approve',
      // @ts-expect-error — duck-typed mock for SupabaseClient<Database>
      deps: { admin, sendApprovalEmail },
    });

    expect(result).toMatchObject({
      result: 'approved',
      name: 'Alice',
      email: 'alice@example.com',
    });
    expect(sendApprovalEmail).toHaveBeenCalledWith({
      recipientName: 'Alice',
      recipientEmail: 'alice@example.com',
    });
  });
});

describe('processApproval — fresh decline', () => {
  it('consumes the token, sets profile.status=declined, sends NO mail', async () => {
    const admin = makeAdmin([
      { kind: 'maybeSingle', data: { id: 'a1', user_id: 'u1', consumed_at: null, outcome: null } },
      { kind: 'maybeSingle', data: { name: 'Bob', email: 'bob@example.com' } },
      { kind: 'updateSelect', data: [{ id: 'a1' }] },
      { kind: 'updateSelect', data: null },
    ]);

    const sendApprovalEmail = vi.fn();

    const result = await processApproval({
      token: 'tok',
      action: 'decline',
      // @ts-expect-error — duck-typed mock
      deps: { admin, sendApprovalEmail },
    });

    expect(result).toMatchObject({ result: 'declined', name: 'Bob' });
    expect(sendApprovalEmail).not.toHaveBeenCalled();
  });
});

describe('processApproval — already consumed', () => {
  it('approved-then-approve → already-approved (no DB writes, no mail)', async () => {
    const admin = makeAdmin([
      {
        kind: 'maybeSingle',
        data: {
          id: 'a1',
          user_id: 'u1',
          consumed_at: '2026-05-22T10:00:00Z',
          outcome: 'approved',
        },
      },
      { kind: 'maybeSingle', data: { name: 'Cara', email: 'cara@example.com' } },
    ]);

    const sendApprovalEmail = vi.fn();

    const result = await processApproval({
      token: 'tok',
      action: 'approve',
      // @ts-expect-error — duck-typed mock
      deps: { admin, sendApprovalEmail },
    });

    expect(result).toMatchObject({
      result: 'already-approved',
      name: 'Cara',
      email: 'cara@example.com',
      date: '2026-05-22T10:00:00Z',
    });
    expect(sendApprovalEmail).not.toHaveBeenCalled();
    // No update queued — if the code wrote we'd see "unexpected" throws.
  });

  it('declined-then-approve → already-declined (outcome is sticky)', async () => {
    const admin = makeAdmin([
      {
        kind: 'maybeSingle',
        data: {
          id: 'a1',
          user_id: 'u1',
          consumed_at: '2026-05-22T11:00:00Z',
          outcome: 'declined',
        },
      },
      { kind: 'maybeSingle', data: { name: 'Dan', email: 'dan@example.com' } },
    ]);

    const result = await processApproval({
      token: 'tok',
      action: 'approve',
      // @ts-expect-error — duck-typed mock
      deps: { admin, sendApprovalEmail: vi.fn() },
    });

    expect(result).toMatchObject({ result: 'already-declined', name: 'Dan' });
  });
});

describe('processApproval — unknown token', () => {
  it('returns { result: invalid }', async () => {
    const admin = makeAdmin([
      { kind: 'maybeSingle', data: null },
    ]);
    const result = await processApproval({
      token: 'bogus',
      action: 'approve',
      // @ts-expect-error — duck-typed mock
      deps: { admin, sendApprovalEmail: vi.fn() },
    });
    expect(result).toEqual({ result: 'invalid' });
  });
});

describe('processApproval — mail throws on approve', () => {
  it('still returns approved + sets mailError=true', async () => {
    const admin = makeAdmin([
      { kind: 'maybeSingle', data: { id: 'a1', user_id: 'u1', consumed_at: null, outcome: null } },
      { kind: 'maybeSingle', data: { name: 'Eve', email: 'eve@example.com' } },
      { kind: 'updateSelect', data: [{ id: 'a1' }] },
      { kind: 'updateSelect', data: null },
    ]);

    const sendApprovalEmail = vi
      .fn()
      .mockRejectedValueOnce(new Error('SMTP 421'));

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await processApproval({
      token: 'tok',
      action: 'approve',
      // @ts-expect-error — duck-typed mock
      deps: { admin, sendApprovalEmail },
    });

    expect(result).toMatchObject({ result: 'approved', mailError: true });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

describe('processApproval — concurrent click loses the race', () => {
  it('UPDATE returns 0 rows → re-read winner → already-approved', async () => {
    const admin = makeAdmin([
      { kind: 'maybeSingle', data: { id: 'a1', user_id: 'u1', consumed_at: null, outcome: null } },
      { kind: 'maybeSingle', data: { name: 'Frida', email: 'frida@example.com' } },
      { kind: 'updateSelect', data: [] }, // 0 rows affected
      { kind: 'maybeSingle', data: { outcome: 'approved', consumed_at: '2026-05-22T12:00:00Z' } },
    ]);

    const result = await processApproval({
      token: 'tok',
      action: 'decline', // raced; the other tab approved
      // @ts-expect-error — duck-typed mock
      deps: { admin, sendApprovalEmail: vi.fn() },
    });

    expect(result).toMatchObject({
      result: 'already-approved',
      name: 'Frida',
      date: '2026-05-22T12:00:00Z',
    });
  });
});
