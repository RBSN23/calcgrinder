'use client';

// PROJ-11 / PROJ-12 — Public calculator page body.
//
// Wraps the shared `<CalculatorRenderer>` (refactored PROJ-9 components)
// with the visitor providers: `InteractivityProvider mode="visitor"`,
// `<VisitorInputProvider>` for ephemeral input overrides, and the
// `<VisitorCalculatorStateAdapter>` that exposes the static public
// payload + the live input map via the shared `useCalculatorState()`
// hook.
//
// PROJ-12 additions:
//   - When `scenario` is passed, scenario values are applied (skipping
//     drift) before the first paint, all per-field locks default to
//     closed, and the scenario header + drift banner render between
//     the calculator hero and the first content section.
//   - A floating Reset button surfaces when inputs differ from the
//     loaded baseline.

import * as React from 'react';

import {
  CalculatorRenderer,
  InteractivityProvider,
} from '@/components/calculator';
import type { PublicCalculator } from '@/lib/calculators/types';
import { applyScenarioValues } from '@/lib/scenarios';
import type { Inputs } from '@/lib/formula';

import { ResetButton } from './reset-button';
import { SaveScenarioSheet } from './save-scenario-sheet';
import { ScenarioHeaderBlock } from './scenario-header-block';
import { ScenarioProvider, type ScenarioInfo } from './scenario-context';
import { StructureDriftBanner } from './structure-drift-banner';
import { UnsavedChangesGuard } from './unsaved-changes-guard';
import { VisitorCalculatorStateAdapter } from './visitor-calculator-state-adapter';
import {
  defaultLocksClosed,
  VisitorInputProvider,
  type LocksMap,
} from './visitor-input-store';

export interface PublicCalculatorScenarioBundle {
  scenario: ScenarioInfo;
  values: Record<string, unknown>;
  initialShareToken: string | null;
}

interface PublicCalculatorPageProps {
  calculator: PublicCalculator;
  /** PROJ-12 — When the URL carries `?s=<token>` AND the RPC resolves
   * the scenario, this bundle drives initial inputs, lock defaults,
   * and the scenario header block. */
  scenario?: PublicCalculatorScenarioBundle | null;
}

export function PublicCalculatorPage({
  calculator,
  scenario,
}: PublicCalculatorPageProps) {
  // Pre-compute scenario apply + drift detection BEFORE the
  // VisitorInputProvider mounts so the first render already has the
  // applied values (no defaults-then-scenario flash).
  const { initialInputs, initialLocks, hasDrift, resolvedScenario } =
    React.useMemo(() => {
      if (!scenario) {
        return {
          initialInputs: {} as Inputs,
          initialLocks: {} as LocksMap,
          hasDrift: false,
          resolvedScenario: null,
        };
      }
      const allCells = calculator.sections.flatMap((s) => s.cells);
      const apply = applyScenarioValues(allCells, scenario.values);
      const editableNames = allCells
        .filter(
          (c) => c.editability === 'editable' && c.visibility !== 'hidden',
        )
        .map((c) => c.name);
      return {
        initialInputs: apply.appliedInputs as Inputs,
        initialLocks: defaultLocksClosed(editableNames),
        hasDrift: apply.hasDrift,
        resolvedScenario: { ...scenario.scenario, hasDrift: apply.hasDrift },
      };
    }, [calculator.sections, scenario]);

  const body = (
    <InteractivityProvider mode="visitor">
      <VisitorInputProvider
        initialInputs={initialInputs}
        initialLocks={initialLocks}
      >
        <VisitorCalculatorStateAdapter calculator={calculator}>
          <div className="flex-1 overflow-auto bg-cg-bg">
            <div className="relative mx-auto flex h-full max-w-[1200px] flex-col gap-3 p-4 md:p-6">
              <ResetButton />
              <CalculatorRenderer
                afterHero={
                  scenario ? (
                    <div className="flex flex-col gap-2">
                      <StructureDriftBanner hasDrift={hasDrift} />
                      <ScenarioHeaderBlock />
                    </div>
                  ) : null
                }
              />
            </div>
          </div>
          <SaveScenarioSheet />
          {scenario ? <UnsavedChangesGuard /> : null}
        </VisitorCalculatorStateAdapter>
      </VisitorInputProvider>
    </InteractivityProvider>
  );

  if (scenario && resolvedScenario) {
    return (
      <ScenarioProvider
        scenario={resolvedScenario}
        initialShareToken={scenario.initialShareToken}
      >
        {body}
      </ScenarioProvider>
    );
  }
  return body;
}
