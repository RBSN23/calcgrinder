// Calcgrinder — empty + error states
// One reusable component used in three contexts:
//   variant='empty'  — dashed border, surface2 bg. "A slot waiting to be filled."
//                       (My Calculators / Templates / My Scenarios empties.)
//   variant='error'  — solid 1px border, surface bg. "This resource is gone /
//                       unavailable." (Orphan scenarios, public-URL errors.)
//   variant='error' + framed={false}
//                    — no card chrome at all. Just centred content. Used for
//                       full-page public-URL errors below the wordmark.
//
// Internal layout is identical across variants: icon → title → body → actions
// → optional footerNote. Only the frame styling changes.
//
// Consumes: cgTokens, Icons, Btn, Wordmark from chrome.jsx (window globals).

const EmptyOrErrorState = ({
  variant = 'empty',
  icon: Icon,
  title,
  body,
  primaryAction,    // { label, onClick, icon? }
  secondaryAction,  // { label, onClick }
  footerNote,       // string or node
  t,
  framed = true,
  // Sizing knobs so the same component works in a section slot (compact)
  // and as a full-area page state (more generous).
  size = 'md',      // 'md' (default, fits in a dashboard section) | 'lg'
}) => {
  const isEmpty = variant === 'empty';
  const lg = size === 'lg';

  // Icon square: same recipe in both variants, just inverts surface so it
  // still pops against its frame (surface on surface2, surface2 on surface).
  const iconBg     = isEmpty ? t.surface : t.surface2;
  const iconBorder = isEmpty ? t.border  : t.border;

  const padding = lg
    ? (framed ? '56px 32px' : '24px 24px')
    : '34px 20px';

  const frameStyle = !framed ? {
    // No card. Caller is responsible for the surrounding page layout.
    background: 'transparent',
    border: 'none',
    padding: lg ? '8px 24px' : padding,
  } : isEmpty ? {
    border: `1px dashed ${t.borderStr}`,
    background: t.surface2,
    borderRadius: 8,
    padding,
  } : {
    border: `1px solid ${t.border}`,
    background: t.surface,
    borderRadius: 10,
    padding,
    boxShadow: t.shadow,
  };

  return (
    <div style={{
      ...frameStyle,
      textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      maxWidth: lg ? 460 : 'none',
      margin: framed ? 0 : '0 auto',
    }}>
      {Icon && (
        <div style={{
          width: lg ? 48 : 40, height: lg ? 48 : 40, borderRadius: 8,
          background: iconBg, border: `1px solid ${iconBorder}`,
          color: t.textMuted,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 2,
        }}>
          <Icon size={lg ? 22 : 18}/>
        </div>
      )}

      <div style={{
        fontSize: lg ? 17 : 14,
        fontWeight: 600, color: t.text, letterSpacing: -0.2,
        marginTop: 4, lineHeight: 1.25,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        maxWidth: '100%',
      }}>{title}</div>

      <div style={{
        fontSize: lg ? 13.5 : 12.5,
        color: t.textMuted, maxWidth: lg ? 380 : 340, lineHeight: 1.5,
      }}>{body}</div>

      {(primaryAction || secondaryAction) && (
        <div style={{
          display: 'flex', gap: 8, marginTop: 10,
          justifyContent: 'center', flexWrap: 'wrap',
        }}>
          {secondaryAction && (
            <Btn variant="secondary" size={lg ? 'md' : 'sm'} t={t} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Btn>
          )}
          {primaryAction && (
            <Btn variant="primary" size={lg ? 'md' : 'sm'} t={t}
                 icon={primaryAction.icon} onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Btn>
          )}
        </div>
      )}

      {footerNote && (
        <div style={{
          fontSize: 12, color: t.textSubtle, marginTop: 14,
          lineHeight: 1.5, maxWidth: 420,
        }}>{footerNote}</div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Page-shell helpers — thin wrappers so the design canvas can render an
// orphan or public-URL state at full-frame fidelity without rebuilding the
// surrounding chrome each time.
// ─────────────────────────────────────────────────────────────

// Orphan view: top bar + a full-area centred error card. Sits where the
// dashboard's <main> usually sits, so context (you're logged in, this is
// your account) reads immediately.
const OrphanPage = ({ theme = 'light', calcName, mode = 'recoverable', otherCount = 0 }) => {
  const t = cgTokens[theme];
  const isRecoverable = mode === 'recoverable';
  const footer = otherCount > 0 ? (
    <span>
      You have <strong style={{color: t.textMuted, fontWeight: 600}}>{otherCount}</strong>
      {' '}other scenario{otherCount === 1 ? '' : 's'} for this calculator.
      {' '}
      <a href="#" style={{color: t.textMuted, textDecoration: 'underline', textUnderlineOffset: 2}}>
        Delete all
      </a>
    </span>
  ) : null;

  return (
    <div style={{
      background: t.bg, color: t.text, width: '100%', height: '100%',
      fontFamily: '"Geist", -apple-system, system-ui, sans-serif',
      fontSize: 14, letterSpacing: -0.05,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <TopBarDesktop t={t} tabs={[{label: 'Dashboard', active: false}, {label: 'Scenario', active: true}]}/>
      <main style={{
        flex: 1, overflow: 'auto', padding: '32px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{maxWidth: 560, width: '100%'}}>
          <EmptyOrErrorState
            variant="error"
            size="lg"
            icon={Icons.Calc}
            title={isRecoverable ? 'Calculator no longer available' : 'Calculator no longer exists'}
            body={isRecoverable
              ? <>The calculator «<strong style={{color: t.text, fontWeight: 600}}>{calcName}</strong>» was deleted by its owner. You can clone it to keep using your scenarios while it's still recoverable.</>
              : <>The calculator «<strong style={{color: t.text, fontWeight: 600}}>{calcName}</strong>» has been permanently removed. Your scenarios for it can no longer be used.</>
            }
            primaryAction={isRecoverable
              ? {label: 'Clone calculator', icon: Icons.Copy}
              : {label: 'Delete this scenario', icon: Icons.Trash}
            }
            secondaryAction={isRecoverable
              ? {label: 'Discard scenario'}
              : {label: 'View other scenarios'}
            }
            footerNote={footer}
            t={t}
          />
        </div>
      </main>
    </div>
  );
};

// Public-URL error page: no app chrome. Wordmark centred at top, error
// content centred in the rest of the page.
const PublicErrorPage = ({ theme = 'light', mode = 'invalid' }) => {
  const t = cgTokens[theme];
  const cfg = {
    invalid: {
      icon: Icons.NotFound,
      title: 'Calculator not found',
      body: "This calculator doesn't exist or the link has been revoked. Check the URL and try again.",
      status: '404',
      primary: null,
      footer: <a href="#" style={{color: t.textMuted, textDecoration: 'underline', textUnderlineOffset: 2}}>Visit Calcgrinder</a>,
    },
    unpublished: {
      icon: Icons.NotFound,
      title: 'Calculator not available',
      body: 'This calculator is private. The owner may publish it later, or you can check the URL.',
      status: '404',
      primary: null,
      footer: <a href="#" style={{color: t.textMuted, textDecoration: 'underline', textUnderlineOffset: 2}}>Visit Calcgrinder</a>,
    },
    deleted: {
      icon: Icons.Hourglass,
      title: 'Calculator no longer available',
      body: 'The owner has deleted this calculator. If you saved scenarios, you can find them in your account.',
      status: '410',
      primary: {label: 'Sign in to see your scenarios'},
      footer: null,
    },
  }[mode];

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
        <div style={{maxWidth: 480, width: '100%', position: 'relative'}}>
          {/* status code — small, monospace, sits above the title */}
          <div style={{
            textAlign: 'center', marginBottom: 18,
            fontFamily: '"Geist Mono", monospace',
            fontSize: 11, fontWeight: 500, letterSpacing: 1.2,
            color: t.textSubtle, textTransform: 'uppercase',
          }}>Error · {cfg.status}</div>
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

Object.assign(window, { EmptyOrErrorState, OrphanPage, PublicErrorPage });
