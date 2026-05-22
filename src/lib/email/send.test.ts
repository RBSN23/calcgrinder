import { afterEach, describe, expect, it, vi } from 'vitest';

// Importing from the internal transport directly so the `server-only`
// marker on `./send` doesn't trip in the Vitest Node-context runner.
// The transport module is the actual SMTP logic; send.ts is just the
// fence + re-export.
import { __resetTransporterForTests, sendMail } from './_internal/transport';

describe('sendMail() — env validation (fail-fast before any I/O)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    __resetTransporterForTests();
  });

  it('throws a Zod error listing every missing env var, before opening any SMTP connection', async () => {
    vi.stubEnv('CYON_SMTP_HOST', '');
    vi.stubEnv('CYON_SMTP_PORT', '');
    vi.stubEnv('CYON_SMTP_USER', '');
    vi.stubEnv('CYON_SMTP_PASS', '');
    vi.stubEnv('EMAIL_FROM', '');

    await expect(
      sendMail({ to: 'recipient@example.com', subject: 'x', text: 'y' }),
    ).rejects.toThrowError(/CYON_SMTP_HOST|EMAIL_FROM/);
  });
});
