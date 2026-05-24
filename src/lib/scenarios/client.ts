// PROJ-12 — Client-side wrappers around the /api/scenarios routes.
//
// Pattern mirrors `@/lib/calculators/client`: each helper owns only the
// HTTP shape, never UI side-effects (no toasts, no router.refresh).
// Routes are built by the /backend skill — until those land, every
// helper here will surface a network / 500 error to the caller and the
// Sheet / list will gracefully fall into its error-state UI.

import type {
  LocalScenario,
  ScenarioRow,
  ScenarioRowWithCalc,
  ScenarioValues,
} from './types';

export class ScenarioApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ScenarioApiError';
    this.status = status;
    this.code = code;
  }
}

async function parseError(res: Response): Promise<ScenarioApiError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const code =
    body && typeof body === 'object' && 'error' in body
      ? String((body as { error: unknown }).error)
      : undefined;
  return new ScenarioApiError(res.status, code ?? `HTTP ${res.status}`, code);
}

export interface CreateScenarioBody {
  calculator_id: string;
  title: string;
  description: string;
  values: ScenarioValues;
}

export async function createScenario(
  body: CreateScenarioBody,
): Promise<ScenarioRow> {
  const res = await fetch('/api/scenarios', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as ScenarioRow;
}

export interface UpdateScenarioBody {
  title?: string;
  description?: string;
  values?: ScenarioValues;
}

export async function updateScenario(
  id: string,
  body: UpdateScenarioBody,
): Promise<ScenarioRow> {
  const res = await fetch(`/api/scenarios/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as ScenarioRow;
}

export async function deleteScenario(id: string): Promise<void> {
  const res = await fetch(`/api/scenarios/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) throw await parseError(res);
}

export interface ShareScenarioResponse {
  share_token: string;
  url: string;
}

export async function shareScenario(id: string): Promise<ShareScenarioResponse> {
  const res = await fetch(
    `/api/scenarios/${encodeURIComponent(id)}/share`,
    { method: 'POST' },
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as ShareScenarioResponse;
}

export async function listScenariosForCalculator(
  calculatorId: string,
): Promise<ScenarioRow[]> {
  const res = await fetch(
    `/api/scenarios?calculator_id=${encodeURIComponent(calculatorId)}`,
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as ScenarioRow[];
}

export async function listMyScenarios(): Promise<ScenarioRowWithCalc[]> {
  const res = await fetch('/api/scenarios?mine=1');
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as ScenarioRowWithCalc[];
}

export interface MigrateScenariosBatchEntry {
  calculator_public_token: string;
  scenarios: LocalScenario[];
}

export interface MigrateScenariosResponse {
  migrated: number;
  skipped: number;
  errors: Array<{ scenario_id: string; reason: string }>;
}

export async function migrateScenarios(
  bundles: MigrateScenariosBatchEntry[],
): Promise<MigrateScenariosResponse> {
  const res = await fetch('/api/scenarios/migrate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bundles }),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as MigrateScenariosResponse;
}
