import nodemailer, { type Transporter } from 'nodemailer';
import { z } from 'zod';

/**
 * INTERNAL — do NOT import directly from production code paths. Use
 * `@/lib/email/send` instead, which adds the `server-only` build-time
 * fence against client-bundle imports.
 *
 * This module exists separately so that Node-context callers (the
 * smoke CLI under `scripts/`, the Vitest test runner) can exercise
 * the same SMTP logic. `server-only` is unresolvable in those
 * contexts (it lives only in `next/dist/compiled/`), so the marker
 * has to sit one level above the implementation.
 */

const envSchema = z.object({
  CYON_SMTP_HOST: z
    .string({ error: 'CYON_SMTP_HOST is required' })
    .min(1, 'CYON_SMTP_HOST must not be empty'),
  CYON_SMTP_PORT: z
    .string({ error: 'CYON_SMTP_PORT is required' })
    .regex(/^(465|587)$/, 'CYON_SMTP_PORT must be 465 (implicit TLS) or 587 (STARTTLS)'),
  CYON_SMTP_USER: z
    .string({ error: 'CYON_SMTP_USER is required' })
    .min(1, 'CYON_SMTP_USER must not be empty'),
  CYON_SMTP_PASS: z
    .string({ error: 'CYON_SMTP_PASS is required' })
    .min(1, 'CYON_SMTP_PASS must not be empty'),
  EMAIL_FROM: z
    .string({ error: 'EMAIL_FROM is required' })
    .refine(
      (v) =>
        /^([^<>]+ <[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+>|[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)$/.test(
          v.trim(),
        ),
      {
        message:
          'EMAIL_FROM must be "addr@domain.tld" or "Display Name <addr@domain.tld>"',
      },
    ),
});

const sendMailInputSchema = z.object({
  to: z.string().email('to must be a valid email address'),
  subject: z.string().min(1, 'subject must not be empty'),
  text: z.string().min(1, 'text must not be empty'),
});

export type SendMailInput = z.infer<typeof sendMailInputSchema>;

// Lazy singleton: built on first sendMail() call, reused thereafter.
// Module-level eager init would break test ergonomics by demanding
// SMTP env vars at import time. Same pattern as createAdminClient
// in src/lib/supabase/admin.ts.
let transporter: Transporter | null = null;

function buildTransporter(): Transporter {
  const env = envSchema.parse(process.env);
  const port = Number(env.CYON_SMTP_PORT);

  return nodemailer.createTransport({
    host: env.CYON_SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: env.CYON_SMTP_USER,
      pass: env.CYON_SMTP_PASS,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = buildTransporter();
  }
  return transporter;
}

function getFrom(): string {
  return envSchema.parse(process.env).EMAIL_FROM.trim();
}

/**
 * Send a plain-text email through Cyon SMTP. Returns nodemailer's
 * SentMessageInfo (includes messageId) on success; throws on failure.
 *
 * Reply-To header is deliberately NEVER set — privacy decision in the
 * PROJ-2 spec.
 */
export async function sendMail(input: SendMailInput) {
  const { to, subject, text } = sendMailInputSchema.parse(input);
  const from = getFrom();
  const t = getTransporter();

  return t.sendMail({
    from,
    to,
    subject,
    text,
  });
}

/**
 * Test-only hook: drop the cached transporter so the next sendMail()
 * call re-reads env vars.
 */
export function __resetTransporterForTests(): void {
  transporter = null;
}
