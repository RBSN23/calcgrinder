import { describe, expect, it } from 'vitest';

import { calcgrinderCI } from './calcgrinder-ci';

describe('calcgrinderCI theme tokens', () => {
  it('matches docs/design/themes.jsx', () => {
    expect(calcgrinderCI).toEqual({
      id: 'calcgrinderCI',
      displayName: 'Calcgrinder · CI',
      description:
        'Corporate identity. Wordmark, icons and charts in brand indigo.',
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
      brandColor: '#4F46E5',
      chartA: '#4F46E5',
      chartB: '#A5B4FC',
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
      layoutPatterns: calcgrinderCI.layoutPatterns,
    });
  });
});
