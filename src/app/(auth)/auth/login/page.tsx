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
  return <LoginForm nextPath={safeNext} />;
}
