'use server';

import { redirect } from 'next/navigation';

import { type FormState } from '@/lib/auth/form-state';
import { createClient } from '@/lib/supabase/server';

import { resetPasswordSchema } from './schema';

export async function resetPasswordAction(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = {
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  };

  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    const matchIssue = parsed.error.issues.find(
      (i) => i.message === 'Passwords do not match.',
    );
    if (matchIssue) {
      return {
        ok: false,
        error: 'Passwords do not match.',
        fieldErrors: {
          password: ' ',
          confirmPassword: 'Passwords do not match.',
        },
      };
    }
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: error.message ?? 'Could not update password.' };
  }

  redirect('/auth/reset-success');
}
