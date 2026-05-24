// PROJ-12 — Dashboard slot 2 — "My Scenarios".
//
// Hide-when-empty per the PRD: returns `null` when the user has zero
// scenarios (no header, no count pill, no placeholder). When ≥ 1
// scenarios exist, renders a <Section> with a row-per-scenario list
// ordered by `updated_at` descending (most-recently-saved first).
//
// PROJ-13 — when the user has ≥ 1 orphan scenario (parent calculator
// hard-deleted), an <OrphanScenariosBanner> renders at the top of the
// section body offering a bulk-delete action. The banner sits above
// the existing row list; per-row Delete from PROJ-12 is unchanged.

import type { ScenarioRowWithCalc } from '@/lib/scenarios';

import { OrphanScenariosBanner } from './orphan-scenarios-banner';
import { ScenarioRow } from './scenario-row';
import { Section } from './section';

export interface MyScenariosSectionProps {
  scenarios: ScenarioRowWithCalc[];
  orphanCount?: number;
}

export function MyScenariosSection({
  scenarios,
  orphanCount = 0,
}: MyScenariosSectionProps) {
  if (scenarios.length === 0) return null;
  return (
    <Section title="My Scenarios" count={scenarios.length} defaultExpanded>
      {orphanCount > 0 ? <OrphanScenariosBanner count={orphanCount} /> : null}
      <div className="flex flex-col gap-2">
        {scenarios.map((row) => (
          <ScenarioRow key={row.id} row={row} />
        ))}
      </div>
    </Section>
  );
}
