// PROJ-5 — Account Dashboard.
//
// Server Component. Reuses the request-scoped `getCurrentProfile()`
// already invoked by the `(app)` layout (no extra Supabase round-trip).
// Renders the desktop-only welcome line, the "Build a new calculator"
// hero, the PROJ-10 My Calculators section, and the Presets section
// (other slots — My Scenarios, Trash, User Calculators — are reserved
// for downstream features and hidden when empty).

import { redirect } from 'next/navigation';

import {
  MyCalculatorsSection,
  NewCalculatorHero,
  Section,
  WelcomeLine,
} from '@/components/dashboard';
import { EmptyOrErrorState, Icons } from '@/components/shell';
import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';
import { listMyCalculators } from '@/lib/calculators/server';

export const metadata = {
  title: 'Dashboard · Calcgrinder',
};

// Always re-read server-fetched data on each request — mutations
// (rename, publish, duplicate, soft-delete) call router.refresh()
// which expects fresh data on the next render.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const current = await getCurrentProfile();
  if (!current) redirect('/auth/login');

  const role = (current.profile.role as 'registered' | 'sysadmin') ?? 'registered';
  const myCalculators = await listMyCalculators();
  const retentionPeriodDays = parseInt(
    process.env.RETENTION_PERIOD_DAYS ?? '30',
    10,
  );

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-[18px] px-4 pb-8 pt-5 md:max-w-[960px] md:gap-7 md:px-8 md:pb-12 md:pt-8">
      <WelcomeLine name={current.profile.name} role={role} />
      <NewCalculatorHero />

      {/*
        Canonical section order — downstream features insert their
        <Section> blocks into the matching slot:
          1. My Calculators  (PROJ-10) — wired below
          2. My Scenarios    (PROJ-12)
          3. Presets         (PROJ-5 / PROJ-18)
          4. Trash           (PROJ-13)
          5. User Calculators (PROJ-19, sysadmin-only)
        Sections hide when their data is empty. Presets is the
        exception — its empty state is the call-to-action surface for
        the curated-templates feature.
      */}
      <div className="flex flex-col gap-3">
        <MyCalculatorsSection
          calculators={myCalculators}
          retentionPeriodDays={
            Number.isFinite(retentionPeriodDays) && retentionPeriodDays > 0
              ? retentionPeriodDays
              : 30
          }
        />
        <Section title="Presets" count={0} defaultExpanded>
          <EmptyOrErrorState
            variant="empty"
            framed={false}
            icon={<Icons.LayoutGrid size={32} />}
            title="No presets yet"
            body="Curated calculators will appear here once a sysadmin publishes one."
          />
        </Section>
      </div>
    </div>
  );
}
