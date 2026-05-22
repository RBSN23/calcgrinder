import { z } from 'zod';

/**
 * PROJ-3 signup form schema.
 *
 * `name` strips ASCII control characters and trims whitespace before
 * the value reaches `signupNotification()` — mitigates PROJ-2 finding
 * L1 (plain-text body injection via the `name` field).
 */

const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

export const signupSchema = z.object({
  name: z
    .string({ message: 'Name is required' })
    .transform((v) => v.replace(CONTROL_CHARS, '').trim())
    .pipe(
      z.string().min(1, 'Name is required').max(120, 'Name is too long'),
    ),
  email: z
    .string({ message: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  password: z
    .string({ message: 'Password is required' })
    .min(1, 'Password is required'),
});

export type SignupInput = z.infer<typeof signupSchema>;
