// PROJ-12 — Scenarios lib barrel.

export type {
  LocalScenario,
  ScenarioRow,
  ScenarioRowWithCalc,
  ScenarioValues,
  TitleValidation,
} from './types';
export {
  MAX_SCENARIO_TITLE_LENGTH,
  MAX_SCENARIO_DESCRIPTION_LENGTH,
  validateScenarioTitle,
  validateScenarioDescription,
} from './types';
export {
  applyScenarioValues,
  isInputsModifiedFromBaseline,
} from './values';
export type { ScenarioApplyResult } from './values';
export {
  SCENARIO_KEY_PREFIX,
  LocalScenarioQuotaError,
  listLocalScenarios,
  saveLocalScenario,
  deleteLocalScenario,
  collectAllLocalScenarios,
  clearLocalScenarios,
} from './localStorage';
export type {
  SaveLocalScenarioInput,
  SaveLocalScenarioResult,
  LocalScenarioBundle,
} from './localStorage';
export {
  ScenarioApiError,
  createScenario,
  updateScenario,
  deleteScenario,
  shareScenario,
  listScenariosForCalculator,
  listMyScenarios,
  migrateScenarios,
} from './client';
export type {
  CreateScenarioBody,
  UpdateScenarioBody,
  ShareScenarioResponse,
  MigrateScenariosBatchEntry,
  MigrateScenariosResponse,
} from './client';
