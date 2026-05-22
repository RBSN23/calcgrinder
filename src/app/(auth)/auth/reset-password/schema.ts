import { z } from 'zod';

export const resetPasswordSchema = z
  .object({
    password: z
      .string({ message: 'New password is required' })
      .min(1, 'New password is required'),
    confirmPassword: z
      .string({ message: 'Please confirm your password' })
      .min(1, 'Please confirm your password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
