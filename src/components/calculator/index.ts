// PROJ-11 — Public barrel for the shared calculator-render boundary.

export {
  InteractivityProvider,
  useInteractivity,
  useIsBuilder,
  useIsVisitor,
  type InteractivityMode,
} from './interactivity-context';
export {
  CalculatorStateProvider,
  useCalculatorState,
  type CalculatorStateValue,
  type CalculatorStateCalculator,
} from './calculator-state-context';
export { CalculatorRenderer } from './calculator-renderer';
