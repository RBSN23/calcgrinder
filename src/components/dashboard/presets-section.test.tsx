import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { PresetsSection } from './presets-section';
import type { PresetCalculatorRow } from '@/lib/calculators/server';

function makeRow(overrides: Partial<PresetCalculatorRow> = {}): PresetCalculatorRow {
  return {
    id: 'preset-1',
    title: 'Mortgage Calculator',
    description: 'A calculator authored by a sysadmin.',
    theme_id: 'calcgrinder',
    updated_at: '2026-05-24T10:00:00.000Z',
    published: true,
    public_token: 'tok-preset-1',
    owner_id: 'sys-1',
    owner_name: 'Admin',
    ...overrides,
  };
}

describe('<PresetsSection>', () => {
  it('renders the empty-state body when there are no presets', () => {
    render(<PresetsSection presets={[]} />);
    expect(screen.getByText('Presets')).toBeInTheDocument();
    expect(screen.getByText('No presets yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Curated calculators will appear here once a sysadmin publishes one\./i,
      ),
    ).toBeInTheDocument();
    // The card grid should NOT be rendered.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a card grid when at least one preset is present', () => {
    render(
      <PresetsSection
        presets={[
          makeRow(),
          makeRow({ id: 'preset-2', title: 'Loan Payoff', public_token: 'tok-2' }),
        ]}
      />,
    );
    expect(screen.queryByText('No presets yet')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Mortgage Calculator' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Loan Payoff' }),
    ).toBeInTheDocument();
  });

  it("uses variant='preset' on the cards (no kebab, no Status pill, Clone icon present)", () => {
    render(<PresetsSection presets={[makeRow()]} />);
    expect(
      screen.queryByRole('button', { name: 'More actions' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Published')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Clone this calculator into your account',
      }),
    ).toBeInTheDocument();
  });

  it('reflects the count in the section header', () => {
    render(
      <PresetsSection
        presets={[
          makeRow(),
          makeRow({ id: 'preset-2', public_token: 'tok-2' }),
          makeRow({ id: 'preset-3', public_token: 'tok-3' }),
        ]}
      />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
