import type { ModerationCalculatorRow } from '@/lib/calculators/server';

import { ModerationCalcCard } from './moderation-calc-card';
import { Section } from './section';

export interface UserCalculatorsSectionProps {
  calculators: ModerationCalculatorRow[];
}

export function UserCalculatorsSection({
  calculators,
}: UserCalculatorsSectionProps) {
  if (calculators.length === 0) return null;
  return (
    <Section title="User Calculators" count={calculators.length} tint="danger">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {calculators.map((c) => (
          <ModerationCalcCard key={c.id} calculator={c} />
        ))}
      </div>
    </Section>
  );
}
