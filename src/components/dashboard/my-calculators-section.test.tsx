import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { MyCalculatorsSection } from './my-calculators-section';
import type { CalculatorRow } from '@/lib/calculators/types';

const ROW: CalculatorRow = {
  id: 'calc-1',
  title: 'Mortgage Calculator',
  description: '',
  theme_id: 'calcgrinder',
  updated_at: '2026-05-23T10:00:00.000Z',
  published: false,
  public_token: 'tok-123',
};

describe('<MyCalculatorsSection>', () => {
  it('renders nothing when the user owns zero calculators (hide-when-empty)', () => {
    const { container } = render(
      <MyCalculatorsSection calculators={[]} retentionPeriodDays={30} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the Section with count and the card list when non-empty', () => {
    render(
      <MyCalculatorsSection
        calculators={[ROW, { ...ROW, id: 'calc-2', title: 'Other' }]}
        retentionPeriodDays={30}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'My Calculators' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mortgage Calculator' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Other' })).toBeInTheDocument();
  });

  it('mounts expanded by default (My Calculators is the primary surface)', () => {
    render(
      <MyCalculatorsSection calculators={[ROW]} retentionPeriodDays={30} />,
    );
    expect(
      screen.getByRole('button', { name: /My Calculators/i }),
    ).toHaveAttribute('aria-expanded', 'true');
  });
});
