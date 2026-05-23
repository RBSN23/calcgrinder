// Shared Vitest helpers for the /api/calculators route tests. The Supabase
// fluent chain is mocked with a builder that records the operation
// (insert/update/select), so the route's call shape can be asserted while
// the test controls every result returned by `single` / `maybeSingle`.

import { vi, type Mock } from 'vitest';

export const USER_FIXTURE = { id: '11111111-1111-1111-1111-111111111111' };

export const ROW_FIXTURE = {
  id: '22222222-2222-2222-2222-222222222222',
  title: 'Untitled calculator',
  description: '',
  theme_id: 'calcgrinder',
  updated_at: '2026-05-23T10:00:00.000Z',
};

export interface QueryResult {
  data: unknown;
  error: unknown;
}

export interface MockBuilder {
  insert: Mock;
  update: Mock;
  select: Mock;
  eq: Mock;
  is: Mock;
  single: Mock;
  maybeSingle: Mock;
}

export interface MockSupabase {
  auth: { getUser: Mock };
  from: Mock;
  _builders: MockBuilder[];
  _lastBuilder: MockBuilder | undefined;
}

/**
 * Build a chainable Supabase mock. `fromResults` is a queue — each call to
 * `.from('calculators')` claims the next entry as the result of the
 * builder's terminal `single` / `maybeSingle` call. Pass one result per
 * `.from()` call the route is expected to make.
 */
export function makeSupabaseMock(opts: {
  user: { id: string } | null;
  fromResults: QueryResult[];
}): MockSupabase {
  const { user, fromResults } = opts;
  let i = 0;
  const builders: MockBuilder[] = [];

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
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        is: vi.fn(() => builder),
        single: vi.fn(async () => result),
        maybeSingle: vi.fn(async () => result),
      };
      builders.push(builder);
      mock._lastBuilder = builder;
      return builder;
    }),
    _builders: builders,
    _lastBuilder: undefined,
  };
  return mock;
}

export function installSupabaseMock(
  createClientMock: Mock,
  supabase: MockSupabase,
): void {
  createClientMock.mockResolvedValue(
    // The route handlers only use the surface area covered by `MockSupabase`;
    // casting to `unknown` keeps the test free of the full Database typing.
    supabase as unknown as never,
  );
}
