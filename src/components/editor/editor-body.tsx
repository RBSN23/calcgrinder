'use client';

// PROJ-8 — Editor body (desktop + mobile variants in one tree).
//
// Mounts inside the EditorProvider. Registers slot content into the
// AppShell's top-bar slot registry, and renders the two-panel split on
// desktop / builder-first stack on mobile.

import * as React from 'react';

import { useRegisterTopBarSlots } from '@/components/shell/top-bar-slots';
import { useEditor } from '@/lib/editor/EditorProvider';

import { BuilderCanvas } from './builder-canvas';
import { BuilderToolbar } from './builder-toolbar';
import { GridPanel } from './grid-panel';
import { MobileFooterNav } from './mobile-footer-nav';
import { ResizeHandle } from './resize-handle';
import { ThemePickerDesktop, ThemePickerMobile } from './theme-picker';
import { ViewportPicker } from './viewport-picker';

export function EditorBody() {
  const { state, renameCalculator } = useEditor();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = React.useState(800);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerHeight(entry.contentRect.height);
    });
    observer.observe(el);
    setContainerHeight(el.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, []);

  // Register top-bar slots: theme picker on desktop, breadcrumb-rename
  // commit, plus the mobile centre (truncated title).
  const slots = React.useMemo(
    () => ({
      rightExtras: <ThemePickerDesktop />,
      editorTitle: state.calculator.title,
      onEditorTitleCommit: renameCalculator,
      mobileCenter: (
        <span className="block max-w-[60vw] truncate">
          {state.calculator.title || 'Untitled calculator'}
        </span>
      ),
    }),
    [state.calculator.title, renameCalculator],
  );
  useRegisterTopBarSlots(slots);

  return (
    <>
      {/* Desktop two-panel layout */}
      <div
        ref={containerRef}
        className="hidden flex-1 flex-col md:flex"
        style={{ height: 'calc(100vh - 48px)' }}
      >
        <GridPanel />
        <ResizeHandle containerHeight={containerHeight} />
        <BuilderToolbar />
        <BuilderCanvas />
      </div>

      {/* Mobile builder-first layout */}
      <div className="flex flex-1 flex-col md:hidden">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-cg-border bg-cg-surface px-3">
          <ThemePickerMobile />
          <span className="flex-1" />
          <ViewportPicker compact />
        </div>
        <BuilderCanvas />
        <MobileFooterNav />
      </div>
    </>
  );
}
