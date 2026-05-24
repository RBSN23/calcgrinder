'use client';

// PROJ-12 — Anonymous → registered scenario migration mount.
//
// Mounted inside every `(public)` visitor-page response. When the
// session is approved AND localStorage carries at least one
// `cg:scenarios:*` key, the helper batches every row into a single
// POST to /api/scenarios/migrate. On 200, the migrated keys are
// cleared from localStorage and a "Imported N scenarios" toast
// surfaces (silent when N = 0). On failure, localStorage rows are
// preserved for retry on the next page-load.

import * as React from 'react';

import {
  clearLocalScenarios,
  collectAllLocalScenarios,
  migrateScenarios,
} from '@/lib/scenarios';

interface ScenarioMigrationMountProps {
  approved: boolean;
}

export function ScenarioMigrationMount({ approved }: ScenarioMigrationMountProps) {
  React.useEffect(() => {
    if (!approved) return;
    let cancelled = false;
    (async () => {
      const bundles = collectAllLocalScenarios();
      if (bundles.length === 0) return;
      try {
        const result = await migrateScenarios(
          bundles.map((b) => ({
            calculator_public_token: b.calculatorPublicToken,
            scenarios: b.scenarios,
          })),
        );
        if (cancelled) return;
        if (result.migrated > 0) {
          // Clear migrated buckets (we clear them all on success per
          // the controller — the server has already taken care of
          // dedupe / skip).
          for (const b of bundles) {
            clearLocalScenarios(b.calculatorPublicToken);
          }
          const { toast } = await import('sonner');
          toast.success(
            `Imported ${result.migrated} ${
              result.migrated === 1 ? 'scenario' : 'scenarios'
            } from this browser.`,
          );
        } else if (result.skipped > 0 && result.migrated === 0) {
          // Everything skipped (e.g. all parent calcs hard-deleted).
          // Still clear so we don't keep retrying forever.
          for (const b of bundles) {
            clearLocalScenarios(b.calculatorPublicToken);
          }
        }
      } catch {
        if (cancelled) return;
        const { toast } = await import('sonner');
        toast.message("Couldn't import scenarios — will retry later.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [approved]);

  return null;
}
