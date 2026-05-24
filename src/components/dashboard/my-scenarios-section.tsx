// PROJ-12 — Dashboard slot 2 — "My Scenarios".
//
// Hide-when-empty per the PRD: returns `null` when the user has zero
// scenarios (no header, no count pill, no placeholder). When ≥ 1
// scenarios exist, renders a <Section> with a row-per-scenario list
// ordered by `updated_at` descending (most-recently-saved first).

import type { ScenarioRowWithCalc } from '@/lib/scenarios';

import { ScenarioRow } from './scenario-row';
import { Section } from './section';

export interface MyScenariosSectionProps {
  scenarios: ScenarioRowWithCalc[];
}

export function MyScenariosSection({ scenarios }: MyScenariosSectionProps) {
  if (scenarios.length === 0) return null;
  return (
    <Section title="My Scenarios" count={scenarios.length} defaultExpanded>
      <div className="flex flex-col gap-2">
        {scenarios.map((row) => (
          <ScenarioRow key={row.id} row={row} />
        ))}
      </div>
    </Section>
  );
}
