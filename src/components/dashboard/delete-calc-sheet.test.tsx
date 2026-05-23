import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DeleteCalcSheet } from './delete-calc-sheet';

describe('<DeleteCalcSheet>', () => {
  it('renders the retention copy with the configured day count', () => {
    render(
      <DeleteCalcSheet
        open
        onOpenChange={() => {}}
        title="Mortgage"
        retentionPeriodDays={45}
        onConfirm={() => {}}
      />,
    );
    expect(
      screen.getByText(
        /Move «Mortgage» to Trash\? You can restore it within 45 days from the Trash section\./,
      ),
    ).toBeInTheDocument();
  });

  it('renders the Move to Trash + Cancel buttons', () => {
    render(
      <DeleteCalcSheet
        open
        onOpenChange={() => {}}
        title="X"
        retentionPeriodDays={30}
        onConfirm={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Move to Trash' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <DeleteCalcSheet
        open={false}
        onOpenChange={() => {}}
        title="X"
        retentionPeriodDays={30}
        onConfirm={() => {}}
      />,
    );
    expect(
      container.querySelector('[role="dialog"]'),
    ).toBeNull();
  });
});
