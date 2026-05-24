import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn() },
}));

import { CloneController } from './clone-controller';
import { CloneHeaderButton } from './clone-header-button';
import * as clientApi from '@/lib/calculators/client';
import { CalculatorApiError } from '@/lib/calculators/client';
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
  beforeEach(() => {
    pushMock.mockReset();
    toastError.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('renders the icon-button with the documented aria-label for approved users', () => {
    render(
      <CloneController calculator={CALC} approvedUser={APPROVED}>
        <CloneHeaderButton />
      </CloneController>,
    );
    const btn = screen.getByRole('button', {
      name: 'Clone this calculator into your account',
    });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute(
      'title',
      'Clone this calculator into your account',
    );
  });

  it('clicking the button calls cloneCalculator with the calculator id + token and navigates to the editor', async () => {
    const clone = vi.spyOn(clientApi, 'cloneCalculator').mockResolvedValue({
      id: 'calc-2',
      title: 'Mortgage Calculator — Copy',
      description: '',
      theme_id: 'calcgrinder',
      updated_at: '2026-05-24T10:01:00.000Z',
      published: false,
      public_token: 'tok-new',
      default_section_id: 'sec-1',
      source_calculator_id: 'calc-1',
    } as never);

    render(
      <CloneController calculator={CALC} approvedUser={APPROVED}>
        <CloneHeaderButton />
      </CloneController>,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Clone this calculator into your account',
      }),
    );
    await waitFor(() =>
      expect(clone).toHaveBeenCalledWith('calc-1', 'tok-123'),
    );
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('/editor/calc-2'),
    );
  });

  it('shows an error toast and restores the button on failure', async () => {
    vi.spyOn(clientApi, 'cloneCalculator').mockRejectedValue(
      new CalculatorApiError(500, 'boom'),
    );
    render(
      <CloneController calculator={CALC} approvedUser={APPROVED}>
        <CloneHeaderButton />
      </CloneController>,
    );
    const btn = screen.getByRole('button', {
      name: 'Clone this calculator into your account',
    });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Couldn't clone — please try again.",
      ),
    );
    expect(pushMock).not.toHaveBeenCalled();
    expect(btn).not.toBeDisabled();
  });

  it('ignores additional clicks while the request is in flight', async () => {
    let resolveClone: ((value: unknown) => void) | null = null;
    vi.spyOn(clientApi, 'cloneCalculator').mockReturnValue(
      new Promise((res) => {
        resolveClone = res;
      }) as never,
    );
    render(
      <CloneController calculator={CALC} approvedUser={APPROVED}>
        <CloneHeaderButton />
      </CloneController>,
    );
    const btn = screen.getByRole('button', {
      name: 'Clone this calculator into your account',
    });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());
    expect(btn).toHaveAttribute('aria-busy', 'true');
    resolveClone?.({
      id: 'calc-2',
      title: 'X — Copy',
      description: '',
      theme_id: 't',
      updated_at: '',
      published: false,
      public_token: '',
      default_section_id: '',
      source_calculator_id: 'calc-1',
    });
    await waitFor(() =>
      expect(clientApi.cloneCalculator).toHaveBeenCalledTimes(1),
    );
  });
});
