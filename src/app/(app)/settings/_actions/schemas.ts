import { z } from 'zod';

import { getThemeIds } from '@/lib/themes';

const CONTROL_CHARS = /[\x00-\x1F\x7F]/;
const LINEBREAKS = /[\r\n]/;

/**
 * Name field: trims whitespace, rejects control characters (including
 * line breaks), enforces 80-char ceiling. Empty value is allowed (the
 * profile.name column accepts NULL).
 */
export const updateNameSchema = z.object({
  name: z
    .string({ message: 'Required.' })
    .transform((v) => v.trim())
    .superRefine((value, ctx) => {
      if (LINEBREAKS.test(value) || CONTROL_CHARS.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Name can't contain line breaks or control characters.",
        });
        return;
      }
      if (value.length > 80) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Name must be 80 characters or fewer.',
        });
      }
    }),
});

export type UpdateNameInput = z.infer<typeof updateNameSchema>;

export const updateEmailSchema = z.object({
  email: z
    .string({ message: 'Required.' })
    .trim()
    .min(1, 'Required.')
    .email('Enter a valid email address.'),
});

export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string({ message: 'Required.' }).min(1, 'Required.'),
    newPassword: z.string({ message: 'Required.' }).min(1, 'Required.'),
    confirmPassword: z.string({ message: 'Required.' }).min(1, 'Required.'),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: "New passwords don't match.",
      });
    }
  });

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

export const updateDefaultThemeSchema = z.object({
  themeId: z
    .string({ message: 'Required.' })
    .refine((id) => getThemeIds().includes(id as ReturnType<typeof getThemeIds>[number]), {
      message: 'Unknown theme id.',
    }),
});

export type UpdateDefaultThemeInput = z.infer<typeof updateDefaultThemeSchema>;
