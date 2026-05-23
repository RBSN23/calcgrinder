'use client';

// PROJ-8 — Mobile Grid drawer toggle.
//
// Sits in the mobile footer nav. Tapping the toggle opens a shadcn `Sheet`
// at a fixed ~50%-of-viewport height. The drawer body shows an empty-state
// placeholder in PROJ-8 — PROJ-9 will replace it with the cell-row list +
// focused-expand.

import * as React from 'react';

import { EmptyOrErrorState } from '@/components/shell';
import { Icons } from '@/components/shell/icons';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useEditor } from '@/lib/editor/EditorProvider';

export function GridDrawerToggle() {
  const { state, dispatch } = useEditor();
  return (
    <>
      <button
        type="button"
        aria-label="Toggle Grid drawer"
        aria-expanded={state.gridDrawerOpen}
        onClick={() =>
          dispatch({ type: 'SET_DRAWER_OPEN', open: !state.gridDrawerOpen })
        }
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cg-border bg-cg-surface px-3 text-[12.5px] font-medium text-cg-text"
      >
        <Icons.LayoutGrid size={14} />
        <span>Grid</span>
      </button>
      <Sheet
        open={state.gridDrawerOpen}
        onOpenChange={(open) => dispatch({ type: 'SET_DRAWER_OPEN', open })}
      >
        <SheetContent
          side="bottom"
          className="h-[50vh] border-cg-border bg-cg-surface p-4"
        >
          <SheetTitle className="text-base font-semibold text-cg-text">
            Grid
          </SheetTitle>
          <div className="mt-4">
            <EmptyOrErrorState
              variant="empty"
              title="No cells yet"
              body="Add cells in the Builder."
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
