import 'server-only';

import { createClient } from '@/lib/supabase/server';

import type { CalculatorRow } from './types';

/**
 * Fetches a calculator row for the editor's server-side page load. Returns
 * `null` when the row doesn't exist, is owned by someone else, or has been
 * soft-deleted — the editor page collapses all three into a single 404 so
 * an attacker cannot enumerate IDs across owners.
 *
 * The query runs through the cookie-bound publishable-key client, so
 * Row-Level Security (defined in the PROJ-8 migration) scopes the row to
 * `auth.uid()` automatically. The `soft_delete_at IS NULL` filter is added
 * explicitly because RLS does not gate soft-deleted rows from their owner
 * — Trash recovery in PROJ-13 needs to read them via a separate endpoint.
 */
export async function getCalculatorForEditor(
  id: string,
): Promise<CalculatorRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('calculators')
    .select('id, title, description, theme_id, updated_at')
    .eq('id', id)
    .is('soft_delete_at', null)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    theme_id: data.theme_id,
    updated_at: data.updated_at,
  };
}
