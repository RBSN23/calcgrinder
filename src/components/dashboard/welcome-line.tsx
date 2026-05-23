// PROJ-5 — Dashboard welcome line.
//
// Server Component. Renders the small-caps "ACCOUNT" eyebrow above an
// `<h1>` "Welcome back, <name>" (or just "Welcome back" when the name is
// null / empty / whitespace-only). Adds the SYSADMIN pill inline when
// role === 'sysadmin'.
//
// Desktop-only: the outer wrapper uses `hidden md:block` so mobile spends
// its real estate on the section list instead. SYSADMIN visibility on
// mobile is preserved via the avatar popover (PROJ-4).

import * as React from 'react';

import { SysadminPill } from '@/components/shell';

export interface WelcomeLineProps {
  name: string | null;
  role: 'registered' | 'sysadmin';
}

export function WelcomeLine({ name, role }: WelcomeLineProps) {
  const trimmed = name?.trim();
  const greeting = trimmed ? `Welcome back, ${trimmed}` : 'Welcome back';
  const isSysadmin = role === 'sysadmin';

  return (
    <div className="hidden md:block">
      <div className="mb-[6px] text-[11.5px] font-medium uppercase tracking-[0.6px] text-cg-text-subtle">
        Account
      </div>
      <h1 className="m-0 flex flex-wrap items-center gap-[10px] text-[24px] font-semibold leading-[1.15] tracking-[-0.6px] text-cg-text">
        <span>{greeting}</span>
        {isSysadmin ? <SysadminPill className="-translate-y-[1px]" /> : null}
      </h1>
    </div>
  );
}
