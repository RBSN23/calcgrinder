// Calcgrinder — Public visitor view
// What a real end-user (registered or anonymous) sees when they open a
// published calculator URL. Pixel-identical to the editor's builder canvas
// minus all edit affordances. Header is themed to the active visitor theme
// (here: "Editorial · Cream").

const { useState: vUseState } = React;

// ─────────────────────────────────────────────────────────────────────────────
// Cream-theme button. Three flavours:
//   primary  → dark ink fill on cream  (Sign up · the headline CTA)
//   solid    → ink stroke on white     (less used now — kept for legacy)
//   ghost    → icon-only, transparent  (Save, Clone in the header)
// ─────────────────────────────────────────────────────────────────────────────
const VBtn = ({ variant='solid', icon:I, children, v, size='md', style, ariaLabel, ...rest }) => {
  const h = size === 'sm' ? 32 : 38;
  const isIconOnly = I && !children;
  const variants = {
    primary: {
      bg: v.ink, fg: v.bg, border: v.ink,
      shadow: `0 1px 0 rgba(255,255,255,0.18) inset, 0 4px 12px rgba(22,20,15,0.18)`,
    },
    solid: {
      bg: v.card, fg: v.ink, border: v.borderStr,
      shadow: '0 1px 0 rgba(0,0,0,0.02)',
    },
    ghost: {
      bg: 'transparent', fg: v.ink, border: 'transparent',
      shadow: 'none',
    },
  };
  const sv = variants[variant];
  // Icon sizing: bigger when it's the only thing in the button.
  const iconSize = isIconOnly ? 19 : (size === 'sm' ? 15 : 16);
  return (
    <button {...rest} aria-label={ariaLabel} style={{
      height: h,
      width: isIconOnly ? h : 'auto',
      padding: isIconOnly ? 0 : '0 16px',
      borderRadius: isIconOnly ? '50%' : 8,
      fontSize:13.5, fontWeight:500, fontFamily:'inherit',
      letterSpacing:-0.1, lineHeight:1,
      background: sv.bg, color: sv.fg, border:`1px solid ${sv.border}`,
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
      cursor:'pointer', whiteSpace:'nowrap',
      boxShadow: sv.shadow,
      ...style,
    }}>
      {I && <I size={iconSize}/>}
      {children}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Brand mark sized to the cream theme — same proportions as the editor but
// rendered against the cream palette so it sits in the surrounding tone.
// ─────────────────────────────────────────────────────────────────────────────
const VBrand = ({ v }) => (
  <div style={{display:'flex', alignItems:'center', gap:10, cursor:'pointer'}}>
    <div style={{
      width:26, height:26, borderRadius:6, background:v.ink,
      color:v.bg, display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'"Geist Mono", monospace', fontSize:15, fontWeight:600,
      letterSpacing:-0.5,
    }}>c</div>
    <span style={{fontSize:15, fontWeight:600, letterSpacing:-0.3, color:v.ink}}>
      Calcgrinder
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Public profile chip — for registered users
// ─────────────────────────────────────────────────────────────────────────────
const VProfile = ({ v, initials='AT' }) => (
  <button style={{
    width:36, height:36, borderRadius:'50%', border:`1px solid ${v.borderStr}`,
    background: v.card, padding:0, cursor:'pointer',
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    color: v.ink, fontFamily:'inherit', fontSize:12.5, fontWeight:600,
    letterSpacing:0.2,
  }}>{initials}</button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Visitor header
//   Anonymous → Save icon (saves to localStorage) · Sign up CTA
//   Registered → Save icon · Clone icon · Profile avatar
// Save/Clone are always icon-only — no bg, no border. Same on mobile.
// ─────────────────────────────────────────────────────────────────────────────
const VisitorHeader = ({ v, user='anonymous', mobile }) => (
  <header style={{
    height: mobile ? 60 : 68, flexShrink:0,
    background: v.bg,
    borderBottom: `1px solid ${v.border}`,
    display:'flex', alignItems:'center',
    padding: mobile ? '0 12px 0 16px' : '0 24px 0 32px',
    gap: mobile ? 4 : 6,
  }}>
    <VBrand v={v}/>

    <span style={{flex:1}}/>

    {/* Save — always present, icon-only. Anonymous saves to localStorage. */}
    <VBtn v={v} variant="ghost" icon={Icons.Save}
      ariaLabel={user === 'anonymous' ? 'Save scenario (kept on this device)' : 'Save scenario'}
      size={mobile ? 'sm' : 'md'}/>

    {user === 'registered' && (
      <VBtn v={v} variant="ghost" icon={Icons.Copy}
        ariaLabel="Clone calculator"
        size={mobile ? 'sm' : 'md'}/>
    )}

    {user === 'anonymous' ? (
      <React.Fragment>
        <span style={{width: mobile ? 6 : 10}}/>
        {!mobile && <VBtn v={v} variant="ghost">Log in</VBtn>}
        <VBtn v={v} variant="primary" size={mobile ? 'sm' : 'md'}>
          {mobile ? 'Sign up' : 'Sign up to save'}
        </VBtn>
      </React.Fragment>
    ) : (
      <React.Fragment>
        <span style={{width: mobile ? 6 : 10}}/>
        <VProfile v={v}/>
      </React.Fragment>
    )}
  </header>
);

// ─────────────────────────────────────────────────────────────────────────────
// Visitor footer — small, cream, "Powered by" line. Optional polish.
// ─────────────────────────────────────────────────────────────────────────────
const VisitorFooter = ({ v }) => (
  <div style={{
    padding:'24px 32px 36px',
    borderTop:`1px solid ${v.border}`,
    display:'flex', alignItems:'center', gap:10,
    background:v.bg, color: v.muted, fontSize:12, letterSpacing:-0.05,
  }}>
    <span>Built with</span>
    <VBrand v={v}/>
    <span style={{flex:1}}/>
    <span style={{color:v.subtle}}>v1 · Mortgage Calculator · published 4 days ago</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// VisitorView — wraps BuilderCanvas with interactive=false + cream header
// ─────────────────────────────────────────────────────────────────────────────
const VisitorView = ({ theme='light', user='anonymous', viewport='desktop' }) => {
  const v = visTheme[theme];
  const t = cgTokens[theme]; // still passed to canvas for token plumbing
  const mobile = viewport === 'mobile';

  return (
    <div style={{
      background: v.bg, color: v.text, width:'100%', height:'100%',
      fontFamily:'"Geist", -apple-system, system-ui, sans-serif',
      fontSize:14, letterSpacing:-0.05, display:'flex', flexDirection:'column',
      overflow:'hidden', WebkitFontSmoothing:'antialiased',
    }}>
      <VisitorHeader v={v} user={user} mobile={mobile}/>

      <div style={{flex:1, overflow:'auto', background: v.bg}}>
        <BuilderCanvas
          t={t} theme={theme}
          viewport={viewport}
          interactive={false}
        />
        <VisitorFooter v={v}/>
      </div>
    </div>
  );
};

Object.assign(window, { VisitorView, VisitorHeader });
