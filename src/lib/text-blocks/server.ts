import 'server-only';

// PROJ-16 — server-only typed-loose pass-through for the `text_blocks`
// Supabase table.
//
// The generated `src/lib/supabase/types.ts` doesn't list `text_blocks`
// until `npx supabase gen types typescript --linked` is re-run after the
// PROJ-16 backend migration lands. Until that regeneration, the strongly-
// typed `supabase.from(...)` calls won't accept the table name. Routing
// the access through this thin helper localises the cast: every route
// uses `textBlocksTable(supabase).select(...)...` with the same fluent
// query API the Supabase client exposes, but the cast lives in one place.
// After regeneration, this helper can be deleted and call sites can
// switch to `supabase.from('text_blocks')` directly.

import type { createClient } from '@/lib/supabase/server';

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface CountResult {
  count: number | null;
  error: unknown;
}
interface ListResult {
  data: unknown[] | null;
  error: unknown;
}
interface SingleResult {
  data: unknown;
  error: unknown;
}
interface MutateResult {
  error: unknown;
}
interface UpdateReturning {
  data: unknown;
  error: unknown;
}

interface SelectChain extends PromiseLike<ListResult> {
  eq(col: string, val: string | number): SelectChain;
  neq(col: string, val: string | number): SelectChain;
  gt(col: string, val: number): SelectChain;
  gte(col: string, val: number): SelectChain;
  lt(col: string, val: number): SelectChain;
  is(col: string, val: null): SelectChain;
  order(col: string, opts: { ascending: boolean }): SelectChain;
  limit(n: number): SelectChain;
  maybeSingle(): Promise<SingleResult>;
  single(): Promise<SingleResult>;
}

interface CountSelectChain extends PromiseLike<CountResult> {
  eq(col: string, val: string | number): CountSelectChain;
}

interface UpdateChain extends PromiseLike<MutateResult> {
  eq(col: string, val: string): UpdateChain;
  select(cols: string): {
    single(): Promise<UpdateReturning>;
  };
}

interface DeleteChain extends PromiseLike<MutateResult> {
  eq(col: string, val: string): DeleteChain;
}

interface InsertChain {
  select(cols: string): {
    single(): Promise<SingleResult>;
  };
}

export interface TextBlocksTable {
  select(cols: string): SelectChain;
  select(
    cols: string,
    opts: { count: 'exact'; head: true },
  ): CountSelectChain;
  insert(row: Record<string, unknown>): InsertChain;
  update(patch: Record<string, unknown>): UpdateChain;
  delete(): DeleteChain;
}

export function textBlocksTable(
  supabase: ServerSupabaseClient,
): TextBlocksTable {
  return (
    supabase as unknown as { from: (table: string) => unknown }
  ).from('text_blocks') as TextBlocksTable;
}
