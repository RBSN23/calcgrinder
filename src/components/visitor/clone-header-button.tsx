'use client';

// PROJ-18 / PROJ-25 — Clone icon button in `VisitorHeader`.
//
// PROJ-25: navigates immediately to `/editor/new?clone=...&token=...`
// (skeleton editor) instead of waiting for the clone API response.

import Link from 'next/link';

import { Icons } from '@/components/shell/icons';

import { useOptionalCloneController } from './clone-controller';

export function CloneHeaderButton() {
  const controller = useOptionalCloneController();

  if (!controller) return null;
  if (!controller.approvedUser) return null;

  const { calculator } = controller;
  const href = `/editor/new?clone=${encodeURIComponent(calculator.id)}&token=${encodeURIComponent(calculator.public_token)}`;

  return (
    <Link
      href={href}
      aria-label="Clone this calculator into your account"
      title="Clone this calculator into your account"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2 hover:text-cg-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cg-accent"
    >
      <Icons.Copy size={16} />
    </Link>
  );
}
