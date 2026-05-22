// Calcgrinder — shared app chrome
// Tokens, icons, avatar, common controls, top bars, avatar popover.
// Both Dashboard and Editor consume these via window globals.

const { useState: cgUseState } = React;

// ─────────────────────────────────────────────────────────────────────────────
// Tokens
// ─────────────────────────────────────────────────────────────────────────────
const cgTokens = {
  light: {
    bg:         '#FAFAF9',
    surface:    '#FFFFFF',
    surface2:   '#F5F5F4',
    surface3:   '#EFEDEB',
    border:     '#E7E5E4',
    borderStr:  '#D6D3D1',
    text:       '#1C1917',
    textMuted:  '#78716C',
    textSubtle: '#A8A29E',
    accent:     '#4F46E5',
    accentHov:  '#4338CA',
    accentSoft: '#EEF0FF',
    accentFg:   '#FFFFFF',
    accentText: '#3730A3',
    // Danger / destructive — used for SYSADMIN pill, password errors,
    // delete-account button, and Danger zone card outline.
    danger:       '#DC2626',
    dangerHov:    '#B91C1C',
    dangerFg:     '#FFFFFF',
    dangerSoft:   '#FEF2F2',
    dangerBorder: '#FECACA',
    dangerText:   '#991B1B',
    // Diff status tints — used by the import-preview NEW / REPLACED pills.
    // Kept desaturated so the neutral stone palette still dominates.
    newSoft:    '#E7F6EC',
    newText:    '#1B6B3A',
    newDot:     '#2F9E55',
    replSoft:   '#FBF1DC',
    replText:   '#92591B',
    replDot:    '#C68616',
    shadow:     '0 1px 2px rgba(28,25,23,0.04), 0 1px 1px rgba(28,25,23,0.03)',
    shadowMd:   '0 4px 12px rgba(28,25,23,0.06), 0 1px 3px rgba(28,25,23,0.04)',
    shadowLg:   '0 12px 32px rgba(28,25,23,0.10), 0 2px 8px rgba(28,25,23,0.06)',
  },
  dark: {
    bg:         '#0C0A09',
    surface:    '#161412',
    surface2:   '#1F1D1B',
    surface3:   '#2A2724',
    border:     '#292524',
    borderStr:  '#3C3835',
    text:       '#F5F5F4',
    textMuted:  '#A8A29E',
    textSubtle: '#78716C',
    accent:     '#818CF8',
    accentHov:  '#A5B4FC',
    accentSoft: 'rgba(129,140,248,0.12)',
    accentFg:   '#0C0A09',
    accentText: '#C7D2FE',
    danger:       '#DC2626',
    dangerHov:    '#B91C1C',
    dangerFg:     '#FFFFFF',
    dangerSoft:   'rgba(220,38,38,0.14)',
    dangerBorder: 'rgba(220,38,38,0.40)',
    dangerText:   '#FCA5A5',
    // Diff status tints — dark theme.
    newSoft:    'rgba(74,222,128,0.14)',
    newText:    '#86EFAC',
    newDot:     '#4ADE80',
    replSoft:   'rgba(245,158,11,0.16)',
    replText:   '#FCD34D',
    replDot:    '#F59E0B',
    shadow:     '0 1px 2px rgba(0,0,0,0.4)',
    shadowMd:   '0 4px 12px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)',
    shadowLg:   '0 12px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG at 1em, inherits currentColor)
// ─────────────────────────────────────────────────────────────────────────────
const cgIcon = ({ size = 16, stroke: sw = 1.75, color, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color || 'currentColor'} strokeWidth={sw} strokeLinecap="round"
    strokeLinejoin="round" {...rest}>
    {children}
  </svg>
);
const Icons = {
  Plus:     (p) => cgIcon({...p, children: <path d="M12 5v14M5 12h14"/>}),
  Minus:    (p) => cgIcon({...p, children: <path d="M5 12h14"/>}),
  ChevR:    (p) => cgIcon({...p, children: <path d="M9 6l6 6-6 6"/>}),
  ChevD:    (p) => cgIcon({...p, children: <path d="M6 9l6 6 6-6"/>}),
  ChevL:    (p) => cgIcon({...p, children: <path d="M15 6l-6 6 6 6"/>}),
  Sun:      (p) => cgIcon({...p, children: <React.Fragment><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></React.Fragment>}),
  Moon:     (p) => cgIcon({...p, children: <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>}),
  Monitor:  (p) => cgIcon({...p, children: <React.Fragment><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></React.Fragment>}),
  Settings: (p) => cgIcon({...p, children: <React.Fragment><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></React.Fragment>}),
  Logout:   (p) => cgIcon({...p, children: <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>}),
  Shield:   (p) => cgIcon({...p, children: <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/>}),
  Kebab:    (p) => cgIcon({...p, children: <React.Fragment><circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/></React.Fragment>}),
  Menu:     (p) => cgIcon({...p, children: <path d="M3 6h18M3 12h18M3 18h18"/>}),
  Calc:     (p) => cgIcon({...p, children: <React.Fragment><rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></React.Fragment>}),
  ArrowR:   (p) => cgIcon({...p, children: <path d="M5 12h14M13 5l7 7-7 7"/>}),
  Copy:     (p) => cgIcon({...p, children: <React.Fragment><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></React.Fragment>}),
  Sparkle:  (p) => cgIcon({...p, children: <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zM5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16z"/>}),
  LayoutGrid: (p) => cgIcon({...p, children: <React.Fragment>
    <rect x="3"  y="3"  width="7" height="7" rx="1.5" fill="currentColor" stroke="none"/>
    <rect x="14" y="3"  width="7" height="7" rx="1.5" fill="currentColor" stroke="none"/>
    <rect x="3"  y="14" width="7" height="7" rx="1.5" fill="currentColor" stroke="none"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" stroke="none"/>
  </React.Fragment>}),
  Empty:    (p) => cgIcon({...p, children: <React.Fragment><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M9 8h6M9 12h4"/></React.Fragment>}),
  // Editor-specific
  Grip:     (p) => cgIcon({...p, children: <React.Fragment><circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none"/></React.Fragment>}),
  Pencil:   (p) => cgIcon({...p, children: <React.Fragment><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></React.Fragment>}),
  External: (p) => cgIcon({...p, children: <React.Fragment><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6M10 14L21 3"/></React.Fragment>}),
  Eye:      (p) => cgIcon({...p, children: <React.Fragment><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></React.Fragment>}),
  EyeOff:   (p) => cgIcon({...p, children: <React.Fragment><path d="M17.94 17.94A10.94 10.94 0 0112 19c-7 0-11-7-11-7a17.7 17.7 0 014.06-4.94M9.9 5.07A10.94 10.94 0 0112 5c7 0 11 7 11 7a17.6 17.6 0 01-3.16 4.19M1 1l22 22M14.12 14.12A3 3 0 119.88 9.88"/></React.Fragment>}),
  Lock:     (p) => cgIcon({...p, children: <React.Fragment><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></React.Fragment>}),
  // Open padlock — outline, shackle unlatched on the right.
  LockOpen: (p) => cgIcon({...p, children: <React.Fragment><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 017.9-1"/></React.Fragment>}),
  // Filled closed padlock — solid body, outlined shackle. The locked-state
  // signal in the Visitor View's per-field lock toggle.
  LockFilled:(p) => cgIcon({...p, children: <React.Fragment><rect x="4" y="11" width="16" height="10" rx="2" fill="currentColor"/><path d="M8 11V7a4 4 0 018 0v4"/></React.Fragment>}),
  Refresh:  (p) => cgIcon({...p, children: <React.Fragment><path d="M3 12a9 9 0 0115.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-15.5 6.3L3 16"/><path d="M3 21v-5h5"/></React.Fragment>}),
  Phone:    (p) => cgIcon({...p, children: <React.Fragment><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></React.Fragment>}),
  Tablet:   (p) => cgIcon({...p, children: <React.Fragment><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 19h2"/></React.Fragment>}),
  Desktop:  (p) => cgIcon({...p, children: <React.Fragment><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></React.Fragment>}),
  ChartLine:(p) => cgIcon({...p, children: <React.Fragment><path d="M3 3v18h18"/><path d="M7 14l4-5 3 3 5-7"/></React.Fragment>}),
  ChartBar: (p) => cgIcon({...p, children: <React.Fragment><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="7"/><rect x="12" y="7" width="3" height="11"/><rect x="17" y="14" width="3" height="4"/></React.Fragment>}),
  ChartArea:(p) => cgIcon({...p, children: <React.Fragment><path d="M3 3v18h18"/><path d="M7 14l4-5 3 3 5-7v13H7z" fill="currentColor" fillOpacity="0.2" stroke="currentColor"/></React.Fragment>}),
  ChartPie: (p) => cgIcon({...p, children: <React.Fragment><path d="M21 12a9 9 0 11-9-9v9z"/></React.Fragment>}),
  Type:     (p) => cgIcon({...p, children: <path d="M4 7V5h16v2M9 19h6M12 5v14"/>}),
  Heading:  (p) => cgIcon({...p, children: <path d="M6 4v16M18 4v16M6 12h12"/>}),
  Hash:     (p) => cgIcon({...p, children: <path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>}),
  Dollar:   (p) => cgIcon({...p, children: <path d="M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H7"/>}),
  Percent:  (p) => cgIcon({...p, children: <React.Fragment><path d="M5 19L19 5"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></React.Fragment>}),
  Check:    (p) => cgIcon({...p, children: <path d="M20 6L9 17l-5-5"/>}),
  X:        (p) => cgIcon({...p, children: <path d="M18 6L6 18M6 6l12 12"/>}),
  Search:   (p) => cgIcon({...p, children: <React.Fragment><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></React.Fragment>}),
  Sliders:  (p) => cgIcon({...p, children: <path d="M4 21V14M4 10V3M12 21V12M12 8V3M20 21V16M20 12V3M1 14h6M9 8h6M17 16h6"/>}),
  Save:     (p) => cgIcon({...p, children: <React.Fragment><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></React.Fragment>}),
  Bookmark: (p) => cgIcon({...p, children: <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>}),
  // Magnifying-glass with X inside — "calculator not found" / 404 token
  NotFound: (p) => cgIcon({...p, children: <React.Fragment><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8.5 8.5l5 5M13.5 8.5l-5 5"/></React.Fragment>}),
  // Hourglass — "no longer available" / soft-deleted (410)
  Hourglass:(p) => cgIcon({...p, children: <React.Fragment><path d="M6 2h12M6 22h12"/><path d="M7 2v3a5 5 0 0010 0V2M7 22v-3a5 5 0 0110 0v3"/></React.Fragment>}),
  Trash:    (p) => cgIcon({...p, children: <React.Fragment><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></React.Fragment>}),
  // Triangle exclamation — paste-error glyph in the Import popover.
  Alert:    (p) => cgIcon({...p, children: <React.Fragment><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></React.Fragment>}),
};

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────
const cgAvatarHue = (str) => {
  let h = 0; for (let i=0;i<str.length;i++) h = (h*31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
};
const Avatar = ({ initials, size = 28, t }) => {
  const hue = cgAvatarHue(initials);
  const isDark = t.bg === cgTokens.dark.bg;
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      background:`oklch(${isDark?0.55:0.62} 0.13 ${hue})`,
      color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size*0.40, fontWeight:600, letterSpacing:0.2,
      boxShadow:`inset 0 0 0 1px rgba(255,255,255,0.15)`, flexShrink:0,
    }}>{initials}</div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Pill / Btn / IconBtn
// ─────────────────────────────────────────────────────────────────────────────
const Pill = ({ children, kind='draft', t, style }) => {
  const styles = {
    published: { bg:t.accentSoft, fg:t.accentText, dot:t.accent },
    draft:     { bg:t.surface3, fg:t.textMuted,    dot:t.textSubtle },
    input:     { bg:t.surface3, fg:t.textMuted,    dot:t.textSubtle },
    output:    { bg:t.accentSoft, fg:t.accentText, dot:t.accent },
    // Import-preview diff kinds.
    'new':     { bg:t.newSoft,   fg:t.newText,     dot:t.newDot },
    replaced:  { bg:t.replSoft,  fg:t.replText,    dot:t.replDot },
    unchanged: { bg:t.surface3,  fg:t.textMuted,   dot:t.textSubtle },
  }[kind];
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'1px 7px 1px 6px', borderRadius:999,
      fontSize:10.5, fontWeight:500, lineHeight:'15px',
      background:styles.bg, color:styles.fg, letterSpacing:0.1,
      textTransform:'uppercase', ...style,
    }}>
      <span style={{width:4, height:4, borderRadius:'50%', background:styles.dot}}/>
      {children}
    </span>
  );
};

const Btn = ({ variant='secondary', size='md', icon:I, children, t, style, ...rest }) => {
  const h = size==='sm' ? 28 : size==='lg' ? 40 : 32;
  const pad = size==='sm' ? '0 10px' : size==='lg' ? '0 16px' : '0 12px';
  const fs = size==='sm' ? 12 : 13;
  const variants = {
    primary:   { bg:t.accent, fg:t.accentFg, border:t.accent,    hover:t.accentHov },
    secondary: { bg:t.surface, fg:t.text,    border:t.borderStr, hover:t.surface2 },
    ghost:     { bg:'transparent', fg:t.text, border:'transparent', hover:t.surface2 },
    soft:      { bg:t.surface2, fg:t.text,    border:t.border,    hover:t.surface3 },
  };
  const v = variants[variant];
  return (
    <button {...rest} style={{
      height:h, padding:pad, borderRadius:6, fontSize:fs, fontWeight:500,
      letterSpacing:-0.05, lineHeight:1, fontFamily:'inherit',
      background:v.bg, color:v.fg, border:`1px solid ${v.border}`,
      display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer',
      whiteSpace:'nowrap', ...style,
    }}>
      {I && <I size={size==='sm'?13:14}/>}
      {children}
    </button>
  );
};

const IconBtn = ({ icon:I, t, size=14, ariaLabel, active, style, ...rest }) => (
  <button aria-label={ariaLabel} {...rest} style={{
    width:28, height:28, borderRadius:6,
    background: active ? t.surface2 : 'transparent',
    color: active ? t.text : t.textMuted,
    border:`1px solid ${active ? t.border : 'transparent'}`,
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    cursor:'pointer', flexShrink:0, fontFamily:'inherit', ...style,
  }}>
    <I size={size}/>
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// SysadminPill — small uppercase filled red pill. ~10px.
// Used next to the user's name on the dashboard welcome line and in the
// Settings → Profile → Role row. Visible to sysadmin users only.
// ─────────────────────────────────────────────────────────────────────────────
const SysadminPill = ({ t, style }) => (
  <span style={{
    display:'inline-flex', alignItems:'center',
    padding:'2px 7px', borderRadius:4,
    fontSize:10, fontWeight:700, lineHeight:'13px',
    background:t.danger, color:t.dangerFg,
    letterSpacing:0.7, textTransform:'uppercase',
    fontFamily:'"Geist Mono", monospace',
    verticalAlign:'middle',
    ...style,
  }}>SYSADMIN</span>
);

// ─────────────────────────────────────────────────────────────────────────────
// Wordmark
// ─────────────────────────────────────────────────────────────────────────────
const Wordmark = ({ t, mini=false }) => (
  <div style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
    <div style={{
      width: mini?18:22, height: mini?18:22, borderRadius: mini?4:5, background:t.text,
      color:t.surface, display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'"Geist Mono", monospace', fontSize: mini?11:13, fontWeight:600,
    }}>c</div>
    {!mini && <span style={{fontSize:14, fontWeight:600, letterSpacing:-0.2, color:t.text}}>Calcgrinder</span>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Top bar — desktop. Tabs are configurable so the editor can show a breadcrumb.
// ─────────────────────────────────────────────────────────────────────────────
const TopBarDesktop = ({
  t,
  tabs = [{ label:'Dashboard', active:true }],
  rightExtras,
  popoverOpen,
  onAvatar,
}) => (
  <header style={{
    height:48, borderBottom:`1px solid ${t.border}`, background:t.surface,
    display:'flex', alignItems:'center', padding:'0 16px', gap:16, position:'relative',
    flexShrink:0,
  }}>
    <Wordmark t={t}/>

    <div style={{width:1, height:18, background:t.border, margin:'0 4px'}}/>

    <nav style={{display:'flex', alignItems:'center', gap:2, minWidth:0}}>
      {tabs.map((tab, i) => (
        <React.Fragment key={i}>
          {i>0 && <span style={{color:t.textSubtle, fontSize:13, padding:'0 2px'}}>/</span>}
          <button style={{
            height:30, padding:'0 10px', border:'none', cursor:'pointer',
            background: tab.active ? t.surface2 : 'transparent',
            color: tab.active ? t.text : t.textMuted,
            fontSize:13, fontWeight:500, fontFamily:'inherit', borderRadius:6,
            letterSpacing:-0.1, maxWidth:280, overflow:'hidden',
            textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>{tab.label}</button>
        </React.Fragment>
      ))}
    </nav>

    <div style={{flex:1}}/>

    {rightExtras}

    <Btn variant="secondary" size="sm" icon={Icons.Plus} t={t}>New calculator</Btn>
    <button onClick={onAvatar} style={{
      border:'none', background:'transparent', padding:0, cursor:'pointer',
      borderRadius:'50%', outline: popoverOpen ? `2px solid ${t.accent}` : 'none',
      outlineOffset:2,
    }}>
      <Avatar initials="AT" t={t}/>
    </button>

    {popoverOpen && <AvatarPopover t={t}/>}
  </header>
);

// ─────────────────────────────────────────────────────────────────────────────
// Avatar popover
// ─────────────────────────────────────────────────────────────────────────────
const AvatarPopover = ({ t, isAdmin = true }) => {
  const [theme, setTheme] = cgUseState('System');
  const itemRow = {
    display:'flex', alignItems:'center', gap:10, padding:'0 10px',
    height:36, borderRadius:6, color:t.text, fontSize:13, fontWeight:500,
    cursor:'pointer', userSelect:'none', letterSpacing:-0.05,
  };
  return (
    <div style={{
      position:'absolute', right:12, top:'calc(100% + 6px)', width:264,
      background:t.surface, border:`1px solid ${t.border}`, borderRadius:10,
      boxShadow:t.shadowLg, padding:6, zIndex:30, color:t.text,
    }}>
      <div style={{display:'flex', gap:10, alignItems:'center', padding:'10px 8px 12px'}}>
        <Avatar initials="AT" size={36} t={t}/>
        <div style={{minWidth:0}}>
          <div style={{fontSize:13, fontWeight:600, color:t.text, lineHeight:1.3}}>Ada Thornton</div>
          <div style={{
            fontSize:12, color:t.textMuted, lineHeight:1.3,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200,
          }}>ada.thornton@calcgrinder.app</div>
        </div>
      </div>
      <div style={{height:1, background:t.border, margin:'0 2px 6px'}}/>
      <div style={{padding:'4px 8px 6px', fontSize:11, fontWeight:500, color:t.textSubtle, letterSpacing:0.4, textTransform:'uppercase'}}>Theme</div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, padding:'0 4px 8px'}}>
        {[{k:'Light',I:Icons.Sun},{k:'Dark',I:Icons.Moon},{k:'System',I:Icons.Monitor}].map(({k,I}) => {
          const active = theme===k;
          return (
            <button key={k} onClick={()=>setTheme(k)} style={{
              height:40, borderRadius:6, cursor:'pointer', fontFamily:'inherit',
              border:`1px solid ${active ? t.accent : t.border}`,
              background: active ? t.accentSoft : t.surface,
              color: active ? t.accentText : t.text,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              gap:3, fontSize:11, fontWeight:500,
            }}>
              <I size={14}/><span>{k}</span>
            </button>
          );
        })}
      </div>
      <div style={{height:1, background:t.border, margin:'2px 2px 6px'}}/>
      {isAdmin && (
        <div style={itemRow}>
          <Icons.Shield size={14}/><span style={{flex:1}}>Admin</span>
          <span style={{
            fontSize:10, color:t.textSubtle, fontFamily:'"Geist Mono", monospace',
            padding:'2px 6px', border:`1px solid ${t.border}`, borderRadius:4,
          }}>sysadmin</span>
        </div>
      )}
      <div style={itemRow}><Icons.Settings size={14}/><span style={{flex:1}}>Settings</span></div>
      <div style={{height:1, background:t.border, margin:'6px 2px'}}/>
      <div style={{...itemRow, color:t.textMuted}}><Icons.Logout size={14}/><span style={{flex:1}}>Sign out</span></div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Mobile top bar (Dashboard variant — no segmented toggle)
// Editor mobile passes a custom `center` slot.
// ─────────────────────────────────────────────────────────────────────────────
const TopBarMobile = ({ t, center }) => (
  <header style={{
    height:48, borderBottom:`1px solid ${t.border}`, background:t.surface,
    display:'flex', alignItems:'center', padding:'0 12px', gap:8, flexShrink:0,
  }}>
    <button style={{
      width:36, height:36, borderRadius:6, background:'transparent', border:'none',
      color:t.text, display:'inline-flex', alignItems:'center', justifyContent:'center',
      cursor:'pointer', margin:'0 -8px 0 -6px',
    }}><Icons.Menu size={18}/></button>
    <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, minWidth:0}}>
      {center || <React.Fragment><Wordmark t={t} mini/><span style={{fontSize:14, fontWeight:600, letterSpacing:-0.2, color:t.text}}>Calcgrinder</span></React.Fragment>}
    </div>
    <Avatar initials="AT" t={t}/>
  </header>
);

Object.assign(window, {
  cgTokens, Icons, Avatar, Pill, Btn, IconBtn, Wordmark, SysadminPill,
  TopBarDesktop, TopBarMobile, AvatarPopover,
});
