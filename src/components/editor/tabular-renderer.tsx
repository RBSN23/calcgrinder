'use client';

// PROJ-17 — TabularRenderer.
//
// Shared renderer consumed by both the Builder cell-card preview and
// the visitor view via the same dispatch site in `cell-card.tsx`. The
// renderer is intentionally inert: no header click handlers, no
// per-cell handlers, no sort / filter / pagination — every row in
// the formula's array is emitted as a `<tr>`, with `<thead>` pinned
// via `position: sticky` inside a vertical-scroll container.
//
// Sizing: max-height 400px (configurable via `--tabular-max-h` CSS
// custom property). When natural column widths exceed the card width,
// horizontal scroll activates. No column stacking on mobile.
//
// Empty state:
//   * empty array + populated columns → headers + a single full-width
//     muted "No data" row inside <tbody>.
//   * empty array + empty columns → "No data" placeholder alone.
//
// Security: row values flow through the shared `formatValue` helper,
// which always returns a plain string. React renders the return as a
// text node — no dangerouslySetInnerHTML on the tabular path.

import * as React from 'react';

import { formatValue } from '@/lib/cells/format';
import type { TabularColumn } from '@/lib/cells/types';
import type { Theme } from '@/lib/themes';

interface TabularRendererProps {
  columns: TabularColumn[];
  rows: unknown[];
  theme: Theme;
  // Fallback currency code resolved from the parent cell — used when a
  // column has format = 'currency' but no per-column override.
  cellCurrencyCode?: string | null;
}

const MAX_HEIGHT_VAR = 'var(--tabular-max-h, 400px)';

export function TabularRenderer({
  columns,
  rows,
  theme,
  cellCurrencyCode,
}: TabularRendererProps) {
  const visibleColumns = React.useMemo(
    () => columns.filter((c) => c.visibility === 'visible'),
    [columns],
  );

  const hasHeaders = visibleColumns.length > 0;
  const isEmpty = rows.length === 0;

  if (!hasHeaders && isEmpty) {
    return <EmptyPlaceholder theme={theme} />;
  }

  return (
    <div
      className="w-full overflow-x-auto overflow-y-auto rounded-md"
      style={{
        maxHeight: MAX_HEIGHT_VAR,
        border: `1px solid ${theme.border}`,
        background: theme.card,
      }}
    >
      <table
        className="w-full border-collapse text-[12.5px]"
        style={{
          color: theme.text,
          fontFamily: theme.font,
        }}
      >
        {hasHeaders ? (
          <thead
            style={{
              position: 'sticky',
              top: 0,
              background: theme.card,
              zIndex: 1,
            }}
          >
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className="whitespace-nowrap px-3 py-2 font-semibold"
                  style={{
                    textAlign: col.alignment,
                    borderBottom: `1px solid ${theme.border}`,
                    color: theme.muted,
                    fontSize: 11,
                    letterSpacing: '0.02em',
                    textTransform: theme.uppercase ? 'uppercase' : undefined,
                  }}
                >
                  {col.label.trim() === '' ? col.id : col.label}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {isEmpty ? (
            <tr>
              <td
                colSpan={Math.max(1, visibleColumns.length)}
                className="px-3 py-6 text-center italic"
                style={{ color: theme.muted }}
              >
                No data
              </td>
            </tr>
          ) : (
            rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                style={{
                  borderBottom:
                    rowIdx === rows.length - 1
                      ? undefined
                      : `1px solid ${theme.border}`,
                }}
              >
                {visibleColumns.map((col) => {
                  const cellValue = readCell(row, col.id);
                  const text = formatValue(
                    {
                      format: col.format,
                      currency_code: col.currency_code ?? cellCurrencyCode ?? null,
                    },
                    cellValue,
                  );
                  const empty = cellValue === undefined || cellValue === null;
                  return (
                    <td
                      key={col.id}
                      className="whitespace-nowrap px-3 py-2"
                      style={{
                        textAlign: col.alignment,
                        color: empty ? theme.subtle : theme.text,
                      }}
                    >
                      {empty ? '' : text}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function EmptyPlaceholder({ theme }: { theme: Theme }) {
  return (
    <div
      className="flex items-center justify-center rounded-md px-3 py-6 text-[12.5px] italic"
      style={{
        border: `1px solid ${theme.border}`,
        background: theme.card,
        color: theme.muted,
      }}
    >
      No data
    </div>
  );
}

function readCell(row: unknown, key: string): unknown {
  if (row === null || row === undefined) return undefined;
  if (typeof row !== 'object') return undefined;
  return (row as Record<string, unknown>)[key];
}
