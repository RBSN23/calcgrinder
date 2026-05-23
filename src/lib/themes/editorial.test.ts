import { describe, expect, it } from 'vitest';

import { editorial } from './editorial';

describe('editorial theme tokens', () => {
  it('matches docs/design/themes.jsx', () => {
    expect(editorial).toEqual({
      id: 'editorial',
      displayName: 'Editorial · Cream',
      description: 'Warm cream + ink. Editorial rhythm, generous whitespace.',
      font: 'var(--font-geist-sans), -apple-system, system-ui, sans-serif',
      fontMono: 'var(--font-geist-mono), monospace',
      bg: '#F4F1EC',
      surface: '#F4F1EC',
      card: '#FFFFFF',
      cardAlt: '#F8F5F0',
      border: '#E5E2DC',
      borderStr: '#D2CEC6',
      rule: '#EAE6DF',
      ink: '#16140F',
      text: '#1F1C16',
      muted: '#6F6A60',
      subtle: '#9A958A',
      accent: '#16140F',
      accentFg: '#F4F1EC',
      accentSoft: 'rgba(22,20,15,0.06)',
      chartA: '#16140F',
      chartB: '#B79E70',
      chartGrid: '#E9E4DC',
      cardStyle: 'flat',
      radius: 10,
      fieldRadius: 7,
      padding: 20,
      cardShadow: '0 1px 2px rgba(0,0,0,0.03)',
      cols2: '1fr 1.3fr',
      cols3: '1fr 1fr 1.55fr',
      headerH: 68,
      cardTints: null,
      layoutPatterns: editorial.layoutPatterns,
    });
  });
});
