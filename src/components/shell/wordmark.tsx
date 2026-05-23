// PROJ-4 — Wordmark (chrome primitive).
// "c" tile + "Calcgrinder" text. `mini` variant drops the text label so
// the mobile top bar can use the tile as a compact home affordance.

import * as React from 'react';

export interface WordmarkProps {
  mini?: boolean;
  className?: string;
}

export function Wordmark({ mini = false, className }: WordmarkProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`} aria-hidden="true">
      <span
        className={`flex items-center justify-center bg-cg-text font-mono font-semibold text-cg-surface ${
          mini ? 'h-[18px] w-[18px] rounded-[4px] text-[11px]' : 'h-[22px] w-[22px] rounded-[5px] text-[13px]'
        }`}
      >
        c
      </span>
      {!mini && (
        <span className="text-[14px] font-semibold tracking-tight text-cg-text">
          Calcgrinder
        </span>
      )}
    </span>
  );
}
