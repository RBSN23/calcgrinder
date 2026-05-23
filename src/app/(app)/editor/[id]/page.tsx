import { notFound, redirect } from 'next/navigation';

import { EditorBody } from '@/components/editor';
import { EditorProvider } from '@/lib/editor/EditorProvider';
import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';
import { getEditorBundle } from '@/lib/calculators/server';

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

  // PROJ-9 — fetch calculator + sections + cells in one round-trip, with
  // the zero-section backfill applied transparently for pre-PROJ-9 rows.
  // The 404 opacity rule (not yours / not found / soft-deleted → 404)
  // is enforced inside getEditorBundle().
  const bundle = await getEditorBundle(id);
  if (!bundle) notFound();

  return (
    <EditorProvider
      initialRow={bundle.calculator}
      initialSections={bundle.sections}
      initialCells={bundle.cells}
    >
      <EditorBody />
    </EditorProvider>
  );
}
