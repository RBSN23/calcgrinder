// PROJ-5 — Public barrel for dashboard primitives.
// Surface-specific primitives (separate from `@/components/shell` which is
// app-wide chrome). Future features (PROJ-10 / PROJ-12 / PROJ-13 /
// PROJ-18 / PROJ-19) consume `<Section>` from here.

export { Section, SECTION_SCROLL_MAX_PX, type SectionProps } from './section';
export { WelcomeLine, type WelcomeLineProps } from './welcome-line';
export { NewCalculatorHero } from './new-calculator-hero';
export { CalcCard, type CalcCardProps } from './calc-card';
export {
  MyCalculatorsSection,
  type MyCalculatorsSectionProps,
} from './my-calculators-section';
export {
  DeleteCalcSheet,
  type DeleteCalcSheetProps,
} from './delete-calc-sheet';
export {
  MyScenariosSection,
  type MyScenariosSectionProps,
} from './my-scenarios-section';
export { ScenarioRow } from './scenario-row';
