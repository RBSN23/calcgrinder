'use client';

// PROJ-16 — Text-block editor pane (split-pane / stacked).
//
// Desktop (>= md): two-column split — plain-text <textarea> on the left,
// live-rendered preview on the right. Both panes scroll independently.
// Mobile (< md): vertically stacked — source above, preview below.
//
// The textarea is the canonical input. Local state updates synchronously
// so the preview re-renders on every keystroke; PATCH is debounced ~500ms
// idle with immediate flush on blur, configurator collapse, and (host)
// undo enrolment.

import * as React from 'react';

import { MarkdownRenderer } from '@/components/markdown/markdown-renderer';
import { useDebouncedCallback } from '@/lib/text-blocks/use-debounced-callback';
import { hasExternalImageSyntax } from '@/lib/text-blocks/image-hint';
import { MAX_TEXT_BLOCK_BODY_BYTES } from '@/lib/text-blocks/limits';
import { bodyByteLength } from '@/lib/text-blocks/validation';
import { TextBlockApiError } from '@/lib/text-blocks/client';
import type { TextBlockRow } from '@/lib/text-blocks/types';
import type { Theme } from '@/lib/themes';

interface TextBlockEditorPaneProps {
  textBlock: TextBlockRow;
  theme: Theme;
  onPatch: (body: { body: string }) => Promise<unknown>;
  /** Imperative collapse fired by the parent card. Used to flush the
   * pending debounced PATCH on collapse. */
  onCollapse: () => void;
}

const PATCH_DEBOUNCE_MS = 500;

export function TextBlockEditorPane({
  textBlock,
  onPatch,
  theme,
}: TextBlockEditorPaneProps) {
  // Local state for instant preview. Server-side body lives in
  // textBlock.body; on first mount we mirror it. Subsequent server updates
  // (undo / external) re-mirror via the effect below.
  const [body, setBody] = React.useState(textBlock.body);
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null);
  const lastServerBody = React.useRef(textBlock.body);

  // External update (e.g. undo, redo, server echo) → re-mirror into local
  // state when the server's body diverges from what we last saw.
  React.useEffect(() => {
    if (textBlock.body !== lastServerBody.current) {
      lastServerBody.current = textBlock.body;
      setBody(textBlock.body);
    }
  }, [textBlock.body]);

  const debouncedSave = useDebouncedCallback((nextBody: string) => {
    void onPatch({ body: nextBody })
      .then(() => {
        lastServerBody.current = nextBody;
        setErrorBanner(null);
      })
      .catch((e) => {
        if (e instanceof TextBlockApiError && e.code === 'body_too_large') {
          setErrorBanner('Text too long — keep your block under ~50 KB.');
        }
      });
  }, PATCH_DEBOUNCE_MS);

  const handleChange = (next: string) => {
    setBody(next);
    debouncedSave(next);
  };

  const handleBlur = () => {
    // Immediate flush on blur — never wait for the debounce when the
    // maintainer's intent (Tab out, click elsewhere) is clear.
    debouncedSave.flush();
  };

  // Flush on unmount so collapsing or navigating away never loses the
  // last few keystrokes.
  React.useEffect(() => {
    return () => debouncedSave.flush();
  }, [debouncedSave]);

  const showImageHint = hasExternalImageSyntax(body);
  const byteLength = bodyByteLength(body);
  const overCap = byteLength > MAX_TEXT_BLOCK_BODY_BYTES;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`text-block-source-${textBlock.id}`}
            className="text-[10.5px] font-semibold uppercase tracking-wide text-cg-text-muted"
          >
            Markdown source
          </label>
          <textarea
            id={`text-block-source-${textBlock.id}`}
            aria-label="Markdown source"
            value={body}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder="Write Markdown here…"
            spellCheck
            autoFocus={textBlock.body === ''}
            className="min-h-[160px] w-full resize-y rounded-md border border-cg-border bg-cg-surface p-2 font-mono text-[12.5px] leading-snug text-cg-text outline-none focus-visible:ring-2 focus-visible:ring-cg-accent/40"
          />
          {showImageHint ? (
            <p
              className="text-[11px] italic text-cg-text-muted"
              role="note"
            >
              Hosted externally — may break if the source moves.
            </p>
          ) : null}
          {overCap || errorBanner ? (
            <p
              className="text-[11px] font-medium text-red-600"
              role="alert"
            >
              {errorBanner ?? 'Text too long — keep your block under ~50 KB.'}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-cg-text-muted">
            Live preview
          </span>
          <div
            aria-label="Live preview"
            className="min-h-[160px] overflow-auto rounded-md border border-dashed border-cg-border bg-cg-surface/40 p-2"
          >
            {body.trim() === '' ? (
              <p className="text-[12px] italic text-cg-text-muted">
                Nothing to preview yet.
              </p>
            ) : (
              <MarkdownRenderer
                body={body}
                textSize={textBlock.text_size}
                textColour={textBlock.text_colour}
                theme={theme}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
