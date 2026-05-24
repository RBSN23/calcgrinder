// PROJ-4 — Icon set ported from docs/design/chrome.jsx.
// Inline SVG glyphs at currentColor; stroke-based by default. The
// chrome surfaces (top bar, popover, empty-or-error states) consume
// only this set. Body content can still pull lucide-react.

import * as React from 'react';

type IconProps = {
  size?: number;
  stroke?: number;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-label'?: string;
};

function makeIcon(children: React.ReactNode): React.FC<IconProps> {
  const Icon: React.FC<IconProps> = ({
    size = 16,
    stroke = 1.75,
    className,
    'aria-hidden': ariaHidden = true,
    'aria-label': ariaLabel,
  }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaLabel ? undefined : ariaHidden}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
    >
      {children}
    </svg>
  );
  return Icon;
}

export const Icons = {
  Plus: makeIcon(<path d="M12 5v14M5 12h14" />),
  Minus: makeIcon(<path d="M5 12h14" />),
  ChevR: makeIcon(<path d="M9 6l6 6-6 6" />),
  ChevD: makeIcon(<path d="M6 9l6 6 6-6" />),
  ChevL: makeIcon(<path d="M15 6l-6 6 6 6" />),
  Sun: makeIcon(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>,
  ),
  Moon: makeIcon(<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />),
  Monitor: makeIcon(
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>,
  ),
  Settings: makeIcon(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </>,
  ),
  Logout: makeIcon(<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />),
  Shield: makeIcon(<path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />),
  Menu: makeIcon(<path d="M3 6h18M3 12h18M3 18h18" />),
  // Four filled squares — preset / template glyph (PROJ-5 Presets empty,
  // PROJ-10 "Start from a template" Hero, PROJ-18 Presets card).
  LayoutGrid: makeIcon(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
    </>,
  ),
  // Magnifying-glass with X — "page not found" glyph.
  NotFound: makeIcon(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M8.5 8.5l5 5M13.5 8.5l-5 5" />
    </>,
  ),
  // PROJ-10 — calculator card glyphs.
  // Pencil — Edit affordance.
  Pencil: makeIcon(
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />,
  ),
  // External-link — Public-view / Preview affordance.
  External: makeIcon(
    <>
      <path d="M14 3h7v7" />
      <path d="M10 14L21 3" />
      <path d="M21 14v7a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h7" />
    </>,
  ),
  // Copy — Duplicate affordance.
  Copy: makeIcon(
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </>,
  ),
  // Calculator icon — top-left badge on <CalcCard>.
  Calc: makeIcon(
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01" />
    </>,
  ),
  // Kebab — vertical 3-dot menu trigger.
  Kebab: makeIcon(
    <>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </>,
  ),
  // Share / link — Sharing popover affordance in editor toolbar.
  Share: makeIcon(
    <>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </>,
  ),
  // Trash — Delete kebab item.
  Trash: makeIcon(
    <>
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </>,
  ),
  // Eye — Publish kebab item.
  Eye: makeIcon(
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
  // EyeOff — Unpublish kebab item.
  EyeOff: makeIcon(
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />,
  ),
  // PROJ-12 — Padlock (closed) — locked input cell on the visitor surface.
  Lock: makeIcon(
    <>
      <rect x="3.5" y="11" width="17" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </>,
  ),
  // PROJ-12 — Padlock (open) — unlocked input cell on the visitor surface.
  Unlock: makeIcon(
    <>
      <rect x="3.5" y="11" width="17" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 019.9-1" />
    </>,
  ),
  // PROJ-12 — Bookmark / Save Scenario — visitor header save icon.
  Bookmark: makeIcon(
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />,
  ),
};

export type IconName = keyof typeof Icons;
