// PROJ-11 — Visitor route group layout.
//
// Hosts the visitor surface — no app chrome (no top bar, no breadcrumb,
// no avatar for the *app*). The visitor header + footer wrap the page
// body; the body itself decides whether to show the calculator, a
// 404, or a 410 (the route handler short-circuits 410 before this
// layout fires).

import * as React from 'react';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cg-bg text-cg-text">
      {children}
    </div>
  );
}
