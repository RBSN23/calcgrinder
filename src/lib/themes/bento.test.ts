import { describe, expect, it } from 'vitest';

import { bento } from './bento';

describe('bento theme tokens', () => {
  it('matches docs/design/themes.jsx', () => {
    expect(bento).toEqual({
      id: 'bento',
      displayName: 'Bento · Vibrant',
      description:
        'Vercel + Apple. Big rounded tiles, contrasting tints, no borders.',
      font: 'var(--font-geist-sans), -apple-system, system-ui, sans-serif',
      fontMono: 'var(--font-geist-mono), monospace',
      bg: '#F1ECDF',
      surface: '#F1ECDF',
      card: '#FFF8E7',
      cardAlt: 'rgba(0,0,0,0.04)',
      border: 'transparent',
      borderStr: 'rgba(0,0,0,0.06)',
      rule: 'rgba(0,0,0,0.06)',
      ink: '#1A1A2E',
      text: '#1A1A2E',
      muted: 'rgba(26,26,46,0.65)',
      subtle: 'rgba(26,26,46,0.45)',
      accent: '#3623A5',
      accentFg: '#FFF8E7',
      accentSoft: 'rgba(54,35,165,0.10)',
      chartA: '#1A1A2E',
      chartB: '#FF7A5A',
      chartGrid: 'rgba(0,0,0,0.08)',
      cardStyle: 'tinted',
      radius: 22,
      fieldRadius: 14,
      padding: 24,
      cardShadow:
        '0 1px 0 rgba(255,255,255,0.5) inset, 0 6px 18px rgba(26,26,46,0.06)',
      cols2: '1fr 1.4fr',
      cols3: '1fr 1.1fr 1.6fr',
      headerH: 72,
      cardTints: {
        inputs: '#FFE2A3',
        results: '#C8D8F5',
        chart: '#DDD0F5',
        hero: '#1A1A2E',
        heroFg: '#FFF8E7',
      },
      layoutPatterns: bento.layoutPatterns,
      chartPalette: bento.chartPalette,
    });
  });
});
