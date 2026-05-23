import { notFound, redirect } from 'next/navigation';

import { EditorBody } from '@/components/editor';
import { EditorProvider } from '@/lib/editor/EditorProvider';
import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';
import { getCalculatorForEditor } from '@/lib/calculators/server';

export const metadata = {
  title: 'Editor · Calcgrinder',
};

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const current = await getCurrentProfile();
  if (!current) redirect(`/auth/login?next=/editor/${encodeURIComponent(id)}`);

  // PROJ-8 — the row lookup collapses three AC scenarios (not yours,
  // doesn't exist, soft-deleted) into one branch. RLS scopes the row to
  // `auth.uid()` so non-owners get a null row even before the explicit
  // `soft_delete_at IS NULL` filter kicks in.
  const row = await getCalculatorForEditor(id);
  if (!row) notFound();

  return (
    <EditorProvider initialRow={row}>
      <EditorBody />
    </EditorProvider>
  );
}
