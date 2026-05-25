import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { CloneController } from './clone-controller';
import { CloneHeaderButton } from './clone-header-button';
import type { PublicCalculator } from '@/lib/calculators/types';

const CALC: PublicCalculator = {
  id: 'calc-1',
  owner_id: 'owner-1',
  title: 'Mortgage Calculator',
  description: '',
  theme_id: 'calcgrinder',
  public_token: 'tok-123',
  published: true,
  updated_at: '2026-05-24T10:00:00.000Z',
  sections: [],
};

const APPROVED = {
  name: 'Jordan',
  email: 'jordan@example.com',
  role: 'registered' as const,
};

describe('<CloneHeaderButton>', () => {
  it('renders nothing when no CloneController is mounted (error shells)', () => {
    const { container } = render(<CloneHeaderButton />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the user is not an approved logged-in user', () => {
    const { container } = render(
      <CloneController calculator={CALC} approvedUser={null}>
        <CloneHeaderButton />
      </CloneController>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a link with the documented aria-label for approved users', () => {
    render(
      <CloneController calculator={CALC} approvedUser={APPROVED}>
        <CloneHeaderButton />
      </CloneController>,
    );
    const link = screen.getByRole('link', {
      name: 'Clone this calculator into your account',
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'title',
      'Clone this calculator into your account',
    );
  });

  it('links to /editor/new with clone params for immediate navigation', () => {
    render(
      <CloneController calculator={CALC} approvedUser={APPROVED}>
        <CloneHeaderButton />
      </CloneController>,
    );
    const link = screen.getByRole('link', {
      name: 'Clone this calculator into your account',
    });
    expect(link).toHaveAttribute(
      'href',
      '/editor/new?clone=calc-1&token=tok-123',
    );
  });
});
