// PROJ-11 / PROJ-12 — Public calculator route.
//
// Server Component that fetches the calculator via the SECURITY DEFINER
// RPC (`fetchPublicCalculator`) and dispatches:
//   - { status: 'ok' } → render the visitor calculator (200)
//   - null             → call notFound() → not-found.tsx (404)
//
// The 410 (Gone) case is handled by middleware (`src/middleware.ts`)
// BEFORE this Server Component runs.
//
// PROJ-12 — when `?s=<scenario-token>` is present, we additionally
// call `fetchPublicScenario(scenarioToken, calcToken)` and either:
//   - serve the scenario-aware page (with the scenario's values
//     applied + scenario header block), OR
//   - render the scenario-specific 404 ("This scenario doesn't
//     exist…") when the RPC returns null. We do NOT silently strip
//     the `?s=` param — per the Decision Log a bad scenario token is
//     a whole-page 404.

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import {
  CloneController,
  PublicCalculatorPage,
  SaveScenarioController,
  ScenarioMigrationMount,
  VisitorShell,
  type PublicCalculatorScenarioBundle,
} from '@/components/visitor';
import { EmptyOrErrorState } from '@/components/shell';
import { VisitorFooter, VisitorHeader } from '@/components/visitor';
import { fetchPublicCalculator } from '@/lib/calculators/public';
import { fetchPublicScenario } from '@/lib/scenarios/public';
import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';

const PAGE_DESCRIPTION_MAX = 160;

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ s?: string | string[] }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const result = await fetchPublicCalculator(token);
  if (!result || result.status === 'gone') {
    return {
      title: 'Calculator not found — Calcgrinder',
      robots: { index: false, follow: false },
    };
  }
  const { calculator } = result;
  const description = truncate(
    calculator.description || '',
    PAGE_DESCRIPTION_MAX,
  );
  // PROJ-12 — meta does NOT leak scenario title / owner / date.
  return {
    title: `${calculator.title} — Calcgrinder`,
    description: description || undefined,
    openGraph: {
      title: calculator.title,
      description: description || undefined,
    },
    robots: { index: false, follow: false },
  };
}

export default async function PublicCalculatorRoute({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const { s } = await searchParams;
  const scenarioToken = typeof s === 'string' ? s : Array.isArray(s) ? s[0] : undefined;

  const [result, current] = await Promise.all([
    fetchPublicCalculator(token),
    getCurrentProfile(),
  ]);

  if (!result || result.status === 'gone') {
    notFound();
  }

  const approvedUser =
    current && current.profile.status === 'approved'
      ? {
          name: current.profile.name,
          email: current.user.email,
          role: current.profile.role as 'registered' | 'sysadmin',
        }
      : null;
  const isAdmin = current?.profile.role === 'sysadmin';

  // PROJ-12 — Scenario branch.
  let scenarioBundle: PublicCalculatorScenarioBundle | null = null;
  let calculatorForRender = result.calculator;
  if (scenarioToken) {
    const fetched = await fetchPublicScenario(scenarioToken, token);
    if (!fetched) {
      return <ScenarioNotFound />;
    }
    scenarioBundle = {
      scenario: {
        id: fetched.scenarioId,
        title: fetched.scenarioTitle,
        description: fetched.scenarioDescription,
        ownerName: fetched.scenarioOwnerName,
        updatedAt: fetched.scenarioUpdatedAt,
        isOwner: current?.user.id === fetched.scenarioOwnerId,
        // hasDrift is computed client-side after apply; placeholder.
        hasDrift: false,
      },
      values: fetched.scenarioValues,
      initialShareToken: fetched.shareToken,
    };
    // The RPC returns the calculator payload as part of the scenario
    // bundle — reuse it to spare a second probe.
    calculatorForRender = fetched.calculator;
  }

  return (
    <SaveScenarioController
      calculator={calculatorForRender}
      approvedUser={approvedUser}
    >
      <CloneController
        calculator={calculatorForRender}
        approvedUser={approvedUser}
      >
        <VisitorShell
          token={token}
          approvedUser={approvedUser}
          isAdmin={isAdmin}
        >
          <ScenarioMigrationMount approved={approvedUser !== null} />
          <PublicCalculatorPage
            calculator={calculatorForRender}
            scenario={scenarioBundle}
          />
        </VisitorShell>
      </CloneController>
    </SaveScenarioController>
  );
}

function ScenarioNotFound() {
  return (
    <>
      <VisitorHeader token={null} approvedUser={null} />
      <main className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyOrErrorState
            variant="error"
            title="Scenario not found"
            body="This scenario doesn't exist or the link is invalid."
          />
        </div>
      </main>
      <VisitorFooter />
    </>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
