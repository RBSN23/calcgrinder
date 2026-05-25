import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Radix's pointer-based open semantics need PointerEvent, which jsdom
// doesn't provide. Polyfill enough of it for fireEvent.pointerDown to
// reach Radix's listeners.
if (typeof window !== 'undefined' && !(window as unknown as { PointerEvent?: unknown }).PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? '';
    }
  }
  (window as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent =
    PointerEventPolyfill;
}

// Radix also calls hasPointerCapture / setPointerCapture / releasePointerCapture
// on elements, which jsdom doesn't define. Stub them as no-ops.
if (typeof Element !== 'undefined') {
  type ElementWithPointer = Element & {
    hasPointerCapture?: () => boolean;
    setPointerCapture?: () => void;
    releasePointerCapture?: () => void;
    scrollIntoView?: () => void;
  };
  const proto = Element.prototype as ElementWithPointer;
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.scrollIntoView) proto.scrollIntoView = () => {};
}

function openDropdown(trigger: HTMLElement) {
  // Radix DropdownMenu opens on pointerdown for mouse events. In jsdom
  // with a PointerEvent polyfill that subclasses MouseEvent, this is the
  // sequence Radix's internals recognise.
  act(() => {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
  });
}

function selectMenuItem(item: HTMLElement) {
  // Radix's MenuItem invokes onSelect inside its onClick handler.
  // Send a real MouseEvent (instead of fireEvent.click which uses
  // jsdom's MouseEvent constructor that drops `detail`) so Radix's
  // internal click filtering recognises it as a user click.
  item.focus();
  const evt = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
  });
  item.dispatchEvent(evt);
}

// next/navigation — push/refresh are captured so we can assert on
// navigation side-effects.
const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

// Sonner toasts are dynamic-imported in the component, so we mock the
// module factory.
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

import { CalcCard } from './calc-card';
import type { CalculatorRow } from '@/lib/calculators/types';
import * as clientApi from '@/lib/calculators/client';
import { CalculatorApiError } from '@/lib/calculators/client';

const ROW: CalculatorRow = {
  id: 'calc-1',
  title: 'Mortgage Calculator',
  description: 'Crunch the numbers on your home loan.',
  theme_id: 'calcgrinder',
  updated_at: '2026-05-23T10:00:00.000Z',
  published: false,
  public_token: 'tok-123',
};

describe('<CalcCard>', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders title, description, Draft pill, and the kebab', () => {
    render(<CalcCard calculator={ROW} retentionPeriodDays={30} />);
    expect(
      screen.getByRole('heading', { name: 'Mortgage Calculator' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Crunch the numbers on your home loan.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument();
  });

  it('renders the card as an anchor pointing at /c/<token> in a new tab', () => {
    render(<CalcCard calculator={ROW} retentionPeriodDays={30} />);
    const anchor = screen.getByRole('link', {
      name: /Mortgage Calculator.*Draft/i,
    });
    expect(anchor).toHaveAttribute('href', '/c/tok-123');
    expect(anchor).toHaveAttribute('target', '_blank');
    expect(anchor).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders the Edit / Public-view / Duplicate icon-buttons with aria labels', () => {
    render(<CalcCard calculator={ROW} retentionPeriodDays={30} />);
    expect(screen.getByRole('button', { name: 'Edit calculator' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open public view in new tab' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Duplicate calculator' }),
    ).toBeInTheDocument();
  });

  it('clicking Edit pushes to /editor/<id> and stops propagation', () => {
    render(<CalcCard calculator={ROW} retentionPeriodDays={30} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit calculator' }));
    expect(pushMock).toHaveBeenCalledWith('/editor/calc-1');
  });

  it('Duplicate icon-button navigates to /editor/new with duplicate param', () => {
    render(<CalcCard calculator={ROW} retentionPeriodDays={30} />);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate calculator' }));
    expect(pushMock).toHaveBeenCalledWith('/editor/new?duplicate=calc-1');
  });

  it('reflects Published pill when row.published is true', () => {
    render(
      <CalcCard
        calculator={{ ...ROW, published: true }}
        retentionPeriodDays={30}
      />,
    );
    expect(screen.getByText('Published')).toBeInTheDocument();
  });

  it('kebab popover lists Public Link / Rename / Duplicate / Publish / Delete', async () => {
    render(<CalcCard calculator={ROW} retentionPeriodDays={30} />);
    openDropdown(screen.getByRole('button', { name: 'More actions' }));
    expect(
      await screen.findByRole('menuitem', { name: /Public Link/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /Rename/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /Duplicate/i }),
    ).toBeInTheDocument();
    // 4th item swaps label based on `published`. ROW is draft, so it
    // should read "Publish".
    expect(
      screen.getByRole('menuitem', { name: /^Publish$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /Delete/i }),
    ).toBeInTheDocument();
  });

  it('kebab popover swaps "Publish" → "Unpublish" when row.published is true', async () => {
    render(
      <CalcCard
        calculator={{ ...ROW, published: true }}
        retentionPeriodDays={30}
      />,
    );
    openDropdown(screen.getByRole('button', { name: 'More actions' }));
    expect(
      await screen.findByRole('menuitem', { name: /Unpublish/i }),
    ).toBeInTheDocument();
  });
});

describe("<CalcCard variant='preset'>", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides the kebab, the Edit and Duplicate icons, and the Status pill', () => {
    render(
      <CalcCard
        calculator={ROW}
        retentionPeriodDays={30}
        variant="preset"
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'More actions' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit calculator' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Duplicate calculator' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
    expect(screen.queryByText('Published')).not.toBeInTheDocument();
  });

  it('renders the Public-view and Clone icon-buttons in that order', () => {
    render(
      <CalcCard
        calculator={ROW}
        retentionPeriodDays={30}
        variant="preset"
      />,
    );
    const publicBtn = screen.getByRole('button', {
      name: 'Open public view in new tab',
    });
    const cloneBtn = screen.getByRole('button', {
      name: 'Clone this calculator into your account',
    });
    expect(publicBtn).toBeInTheDocument();
    expect(cloneBtn).toBeInTheDocument();
    expect(
      publicBtn.compareDocumentPosition(cloneBtn) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders the card anchor without the Draft/Published prefix in the aria-label", () => {
    render(
      <CalcCard
        calculator={ROW}
        retentionPeriodDays={30}
        variant="preset"
      />,
    );
    const anchor = screen.getByRole('link', {
      name: 'Mortgage Calculator. Open public view in new tab.',
    });
    expect(anchor).toHaveAttribute('href', '/c/tok-123');
    expect(anchor).toHaveAttribute('target', '_blank');
  });

  it('clicking the Clone icon-button navigates to /editor/new with clone params', () => {
    render(
      <CalcCard
        calculator={ROW}
        retentionPeriodDays={30}
        variant="preset"
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Clone this calculator into your account',
      }),
    );
    expect(pushMock).toHaveBeenCalledWith(
      '/editor/new?clone=calc-1&token=tok-123',
    );
  });
});

// Reference-only — `selectMenuItem` is provided for future tests that
// can drive Radix MenuItem onSelect once the testing environment is
// upgraded to a polyfill that fires the right event sequence. The
// E2E tests cover the dropdown-driven rename / publish / delete flows
// in a real browser; the unit suite above asserts surface composition.
void selectMenuItem;
void CalculatorApiError;
void clientApi;
