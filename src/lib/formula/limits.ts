// Engine size caps. Enforced at save-time (by PROJ-8/9) AND at
// evaluation-time (here). Exported so PROJ-8/9 can show "X of N"
// counters without duplicating the constants.

export const MAX_CELLS = 200;
export const MAX_FORMULA_LEN = 2000;
export const MAX_ARRAY_ROWS = 10000;
