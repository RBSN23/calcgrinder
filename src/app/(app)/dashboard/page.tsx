import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';

export const metadata = {
  title: 'Dashboard · Calcgrinder',
};

export default async function DashboardPage() {
  const current = await getCurrentProfile();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome{current?.profile.name ? `, ${current.profile.name}` : ''}.
        The real dashboard ships with PROJ-5.
      </p>
    </main>
  );
}
