import { describe, expect, it } from 'vitest';

import { terminal } from './terminal';

describe('terminal theme tokens', () => {
  it('matches docs/design/themes.jsx', () => {
    expect(terminal).toEqual({
      id: 'terminal',
      displayName: 'Terminal · Cyber',
      description:
        'Dark canvas with retro mono. Vercel-influenced surfaces, terminal flavor.',
      font: 'var(--font-geist-mono), "SF Mono", monospace',
      fontMono: 'var(--font-geist-mono), monospace',
      bg: '#0A0A0A',
      surface: '#0A0A0A',
      card: '#0F0F0F',
      cardAlt: '#161616',
      border: '#1F1F1F',
      borderStr: '#2A2A2A',
      rule: '#1A1A1A',
      ink: '#E8E8E8',
      text: '#D4D4D4',
      muted: '#8A8A8A',
      subtle: '#5A5A5A',
      accent: '#4ADE80',
      accentFg: '#0A0A0A',
      accentSoft: 'rgba(74,222,128,0.14)',
      glowRgba: '74,222,128',
      chartA: '#E8E8E8',
      chartB: '#4ADE80',
      chartGrid: '#171717',
      cardStyle: 'glow',
      radius: 8,
      fieldRadius: 6,
      padding: 22,
      cardShadow:
        '0 0 0 1px rgba(255,255,255,0.05), 0 0 24px rgba(74,222,128,0.06), 0 12px 40px rgba(0,0,0,0.4)',
      cols2: '1fr 1.2fr',
      cols3: '1fr 1fr 1.5fr',
      headerH: 60,
      cardTints: null,
      layoutPatterns: terminal.layoutPatterns,
      chartPalette: terminal.chartPalette,
    });
  });
});
