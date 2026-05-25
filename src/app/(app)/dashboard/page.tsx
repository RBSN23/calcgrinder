// PROJ-5 / PROJ-25 — Account Dashboard.
//
// Server Component. Fetches all dashboard data in a single RPC call
// (`fn_get_dashboard`) instead of 6 parallel Supabase queries.

import { redirect } from 'next/navigation';

import {
  MyCalculatorsSection,
  MyScenariosSection,
  NewCalculatorHero,
  PresetsSection,
  TrashSection,
  UserCalculatorsSection,
  WelcomeLine,
} from '@/components/dashboard';
import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';
import type { CalculatorRow } from '@/lib/calculators/types';
import type { TrashedCalculatorRow, PresetCalculatorRow, ModerationCalculatorRow } from '@/lib/calculators/server';
import type { ScenarioRowWithCalc } from '@/lib/scenarios/types';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Dashboard · Calcgrinder',
};

export const dynamic = 'force-dynamic';

interface DashboardData {
  calculators: CalculatorRow[];
  scenarios: ScenarioRowWithCalc[];
  trashed_calculators: TrashedCalculatorRow[];
  orphan_scenario_count: number;
  presets: PresetCalculatorRow[];
  user_calculators: ModerationCalculatorRow[];
  is_sysadmin: boolean;
}

export default async function DashboardPage() {
  const current = await getCurrentProfile();
  if (!current) redirect('/auth/login');

  const role = (current.profile.role as 'registered' | 'sysadmin') ?? 'registered';

  const supabase = await createClient();
  const { data: raw, error } = await supabase.rpc('fn_get_dashboard');

  if (error || !raw) {
    console.error('fn_get_dashboard failed', error);
    redirect('/auth/login');
  }

  const d = raw as unknown as DashboardData;

  const retentionPeriodDaysRaw = parseInt(
    process.env.RETENTION_PERIOD_DAYS ?? '30',
    10,
  );
  const retentionPeriodDays =
    Number.isFinite(retentionPeriodDaysRaw) && retentionPeriodDaysRaw > 0
      ? retentionPeriodDaysRaw
      : 30;

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-[18px] px-4 pb-8 pt-5 md:max-w-[960px] md:gap-7 md:px-8 md:pb-12 md:pt-8">
      <WelcomeLine name={current.profile.name} role={role} />
      <NewCalculatorHero />

      <div className="flex flex-col gap-3">
        <MyCalculatorsSection
          calculators={d.calculators}
          retentionPeriodDays={retentionPeriodDays}
        />
        <MyScenariosSection
          scenarios={d.scenarios}
          orphanCount={d.orphan_scenario_count}
        />
        <PresetsSection presets={d.presets} />
        <TrashSection
          calculators={d.trashed_calculators}
          retentionPeriodDays={retentionPeriodDays}
        />
        {d.is_sysadmin ? (
          <UserCalculatorsSection calculators={d.user_calculators} />
        ) : null}
      </div>
    </div>
  );
}
