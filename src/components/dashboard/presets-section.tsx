// PROJ-18 — Dashboard "Presets" section.
//
// Curated calculators surface: sysadmin-owned + published rows from
// `fn_list_presets()`. Always rendered (Presets is the PRD-documented
// exception to the dashboard's hide-when-empty rule) — when the list
// is empty, the section shows the PROJ-5 empty-state body so the
// surface's purpose is visible to first-time users.

import { EmptyOrErrorState, Icons } from '@/components/shell';
import type { PresetCalculatorRow } from '@/lib/calculators/server';

import { CalcCard } from './calc-card';
import { Section } from './section';

export interface PresetsSectionProps {
  presets: PresetCalculatorRow[];
}

export function PresetsSection({ presets }: PresetsSectionProps) {
  return (
    <Section title="Presets" count={presets.length} defaultExpanded>
      {presets.length === 0 ? (
        <EmptyOrErrorState
          variant="empty"
          framed={false}
          icon={<Icons.LayoutGrid size={32} />}
          title="No presets yet"
          body="Curated calculators will appear here once a sysadmin publishes one."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {presets.map((p) => (
            <CalcCard
              key={p.id}
              calculator={p}
              variant="preset"
              // retentionPeriodDays is unused for variant='preset' (no
              // delete sheet). Pass a sentinel to satisfy the prop.
              retentionPeriodDays={0}
            />
          ))}
        </div>
      )}
    </Section>
  );
}
