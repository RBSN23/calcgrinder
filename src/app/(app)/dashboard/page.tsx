// PROJ-5 — Account Dashboard.
//
// Server Component. Reuses the request-scoped `getCurrentProfile()`
// already invoked by the `(app)` layout (no extra Supabase round-trip).
// Renders the desktop-only welcome line + the Presets section with its
// empty-state body. All other sections (My Calculators, My Scenarios,
// Trash, User Calculators) are hidden in PROJ-5 — their slots are
// reserved in the JSX order below for downstream features.

import { redirect } from 'next/navigation';

import { Section, WelcomeLine } from '@/components/dashboard';
import { EmptyOrErrorState, Icons } from '@/components/shell';
import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';

export const metadata = {
  title: 'Dashboard · Calcgrinder',
};

export default async function DashboardPage() {
  const current = await getCurrentProfile();
  if (!current) redirect('/auth/login');

  const role = (current.profile.role as 'registered' | 'sysadmin') ?? 'registered';

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-[18px] px-4 pb-8 pt-5 md:max-w-[960px] md:gap-7 md:px-8 md:pb-12 md:pt-8">
      <WelcomeLine name={current.profile.name} role={role} />

      {/*
        Canonical section order — downstream features insert their
        <Section> blocks into the matching slot:
          1. My Calculators  (PROJ-10)
          2. My Scenarios    (PROJ-12)
          3. Presets         (PROJ-5 / PROJ-18)
          4. Trash           (PROJ-13)
          5. User Calculators (PROJ-19, sysadmin-only)
        Sections hide when their data is empty. Presets is the
        exception — its empty state is the call-to-action surface for
        the curated-templates feature.
      */}
      <div className="flex flex-col gap-3">
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
