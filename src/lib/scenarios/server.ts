import 'server-only';

import { createClient } from '@/lib/supabase/server';

import type { ScenarioRowWithCalc } from './types';

/**
 * PROJ-12 — Server-side fetch for the dashboard My Scenarios list.
 *
 * Joins `scenarios` with the parent calculator (`title`, `public_token`,
 * `soft_delete_at`) so the row can render the parent calc info inline
 * and disable Edit / Public-view / Copy link when the parent is in
 * trash or hard-deleted. RLS scopes by `owner_id = auth.uid()`
 * automatically; no explicit owner filter is needed.
 *
 * Returns `[]` on any error so the dashboard degrades to "no scenarios"
 * (which then hide-when-empty per PROJ-5).
 */
export async function listMyScenariosWithCalc(): Promise<ScenarioRowWithCalc[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('scenarios')
    .select(
      'id, calculator_id, owner_id, title, description, values, share_token, created_at, updated_at, calculator:calculators(id, title, public_token, soft_delete_at)',
    )
    .order('updated_at', { ascending: false })
    .limit(1000);

  if (error || !data) return [];

  return data
    .map((row) => normalise(row as Record<string, unknown>))
    .filter((r): r is ScenarioRowWithCalc => r !== null);
}

/**
 * PROJ-13 — count of the current user's orphan scenarios for the
 * dashboard banner. An orphan is a scenario whose parent calculator
 * was hard-deleted (the FK `ON DELETE SET NULL` from PROJ-12 makes
 * `calculator_id` NULL in that case). Soft-deleted parents are still
 * recoverable and do NOT count as orphans per the spec.
 * RLS scopes by `owner_id = auth.uid()` automatically.
 */
export async function countMyOrphanScenarios(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('scenarios')
    .select('id', { count: 'exact', head: true })
    .is('calculator_id', null);
  if (error) return 0;
  return count ?? 0;
}

function normalise(row: Record<string, unknown>): ScenarioRowWithCalc | null {
  const id = typeof row.id === 'string' ? row.id : null;
  const owner_id = typeof row.owner_id === 'string' ? row.owner_id : null;
  const title = typeof row.title === 'string' ? row.title : null;
  if (!id || !owner_id || title == null) return null;
  const calcRaw = row.calculator;
  let calculator: ScenarioRowWithCalc['calculator'] = null;
  if (calcRaw && typeof calcRaw === 'object' && !Array.isArray(calcRaw)) {
    const c = calcRaw as Record<string, unknown>;
    calculator = {
      id: typeof c.id === 'string' ? c.id : null,
      title: typeof c.title === 'string' ? c.title : '',
      public_token: typeof c.public_token === 'string' ? c.public_token : null,
      soft_delete_at:
        typeof c.soft_delete_at === 'string' ? c.soft_delete_at : null,
    };
  }
  return {
    id,
    calculator_id:
      typeof row.calculator_id === 'string' ? row.calculator_id : null,
    owner_id,
    title,
    description: typeof row.description === 'string' ? row.description : '',
    values:
      row.values && typeof row.values === 'object' && !Array.isArray(row.values)
        ? (row.values as Record<string, unknown>)
        : {},
    share_token:
      typeof row.share_token === 'string' ? row.share_token : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : '',
    calculator,
  };
}
