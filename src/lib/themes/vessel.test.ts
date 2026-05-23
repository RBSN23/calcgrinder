import { describe, expect, it } from 'vitest';

import { vessel } from './vessel';

describe('vessel theme tokens', () => {
  it('matches docs/design/themes.jsx', () => {
    expect(vessel).toEqual({
      id: 'vessel',
      displayName: 'Vessel',
      description: 'Dark deep · neon green accent. Subtle glow on card edges.',
      font: 'var(--font-geist-sans), -apple-system, system-ui, sans-serif',
      fontMono: 'var(--font-geist-mono), monospace',
      bg: '#0A0A0A',
      surface: '#0A0A0A',
      card: '#0F0F0F',
      cardAlt: '#171717',
      border: '#1F1F1F',
      borderStr: '#2A2A2A',
      rule: '#1A1A1A',
      ink: '#FAFAFA',
      text: '#EDEDED',
      muted: '#8A8A8A',
      subtle: '#555555',
      accent: '#00DC82',
      accentFg: '#0A0A0A',
      accentSoft: 'rgba(0,220,130,0.12)',
      chartA: '#FAFAFA',
      chartB: '#00DC82',
      chartGrid: '#1A1A1A',
      cardStyle: 'glow',
      radius: 14,
      fieldRadius: 8,
      padding: 22,
      cardShadow:
        '0 0 0 1px rgba(255,255,255,0.04), 0 0 32px rgba(0,220,130,0.05), 0 12px 40px rgba(0,0,0,0.5)',
      cols2: '1fr 1.2fr',
      cols3: '1fr 1fr 1.5fr',
      headerH: 64,
      cardTints: null,
    });
  });
});
