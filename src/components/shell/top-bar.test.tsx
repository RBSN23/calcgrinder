import { describe, expect, it } from 'vitest';

import { buildBreadcrumbTabs } from './top-bar-desktop';

describe('buildBreadcrumbTabs', () => {
  it('/dashboard → single active Dashboard tab', () => {
    const tabs = buildBreadcrumbTabs('/dashboard');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toMatchObject({ label: 'Dashboard', active: true });
    expect(tabs[0].href).toBeUndefined();
  });

  it('/settings → Dashboard (link, inactive) + Settings (active)', () => {
    const tabs = buildBreadcrumbTabs('/settings');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toMatchObject({ label: 'Dashboard', href: '/dashboard', active: false });
    expect(tabs[1]).toMatchObject({ label: 'Settings', active: true });
    expect(tabs[1].href).toBeUndefined();
  });

  it('/editor/anything → Dashboard (link) + "Untitled calculator" placeholder', () => {
    const tabs = buildBreadcrumbTabs('/editor/abc-123');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toMatchObject({ label: 'Dashboard', href: '/dashboard', active: false });
    expect(tabs[1]).toMatchObject({ label: 'Untitled calculator', active: true });
  });

  it('/editor/* honours the editorTitle override (PROJ-8 seam)', () => {
    const tabs = buildBreadcrumbTabs('/editor/abc-123', { editorTitle: 'Mortgage helper' });
    expect(tabs[1]).toMatchObject({ label: 'Mortgage helper', active: true });
  });

  it('unmatched routes fall back to Dashboard (link)', () => {
    const tabs = buildBreadcrumbTabs('/widgets');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toMatchObject({ label: 'Dashboard', href: '/dashboard', active: false });
  });

  it('/dashboard/foo (unmatched under dashboard) falls back to Dashboard link', () => {
    const tabs = buildBreadcrumbTabs('/dashboard/foo');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toMatchObject({ label: 'Dashboard', href: '/dashboard', active: false });
  });
});
