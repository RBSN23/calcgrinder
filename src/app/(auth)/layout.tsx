import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth';
import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';

export default async function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentProfile();
  if (current && current.profile.status === 'approved') {
    redirect('/dashboard');
  }
  return <AuthShell>{children}</AuthShell>;
}
