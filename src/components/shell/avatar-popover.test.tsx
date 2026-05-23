import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setThemeMock = vi.fn();
const themeState: { theme: string } = { theme: 'system' };

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: themeState.theme, setTheme: setThemeMock }),
}));

import { AvatarPopoverContent } from './avatar-popover';

describe('AvatarPopoverContent', () => {
  beforeEach(() => {
    setThemeMock.mockReset();
    themeState.theme = 'system';
  });

  it('renders the user name and email in the header', () => {
    render(
      <AvatarPopoverContent
        user={{ name: 'Ada Thornton', email: 'ada@calcgrinder.app', role: 'registered' }}
      />,
    );
    expect(screen.getByText('Ada Thornton')).toBeInTheDocument();
    expect(screen.getByText('ada@calcgrinder.app')).toBeInTheDocument();
  });

  it('falls back to "—" when the name is null', () => {
    render(
      <AvatarPopoverContent
        user={{ name: null, email: 'shawbro77@icloud.com', role: 'registered' }}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the SYSADMIN pill for sysadmin role only', () => {
    const { rerender } = render(
      <AvatarPopoverContent
        user={{ name: 'Ada', email: 'a@x.com', role: 'registered' }}
      />,
    );
    expect(screen.queryByText('SYSADMIN')).not.toBeInTheDocument();
    rerender(
      <AvatarPopoverContent
        user={{ name: 'Ada', email: 'a@x.com', role: 'sysadmin' }}
      />,
    );
    expect(screen.getByText('SYSADMIN')).toBeInTheDocument();
  });

  it('does not render the Admin row when isAdmin=false (PROJ-4 default)', () => {
    render(
      <AvatarPopoverContent
        user={{ name: 'Ada', email: 'a@x.com', role: 'sysadmin' }}
        isAdmin={false}
      />,
    );
    expect(screen.queryByRole('menuitem', { name: /admin/i })).not.toBeInTheDocument();
  });

  it('renders the Admin row when isAdmin=true (PROJ-19 seam)', () => {
    render(
      <AvatarPopoverContent
        user={{ name: 'Ada', email: 'a@x.com', role: 'sysadmin' }}
        isAdmin
      />,
    );
    expect(screen.getByRole('menuitem', { name: /admin/i })).toBeInTheDocument();
  });

  it('calls setTheme("light"/"dark"/"system") when theme buttons are clicked', () => {
    render(
      <AvatarPopoverContent
        user={{ name: 'Ada', email: 'a@x.com', role: 'registered' }}
      />,
    );
    const radiogroup = screen.getByRole('radiogroup');
    fireEvent.click(within(radiogroup).getByRole('radio', { name: /light/i }));
    fireEvent.click(within(radiogroup).getByRole('radio', { name: /dark/i }));
    fireEvent.click(within(radiogroup).getByRole('radio', { name: /system/i }));
    expect(setThemeMock).toHaveBeenNthCalledWith(1, 'light');
    expect(setThemeMock).toHaveBeenNthCalledWith(2, 'dark');
    expect(setThemeMock).toHaveBeenNthCalledWith(3, 'system');
  });

  it('points the Settings menuitem at /settings', () => {
    render(
      <AvatarPopoverContent
        user={{ name: 'Ada', email: 'a@x.com', role: 'registered' }}
      />,
    );
    const settings = screen.getByRole('menuitem', { name: /settings/i });
    expect(settings).toHaveAttribute('href', '/settings');
  });

  it('wraps Sign out in a POST form targeting /auth/sign-out', () => {
    const { container } = render(
      <AvatarPopoverContent
        user={{ name: 'Ada', email: 'a@x.com', role: 'registered' }}
      />,
    );
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    expect(form?.getAttribute('action')).toBe('/auth/sign-out');
    expect(form?.getAttribute('method')).toBe('post');
    const submit = form?.querySelector('button[type="submit"]');
    expect(submit?.textContent).toMatch(/sign out/i);
  });
});
