import { describe, expect, it } from 'vitest';

import { cgAvatarHue, deriveInitials } from './avatar-initials';

describe('deriveInitials', () => {
  it('returns the first letter of each space-split word, capped at 2', () => {
    expect(deriveInitials({ name: 'Ada Thornton', email: 'ada@x.com' })).toBe('AT');
  });

  it('caps at the first two words even when the name has more', () => {
    expect(deriveInitials({ name: 'Ada Beatrice Thornton', email: 'ada@x.com' })).toBe('AB');
  });

  it('returns the first letter of a single-word name', () => {
    expect(deriveInitials({ name: 'Madonna', email: 'm@x.com' })).toBe('M');
  });

  it('falls back to the first 2 chars of the email local-part when name is null', () => {
    expect(deriveInitials({ name: null, email: 'shawbro77@icloud.com' })).toBe('SH');
  });

  it('falls back to the email local-part when name is an empty string', () => {
    expect(deriveInitials({ name: '', email: 'shawbro77@icloud.com' })).toBe('SH');
  });

  it('falls back to the email local-part when name is whitespace-only', () => {
    expect(deriveInitials({ name: '   ', email: 'shawbro77@icloud.com' })).toBe('SH');
  });

  it('handles a single-character email local-part', () => {
    expect(deriveInitials({ name: null, email: 'a@example.com' })).toBe('A');
  });

  it('preserves accented characters', () => {
    expect(deriveInitials({ name: 'Łukasz Świątek', email: 'l@x.com' })).toBe('ŁŚ');
  });

  it('returns "?" when both name and email are empty', () => {
    expect(deriveInitials({ name: null, email: '' })).toBe('?');
    expect(deriveInitials({ name: '', email: '' })).toBe('?');
  });

  it('uppercases mixed-case names', () => {
    expect(deriveInitials({ name: 'ada thornton', email: 'a@x.com' })).toBe('AT');
  });
});

describe('cgAvatarHue', () => {
  it('is deterministic for the same input', () => {
    expect(cgAvatarHue('AT')).toBe(cgAvatarHue('AT'));
    expect(cgAvatarHue('SH')).toBe(cgAvatarHue('SH'));
  });

  it('returns a value in the [0, 360) range', () => {
    for (const seed of ['', 'A', 'AT', 'Madonna', 'shawbro77']) {
      const hue = cgAvatarHue(seed);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it('produces different hues for distinct inputs', () => {
    const hues = new Set(['AT', 'SH', 'M', 'XY', 'AB'].map(cgAvatarHue));
    expect(hues.size).toBeGreaterThan(1);
  });
});
