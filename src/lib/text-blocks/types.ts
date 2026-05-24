// PROJ-16 — Text block types.
//
// Mirrors the public.text_blocks row shape /backend will materialise.
// Text blocks share the four card-level visual columns with cells/charts
// plus text-block-specific text_size and text_colour. No `name` column —
// text blocks are Builder-only and aren't referenced by formulas.

export type TextBlockCardBackgroundTint = 'none' | 'soft' | 'strong';
export type TextBlockCardBorder = 'none' | 'hairline' | 'strong';
export type TextBlockCardSizeHint = 'narrow' | 'wide' | 'full';
export type TextBlockTextSize = 's' | 'm' | 'l' | 'xl';
export type TextBlockTextColour = 'default' | 'accent_1' | 'accent_2';

export interface TextBlockRow {
  id: string;
  calculator_id: string;
  section_id: string;
  body: string;
  card_accent: string; // theme accent token id or 'theme'
  card_background_tint: TextBlockCardBackgroundTint;
  card_border: TextBlockCardBorder;
  card_size_hint: TextBlockCardSizeHint;
  text_size: TextBlockTextSize;
  text_colour: TextBlockTextColour;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export const TEXT_BLOCK_TEXT_SIZE_OPTIONS: readonly TextBlockTextSize[] = [
  's',
  'm',
  'l',
  'xl',
];

export const TEXT_BLOCK_TEXT_COLOUR_OPTIONS: readonly TextBlockTextColour[] = [
  'default',
  'accent_1',
  'accent_2',
];

export const TEXT_BLOCK_TINT_OPTIONS: readonly TextBlockCardBackgroundTint[] = [
  'none',
  'soft',
  'strong',
];

export const TEXT_BLOCK_BORDER_OPTIONS: readonly TextBlockCardBorder[] = [
  'none',
  'hairline',
  'strong',
];

export const TEXT_BLOCK_SIZE_OPTIONS: readonly TextBlockCardSizeHint[] = [
  'narrow',
  'wide',
  'full',
];
