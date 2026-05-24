// PROJ-13 — Unit tests for the footer date formatter exported by
// trash-calc-card. The function maps the (soft_delete_at,
// retentionPeriodDays, now) triple to user-facing copy with explicit
// phrasing on the boundary cases the spec calls out: today /
// yesterday / N days ago, today / tomorrow / N days / any moment.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatTrashFooter } from './trash-calc-card';

const NOW_ISO = '2026-06-01T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const DAY_MS = 24 * 60 * 60 * 1000;

describe('formatTrashFooter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Deleted today" when the soft-delete is < 1 day old', () => {
    const softDeleteAt = new Date(NOW_MS - 30 * 60 * 1000).toISOString();
    expect(formatTrashFooter(softDeleteAt, 30)).toBe(
      'Deleted today · Purges in 30 days',
    );
  });

  it('returns "Deleted yesterday" when the soft-delete is exactly 1 day old', () => {
    const softDeleteAt = new Date(NOW_MS - DAY_MS).toISOString();
    expect(formatTrashFooter(softDeleteAt, 30)).toBe(
      'Deleted yesterday · Purges in 29 days',
    );
  });

  it('returns "Deleted N days ago" for N >= 2', () => {
    const softDeleteAt = new Date(NOW_MS - 5 * DAY_MS).toISOString();
    expect(formatTrashFooter(softDeleteAt, 30)).toBe(
      'Deleted 5 days ago · Purges in 25 days',
    );
  });

  it('says "Purges tomorrow" when M is 1', () => {
    // Use a 7-day retention so the "tomorrow" branch fires at 6 days
    // ago (purge fires in 24h, ceil → 1).
    const softDeleteAt = new Date(NOW_MS - 6 * DAY_MS).toISOString();
    expect(formatTrashFooter(softDeleteAt, 7)).toBe(
      'Deleted 6 days ago · Purges tomorrow',
    );
  });

  it('says "Purges today" when remainingMs is exactly 0 (M=0 boundary)', () => {
    // soft_delete_at = NOW - retention*DAY exactly → purgeAt = NOW →
    // remainingMs = 0 → remainingDays = ceil(0) = 0 → "Purges today".
    // Anything strictly less than zero falls into "any moment" per the
    // BUG-L1 fix.
    const softDeleteAt = new Date(NOW_MS - 7 * DAY_MS).toISOString();
    expect(formatTrashFooter(softDeleteAt, 7)).toBe(
      'Deleted 7 days ago · Purges today',
    );
  });

  it('says "Purges any moment" the instant remainingMs goes negative (M<0 boundary)', () => {
    // 1ms past the cutoff. Before BUG-L1 fix this also said "today"
    // (the original branch order swallowed M<0 inside the M≤0 case).
    const softDeleteAt = new Date(NOW_MS - (7 * DAY_MS + 1)).toISOString();
    expect(formatTrashFooter(softDeleteAt, 7)).toBe(
      'Deleted 7 days ago · Purges any moment',
    );
  });

  it('says "Purges any moment" when the window has already elapsed', () => {
    // Past the cutoff — cron hasn't run yet but the window is over.
    const softDeleteAt = new Date(NOW_MS - 32 * DAY_MS).toISOString();
    expect(formatTrashFooter(softDeleteAt, 30)).toBe(
      'Deleted 32 days ago · Purges any moment',
    );
  });

  it('falls back to a safe label when soft_delete_at is unparseable', () => {
    expect(formatTrashFooter('not-a-date', 14)).toBe(
      'Deleted · Purges in 14 days',
    );
  });
});
