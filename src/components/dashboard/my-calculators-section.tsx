// PROJ-10 — Dashboard slot 1 — "My Calculators".
//
// Hide-when-empty per the PRD: returns `null` when the user owns zero
// non-soft-deleted calculators (no header, no count pill, no
// placeholder). When non-empty, mounts `<Section>` with
// `defaultExpanded` so the My Calculators list opens on first paint
// (other dashboard sections collapse by default).
//
// The grid is responsive: 1 column on mobile, 2 on >= sm. Card order
// is `updated_at DESC` — already enforced by the server query in
// `dashboard/page.tsx`.

import type { CalculatorRow } from '@/lib/calculators/types';

import { CalcCard } from './calc-card';
import { Section } from './section';

export interface MyCalculatorsSectionProps {
  calculators: CalculatorRow[];
  retentionPeriodDays: number;
}

export function MyCalculatorsSection({
  calculators,
  retentionPeriodDays,
}: MyCalculatorsSectionProps) {
  if (calculators.length === 0) return null;
  return (
    <Section title="My Calculators" count={calculators.length} defaultExpanded>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {calculators.map((c) => (
          <CalcCard
            key={c.id}
            calculator={c}
            retentionPeriodDays={retentionPeriodDays}
          />
        ))}
      </div>
    </Section>
  );
}
