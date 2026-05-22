// Calcgrinder — Auth flows
// Eight pre-auth screens. No app chrome (no top bar, no avatar).
// Wordmark centred at top; single-column form/content below.
// All visual primitives come from chrome.jsx (cgTokens, Wordmark, Btn, Icons).
//
// Layout contract:
//   AuthShell is a full-bleed page in the App theme bg colour. Content lives
//   in a single column, max-width 400px on desktop. On mobile (<480), the
//   shell switches to ~24px side padding and the column stretches.
//   Sections rendered into a DesignCanvas artboard size their frame; the
//   AuthShell itself fills 100% width/height of that frame.

const { useState: authUseState } = React;

// ─────────────────────────────────────────────────────────────────────────────
// Shell — bg + vertical centre + wordmark header + form column.
// ─────────────────────────────────────────────────────────────────────────────
const AuthShell = ({ t, viewport = 'desktop', children }) => {
  const isMobile = viewport === 'mobile';
  return (
    <div style={{
      width: '100%', height: '100%', background: t.bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: isMobile ? '56px 24px 32px' : '88px 24px 56px',
      color: t.text, overflow: 'auto',
    }}>
      {/* Wordmark — centred, link-style cursor removed by wrapping in a div */}
      <div style={{ marginBottom: isMobile ? 36 : 48 }}>
        <AuthWordmark t={t}/>
      </div>
      <div style={{
        width: '100%', maxWidth: isMobile ? '100%' : 360,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {children}
      </div>
    </div>
  );
};

// Slightly larger wordmark than the in-app version, no cursor:pointer.
const AuthWordmark = ({ t }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{
      width: 28, height: 28, borderRadius: 6, background: t.text,
      color: t.surface, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Geist Mono", monospace', fontSize: 16, fontWeight: 600,
    }}>c</div>
    <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3, color: t.text }}>
      Calcgrinder
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Form primitives — match TextInput style from editor-grid.jsx but taller
// (38px) to feel hand-friendly on pre-auth screens; same surface/border tokens.
// ─────────────────────────────────────────────────────────────────────────────
const AuthField = ({ t, label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
    <label style={{
      fontSize: 11, fontWeight: 500, color: t.textMuted,
      letterSpacing: 0.4, textTransform: 'uppercase',
    }}>{label}</label>
    {children}
  </div>
);

const AuthInput = ({ t, value, placeholder, type = 'text', mono = false, error = false }) => (
  <div style={{
    height: 38, padding: '0 12px', borderRadius: 7,
    background: t.surface,
    border: `1px solid ${error ? '#DC2626' : t.borderStr}`,
    boxShadow: error ? '0 0 0 3px rgba(220,38,38,0.10)' : 'none',
    display: 'flex', alignItems: 'center',
    fontSize: 13.5,
    color: value ? t.text : t.textSubtle,
    fontFamily: mono ? '"Geist Mono", monospace' : 'inherit',
  }}>
    <span style={{
      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      letterSpacing: type === 'password' && value ? 2 : 0,
    }}>
      {type === 'password' && value
        ? '•'.repeat(Math.min(12, value.length))
        : (value || placeholder || '')}
    </span>
  </div>
);

const AuthSubmit = ({ t, children }) => (
  <button style={{
    width: '100%', height: 42, borderRadius: 7,
    background: t.accent, color: t.accentFg,
    border: `1px solid ${t.accent}`,
    fontFamily: 'inherit', fontSize: 14, fontWeight: 600, letterSpacing: -0.1,
    cursor: 'pointer', marginTop: 4,
  }}>{children}</button>
);

const AuthLink = ({ t, children, strong = false }) => (
  <span style={{
    color: t.accentText, fontWeight: strong ? 600 : 500, cursor: 'pointer',
    textDecoration: 'none',
  }}>{children}</span>
);

const AuthDivider = ({ t }) => (
  <div style={{ height: 1, background: t.border, margin: '4px 0' }}/>
);

const AuthFootLine = ({ t, children, align = 'center' }) => (
  <div style={{
    textAlign: align, fontSize: 13, color: t.textMuted, lineHeight: 1.5,
  }}>{children}</div>
);

const AuthHelpText = ({ t, children }) => (
  <p style={{
    margin: '2px 2px 0', fontSize: 12, color: t.textMuted, lineHeight: 1.5,
  }}>{children}</p>
);

// Inline error banner — sits above the form, subtle but unambiguous.
const AuthErrorBanner = ({ t, children }) => {
  const isDark = t.bg === cgTokens.dark.bg;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 9,
      padding: '10px 12px', borderRadius: 7,
      background: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2',
      border: `1px solid ${isDark ? 'rgba(220,38,38,0.35)' : '#FECACA'}`,
      color: isDark ? '#FCA5A5' : '#991B1B',
      fontSize: 13, lineHeight: 1.45, fontWeight: 500,
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: '50%',
        background: isDark ? '#FCA5A5' : '#DC2626',
        color: isDark ? '#0C0A09' : '#fff',
        fontSize: 11, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
      }}>!</span>
      <span>{children}</span>
    </div>
  );
};

// Centred large glyph for confirmation / waiting screens. Color comes from the
// caller (t.textMuted or t.accent per spec).
const AuthGlyph = ({ icon: I, color, size = 40, fill }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 64, height: 64, margin: '0 auto', borderRadius: '50%',
    background: fill, color,
  }}>
    <I size={size} stroke={1.5}/>
  </div>
);

// Custom icons we don't have in chrome.jsx (clock / hourglass / mail).
const AuthIcons = {
  Clock: (p) => (
    <svg width={p.size||40} height={p.size||40} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={p.stroke||1.5}
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3.5 2"/>
    </svg>
  ),
  Mail: (p) => (
    <svg width={p.size||40} height={p.size||40} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={p.stroke||1.5}
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5"/>
      <path d="M3.5 7l8.5 6 8.5-6"/>
    </svg>
  ),
  Check: (p) => (
    <svg width={p.size||40} height={p.size||40} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={p.stroke||1.75}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l4.5 4.5L19 7"/>
    </svg>
  ),
  X: (p) => (
    <svg width={p.size||40} height={p.size||40} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={p.stroke||1.5}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  ),
};

// Title + body block used by confirmation / waiting screens.
const AuthMessage = ({ t, title, children, align = 'center' }) => (
  <div style={{ textAlign: align }}>
    <h1 style={{
      margin: '0 0 8px', fontSize: 22, fontWeight: 600, letterSpacing: -0.3,
      color: t.text, lineHeight: 1.2,
    }}>{title}</h1>
    <p style={{
      margin: 0, fontSize: 14, color: t.textMuted, lineHeight: 1.55,
    }}>{children}</p>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Screen 1 — Login
// ─────────────────────────────────────────────────────────────────────────────
const LoginScreen = ({ theme = 'light', viewport = 'desktop', error = false }) => {
  const t = cgTokens[theme];
  return (
    <AuthShell t={t} viewport={viewport}>
      {error && (
        <AuthErrorBanner t={t}>Invalid email or password.</AuthErrorBanner>
      )}
      <AuthField t={t} label="Email">
        <AuthInput t={t} value="ada.thornton@example.com" type="email"/>
      </AuthField>
      <AuthField t={t} label="Password">
        <AuthInput t={t} value="hunter2hunter2" type="password"/>
      </AuthField>
      <AuthSubmit t={t}>Sign in</AuthSubmit>
      <div style={{ textAlign: 'center', marginTop: -4 }}>
        <span style={{ fontSize: 13, color: t.textMuted }}>
          <AuthLink t={t}>Forgot password?</AuthLink>
        </span>
      </div>
      <AuthDivider t={t}/>
      <AuthFootLine t={t}>
        No account yet? <AuthLink t={t} strong>Sign up</AuthLink>
      </AuthFootLine>
    </AuthShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Screen 2 — Request access (signup)
// ─────────────────────────────────────────────────────────────────────────────
const RequestAccessScreen = ({ theme = 'light', viewport = 'desktop' }) => {
  const t = cgTokens[theme];
  return (
    <AuthShell t={t} viewport={viewport}>
      <AuthField t={t} label="Name">
        <AuthInput t={t} value="Ada Thornton"/>
      </AuthField>
      <AuthField t={t} label="Email">
        <AuthInput t={t} value="ada.thornton@example.com" type="email"/>
      </AuthField>
      <AuthField t={t} label="Password">
        <AuthInput t={t} value="hunter2hunter2" type="password"/>
      </AuthField>
      <AuthSubmit t={t}>Request access</AuthSubmit>
      <AuthHelpText t={t}>
        Calcgrinder is invite-only. The admin will review your request
        and you'll get an email when approved.
      </AuthHelpText>
      <AuthDivider t={t}/>
      <AuthFootLine t={t}>
        Already have an account? <AuthLink t={t} strong>Sign in</AuthLink>
      </AuthFootLine>
    </AuthShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Screen 3 — Waiting for approval (also shown for denied accounts)
// ─────────────────────────────────────────────────────────────────────────────
const WaitingApprovalScreen = ({ theme = 'light', viewport = 'desktop' }) => {
  const t = cgTokens[theme];
  return (
    <AuthShell t={t} viewport={viewport}>
      <AuthGlyph icon={AuthIcons.Clock} color={t.textMuted}/>
      <AuthMessage t={t} title="Waiting for approval">
        Your request is being reviewed. You'll receive an email when your
        account is approved.
      </AuthMessage>
      <div style={{ height: 24 }}/>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 12.5, color: t.textSubtle }}>
          <AuthLink t={t}>Sign out</AuthLink>
        </span>
      </div>
    </AuthShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Screen 4 — Forgot password (request reset)
// ─────────────────────────────────────────────────────────────────────────────
const ForgotPasswordScreen = ({ theme = 'light', viewport = 'desktop' }) => {
  const t = cgTokens[theme];
  return (
    <AuthShell t={t} viewport={viewport}>
      <AuthMessage t={t} title="Reset your password" align="left">
        Enter the email you signed up with. We'll send you a link to set a
        new password.
      </AuthMessage>
      <AuthField t={t} label="Email">
        <AuthInput t={t} value="ada.thornton@example.com" type="email"/>
      </AuthField>
      <AuthSubmit t={t}>Send reset link</AuthSubmit>
      <div style={{ textAlign: 'center', marginTop: -4 }}>
        <span style={{ fontSize: 13, color: t.textMuted }}>
          <AuthLink t={t}>Back to sign in</AuthLink>
        </span>
      </div>
    </AuthShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Screen 5 — Forgot password sent (confirmation)
// ─────────────────────────────────────────────────────────────────────────────
const ForgotPasswordSentScreen = ({ theme = 'light', viewport = 'desktop' }) => {
  const t = cgTokens[theme];
  return (
    <AuthShell t={t} viewport={viewport}>
      <AuthGlyph icon={AuthIcons.Mail} color={t.textMuted}/>
      <AuthMessage t={t} title="Check your email">
        If an account exists for that email, we've sent a password reset link.
      </AuthMessage>
      <div style={{ height: 16 }}/>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 13, color: t.textMuted }}>
          <AuthLink t={t}>Back to sign in</AuthLink>
        </span>
      </div>
    </AuthShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Screen 6 — Reset password
// ─────────────────────────────────────────────────────────────────────────────
const ResetPasswordScreen = ({ theme = 'light', viewport = 'desktop', error = false }) => {
  const t = cgTokens[theme];
  return (
    <AuthShell t={t} viewport={viewport}>
      <AuthMessage t={t} title="Set a new password" align="left">
        Choose a new password for your Calcgrinder account.
      </AuthMessage>
      {error && (
        <AuthErrorBanner t={t}>Passwords do not match.</AuthErrorBanner>
      )}
      <AuthField t={t} label="New password">
        <AuthInput t={t} value="northstar88!" type="password" error={error}/>
      </AuthField>
      <AuthField t={t} label="Confirm new password">
        <AuthInput t={t} value="northstar8!" type="password" error={error}/>
      </AuthField>
      <AuthSubmit t={t}>Set new password</AuthSubmit>
    </AuthShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Screen 7 — Reset success
// ─────────────────────────────────────────────────────────────────────────────
const ResetSuccessScreen = ({ theme = 'light', viewport = 'desktop' }) => {
  const t = cgTokens[theme];
  return (
    <AuthShell t={t} viewport={viewport}>
      <AuthGlyph icon={AuthIcons.Check} color={t.accent} fill={t.accentSoft}/>
      <AuthMessage t={t} title="Password updated">
        You can now sign in with your new password.
      </AuthMessage>
      <AuthSubmit t={t}>Sign in</AuthSubmit>
    </AuthShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Screen 8a / 8b — Admin approval landing (sysadmin only).
// Minimal, functional. No CTAs.
// ─────────────────────────────────────────────────────────────────────────────
const AdminLandingScreen = ({ theme = 'light', viewport = 'desktop', outcome = 'approved' }) => {
  const t = cgTokens[theme];
  const approved = outcome === 'approved';
  return (
    <AuthShell t={t} viewport={viewport}>
      <AuthGlyph
        icon={approved ? AuthIcons.Check : AuthIcons.X}
        color={approved ? t.accent : t.textMuted}
        fill={approved ? t.accentSoft : t.surface2}
        size={32}
      />
      <AuthMessage t={t} title={approved ? 'Account approved' : 'Account declined'}>
        {approved ? (
          <React.Fragment>
            <span style={{ color: t.text, fontWeight: 500 }}>Ada Thornton</span>
            {' '}(<span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 12.5 }}>ada.thornton@example.com</span>)
            {' '}can now sign in.
          </React.Fragment>
        ) : (
          <React.Fragment>
            <span style={{ color: t.text, fontWeight: 500 }}>Ada Thornton</span>
            {' '}(<span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 12.5 }}>ada.thornton@example.com</span>)
            {' '}has been declined and will not be notified.
          </React.Fragment>
        )}
      </AuthMessage>
    </AuthShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Export to globals.
// ─────────────────────────────────────────────────────────────────────────────
Object.assign(window, {
  AuthShell, AuthField, AuthInput, AuthSubmit, AuthLink,
  AuthErrorBanner, AuthMessage, AuthGlyph, AuthIcons,
  LoginScreen, RequestAccessScreen, WaitingApprovalScreen,
  ForgotPasswordScreen, ForgotPasswordSentScreen,
  ResetPasswordScreen, ResetSuccessScreen, AdminLandingScreen,
});
