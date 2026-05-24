// PROJ-11 / PROJ-12 — Public barrel for visitor surface primitives.

export { VisitorHeader } from './visitor-header';
export { VisitorFooter } from './visitor-footer';
export { VisitorShell } from './visitor-shell';
export { PublicCalculatorPage } from './public-calculator-page';
export type { PublicCalculatorScenarioBundle } from './public-calculator-page';
export {
  VisitorInputProvider,
  useVisitorInputStore,
  useOptionalVisitorInputStore,
  defaultLocksClosed,
} from './visitor-input-store';
export type { LocksMap } from './visitor-input-store';
export { ScenarioProvider, useScenario } from './scenario-context';
export type { ScenarioInfo } from './scenario-context';
export { ScenarioHeaderBlock } from './scenario-header-block';
export { StructureDriftBanner } from './structure-drift-banner';
export { ResetButton } from './reset-button';
export { CellLockToggle } from './cell-lock-toggle';
export {
  SaveScenarioController,
  useSaveScenarioController,
  useOptionalSaveScenarioController,
} from './save-scenario-controller';
export { SaveScenarioSheet } from './save-scenario-sheet';
export { SaveScenarioHeaderButton } from './save-scenario-header-button';
export { ResponsiveSheet } from './responsive-sheet';
export { UnsavedChangesGuard } from './unsaved-changes-guard';
export { ScenarioMigrationMount } from './scenario-migration-mount';
