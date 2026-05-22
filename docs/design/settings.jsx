// Calcgrinder — Settings page + email-confirmation landing surfaces.
//
// Consumes window globals from chrome.jsx (cgTokens, Icons, Btn, Wordmark,
// Avatar, SysadminPill, TopBarDesktop / TopBarMobile) and from states.jsx
// (EmptyOrErrorState).
//
// Settings is reached via the avatar popover's "Settings" link. The page is
// a single centred column (~640px) divided into four sections:
//   1. Profile          — Name · Email · Role
//   2. Security         — Password change
//   3. Preferences      — App theme · Default calculator theme
//   4. Danger zone      — Delete account (with bottom-sheet confirm)
//
// Inline edits save on blur (incremental save model — no Save/Cancel bar).
// Destructive actions go through email confirmation, not a typed username.

const { useState: stUseState } = React;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEAD — uppercase muted ~13px. Sits above each section's rows.
// ─────────────────────────────────────────────────────────────────────────────
const SectionHead = ({ t, children, style }) => (
  <div style={{
    fontSize: 12, fontWeight: 600, color: t.textMuted,
    letterSpacing: 0.7, textTransform: 'uppercase',
    padding: '0 0 12px',
    ...style,
  }}>{children}</div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ROW — one form row. Label sits above the control, helper text below.
// extraLabel slot allows the Role row to surface the Sysadmin pill next to
// the label without an input below it.
// ─────────────────────────────────────────────────────────────────────────────
const SettingsRow = ({ t, label, extraLabel, helper, children, style }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 13, fontWeight: 500, color: t.text, letterSpacing: -0.05,
    }}>
      <span>{label}</span>
      {extraLabel}
    </div>
    {children}
    {helper && (
      <p style={{
        margin: '2px 2px 0', fontSize: 12, color: t.textMuted, lineHeight: 1.5,
      }}>{helper}</p>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS INPUT — same family as AuthInput / TextInput, but with a focus
// affordance baked in so an inline-editable field reads as editable. `focus`
// renders the focused style; `pending` adds the email-pending pill on the
// right side. `error` paints the danger border + ring.
// ─────────────────────────────────────────────────────────────────────────────
const SettingsInput = ({
  t, value, placeholder, type = 'text', mono = false,
  focus = false, pending = false, error = false, suffix,
}) => {
  let border = t.borderStr;
  let ring   = 'none';
  if (focus)   { border = t.accent;  ring = `0 0 0 3px ${t.accentSoft}`; }
  if (pending) { border = '#D97706';  ring = '0 0 0 3px rgba(217,119,6,0.10)'; }
  if (error)   { border = t.danger;  ring = `0 0 0 3px ${t.dangerSoft}`; }
  return (
    <div style={{
      height: 38, padding: '0 12px', borderRadius: 7,
      background: t.surface,
      border: `1px solid ${border}`,
      boxShadow: ring,
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 13.5,
      color: value ? t.text : t.textSubtle,
      fontFamily: mono ? '"Geist Mono", monospace' : 'inherit',
      letterSpacing: type === 'password' && value ? 2 : 0,
    }}>
      <span style={{
        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {type === 'password' && value
          ? '•'.repeat(Math.min(12, value.length))
          : (value || placeholder || '')}
      </span>
      {suffix}
    </div>
  );
};

// Pending-verification pill — sits inside the email input on the right.
const PendingPill = ({ t }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '2px 7px 2px 6px', borderRadius: 999,
    fontSize: 10.5, fontWeight: 600, lineHeight: '14px',
    background: '#FEF3C7', color: '#92400E',
    letterSpacing: 0.4, textTransform: 'uppercase',
    border: '1px solid #FDE68A',
  }}>
    <span style={{
      width: 5, height: 5, borderRadius: '50%', background: '#D97706',
    }}/>
    Pending
  </span>
);

// Inline link — used inside helper text (Resend / Cancel-change).
const InlineLink = ({ t, children, danger = false }) => (
  <a href="#" style={{
    color: danger ? t.dangerText : t.accentText,
    fontWeight: 500, textDecoration: 'underline',
    textUnderlineOffset: 2, textDecorationColor: 'currentColor',
  }}>{children}</a>
);

// Inline success / error caption shown beneath the password fields after the
// Update button is pressed. Auto-dismisses after a few seconds in real life.
const InlineCaption = ({ t, kind = 'success', children }) => {
  const c = kind === 'success'
    ? { fg: t.accentText, dot: t.accent, icon: Icons.Check }
    : { fg: t.dangerText, dot: t.danger, icon: Icons.X };
  const I = c.icon;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12.5, color: c.fg, fontWeight: 500, lineHeight: 1.4,
      padding: '2px 2px',
    }}>
      <span style={{
        width: 14, height: 14, borderRadius: '50%', background: c.dot,
        color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}><I size={9} stroke={3}/></span>
      <span>{children}</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENTED THEME CONTROL — same look as the avatar popover's theme row,
// re-skinned as a single row of three equal cells. Used in Preferences.
// Both surfaces stay in sync via the theme prop (caller passes the current
// value); in this design pass we just render the visual.
// ─────────────────────────────────────────────────────────────────────────────
const ThemeSegmented = ({ t, value = 'System' }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4,
    padding: 3, background: t.surface2,
    border: `1px solid ${t.border}`, borderRadius: 8,
  }}>
    {[{k:'Light',I:Icons.Sun},{k:'Dark',I:Icons.Moon},{k:'System',I:Icons.Monitor}].map(({k,I}) => {
      const active = value === k;
      return (
        <div key={k} style={{
          height: 36, borderRadius: 6, cursor: 'pointer',
          border: `1px solid ${active ? t.accent : 'transparent'}`,
          background: active ? t.surface : 'transparent',
          color: active ? t.accentText : t.textMuted,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          fontSize: 12.5, fontWeight: 500,
          boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        }}>
          <I size={14}/><span>{k}</span>
        </div>
      );
    })}
  </div>
);

// Calculator-theme dropdown. Same visual family as the editor Select.
const CalcThemeSelect = ({ t, value = 'Calcgrinder' }) => (
  <div style={{
    height: 38, padding: '0 10px 0 12px', borderRadius: 7,
    background: t.surface, border: `1px solid ${t.borderStr}`,
    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between',
    fontSize: 13.5, color: t.text, cursor: 'pointer',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: 16, height: 16, borderRadius: 4,
        background: t.text, color: t.surface,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Geist Mono", monospace', fontSize: 9, fontWeight: 600,
      }}>c</span>
      <span>{value}</span>
    </div>
    <Icons.ChevD size={14}/>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE BOTTOM SHEET — destructive confirm.
// Pattern (per spec): dim overlay rgba(0,0,0,0.20), top corners 16,
// drag handle, shadowLg upward, primary destructive button + ghost Cancel.
// Same sheet will later be lifted into a shared component.
// ─────────────────────────────────────────────────────────────────────────────
const DeleteAccountSheet = ({ t, viewport = 'desktop' }) => {
  const isMobile = viewport === 'mobile';
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(0,0,0,0.20)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: isMobile ? '100%' : 520,
        margin: isMobile ? 0 : '0 auto',
        background: t.surface,
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        borderTop: `1px solid ${t.border}`,
        boxShadow: t.shadowLg,
        padding: '12px 24px 24px',
      }}>
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2, background: t.borderStr,
          margin: '0 auto 16px',
        }}/>

        {/* Icon + title + body */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: t.dangerSoft, color: t.danger,
            border: `1px solid ${t.dangerBorder}`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icons.Trash size={18}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: 600, color: t.text,
              letterSpacing: -0.2, lineHeight: 1.3,
            }}>Delete your account?</div>
            <p style={{
              margin: '6px 0 0', fontSize: 13.5, color: t.textMuted, lineHeight: 1.55,
            }}>
              We'll send a confirmation link to{' '}
              <span style={{ color: t.text, fontWeight: 500 }}>ada.thornton@calcgrinder.app</span>.
              Clicking it permanently deletes your account, all calculators
              you own, and every scenario saved against them. Visitors will
              see your published calculators disappear.
            </p>
          </div>
        </div>

        {/* Buttons — full-width on mobile, right-aligned on desktop */}
        <div style={{
          display: 'flex', gap: 8, marginTop: 20,
          justifyContent: isMobile ? 'stretch' : 'flex-end',
          flexDirection: isMobile ? 'column-reverse' : 'row',
        }}>
          <Btn variant="ghost" size="md" t={t}
            style={{ height: 40, justifyContent: 'center',
                     flex: isMobile ? '1 1 auto' : '0 0 auto' }}>
            Cancel
          </Btn>
          <button style={{
            height: 40,
            padding: '0 16px',
            borderRadius: 6,
            background: t.danger, color: t.dangerFg,
            border: `1px solid ${t.danger}`,
            fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, letterSpacing: -0.05,
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            flex: isMobile ? '1 1 auto' : '0 0 auto',
          }}>
            <Icons.Trash size={14}/>
            Send deletion link
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

const ProfileSection = ({ t, emailPending, isSysadmin }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
    <SettingsRow t={t} label="Name"
      helper="Shown on your account menu.">
      <SettingsInput t={t} value="Ada Thornton"/>
    </SettingsRow>

    <SettingsRow
      t={t}
      label="Email"
      helper={emailPending ? (
        <span>
          A verification link was sent to{' '}
          <span style={{ color: t.text, fontWeight: 500, fontFamily: '"Geist Mono", monospace', fontSize: 11.5 }}>
            ada@newdomain.io
          </span>
          . Your email will change once you confirm.{' '}
          <InlineLink t={t}>Resend link</InlineLink>
          {' · '}
          <InlineLink t={t} danger>Cancel change</InlineLink>
        </span>
      ) : "We'll send a verification link to your new address before changing it."}>
      <SettingsInput
        t={t}
        value={emailPending ? "ada.thornton@calcgrinder.app" : "ada.thornton@calcgrinder.app"}
        type="email"
        pending={emailPending}
        suffix={emailPending ? <PendingPill t={t}/> : null}
      />
    </SettingsRow>

    <SettingsRow t={t} label="Role"
      extraLabel={isSysadmin ? <SysadminPill t={t}/> : null}
      helper={isSysadmin
        ? "Sysadmin can approve new users and curate Templates. The role is set by another sysadmin and can't be changed here."
        : "Your role is set by a sysadmin."}/>
  </div>
);

const SecuritySection = ({ t, error = false, success = false }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <SettingsRow t={t} label="Current password">
      <SettingsInput t={t} value="hunter2hunter2" type="password"
        error={error === 'wrong-current'}/>
    </SettingsRow>
    <SettingsRow t={t} label="New password">
      <SettingsInput t={t} value="northstar88!" type="password"
        error={error === 'mismatch'}/>
    </SettingsRow>
    <SettingsRow t={t} label="Confirm new password">
      <SettingsInput t={t} value="northstar88!" type="password"
        error={error === 'mismatch'}/>
    </SettingsRow>

    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, marginTop: 4,
    }}>
      <Btn variant="secondary" size="md" t={t}>Update password</Btn>
      {success && <InlineCaption t={t} kind="success">Password updated.</InlineCaption>}
      {error === 'mismatch' && <InlineCaption t={t} kind="error">New passwords don't match.</InlineCaption>}
      {error === 'wrong-current' && <InlineCaption t={t} kind="error">Current password is incorrect.</InlineCaption>}
    </div>
  </div>
);

const PreferencesSection = ({ t }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
    <SettingsRow t={t} label="App theme"
      helper="Affects the Calcgrinder dashboard, editor and these settings. Synced with the theme picker in your account menu.">
      <ThemeSegmented t={t} value="System"/>
    </SettingsRow>
    <SettingsRow t={t} label="Default calculator theme for new calculators"
      helper="Applied to any new calculator you create. Existing calculators keep their current theme.">
      <CalcThemeSelect t={t} value="Calcgrinder"/>
    </SettingsRow>
  </div>
);

const DangerZoneSection = ({ t, deletionPending = false }) => (
  <div style={{
    border: `1px solid ${t.dangerBorder}`,
    background: t.surface,
    borderRadius: 10,
    padding: 22,
    boxShadow: t.shadow,
  }}>
    <SectionHead t={t} style={{
      padding: 0, marginBottom: 14, color: t.dangerText,
    }}>Danger zone</SectionHead>

    {deletionPending && (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 12px', borderRadius: 7,
        background: t.dangerSoft,
        border: `1px solid ${t.dangerBorder}`,
        color: t.dangerText,
        fontSize: 12.5, lineHeight: 1.5, marginBottom: 18,
      }}>
        <span style={{
          width: 16, height: 16, borderRadius: '50%',
          background: t.danger, color: '#fff', fontSize: 11, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: 1,
        }}>!</span>
        <span style={{ flex: 1 }}>
          <span style={{ fontWeight: 600 }}>Deletion pending.</span>
          {' '}A confirmation link was sent to{' '}
          <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 11.5, fontWeight: 500 }}>
            ada.thornton@calcgrinder.app
          </span>
          . Your account will be deleted once you click it.{' '}
          <InlineLink t={t} danger>Resend link</InlineLink>
          {' · '}
          <InlineLink t={t} danger>Cancel deletion</InlineLink>
        </span>
      </div>
    )}

    <p style={{
      margin: 0, fontSize: 13, color: t.textMuted, lineHeight: 1.55,
    }}>
      Deleting your account permanently removes all calculators you own and
      every scenario saved against them — yours and anyone else's. Visitors
      will see your published calculators disappear. This cannot be undone.
    </p>

    <div style={{ marginTop: 16 }}>
      <button style={{
        height: 36, padding: '0 14px', borderRadius: 6,
        background: deletionPending ? 'transparent' : t.danger,
        color: deletionPending ? t.dangerText : t.dangerFg,
        border: `1px solid ${deletionPending ? t.dangerBorder : t.danger}`,
        fontFamily: 'inherit', fontSize: 13, fontWeight: 600, letterSpacing: -0.05,
        cursor: deletionPending ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        opacity: deletionPending ? 0.7 : 1,
      }}>
        <Icons.Trash size={13}/>
        {deletionPending ? 'Deletion pending' : 'Delete account'}
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PAGE
//   `state` controls which variant is shown:
//     'default'     — no pending changes, no errors
//     'pending'     — email change pending + deletion pending
//     'confirmSheet'— default state with delete-confirm sheet overlay
// ─────────────────────────────────────────────────────────────────────────────
const SettingsPage = ({
  theme = 'light',
  viewport = 'desktop',
  state = 'default',
  isSysadmin = true,
  showSheet = false,
}) => {
  const t = cgTokens[theme];
  const mobile = viewport === 'mobile';
  const emailPending     = state === 'pending';
  const deletionPending  = state === 'pending';

  return (
    <div style={{
      background: t.bg, color: t.text, width: '100%', height: '100%',
      fontFamily: '"Geist", -apple-system, system-ui, sans-serif',
      fontSize: 14, letterSpacing: -0.05,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', WebkitFontSmoothing: 'antialiased',
      position: 'relative',
    }}>
      {mobile
        ? <TopBarMobile t={t} center={
            <span style={{ fontSize: 14, fontWeight: 600, color: t.text, letterSpacing: -0.2 }}>
              Settings
            </span>
          }/>
        : <TopBarDesktop t={t}
            tabs={[
              { label: 'Dashboard', active: false },
              { label: 'Settings',  active: true  },
            ]}
          />
      }

      <main style={{
        flex: 1, overflow: 'auto',
        padding: mobile ? '24px 20px 40px' : '40px 32px 64px',
      }}>
        <div style={{
          maxWidth: 640, margin: '0 auto',
          display: 'flex', flexDirection: 'column', gap: mobile ? 36 : 44,
        }}>
          {/* Page heading */}
          {!mobile && (
            <div>
              <div style={{
                fontSize: 11.5, fontWeight: 500, color: t.textSubtle,
                letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
              }}>Account</div>
              <h1 style={{
                margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: -0.6,
                color: t.text, lineHeight: 1.15,
              }}>Settings</h1>
            </div>
          )}

          {/* 1. Profile */}
          <section>
            <SectionHead t={t}>Profile</SectionHead>
            <ProfileSection t={t} emailPending={emailPending} isSysadmin={isSysadmin}/>
          </section>

          <div style={{ height: 1, background: t.border }}/>

          {/* 2. Security */}
          <section>
            <SectionHead t={t}>Security</SectionHead>
            <SecuritySection t={t}/>
          </section>

          <div style={{ height: 1, background: t.border }}/>

          {/* 3. Preferences */}
          <section>
            <SectionHead t={t}>Preferences</SectionHead>
            <PreferencesSection t={t}/>
          </section>

          {/* 4. Danger zone — visually offset by its own card */}
          <section>
            <DangerZoneSection t={t} deletionPending={deletionPending}/>
          </section>
        </div>
      </main>

      {showSheet && <DeleteAccountSheet t={t} viewport={viewport}/>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL CONFIRMATION LANDING PAGES
// L1 — Email change confirmed
// L2 — Account deletion confirmed
// Both: no app chrome, wordmark centred at top (auth framing); body uses
// EmptyOrErrorState with variant='error' framed={false}.
// ─────────────────────────────────────────────────────────────────────────────
const ConfirmationLanding = ({
  theme = 'light',
  kind = 'email-changed', // 'email-changed' | 'account-deleted'
}) => {
  const t = cgTokens[theme];
  const cfg = kind === 'email-changed' ? {
    icon: Icons.Check,
    title: 'Email address updated',
    body: (
      <React.Fragment>
        You can now sign in with{' '}
        <strong style={{ color: t.text, fontWeight: 600,
                         fontFamily: '"Geist Mono", monospace', fontSize: 12.5 }}>
          ada@newdomain.io
        </strong>
        . The old address is no longer linked to your account.
      </React.Fragment>
    ),
    primary: { label: 'Continue to dashboard', icon: Icons.ArrowR },
    footer: 'You can close this tab safely.',
    status: 'CONFIRMED',
  } : {
    icon: Icons.Trash,
    title: 'Account deleted',
    body: (
      <React.Fragment>
        Your Calcgrinder account and every calculator you owned have been
        permanently removed. We're sorry to see you go.
      </React.Fragment>
    ),
    primary: null,
    footer: (
      <span>
        Change your mind? <a href="#" style={{
          color: t.textMuted, textDecoration: 'underline', textUnderlineOffset: 2,
        }}>Request access</a> with the same email to start fresh.
      </span>
    ),
    status: 'DELETED',
  };

  return (
    <div style={{
      background: t.bg, color: t.text, width: '100%', height: '100%',
      fontFamily: '"Geist", -apple-system, system-ui, sans-serif',
      fontSize: 14, letterSpacing: -0.05,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{
        padding: '32px 0 0', display: 'flex', justifyContent: 'center',
      }}>
        <Wordmark t={t}/>
      </div>
      <main style={{
        flex: 1, overflow: 'auto', padding: '32px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ maxWidth: 480, width: '100%' }}>
          <div style={{
            textAlign: 'center', marginBottom: 18,
            fontFamily: '"Geist Mono", monospace',
            fontSize: 11, fontWeight: 500, letterSpacing: 1.2,
            color: t.textSubtle, textTransform: 'uppercase',
          }}>{cfg.status}</div>
          <EmptyOrErrorState
            variant="error"
            framed={false}
            size="lg"
            icon={cfg.icon}
            title={cfg.title}
            body={cfg.body}
            primaryAction={cfg.primary}
            footerNote={cfg.footer}
            t={t}
          />
        </div>
      </main>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
Object.assign(window, {
  SettingsPage, DeleteAccountSheet, ConfirmationLanding,
  // primitives, in case other surfaces want to reuse
  SettingsRow, SettingsInput, SectionHead, ThemeSegmented, CalcThemeSelect,
});
