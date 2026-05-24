'use client';

// PROJ-12 — Save Scenario sheet.
//
// Anonymous flow → writes to localStorage via @/lib/scenarios.
// Registered flow → POSTs / PUTs to /api/scenarios (lazy lookup of
// existing rows on open). On a `?s=` URL whose scenario the user
// owns, that row is pre-selected as the overwrite target.
//
// Tapping an existing-list row both LOADS the scenario's values into
// the calculator AND selects it for overwrite. Typing a different
// title de-selects (an implicit "create new").

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/shell/icons';
import {
  createScenario,
  listLocalScenarios,
  listScenariosForCalculator,
  LocalScenarioQuotaError,
  MAX_SCENARIO_DESCRIPTION_LENGTH,
  MAX_SCENARIO_TITLE_LENGTH,
  saveLocalScenario,
  ScenarioApiError,
  shareScenario,
  updateScenario,
  validateScenarioTitle,
} from '@/lib/scenarios';
import type {
  LocalScenario,
  ScenarioRow,
  ScenarioValues,
} from '@/lib/scenarios';
import Link from 'next/link';

import { ResponsiveSheet } from './responsive-sheet';
import { useSaveScenarioController } from './save-scenario-controller';
import { useScenario } from './scenario-context';
import { useVisitorInputStore } from './visitor-input-store';

type ExistingRow =
  | { kind: 'server'; row: ScenarioRow }
  | { kind: 'local'; row: LocalScenario };

export function SaveScenarioSheet() {
  const { open, setOpen, calculator, approvedUser } =
    useSaveScenarioController();
  const { inputs, loadedBaseline, setInput, reset } = useVisitorInputStore();
  const scenario = useScenario();

  const isAuthenticated = approvedUser !== null;

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [existing, setExisting] = React.useState<ExistingRow[]>([]);
  const [listLoading, setListLoading] = React.useState(false);
  const [listError, setListError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const titleRef = React.useRef<HTMLInputElement | null>(null);

  // Reset / hydrate sheet state on open.
  React.useEffect(() => {
    if (!open) return;
    setInlineError(null);
    setSaving(false);
    if (scenario) {
      // Pre-select the current scenario when one is loaded.
      setSelectedId(scenario.id);
      setTitle(scenario.title);
      setDescription(scenario.description);
    } else {
      setSelectedId(null);
      setTitle('');
      setDescription('');
    }
    // Fetch existing list.
    let cancelled = false;
    setListLoading(true);
    setListError(false);
    (async () => {
      try {
        if (isAuthenticated) {
          const rows = await listScenariosForCalculator(calculator.id);
          if (cancelled) return;
          setExisting(rows.map((row) => ({ kind: 'server' as const, row })));
        } else {
          const rows = listLocalScenarios(calculator.public_token);
          if (cancelled) return;
          setExisting(rows.map((row) => ({ kind: 'local' as const, row })));
        }
      } catch {
        if (cancelled) return;
        setListError(true);
        setExisting([]);
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isAuthenticated, calculator.id, calculator.public_token, scenario]);

  // Focus title on open.
  React.useEffect(() => {
    if (open && titleRef.current) {
      const id = window.setTimeout(() => titleRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  // Typing a different title than the selected row's title de-selects.
  React.useEffect(() => {
    if (selectedId == null) return;
    const sel = existing.find(
      (e) => (e.kind === 'server' ? e.row.id : e.row.id) === selectedId,
    );
    if (!sel) return;
    const selTitle = sel.kind === 'server' ? sel.row.title : sel.row.title;
    if (title.trim() !== selTitle.trim()) {
      setSelectedId(null);
    }
  }, [title, selectedId, existing]);

  const isTitleEmpty = title.trim().length === 0;
  const isTitleTooLong = title.length > MAX_SCENARIO_TITLE_LENGTH;
  const isDescTooLong = description.length > MAX_SCENARIO_DESCRIPTION_LENGTH;
  const saveDisabled =
    saving || isTitleEmpty || isTitleTooLong || isDescTooLong;
  const buttonLabel = selectedId != null ? 'Overwrite' : 'Save';

  function selectRow(row: ExistingRow) {
    // 1. Load values into calculator.
    const values = row.kind === 'server' ? row.row.values : row.row.values;
    // Clear current overrides then re-apply selected scenario's values.
    // We reset first so any unsaved fields revert to the loaded baseline,
    // then set each known value from the scenario.
    reset();
    for (const [name, value] of Object.entries(values)) {
      setInput(name, value);
    }
    // 2. Pre-fill title / description.
    setTitle(row.kind === 'server' ? row.row.title : row.row.title);
    setDescription(
      row.kind === 'server' ? row.row.description : row.row.description,
    );
    // 3. Mark selected for overwrite.
    setSelectedId(row.kind === 'server' ? row.row.id : row.row.id);
  }

  async function handleSave() {
    setInlineError(null);
    const v = validateScenarioTitle(title);
    if (!v.ok) {
      setInlineError(
        v.reason === 'title_required'
          ? 'Title is required.'
          : `Titles can be at most ${MAX_SCENARIO_TITLE_LENGTH} characters.`,
      );
      return;
    }
    if (isDescTooLong) {
      setInlineError(
        `Description can be at most ${MAX_SCENARIO_DESCRIPTION_LENGTH} characters.`,
      );
      return;
    }
    const values = snapshotInputs(inputs, loadedBaseline);
    setSaving(true);
    const { toast } = await import('sonner');
    try {
      if (isAuthenticated) {
        let row: ScenarioRow;
        if (selectedId) {
          row = await updateScenario(selectedId, {
            title: v.value,
            description,
            values,
          });
        } else {
          row = await createScenario({
            calculator_id: calculator.id,
            title: v.value,
            description,
            values,
          });
        }
        setOpen(false);
        const overwritten = selectedId != null;
        toast.success(overwritten ? 'Scenario overwritten' : 'Scenario saved', {
          action: {
            label: 'Copy link',
            onClick: async () => {
              try {
                const { url } = await shareScenario(row.id);
                await copyToClipboard(url, toast);
              } catch {
                toast.error("Couldn't copy link — please try again.");
              }
            },
          },
        });
      } else {
        try {
          const { overwritten } = saveLocalScenario({
            calculatorPublicToken: calculator.public_token,
            overwriteId: selectedId ?? undefined,
            title: v.value,
            description,
            values,
          });
          setOpen(false);
          toast.success(
            overwritten ? 'Scenario overwritten' : 'Scenario saved to this browser',
          );
        } catch (err) {
          if (err instanceof LocalScenarioQuotaError) {
            setInlineError(
              'Browser storage full — sign up for an account to save more scenarios.',
            );
            return;
          }
          throw err;
        }
      }
    } catch (err) {
      if (err instanceof ScenarioApiError) {
        if (err.status === 429) {
          setInlineError('Slow down — try again in a minute.');
        } else if (err.status === 401) {
          setInlineError('Your session expired. Please log in again.');
        } else if (err.status >= 500) {
          setInlineError('Something went wrong — please try again.');
        } else {
          setInlineError("Couldn't save — please try again.");
        }
      } else {
        setInlineError("Couldn't save — please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={setOpen}
      title="Save scenario"
      description={
        isAuthenticated
          ? 'Save a copy of these inputs. You can share it with a link.'
          : 'Save these inputs to this browser, or sign up to share them.'
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="scenario-title"
            className="text-[12.5px] font-medium text-cg-text"
          >
            Title
          </Label>
          <Input
            id="scenario-title"
            ref={titleRef}
            value={title}
            maxLength={MAX_SCENARIO_TITLE_LENGTH + 50}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q3 forecast — best case"
            aria-invalid={
              isTitleEmpty || isTitleTooLong ? 'true' : 'false'
            }
            className="h-9 text-[13px]"
          />
          <div className="flex items-center justify-between text-[11.5px]">
            <span
              className={
                isTitleEmpty
                  ? 'text-cg-text-muted'
                  : isTitleTooLong
                    ? 'text-red-600'
                    : 'text-transparent'
              }
              aria-live="polite"
            >
              {isTitleEmpty
                ? 'Title is required'
                : isTitleTooLong
                  ? `Max ${MAX_SCENARIO_TITLE_LENGTH} characters`
                  : ''}
            </span>
            <span
              className={
                isTitleTooLong ? 'text-red-600' : 'text-cg-text-subtle'
              }
            >
              {title.length}/{MAX_SCENARIO_TITLE_LENGTH}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="scenario-description"
            className="text-[12.5px] font-medium text-cg-text"
          >
            Description{' '}
            <span className="text-cg-text-subtle">(optional)</span>
          </Label>
          <Textarea
            id="scenario-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What did you try? Why?"
            rows={3}
            className="resize-y text-[13px]"
            maxLength={MAX_SCENARIO_DESCRIPTION_LENGTH + 50}
          />
          <div className="flex items-center justify-end text-[11.5px]">
            <span
              className={
                isDescTooLong ? 'text-red-600' : 'text-cg-text-subtle'
              }
            >
              {description.length}/{MAX_SCENARIO_DESCRIPTION_LENGTH}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[12.5px] font-medium text-cg-text">
            {isAuthenticated
              ? 'Your saved scenarios for this calculator'
              : 'Saved on this browser'}
          </Label>
          <div className="max-h-[200px] overflow-y-auto rounded-md border border-cg-border bg-cg-surface-2/40">
            {listLoading ? (
              <p className="px-3 py-3 text-[12.5px] text-cg-text-muted">
                Loading…
              </p>
            ) : listError ? (
              <p className="px-3 py-3 text-[12.5px] text-cg-text-muted">
                Couldn&apos;t load your scenarios — saves will still work.
              </p>
            ) : existing.length === 0 ? (
              <p className="px-3 py-3 text-[12.5px] text-cg-text-muted">
                No saved scenarios yet
              </p>
            ) : (
              <ul className="divide-y divide-cg-border">
                {existing.map((entry) => (
                  <ExistingRowItem
                    key={entry.kind === 'server' ? entry.row.id : entry.row.id}
                    entry={entry}
                    isAuthenticated={isAuthenticated}
                    selected={
                      selectedId ===
                      (entry.kind === 'server'
                        ? entry.row.id
                        : entry.row.id)
                    }
                    isCurrent={
                      scenario != null &&
                      entry.kind === 'server' &&
                      entry.row.id === scenario.id
                    }
                    onSelect={() => selectRow(entry)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {inlineError ? (
          <div className="rounded-md border border-red-500/40 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
            {inlineError}
            {inlineError.includes('Browser storage full') ? (
              <>
                {' '}
                <Link
                  href="/auth/signup"
                  className="font-medium underline"
                  onClick={() => setOpen(false)}
                >
                  Sign up
                </Link>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saveDisabled}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : buttonLabel}
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}

interface ExistingRowItemProps {
  entry: ExistingRow;
  isAuthenticated: boolean;
  selected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}

function ExistingRowItem({
  entry,
  isAuthenticated,
  selected,
  isCurrent,
  onSelect,
}: ExistingRowItemProps) {
  const title = entry.kind === 'server' ? entry.row.title : entry.row.title;
  const savedAt =
    entry.kind === 'server' ? entry.row.updated_at : entry.row.saved_at;
  const id = entry.kind === 'server' ? entry.row.id : entry.row.id;
  return (
    <li
      className={
        'flex items-center justify-between gap-2 px-3 py-2 text-[12.5px] transition-colors hover:bg-cg-surface-2' +
        (selected ? ' bg-cg-surface-2' : '')
      }
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex-1 min-w-0 text-left outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-cg-accent"
      >
        <span className="block truncate font-medium text-cg-text">
          {title}
          {isCurrent ? (
            <span className="ml-1 text-cg-text-subtle">(current)</span>
          ) : null}
        </span>
        <span className="block text-[11px] text-cg-text-subtle">
          Saved {formatShortRelative(savedAt)}
        </span>
      </button>
      {isAuthenticated && entry.kind === 'server' ? (
        <CopyLinkRowButton scenarioId={id} />
      ) : null}
    </li>
  );
}

function CopyLinkRowButton({ scenarioId }: { scenarioId: string }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      aria-label="Copy share link"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        const { toast } = await import('sonner');
        try {
          const { url } = await shareScenario(scenarioId);
          await copyToClipboard(url, toast);
        } catch {
          toast.error("Couldn't copy link — please try again.");
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2 disabled:opacity-50"
    >
      <Icons.Share size={12} />
    </button>
  );
}

async function copyToClipboard(
  text: string,
  toast: { success: (msg: string) => void; message: (msg: string, opts?: { description?: string }) => void },
): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast.success('Link copied to clipboard');
      return;
    }
  } catch {
    // fall through
  }
  toast.message("Couldn't copy — long-press the URL", { description: text });
}

/**
 * Compose the saved-values snapshot. We merge the loaded baseline
 * (calculator defaults, or scenario values that were applied on
 * mount) with the visitor's current `inputs` overrides so the saved
 * scenario captures the complete state, not a sparse diff.
 */
function snapshotInputs(
  inputs: Record<string, unknown>,
  baseline: Record<string, unknown>,
): ScenarioValues {
  return { ...baseline, ...inputs };
}

function formatShortRelative(iso: string): string {
  const now = Date.now();
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const diffMs = Math.max(0, now - then);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.floor(day / 7)}w ago`;
  return new Date(then).toISOString().slice(0, 10);
}
