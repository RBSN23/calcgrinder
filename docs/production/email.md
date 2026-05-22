# Email setup (PROJ-2)

This guide walks the deployer from a fresh Cyon SMTP account
to a fully wired Calcgrinder instance — outbound mail
flowing through Cyon, Supabase Auth's native flows
configured for custom SMTP, and the three transactional
templates ready to send.

Sections must be followed in order. Each one assumes the
previous one is done.

---

## 1. DNS records (SPF, DKIM, DMARC)

This step is **mandatory**. Without SPF and DKIM, your
outbound mail will land in spam folders or be rejected
outright by major providers (Gmail, Outlook, iCloud).

In your DNS host's zone editor, add the following records
on the domain you'll send from (the part after `@` in
`EMAIL_FROM`). Replace `<your-domain>` accordingly.

### SPF

A `TXT` record on the apex of `<your-domain>` authorising
Cyon's mail servers to send on your behalf:

```
Name:  <your-domain>           (or @ depending on the host)
Type:  TXT
Value: v=spf1 include:spf.protection.cyon.net ~all
```

Confirm Cyon's exact SPF include with your hosting account
documentation — `spf.protection.cyon.net` is Cyon's
canonical hostname as of 2026-05-22, but Cyon documents the
authoritative value in their control panel under
**Mail → SMTP / Mailing**.

### DKIM

Cyon generates the DKIM key in their control panel under
**Mail → DKIM**. Enable DKIM, then copy the generated `TXT`
record verbatim into your DNS zone — typically:

```
Name:  default._domainkey.<your-domain>
Type:  TXT
Value: v=DKIM1; k=rsa; p=<long base64 public key>
```

The selector (`default`) and the exact value are emitted by
Cyon — copy from their panel, don't transcribe.

### DMARC (recommended)

A `TXT` record that tells receivers what to do with mail
failing SPF/DKIM. Start in monitor-only mode (`p=none`); you
can tighten to `p=quarantine` or `p=reject` later once
you've watched the aggregate reports.

```
Name:  _dmarc.<your-domain>
Type:  TXT
Value: v=DMARC1; p=none; rua=mailto:postmaster@<your-domain>
```

### Verification

DNS propagation takes minutes-to-hours. To verify:

```bash
dig +short TXT <your-domain>
dig +short TXT default._domainkey.<your-domain>
dig +short TXT _dmarc.<your-domain>
```

All three should return the values you set. SPF / DKIM /
DMARC checkers (e.g. `mxtoolbox.com`) provide a more
thorough validation.

---

## 2. `.env.local` Cyon SMTP credentials

In `.env.local`, fill in the five email-related variables:

```
CYON_SMTP_HOST=mail.cyon.com           # whatever Cyon's panel shows
CYON_SMTP_PORT=587                     # 587 (STARTTLS) recommended; 465 (implicit TLS) also accepted
CYON_SMTP_USER=noreply@<your-domain>   # the SMTP auth user; Cyon requires the address to live on your domain
CYON_SMTP_PASS=<the SMTP password>     # set in Cyon's panel; not your Cyon account password
EMAIL_FROM="Calcgrinder <noreply@<your-domain>>"
```

Notes:

- `CYON_SMTP_PORT` must be exactly `465` or `587`.
  PROJ-2's Zod validation rejects any other value.
- `EMAIL_FROM` must be a valid RFC 5322 string. Either a
  bare address (`noreply@<your-domain>`) or a display-name
  + bracketed-address pair (`Calcgrinder <noreply@…>`).
- `EMAIL_FROM`'s address-part **must live on the same
  domain** as `CYON_SMTP_USER`. Cyon enforces this at the
  SMTP layer; mismatched domains will be rejected.

---

## 3. Verify SMTP via `npm run email:smoke`

With `.env.local` populated, exercise the SMTP path
end-to-end. The smoke CLI renders one of the three
production templates with hardcoded dummy values and
sends through real Cyon.

```bash
npm run email:smoke -- --to <your-test-inbox> --template signup-notification
npm run email:smoke -- --to <your-test-inbox> --template approval-confirmation
npm run email:smoke -- --to <your-test-inbox> --template account-deletion-confirmation
```

Each invocation should print:

```
sent <template> to <your-test-inbox>
messageId: <some.id@cyon.example>
```

Check the inbox. You should see three plain-text emails,
each from `Calcgrinder <noreply@…>`. If any of them lands
in spam, revisit section 1 (DNS records).

If the CLI exits with `error: smoke send failed: …`, the
error message contains the underlying Cyon SMTP response.
Common cases:

- `Invalid login` — `CYON_SMTP_USER` / `CYON_SMTP_PASS`
  wrong. Confirm in Cyon's panel.
- `Mail from address must match authenticated user` —
  `EMAIL_FROM` lives on a different domain than
  `CYON_SMTP_USER`. Fix in `.env.local`.
- `Connection timeout` — `CYON_SMTP_HOST` or
  `CYON_SMTP_PORT` wrong, or your network blocks port
  587 / 465 outbound.

---

## 4. Supabase Auth custom SMTP

Supabase Auth's native flows (password reset, email
verification, email-change confirmation) should also route
through Cyon so every outbound mail in your system comes
from one consistent sender.

In the Supabase Cloud dashboard:

1. Open your project.
2. Go to **Authentication → Settings → SMTP Provider**.
3. Toggle **Enable Custom SMTP** on.
4. Fill in:
   - **Host:** the same value as `CYON_SMTP_HOST`
   - **Port:** the same value as `CYON_SMTP_PORT` (587 or 465)
   - **Username:** the same value as `CYON_SMTP_USER`
   - **Password:** the same value as `CYON_SMTP_PASS`
   - **Sender email:** the address-part of `EMAIL_FROM`
     (without the display name brackets — Supabase wants
     just `noreply@<your-domain>`)
   - **Sender name:** `Calcgrinder` (Supabase will combine
     the two into an RFC 5322 sender)
5. Save.

To verify: trigger a password reset on a test account
(once PROJ-3 ships) and confirm the email arrives with
`Received:` headers showing Cyon's servers, not Supabase's
default sender.

---

## 5. Supabase Auth email templates

In the same dashboard, go to
**Authentication → Email Templates**. Three templates need
customisation; two stay at Supabase defaults.

### Customise: Confirm signup

**Subject:**

```
Confirm your Calcgrinder account
```

**Body (plain text):**

```
Hi,

Thanks for signing up for Calcgrinder. Click the link below to confirm your email address:

{{ .ConfirmationURL }}

After confirmation your account will be reviewed before sign-in is enabled.

— Calcgrinder
```

### Customise: Reset password

**Subject:**

```
Reset your Calcgrinder password
```

**Body (plain text):**

```
Hi,

We received a request to reset your Calcgrinder password. Click the link below to choose a new password:

{{ .ConfirmationURL }}

If you didn't request this, ignore this email — your password stays unchanged.

— Calcgrinder
```

### Customise: Change email address

**Subject:**

```
Confirm your new Calcgrinder email
```

**Body (plain text):**

```
Hi,

You requested to change your Calcgrinder account email to this address. Click the link below to confirm:

{{ .ConfirmationURL }}

If you didn't request this, ignore this email — the change won't take effect.

— Calcgrinder
```

### Leave at default: Magic Link

Calcgrinder uses email + password, **never** magic-link
sign-in (intentional product decision — see PROJ-2 spec).
This template should never fire in v1. Leave it at the
Supabase default so that if it ever does fire — a developer
mistake, a sysadmin clicking the wrong button — the
recipient gets a clearly-different-looking email that
signals "this shouldn't have happened" rather than a
silently-disguised bug.

### Leave at default: Invite user

Calcgrinder's approval flow is self-signup + sysadmin
approval, not sysadmin-initiated invitations. This template
should never fire in v1. Same canary rationale as Magic
Link — leave at default.

### Placeholder syntax

Supabase Auth uses Go template syntax (`{{ .Field }}`) for
substitution at send time. The placeholders above
(`{{ .ConfirmationURL }}`) are filled in by Supabase, not
by your code. Paste them literally — do not replace them
with hardcoded URLs.

---

## Out of scope here

This guide configures **PROJ-2's** transport-layer and
template-content surface. The features that actually call
`sendMail()` from inside an HTTP request handler — signup
notifications, approval confirmations, account-deletion
confirmations — are wired in PROJ-3 (auth + approval flow)
and PROJ-14 (settings page). Those features' own QA phases
exercise the full end-to-end loop; the smoke CLI is the
deployer-side acceptance test for PROJ-2 alone.
