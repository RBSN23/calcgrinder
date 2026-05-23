import { redirect } from 'next/navigation';

import { AppShell } from '@/components/shell';
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

  const user = {
    name: current.profile.name,
    email: current.user.email,
    role: current.profile.role as 'registered' | 'sysadmin',
  };

  return <AppShell user={user}>{children}</AppShell>;
}
