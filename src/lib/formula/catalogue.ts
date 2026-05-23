// Machine-readable function catalogue.
//
// Pure projection of FUNCTION_TABLE — strips the implementation,
// keeps only the metadata authoring UIs need (PROJ-8/9). No second
// source of truth.

import { FUNCTION_LIST } from './functions';
import type { FunctionMeta } from './types';

let cached: readonly FunctionMeta[] | null = null;

export function getFunctionCatalogue(): readonly FunctionMeta[] {
  if (cached) return cached;
  const list = FUNCTION_LIST.map((fn) => ({
    name: fn.name,
    signature: fn.signature,
    parameters: fn.parameters,
    category: fn.category,
    short_description: fn.short_description,
    is_volatile: fn.is_volatile ?? false,
  }));
  cached = Object.freeze(list);
  return cached;
}
