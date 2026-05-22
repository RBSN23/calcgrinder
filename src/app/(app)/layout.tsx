import { redirect } from 'next/navigation';

import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentProfile();
  if (!current) redirect('/auth/login');
  if (current.profile.status !== 'approved') {
    redirect('/auth/waiting-for-approval');
  }
  // PROJ-4 will replace this stub with the real AppShell (top bar +
  // avatar popover). For now we just pass children through so the
  // protected surfaces are reachable for PROJ-3 QA.
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
