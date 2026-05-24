import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const updateEmail = vi.fn();
const cancelEmail = vi.fn();
vi.mock('../_actions/update-email', () => ({
  updateEmailAction: (...args: unknown[]) => updateEmail(...args),
  cancelEmailChangeAction: (...args: unknown[]) => cancelEmail(...args),
}));

import { EmailRow } from './email-row';

describe('EmailRow — BUG-L1 regression (input snaps back to old email after entering pending state)', () => {
  beforeEach(() => {
    updateEmail.mockReset();
    cancelEmail.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('resets the input to the current (old) email after a successful action', async () => {
    updateEmail.mockResolvedValue({ ok: true });
    render(<EmailRow currentEmail="old@example.com" pendingEmail={null} />);

    const input = screen.getByLabelText('Email') as HTMLInputElement;
    expect(input.value).toBe('old@example.com');

    fireEvent.change(input, { target: { value: 'new@example.com' } });
    expect(input.value).toBe('new@example.com');

    await act(async () => {
      fireEvent.blur(input);
    });

    expect(updateEmail).toHaveBeenCalledWith('new@example.com');
    // Spec: input shows the OLD email value (not the new one) once the
    // change is pending; the new address is surfaced via the helper
    // text + Pending pill instead.
    expect(input.value).toBe('old@example.com');
  });

  it('also resets the input on error (existing behaviour preserved)', async () => {
    updateEmail.mockResolvedValue({ ok: false, error: 'boom' });
    render(<EmailRow currentEmail="old@example.com" pendingEmail={null} />);

    const input = screen.getByLabelText('Email') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'duplicate@example.com' } });
    await act(async () => {
      fireEvent.blur(input);
    });

    expect(input.value).toBe('old@example.com');
  });

  it('skips the action when the typed value equals the current email (case-insensitive)', async () => {
    render(<EmailRow currentEmail="old@example.com" pendingEmail={null} />);
    const input = screen.getByLabelText('Email') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'OLD@example.com' } });
    await act(async () => {
      fireEvent.blur(input);
    });
    expect(updateEmail).not.toHaveBeenCalled();
    expect(input.value).toBe('OLD@example.com');
  });
});
