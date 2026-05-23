import { describe, expect, it } from 'vitest';

import { calcgrinder } from './calcgrinder';

// Data-equality transcription of docs/design/themes.jsx → THEMES.calcgrinder.
// `"Geist"` / `"Geist Mono"` font literals are replaced with the CSS
// variables wired in src/app/layout.tsx; mortgage-mock fields
// (titleLabel/title/subtitle) are stripped per the spec; id/displayName/
// description are added.
describe('calcgrinder theme tokens', () => {
  it('matches docs/design/themes.jsx', () => {
    expect(calcgrinder).toEqual({
      id: 'calcgrinder',
      displayName: 'Calcgrinder · Light',
      description: 'Inspired by the app. Stone neutrals + indigo accent.',
      font: 'var(--font-geist-sans), -apple-system, system-ui, sans-serif',
      fontMono: 'var(--font-geist-mono), monospace',
      bg: '#FAFAF9',
      surface: '#FAFAF9',
      card: '#FFFFFF',
      cardAlt: '#F5F5F4',
      border: '#E7E5E4',
      borderStr: '#D6D3D1',
      rule: '#EFEDEB',
      ink: '#1C1917',
      text: '#1C1917',
      muted: '#78716C',
      subtle: '#A8A29E',
      accent: '#4F46E5',
      accentFg: '#FFFFFF',
      accentSoft: '#EEF0FF',
      chartA: '#1C1917',
      chartB: '#4F46E5',
      chartGrid: '#EFEDEB',
      cardStyle: 'flat',
      radius: 8,
      fieldRadius: 6,
      padding: 18,
      cardShadow:
        '0 1px 2px rgba(28,25,23,0.04), 0 1px 1px rgba(28,25,23,0.03)',
      cols2: '1fr 1.2fr',
      cols3: '1fr 1fr 1.45fr',
      headerH: 62,
      cardTints: null,
      layoutPatterns: calcgrinder.layoutPatterns,
    });
  });

  it('strips mortgage-mock fields', () => {
    const asRecord = calcgrinder as unknown as Record<string, unknown>;
    expect(asRecord.titleLabel).toBeUndefined();
    expect(asRecord.title).toBeUndefined();
    expect(asRecord.subtitle).toBeUndefined();
  });
});
