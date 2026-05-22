export const metadata = {
  title: 'Editor · Calcgrinder',
};

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Editor</h1>
      <p className="text-muted-foreground">
        Editing calculator <span className="font-mono">{id}</span>. The
        Grid + Builder split ships with PROJ-8.
      </p>
    </main>
  );
}
