// PROJ-4 — Avatar circle (chrome primitive).
// Stateless. Background uses `oklch(var(--cg-avatar-l) 0.13 <hue>deg)` so
// the per-theme lightness switches without a JS round-trip on theme change.

import * as React from 'react';

import { cgAvatarHue } from './avatar-initials';

export interface AvatarProps {
  initials: string;
  size?: number;
  className?: string;
}

export function Avatar({ initials, size = 28, className }: AvatarProps) {
  const hue = cgAvatarHue(initials);
  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: size * 0.4,
    background: `oklch(var(--cg-avatar-l) 0.13 ${hue}deg)`,
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
  };
  return (
    <div
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight text-white ${className ?? ''}`}
      style={style}
    >
      {initials}
    </div>
  );
}
