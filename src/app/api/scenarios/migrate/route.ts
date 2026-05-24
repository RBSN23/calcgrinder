// PROJ-12 — POST /api/scenarios/migrate
//
// Batch-insert anonymous localStorage scenarios under the calling user.
// Fires opportunistically on every authenticated visitor-page-load via
// `<ScenarioMigrationMount>`; per the spec, "no first-login-only gating
// — every authenticated visitor-page-load checks."
//
// Body shape:
//   {
//     bundles: [
//       {
//         calculator_public_token: string,
//         scenarios: LocalScenario[]  // { id, title, description, values, saved_at }
//       },
//       ...
//     ]
//   }
//
// Per-bundle behaviour:
//   * Resolve `calculator_public_token` to a calculators.id via direct
//     SELECT on (public_token, soft_delete_at IS NULL). Missing → SKIP
//     every scenario in the bundle (spec: silently skip migrations whose
//     calculator_id no longer exists; the localStorage row is still
//     cleared by the client when migrated > 0 || skipped > 0).
//   * For each scenario in the bundle, resolve a title that doesn't
//     collide with an existing (owner_id, calculator_id, title) row by
//     suffixing ` (2)`, ` (3)`, … (same algorithm as fn_duplicate_calculator).
//
// Returns `{ migrated, skipped, errors }`. Partial success is the
// expected normal case; the client clears localStorage only when at
// least one row was migrated or skipped successfully (the bundles
// API contract states success only on HTTP 2xx).
//
// Per-user write rate-limit applies. The migration is treated as a
// single budget event per request (one rate-limit check, not one per
// scenario), so a freshly-signed-up user with 50 stale localStorage
// rows isn't throttled mid-migration.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { checkScenarioWrite } from '@/lib/rate-limit';
import {
  MAX_SCENARIO_DESCRIPTION_LENGTH,
  MAX_SCENARIO_TITLE_LENGTH,
  validateScenarioTitle,
} from '@/lib/scenarios/types';

export const runtime = 'nodejs';

const MAX_BUNDLES = 50;
const MAX_SCENARIOS_PER_BUNDLE = 200;

const localScenarioSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    values: z.record(z.string(), z.unknown()).optional(),
    saved_at: z.string().optional(),
  })
  .strip();

const bodySchema = z
  .object({
    bundles: z
      .array(
        z
          .object({
            calculator_public_token: z.string().min(1).max(100),
            scenarios: z
              .array(localScenarioSchema)
              .max(MAX_SCENARIOS_PER_BUNDLE),
          })
          .strip(),
      )
      .max(MAX_BUNDLES),
  })
  .strip();

interface MigrationError {
  scenario_id: string;
  reason: string;
}

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rate = await checkScenarioWrite(user.id);
  if (!rate.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const { bundles } = parsed.data;

  let migrated = 0;
  let skipped = 0;
  const errors: MigrationError[] = [];

  for (const bundle of bundles) {
    // Resolve the calculator_id from public_token. SECURITY DEFINER
    // would be cleaner but the SELECT-on-public_token-only check needs
    // table access; instead we use the existing
    // `fn_get_public_calculator` RPC which is already granted to
    // authenticated and returns 0 rows on miss / soft-deleted.
    const { data: calcRows, error: calcErr } = await supabase.rpc(
      'fn_get_public_calculator',
      { p_token: bundle.calculator_public_token },
    );

    if (calcErr) {
      console.error(
        `POST /api/scenarios/migrate: calculator lookup failed for token=${bundle.calculator_public_token}`,
        calcErr,
      );
      for (const s of bundle.scenarios) {
        errors.push({ scenario_id: s.id, reason: 'lookup_failed' });
      }
      continue;
    }

    const calcRow = Array.isArray(calcRows) ? calcRows[0] : null;
    // Skip bundles where the calculator no longer exists OR is
    // soft-deleted (spec: orphan-from-birth = silent skip).
    if (
      !calcRow ||
      !calcRow.id ||
      (calcRow as { soft_delete_at?: string | null }).soft_delete_at !== null
    ) {
      skipped += bundle.scenarios.length;
      continue;
    }
    const calculatorId = calcRow.id;

    // Load existing titles for collision resolution. RLS scopes by
    // owner — only the caller's scenarios show up.
    const { data: existingRows } = await supabase
      .from('scenarios')
      .select('title')
      .eq('calculator_id', calculatorId)
      .limit(1000);

    const existingTitles = new Set<string>(
      (existingRows ?? []).map((r) => (r as { title: string }).title),
    );

    for (const s of bundle.scenarios) {
      const titleResult = validateScenarioTitle(s.title);
      if (!titleResult.ok) {
        errors.push({ scenario_id: s.id, reason: 'title_invalid' });
        continue;
      }
      const desc = s.description ?? '';
      if (desc.length > MAX_SCENARIO_DESCRIPTION_LENGTH) {
        errors.push({ scenario_id: s.id, reason: 'description_too_long' });
        continue;
      }
      const values = (s.values ?? {}) as Record<string, unknown>;

      // Suffix walk: title → "title (2)" → "title (3)" → …
      // Cap at 100 attempts to mirror the SQL helper.
      let finalTitle = titleResult.value;
      if (existingTitles.has(finalTitle)) {
        let attempt = 2;
        let candidate = `${titleResult.value} (${attempt})`;
        // Defensive trim if the suffix would exceed the column cap.
        while (existingTitles.has(candidate) || candidate.length > MAX_SCENARIO_TITLE_LENGTH) {
          if (candidate.length > MAX_SCENARIO_TITLE_LENGTH) {
            const room = MAX_SCENARIO_TITLE_LENGTH - ` (${attempt})`.length;
            if (room <= 0) {
              candidate = '';
              break;
            }
            candidate = `${titleResult.value.slice(0, room)} (${attempt})`;
            if (existingTitles.has(candidate)) {
              attempt += 1;
              continue;
            }
            break;
          }
          attempt += 1;
          if (attempt > 100) {
            candidate = '';
            break;
          }
          candidate = `${titleResult.value} (${attempt})`;
        }
        if (!candidate) {
          errors.push({ scenario_id: s.id, reason: 'title_unresolved' });
          continue;
        }
        finalTitle = candidate;
      }

      const { error: insertErr } = await supabase
        .from('scenarios')
        .insert({
          owner_id: user.id,
          calculator_id: calculatorId,
          title: finalTitle,
          description: desc,
          values: values as never,
        });

      if (insertErr) {
        if ((insertErr as { code?: unknown }).code === '23514') {
          errors.push({ scenario_id: s.id, reason: 'invalid_values' });
          continue;
        }
        console.error(
          `POST /api/scenarios/migrate: insert failed for scenario ${s.id}`,
          insertErr,
        );
        errors.push({ scenario_id: s.id, reason: 'insert_failed' });
        continue;
      }

      existingTitles.add(finalTitle);
      migrated += 1;
    }
  }

  return NextResponse.json({ migrated, skipped, errors });
}
