import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WelcomeLine } from './welcome-line';

describe('<WelcomeLine>', () => {
  it('renders "Welcome back, <name>" when name is present', () => {
    render(<WelcomeLine name="Ada Thornton" role="registered" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Welcome back, Ada Thornton',
    );
  });

  it('renders "Welcome back" with no suffix when name is null', () => {
    render(<WelcomeLine name={null} role="registered" />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/^Welcome back$/);
  });

  it('renders "Welcome back" when name is whitespace-only', () => {
    render(<WelcomeLine name="   " role="registered" />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/^Welcome back$/);
  });

  it('trims surrounding whitespace from the name', () => {
    render(<WelcomeLine name="  Ada  " role="registered" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Welcome back, Ada',
    );
  });

  it('renders the SYSADMIN pill when role="sysadmin"', () => {
    render(<WelcomeLine name="Ada" role="sysadmin" />);
    expect(screen.getByText('SYSADMIN')).toBeInTheDocument();
  });

  it('does not render the SYSADMIN pill when role="registered"', () => {
    render(<WelcomeLine name="Ada" role="registered" />);
    expect(screen.queryByText('SYSADMIN')).not.toBeInTheDocument();
  });

  it('renders the SYSADMIN pill even when name is null', () => {
    render(<WelcomeLine name={null} role="sysadmin" />);
    expect(screen.getByText('SYSADMIN')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Welcome back/,
    );
  });

  it('has an "ACCOUNT" eyebrow above the h1', () => {
    render(<WelcomeLine name="Ada" role="registered" />);
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('outer wrapper is hidden on mobile (hidden md:block)', () => {
    const { container } = render(<WelcomeLine name="Ada" role="registered" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toMatch(/hidden/);
    expect(wrapper.className).toMatch(/md:block/);
  });
});
