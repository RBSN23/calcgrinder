/**
 * Idempotent sysadmin bootstrap and promotion tool.
 *
 *   npm run seed:sysadmin                            # bootstrap
 *   npm run seed:sysadmin -- --promote <email>       # promote existing user
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY from env. Bootstrap
 * additionally reads SYSADMIN_EMAIL + SYSADMIN_INITIAL_PASSWORD.
 *
 * Behaviour matrix:
 *   - bootstrap, user doesn't exist        -> create + elevate
 *   - bootstrap, user is already sysadmin  -> no-op
 *   - bootstrap, user exists w/ other role -> elevate; password env ignored
 *   - --promote, target doesn't exist      -> fail with sign-up-first message
 *   - --promote, target is already sysadmin -> no-op
 *   - --promote, target exists w/ other role -> elevate
 *
 * See features/PROJ-1-supabase-infrastructure-setup.md for the full
 * decision matrix.
 */

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Argv parsing
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const promoteFlagIndex = argv.indexOf('--promote');
const isPromoteMode = promoteFlagIndex !== -1;
const promoteArg = isPromoteMode ? argv[promoteFlagIndex + 1] : undefined;

// ---------------------------------------------------------------------------
// Zod schemas — fail-fast env / arg validation before any DB work
// ---------------------------------------------------------------------------
const baseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ error: 'NEXT_PUBLIC_SUPABASE_URL is required' })
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  SUPABASE_SECRET_KEY: z
    .string({ error: 'SUPABASE_SECRET_KEY is required' })
    .min(1, 'SUPABASE_SECRET_KEY must not be empty'),
});

const bootstrapEnvSchema = baseEnvSchema.extend({
  SYSADMIN_EMAIL: z
    .string({ error: 'SYSADMIN_EMAIL is required' })
    .email('SYSADMIN_EMAIL must be a valid email'),
  // Password presence is enforced later — only required if the user
  // doesn't already exist. See case 7 in the spec's behaviour matrix.
  SYSADMIN_INITIAL_PASSWORD: z.string().optional(),
});

const promoteEmailSchema = z
  .string({ error: '--promote requires an email argument' })
  .email('--promote requires a valid email address');

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function reportZodErrors(error: z.ZodError): never {
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    console.error(`error: ${path}${issue.message}`);
  }
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Resolved config
// ---------------------------------------------------------------------------
let supabaseUrl: string;
let secretKey: string;
let targetEmail: string;
let initialPassword: string | undefined;

if (isPromoteMode) {
  const emailParse = promoteEmailSchema.safeParse(promoteArg);
  if (!emailParse.success) reportZodErrors(emailParse.error);

  const envParse = baseEnvSchema.safeParse(process.env);
  if (!envParse.success) reportZodErrors(envParse.error);

  supabaseUrl = envParse.data.NEXT_PUBLIC_SUPABASE_URL;
  secretKey = envParse.data.SUPABASE_SECRET_KEY;
  targetEmail = emailParse.data;
} else {
  const envParse = bootstrapEnvSchema.safeParse(process.env);
  if (!envParse.success) reportZodErrors(envParse.error);

  supabaseUrl = envParse.data.NEXT_PUBLIC_SUPABASE_URL;
  secretKey = envParse.data.SUPABASE_SECRET_KEY;
  targetEmail = envParse.data.SYSADMIN_EMAIL;
  initialPassword = envParse.data.SYSADMIN_INITIAL_PASSWORD;
}

// ---------------------------------------------------------------------------
// Supabase admin client
// ---------------------------------------------------------------------------
const supabase: SupabaseClient = createSupabaseClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type ProfileRow = {
  id: string;
  email: string;
  role: 'registered' | 'sysadmin';
  status: 'pending' | 'approved' | 'declined';
};

async function findProfileByEmail(email: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, status')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileRow | null) ?? null;
}

async function createSysadminAuthUser(email: string, password: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  if (!data.user) throw new Error('auth.admin.createUser returned no user');
  return data.user.id;
}

async function elevateToSysadmin(id: string): Promise<void> {
  // UPSERT-shaped UPDATE: writes only role and status, leaves everything
  // else (name, audit timestamps, ...) untouched. Race-resistant against
  // the handle_new_user trigger that fires alongside auth-user creation.
  const { error } = await supabase
    .from('profiles')
    .update({ role: 'sysadmin', status: 'approved' })
    .eq('id', id);
  if (error) throw error;
}

function describeTransitions(from: ProfileRow): string[] {
  const transitions: string[] = [];
  if (from.role !== 'sysadmin') transitions.push(`role: ${from.role} -> sysadmin`);
  if (from.status !== 'approved') transitions.push(`status: ${from.status} -> approved`);
  return transitions;
}

// ---------------------------------------------------------------------------
// Bootstrap flow
// ---------------------------------------------------------------------------
async function bootstrap(email: string, password: string | undefined): Promise<void> {
  const profile = await findProfileByEmail(email);

  if (!profile) {
    if (!password || password.trim() === '') {
      fail(
        'SYSADMIN_INITIAL_PASSWORD is required to create the sysadmin account (no user with that email exists yet)',
      );
    }
    const id = await createSysadminAuthUser(email, password);
    await elevateToSysadmin(id);
    console.log(`sysadmin ${email} created and ready`);
    return;
  }

  if (profile.role === 'sysadmin' && profile.status === 'approved') {
    console.log(`sysadmin ${email} already provisioned, no changes`);
    if (password) {
      console.log(
        'note: SYSADMIN_INITIAL_PASSWORD was not applied because the user already exists',
      );
    }
    return;
  }

  const transitions = describeTransitions(profile);
  await elevateToSysadmin(profile.id);
  console.log(`promoted existing user ${email} (${transitions.join(', ')})`);
  if (password) {
    console.log(
      'note: SYSADMIN_INITIAL_PASSWORD was not applied because the user already exists',
    );
  }
}

// ---------------------------------------------------------------------------
// Promote flow
// ---------------------------------------------------------------------------
async function promote(email: string): Promise<void> {
  const profile = await findProfileByEmail(email);

  if (!profile) {
    fail(
      `no user with email ${email} exists. Have them sign up first, then re-run with --promote.`,
    );
  }

  if (profile.role === 'sysadmin' && profile.status === 'approved') {
    console.log(`${email} is already a sysadmin, no changes`);
    return;
  }

  const transitions = describeTransitions(profile);
  await elevateToSysadmin(profile.id);
  console.log(`promoted ${email} to sysadmin (${transitions.join(', ')})`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  try {
    if (isPromoteMode) {
      await promote(targetEmail);
    } else {
      await bootstrap(targetEmail, initialPassword);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`seed:sysadmin failed: ${msg}`);
    process.exit(1);
  }
}

void main();
