// PROJ-13 — Dashboard slot 4 — "Trash".
//
// Hide-when-empty per the PRD: returns `null` when the user has zero
// soft-deleted calculators. When non-empty, mounts <Section> with
// defaultExpanded={false} — Trash is reference content the user
// visits when they need to recover, not their primary workspace; the
// count pill conveys "there's stuff in here" without consuming space
// on first paint.
//
// The grid mirrors My Calculators (1 column on mobile, 2 on >= sm)
// so card sizing stays consistent across the two surfaces.

import type { TrashedCalculatorRow } from '@/lib/calculators/server';

import { Section } from './section';
import { TrashCalcCard } from './trash-calc-card';

export interface TrashSectionProps {
  calculators: TrashedCalculatorRow[];
  retentionPeriodDays: number;
}

export function TrashSection({
  calculators,
  retentionPeriodDays,
}: TrashSectionProps) {
  if (calculators.length === 0) return null;
  return (
    <Section title="Trash" count={calculators.length}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {calculators.map((c) => (
          <TrashCalcCard
            key={c.id}
            calculator={c}
            retentionPeriodDays={retentionPeriodDays}
          />
        ))}
      </div>
    </Section>
  );
}
