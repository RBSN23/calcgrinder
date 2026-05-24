// Shared Vitest helpers for the /api/scenarios route tests. Mirrors the
// /api/calculators test-helpers in shape; the scenarios mock supports
// both terminal-resolved chains (`.single` / `.maybeSingle`) and the
// thenable chains (`.select(...).eq(...).order(...).limit(...)` →
// list result).

import { vi, type Mock } from 'vitest';

export const USER_FIXTURE = { id: '11111111-1111-1111-1111-111111111111' };
export const OTHER_USER_FIXTURE = { id: '99999999-9999-9999-9999-999999999999' };

export const CALCULATOR_ID = '22222222-2222-2222-2222-222222222222';
export const CALCULATOR_TOKEN = 'tok-22-chars-aaaaaaaaa';

export const SCENARIO_ROW = {
  id: '33333333-3333-3333-3333-333333333333',
  calculator_id: CALCULATOR_ID,
  owner_id: USER_FIXTURE.id,
  title: 'My scenario',
  description: '',
  values: { rate: 0.05 },
  share_token: null as string | null,
  created_at: '2026-05-24T10:00:00.000Z',
  updated_at: '2026-05-24T10:00:00.000Z',
};

export interface QueryResult {
  data: unknown;
  error: unknown;
  count?: number | null;
}

export interface MockBuilder {
  insert: Mock;
  update: Mock;
  delete: Mock;
  select: Mock;
  eq: Mock;
  neq: Mock;
  gt: Mock;
  lt: Mock;
  in: Mock;
  is: Mock;
  not: Mock;
  order: Mock;
  limit: Mock;
  single: Mock;
  maybeSingle: Mock;
  then: (
    onFulfilled?: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
}

export interface MockSupabase {
  auth: { getUser: Mock };
  from: Mock;
  rpc: Mock;
  _builders: MockBuilder[];
  _lastBuilder: MockBuilder | undefined;
  _rpcCalls: Array<{ fn: string; args: unknown }>;
}

export function makeSupabaseMock(opts: {
  user: { id: string } | null;
  fromResults?: QueryResult[];
  rpcResults?: QueryResult[];
}): MockSupabase {
  const { user, fromResults = [], rpcResults = [] } = opts;
  let i = 0;
  let rpcIdx = 0;
  const builders: MockBuilder[] = [];
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];

  const mock: MockSupabase = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
    },
    from: vi.fn(() => {
      const result = fromResults[i++] ?? {
        data: null,
        error: { message: 'no mock result configured for this from() call' },
      };
      const builder: MockBuilder = {
        insert: vi.fn(() => builder),
        update: vi.fn(() => builder),
        delete: vi.fn(() => builder),
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        neq: vi.fn(() => builder),
        gt: vi.fn(() => builder),
        lt: vi.fn(() => builder),
        in: vi.fn(() => builder),
        is: vi.fn(() => builder),
        not: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        single: vi.fn(async () => result),
        maybeSingle: vi.fn(async () => result),
        then(onFulfilled, onRejected) {
          return Promise.resolve(result).then(onFulfilled, onRejected);
        },
      };
      builders.push(builder);
      mock._lastBuilder = builder;
      return builder;
    }),
    rpc: vi.fn(async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      const result = rpcResults[rpcIdx++] ?? {
        data: null,
        error: { message: 'no mock rpc result configured' },
      };
      return result;
    }),
    _builders: builders,
    _lastBuilder: undefined,
    _rpcCalls: rpcCalls,
  };
  return mock;
}

export function installSupabaseMock(
  createClientMock: Mock,
  supabase: MockSupabase,
): void {
  createClientMock.mockResolvedValue(supabase as unknown as never);
}
