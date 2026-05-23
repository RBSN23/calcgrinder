// PROJ-4 — Catch-all inside the (app) route group.
// Next.js's per-group `not-found.tsx` only fires for `notFound()` calls
// within the group. Unmatched URLs would otherwise fall through to the
// default Next.js 404 (no chrome, no Dashboard link). This catch-all
// forwards every unmatched (app) URL into `(app)/not-found.tsx`, which
// renders the full AppShell + EmptyOrErrorState.
//
// Because Next.js matches static segments before catch-alls, this does
// not shadow `/dashboard`, `/settings`, or `/editor/[id]`.
import { notFound } from 'next/navigation';

export default function AppCatchAll() {
  notFound();
}
