import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/supabase/types';

export type CurrentProfile = {
  user: { id: string; email: string };
  profile: Tables<'profiles'>;
};

/**
 * Returns the currently signed-in user's auth identity + profile row, or
 * `null` if the request is unauthenticated.
 *
 * Wrapped in React's request-scoped `cache()` so middleware + layout +
 * page all share a single Supabase round-trip. Status is NOT cached
 * beyond the request — approval state can change between requests.
 */
export const getCurrentProfile = cache(
  async (): Promise<CurrentProfile | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error || !profile) return null;

    return {
      user: { id: user.id, email: user.email ?? profile.email },
      profile,
    };
  },
);
