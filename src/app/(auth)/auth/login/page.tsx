import { LoginForm } from './login-form';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = {
  title: 'Sign in · Calcgrinder',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const rawNext = params.next;
  const next = typeof rawNext === 'string' ? rawNext : '/dashboard';
  const safeNext =
    next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  // /auth/confirm redirects expired or already-consumed Supabase-auth-
  // callback links to /auth/login?error=link_invalid. Surface that as an
  // initial banner so the user understands why they were sent back.
  const rawError = params.error;
  const initialError =
    typeof rawError === 'string' && rawError === 'link_invalid'
      ? 'This link is no longer valid.'
      : null;

  return <LoginForm nextPath={safeNext} initialError={initialError} />;
}
