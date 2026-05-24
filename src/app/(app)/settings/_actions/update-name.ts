'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';
import { createAdminClient } from '@/lib/supabase/admin';

import { updateNameSchema } from './schemas';
import type { ActionResult } from './types';

export async function updateNameAction(
  rawName: string,
): Promise<ActionResult> {
  const current = await getCurrentProfile();
  if (!current || current.profile.status !== 'approved') {
    return { ok: false, error: "Couldn't save — try again." };
  }

  const parsed = updateNameSchema.safeParse({ name: rawName });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid name.',
    };
  }

  const next = parsed.data.name;
  const admin = createAdminClient();

  const { error } = await admin
    .from('profiles')
    .update({ name: next })
    .eq('id', current.user.id);

  if (error) {
    console.error('updateNameAction failed', error);
    return { ok: false, error: "Couldn't save — try again." };
  }

  revalidatePath('/settings');
  return { ok: true, message: 'Saved' };
}
