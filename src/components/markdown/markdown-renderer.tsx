'use client';

// PROJ-16 — Shared markdown renderer.
//
// Single source of truth for text-block rendering: imported by both the
// Builder's TextBlockEditorPane (live preview) and the visitor-view slot
// registration. By construction, what the maintainer sees in the preview
// is what the visitor sees on /c/<token>.
//
// Pipeline:
//   markdown source
//   → remark-parse (via react-markdown)
//   → remark-gfm                 (GFM extensions, soft-breaks, autolink)
//   → h1ToH2 plugin              (H1 source nodes promoted to H2)
//   → remark-rehype { allowDangerousHtml: false }  (raw HTML DROPPED here)
//   → rehype-sanitize             (default schema, no HTML pass-through)
//   → react-markdown renders
//
// Sanitisation is belt-and-braces: raw HTML is dropped at the mdast→hast
// bridge (no rehype-raw), and rehype-sanitize strips any unsafe attribute
// residue (inline events, javascript: / data: URLs). Markdown auto-escape
// turns literal `<script>` text into `&lt;script&gt;` in output.
//
// Memoisation: the parse + render result is memoised on body string and
// the visual settings that influence styling, so unchanged content skips
// re-parsing on each keystroke of an unrelated field.

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

import type { Theme } from '@/lib/themes';
import type {
  TextBlockTextColour,
  TextBlockTextSize,
} from '@/lib/text-blocks/types';
import { cn } from '@/lib/utils';

import { h1ToH2 } from './plugins/h1-to-h2';

interface MarkdownRendererProps {
  body: string;
  textSize?: TextBlockTextSize;
  textColour?: TextBlockTextColour;
  theme?: Theme;
  className?: string;
}

// Card-level Text-size base in px. Heading scale (h2 1.4× h3 1.2× h4 1.05×)
// is delivered as `em` multipliers on the h2/h3/h4 selectors below, so the
// composition (base × multiplier) happens natively in CSS.
const TEXT_SIZE_PX: Record<TextBlockTextSize, number> = {
  s: 12.5,
  m: 14,
  l: 16,
  xl: 18,
};

export function MarkdownRenderer({
  body,
  textSize = 'm',
  textColour = 'default',
  theme,
  className,
}: MarkdownRendererProps) {
  const rootStyle = React.useMemo<React.CSSProperties>(() => {
    const colour =
      textColour === 'accent_1'
        ? theme?.accent
        : textColour === 'accent_2'
          ? theme?.muted
          : theme?.text;
    return {
      fontSize: TEXT_SIZE_PX[textSize],
      color: colour,
      fontFamily: theme?.font,
      lineHeight: 1.5,
    };
  }, [textSize, textColour, theme]);

  const linkColour = theme?.accent;

  // Memoise the rendered tree so identical bodies skip the parse pass.
  // We key on body + textSize + textColour + theme identity; the theme
  // changes rarely so it's not the dominant axis.
  const rendered = React.useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, h1ToH2]}
        rehypePlugins={[rehypeSanitize]}
        skipHtml
        components={{
          a: ({ href, children, ...rest }) => (
            <a
              {...rest}
              href={typeof href === 'string' ? href : undefined}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: linkColour, textDecoration: 'underline' }}
            >
              {children}
            </a>
          ),
          img: ({ src, alt, ...rest }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              {...rest}
              src={typeof src === 'string' ? src : undefined}
              alt={alt ?? ''}
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    ),
    [body, linkColour],
  );

  return (
    <div className={cn('cg-markdown', className)} style={rootStyle}>
      {rendered}
    </div>
  );
}
