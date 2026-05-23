// PROJ-4 — SYSADMIN pill (chrome primitive).
// Small uppercase red filled pill rendered next to a sysadmin user's
// name in the avatar popover header.

import * as React from 'react';

export interface SysadminPillProps {
  className?: string;
}

export function SysadminPill({ className }: SysadminPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-[4px] bg-cg-danger px-[7px] py-[2px] font-mono text-[10px] font-bold uppercase leading-[13px] tracking-[0.7px] text-cg-danger-fg align-middle ${className ?? ''}`}
    >
      SYSADMIN
    </span>
  );
}
