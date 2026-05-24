'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';
import { createAdminClient } from '@/lib/supabase/admin';

import { updateDefaultThemeSchema } from './schemas';
import type { ActionResult } from './types';

export async function updateDefaultCalculatorThemeAction(
  themeId: string,
): Promise<ActionResult> {
  const current = await getCurrentProfile();
  if (!current || current.profile.status !== 'approved') {
    return { ok: false, error: "Couldn't save — try again." };
  }

  const parsed = updateDefaultThemeSchema.safeParse({ themeId });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Unknown theme id.',
    };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ default_calculator_theme: parsed.data.themeId })
    .eq('id', current.user.id);

  if (error) {
    console.error('updateDefaultCalculatorThemeAction failed', error);
    return { ok: false, error: "Couldn't save — try again." };
  }

  revalidatePath('/settings');
  return { ok: true, message: 'Saved' };
}
