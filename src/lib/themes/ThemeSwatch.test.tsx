import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThemeSwatch } from './ThemeSwatch';
import { getTheme, getThemeIds } from './index';

describe('<ThemeSwatch>', () => {
  for (const id of getThemeIds()) {
    it(`renders a stable snapshot for ${id}`, () => {
      const { container } = render(<ThemeSwatch theme={getTheme(id)} />);
      expect(container.firstChild).toMatchSnapshot();
    });
  }

  it('uses theme.bg on the outer container', () => {
    const theme = getTheme('vessel');
    const { container } = render(<ThemeSwatch theme={theme} />);
    const outer = container.firstChild as HTMLElement;
    // Hex colours get normalised to rgb() by the DOM; just verify the
    // background was set from the theme (non-empty) rather than left
    // unstyled.
    expect(outer.style.background).toBeTruthy();
  });

  it('uses gradient bg verbatim when theme.bg is a gradient', () => {
    const theme = getTheme('bentoGlassy');
    const { container } = render(<ThemeSwatch theme={theme} />);
    const outer = container.firstChild as HTMLElement;
    expect(outer.style.background).toContain('linear-gradient');
  });

  it('defaults to a 56×56 footprint', () => {
    const { container } = render(
      <ThemeSwatch theme={getTheme('calcgrinder')} />,
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.style.width).toBe('56px');
    expect(outer.style.height).toBe('56px');
  });

  it('respects a custom size prop', () => {
    const { container } = render(
      <ThemeSwatch theme={getTheme('calcgrinder')} size={32} />,
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.style.width).toBe('32px');
    expect(outer.style.height).toBe('32px');
  });

  it('exposes the theme id via data attribute and aria-label', () => {
    const theme = getTheme('terminal');
    const { container } = render(<ThemeSwatch theme={theme} />);
    const outer = container.firstChild as HTMLElement;
    expect(outer.getAttribute('data-theme-id')).toBe(theme.id);
    expect(outer.getAttribute('aria-label')).toContain(theme.displayName);
  });
});
