'use client';

// PROJ-12 — Scenario header block.
//
// Renders the saved scenario's title, optional description (preserved
// newlines), and "by <name> · saved <relative>" sub-line between the
// calculator hero and the first content section. Owner sees a Copy
// link icon on the right that triggers the lazy-mint flow.

import * as React from 'react';

import { Icons } from '@/components/shell/icons';
import {
  ScenarioApiError,
  shareScenario,
} from '@/lib/scenarios/client';

import { useScenario } from './scenario-context';
import { useVisitorInputStore } from './visitor-input-store';

export function ScenarioHeaderBlock() {
  const scenario = useScenario();
  const { isModified } = useVisitorInputStore();
  if (!scenario) return null;
  const showCopyLink = scenario.isOwner;
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-cg-border bg-cg-surface/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h2 className="m-0 truncate text-[15px] font-semibold text-cg-text">
            {scenario.title}
          </h2>
          {isModified ? (
            <span className="text-[12px] italic text-cg-text-muted">
              (modified)
            </span>
          ) : null}
        </div>
        {scenario.description ? (
          <p
            className="mt-1 whitespace-pre-wrap text-[12.5px] leading-snug text-cg-text-muted"
            style={isModified ? { opacity: 0.6 } : undefined}
          >
            {scenario.description}
          </p>
        ) : null}
        <p
          className="mt-1 text-[11.5px] text-cg-text-subtle"
          style={isModified ? { opacity: 0.6 } : undefined}
        >
          by {scenario.ownerName} · saved {formatRelative(scenario.updatedAt)}
        </p>
      </div>
      {showCopyLink ? <ScenarioCopyLinkButton scenarioId={scenario.id} /> : null}
    </div>
  );
}

interface ScenarioCopyLinkButtonProps {
  scenarioId: string;
}

function ScenarioCopyLinkButton({ scenarioId }: ScenarioCopyLinkButtonProps) {
  const scenario = useScenario();
  const [busy, setBusy] = React.useState(false);
  async function handleClick() {
    if (busy || !scenario) return;
    setBusy(true);
    try {
      const { url, share_token } = await shareScenario(scenarioId);
      scenario.setShareToken(share_token);
      await copyToClipboard(url);
    } catch (err) {
      const { toast } = await import('sonner');
      if (err instanceof ScenarioApiError && err.status === 429) {
        toast.error('Slow down — try again in a minute.');
      } else {
        toast.error("Couldn't generate share link — please try again.");
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      aria-label="Copy share link"
      disabled={busy}
      onClick={handleClick}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cg-accent disabled:opacity-50"
    >
      <Icons.Share size={14} />
    </button>
  );
}

async function copyToClipboard(text: string): Promise<void> {
  const { toast } = await import('sonner');
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast.success('Link copied to clipboard');
      return;
    }
  } catch {
    // fall through
  }
  toast.message("Couldn't copy — long-press the URL", {
    description: text,
  });
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const diffMs = Math.max(0, now - then);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day} days ago`;
  if (day < 14) return 'last week';
  if (day < 30) return `${Math.floor(day / 7)} weeks ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} month${month === 1 ? '' : 's'} ago`;
  return new Date(then).toISOString().slice(0, 10);
}
