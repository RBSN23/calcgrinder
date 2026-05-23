// PROJ-9 hotfix — Local renumber for optimistic drag-reorder.
//
// The server's PATCH on a cell or section renumbers siblings transactionally
// so display_order stays gap-free. The optimistic-update flow has to mirror
// that math locally — otherwise the dragged row gets the new order while
// its siblings keep their old orders, two rows collide on the same value,
// and the stable sort renders them in their original positions (the
// "drag snaps back" symptom).
//
// This helper computes the post-renumber display_order for every sibling
// when a single row moves from `oldOrder` to `newOrder` within a section
// or calculator. The match for `scope` is the same key the server uses
// for the unique constraint — `section_id` for cells, `calculator_id`
// for sections.

export interface ReorderableRow {
  id: string;
  display_order: number;
}

/**
 * Returns the rows whose display_order changes when `targetId` moves from
 * its current position to `newOrder` within `scopeRows`. Includes the
 * dragged row itself. Rows outside the affected window are NOT returned.
 *
 * Mirrors the PATCH /api/cells/:id and PATCH /api/sections/:id renumber
 * loops in src/app/api/cells/[id]/route.ts and
 * src/app/api/sections/[id]/route.ts.
 */
export function computeReorderUpdates<T extends ReorderableRow>(
  scopeRows: T[],
  targetId: string,
  newOrder: number,
): { id: string; display_order: number }[] {
  const target = scopeRows.find((r) => r.id === targetId);
  if (!target) return [];
  const oldOrder = target.display_order;
  // Clamp to the same bounds the server uses.
  const clamped = Math.max(0, Math.min(scopeRows.length - 1, newOrder));
  if (clamped === oldOrder) return [];

  const updates: { id: string; display_order: number }[] = [];
  if (clamped > oldOrder) {
    // Downstream: siblings in (oldOrder, clamped] shift down by 1.
    for (const row of scopeRows) {
      if (row.id === targetId) continue;
      if (row.display_order > oldOrder && row.display_order <= clamped) {
        updates.push({ id: row.id, display_order: row.display_order - 1 });
      }
    }
  } else {
    // Upstream: siblings in [clamped, oldOrder) shift up by 1.
    for (const row of scopeRows) {
      if (row.id === targetId) continue;
      if (row.display_order >= clamped && row.display_order < oldOrder) {
        updates.push({ id: row.id, display_order: row.display_order + 1 });
      }
    }
  }
  updates.push({ id: targetId, display_order: clamped });
  return updates;
}
