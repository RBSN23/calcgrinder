import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as themeModules from './index';
import {
  getDefaultThemeId,
  getTheme,
  getThemeIds,
} from './index';
import type { ThemeId } from './types';

const EXPECTED_IDS: ThemeId[] = [
  'calcgrinder',
  'vessel',
  'editorial',
  'calcgrinderCI',
  'minimal',
  'bento',
  'bentoGlassy',
  'terminal',
];

describe('theme registry', () => {
  it('getThemeIds returns the canonical 8-theme list in order', () => {
    expect(getThemeIds()).toEqual(EXPECTED_IDS);
  });

  it('getDefaultThemeId returns "calcgrinder"', () => {
    expect(getDefaultThemeId()).toBe('calcgrinder');
  });

  describe('getTheme', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it.each(EXPECTED_IDS)(
      'returns the matching theme module for id %s with no warning',
      (id) => {
        const theme = getTheme(id);
        expect(theme.id).toBe(id);
        expect(warnSpy).not.toHaveBeenCalled();
      },
    );

    it('falls back to calcgrinder for an unknown id with a [theme-system] warning', () => {
      const theme = getTheme('unknown-id');
      expect(theme.id).toBe('calcgrinder');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        '[theme-system] Unknown theme id "unknown-id" — falling back to "calcgrinder"',
      );
    });

    it('falls back to calcgrinder for null', () => {
      const theme = getTheme(null);
      expect(theme.id).toBe('calcgrinder');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        '[theme-system] Unknown theme id "null" — falling back to "calcgrinder"',
      );
    });

    it('falls back to calcgrinder for undefined', () => {
      const theme = getTheme(undefined);
      expect(theme.id).toBe('calcgrinder');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        '[theme-system] Unknown theme id "undefined" — falling back to "calcgrinder"',
      );
    });
  });

  describe('consistency', () => {
    it('every id from getThemeIds is reachable via getTheme', () => {
      for (const id of getThemeIds()) {
        const theme = getTheme(id);
        expect(theme).toBeDefined();
        expect(theme.id).toBe(id);
      }
    });

    it('every theme module exposes a unique non-empty id matching its registry key', () => {
      const seen = new Set<string>();
      for (const id of getThemeIds()) {
        expect(id).not.toBe('');
        expect(seen.has(id)).toBe(false);
        seen.add(id);
        // Round-trip: the module's `.id` matches the registry key.
        expect(getTheme(id).id).toBe(id);
      }
    });

    it('exports all named theme modules', () => {
      // Catches the case where a theme file is added but never wired
      // into the registry index — the namespace import would still
      // include it but the registry wouldn't.
      for (const id of EXPECTED_IDS) {
        expect((themeModules as Record<string, unknown>)[id]).toBeDefined();
      }
    });
  });
});
