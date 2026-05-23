// PROJ-11 — Visitor 404 (token not found / expired / regenerated).
//
// Returned by `notFound()` from page.tsx when the RPC matches no
// calculator row. The copy intentionally does not leak whether the
// token ever existed.

import { EmptyOrErrorState } from '@/components/shell';
import { VisitorFooter, VisitorHeader } from '@/components/visitor';

export default function NotFound() {
  return (
    <>
      <VisitorHeader token={null} approvedUser={null} />
      <main className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyOrErrorState
            variant="error"
            title="Calculator not found"
            body="This calculator doesn't exist or the link is invalid."
          />
        </div>
      </main>
      <VisitorFooter />
    </>
  );
}
