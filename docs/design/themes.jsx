// Calcgrinder — Themes (visitor-view variants)
// One generic <ThemedCalculator/> renderer driven by per-theme tokens.
// All 6 themes show the SAME mortgage calculator at the SAME data.
//
// Layouts: '2col' | '3col' | 'mobile'  (mobile is always single column.)
//
// To add a theme, drop a new entry into THEMES below; the renderer is
// theme-agnostic apart from a small dispatch on `cardStyle`.

// ─────────────────────────────────────────────────────────────────────────────
// Calculator data (identical for every theme)
// ─────────────────────────────────────────────────────────────────────────────
const calcData = {
  price:        { raw: 450000, fmt: '$450,000' },
  downPct:      20,
  rate:         5.85,
  termYears:    30,
  downAmount:   '$90,000',
  monthly:      '$2,653.71',
  totalInt:     '$595,335',
  totalCost:    '$1,045,335',
};

const chartData = [
  { y: 0,  interest: 2160, principal: 493 },
  { y: 5,  interest: 1950, principal: 703 },
  { y: 10, interest: 1670, principal: 983 },
  { y: 15, interest: 1290, principal: 1363 },
  { y: 20, interest: 815,  principal: 1838 },
  { y: 25, interest: 190,  principal: 2463 },
  { y: 30, interest: 10,   principal: 2643 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Theme palettes & layout rules
//   cardStyle:   'flat' | 'glow' | 'tinted' | 'terminal'
//   uppercase:   apply text-transform:uppercase to all labels (Terminal)
//   monoEverything: use mono for all type (Terminal)
// ─────────────────────────────────────────────────────────────────────────────
const THEMES = {
  editorial: {
    label: 'Editorial · Cream',
    sub:   'Warm cream + ink. Editorial rhythm, generous whitespace.',
    font:    '"Geist", -apple-system, system-ui, sans-serif',
    fontMono:'"Geist Mono", monospace',
    bg: '#F4F1EC', surface: '#F4F1EC',
    card: '#FFFFFF', cardAlt: '#F8F5F0',
    border: '#E5E2DC', borderStr: '#D2CEC6',
    rule: '#EAE6DF',
    ink: '#16140F', text: '#1F1C16', muted: '#6F6A60', subtle: '#9A958A',
    accent: '#16140F',  accentFg: '#F4F1EC', accentSoft: 'rgba(22,20,15,0.06)',
    chartA: '#16140F', chartB: '#B79E70', chartGrid: '#E9E4DC',
    cardStyle: 'flat',
    radius: 10, fieldRadius: 7, padding: 20,
    cardShadow: '0 1px 2px rgba(0,0,0,0.03)',
    cols2: '1fr 1.3fr', cols3: '1fr 1fr 1.55fr',
    headerH: 68,
    titleLabel: 'MORTGAGE',
    title: 'What can you afford?',
    subtitle: 'Enter the price, deposit, and rate. We work out the monthly cost and the total you pay across the life of the loan.',
    cardTints: null,
  },

  calcgrinder: {
    label: 'Calcgrinder · Light',
    sub:   'Inspired by the app. Stone neutrals + indigo accent.',
    font:    '"Geist", -apple-system, system-ui, sans-serif',
    fontMono:'"Geist Mono", monospace',
    bg: '#FAFAF9', surface: '#FAFAF9',
    card: '#FFFFFF', cardAlt: '#F5F5F4',
    border: '#E7E5E4', borderStr: '#D6D3D1',
    rule: '#EFEDEB',
    ink: '#1C1917', text: '#1C1917', muted: '#78716C', subtle: '#A8A29E',
    accent: '#4F46E5', accentFg: '#FFFFFF', accentSoft: '#EEF0FF',
    chartA: '#1C1917', chartB: '#4F46E5', chartGrid: '#EFEDEB',
    cardStyle: 'flat',
    radius: 8, fieldRadius: 6, padding: 18,
    cardShadow: '0 1px 2px rgba(28,25,23,0.04), 0 1px 1px rgba(28,25,23,0.03)',
    cols2: '1fr 1.2fr', cols3: '1fr 1fr 1.45fr',
    headerH: 62,
    titleLabel: 'Mortgage',
    title: 'Mortgage Calculator',
    subtitle: 'Find your monthly cost and the lifetime total.',
    cardTints: null,
  },

  calcgrinderCI: {
    label: 'Calcgrinder · CI',
    sub:   'Corporate identity. Wordmark, icons and charts in brand indigo.',
    font:    '"Geist", -apple-system, system-ui, sans-serif',
    fontMono:'"Geist Mono", monospace',
    bg: '#FAFAF9', surface: '#FAFAF9',
    card: '#FFFFFF', cardAlt: '#F5F5F4',
    border: '#E7E5E4', borderStr: '#D6D3D1',
    rule: '#EFEDEB',
    ink: '#1C1917', text: '#1C1917', muted: '#78716C', subtle: '#A8A29E',
    accent: '#4F46E5', accentFg: '#FFFFFF', accentSoft: '#EEF0FF',
    brandColor: '#4F46E5',
    chartA: '#4F46E5', chartB: '#A5B4FC', chartGrid: '#EFEDEB',
    cardStyle: 'flat',
    radius: 8, fieldRadius: 6, padding: 18,
    cardShadow: '0 1px 2px rgba(28,25,23,0.04), 0 1px 1px rgba(28,25,23,0.03)',
    cols2: '1fr 1.2fr', cols3: '1fr 1fr 1.45fr',
    headerH: 62,
    titleLabel: 'Mortgage',
    title: 'Mortgage Calculator',
    subtitle: 'Calcgrinder design system. Charts and accents in brand indigo.',
    cardTints: null,
  },

  minimal: {
    label: 'Minimal · Linear',
    sub:   'Clean modern. Hairline borders, no shadows, tight rhythm.',
    font:    '"Geist", "Inter", -apple-system, system-ui, sans-serif',
    fontMono:'"Geist Mono", "SF Mono", monospace',
    bg: '#FFFFFF', surface: '#FFFFFF',
    card: '#FFFFFF', cardAlt: '#FAFAFA',
    border: '#EEEEEE', borderStr: '#D4D4D4',
    rule: '#F0F0F0',
    ink: '#0A0A0A', text: '#0A0A0A', muted: '#737373', subtle: '#A3A3A3',
    accent: '#5E6AD2', accentFg: '#FFFFFF', accentSoft: 'rgba(94,106,210,0.10)',
    chartA: '#0A0A0A', chartB: '#5E6AD2', chartGrid: '#F0F0F0',
    cardStyle: 'flat',
    radius: 8, fieldRadius: 6, padding: 24,
    cardShadow: 'none',
    cols2: '1fr 1.1fr', cols3: '1fr 1.05fr 1.6fr',
    headerH: 56,
    titleLabel: 'mortgage',
    title: 'Mortgage',
    subtitle: 'What does this loan actually cost.',
    cardTints: null,
  },

  bento: {
    label: 'Bento · Vibrant',
    sub:   'Vercel + Apple. Big rounded tiles, contrasting tints, no borders.',
    font:    '"Geist", -apple-system, system-ui, sans-serif',
    fontMono:'"Geist Mono", monospace',
    bg: '#F1ECDF', surface: '#F1ECDF',
    card: '#FFF8E7',
    cardAlt: 'rgba(0,0,0,0.04)',
    border: 'transparent', borderStr: 'rgba(0,0,0,0.06)',
    rule: 'rgba(0,0,0,0.06)',
    ink: '#1A1A2E', text: '#1A1A2E', muted: 'rgba(26,26,46,0.65)', subtle: 'rgba(26,26,46,0.45)',
    accent: '#3623A5', accentFg: '#FFF8E7', accentSoft: 'rgba(54,35,165,0.10)',
    chartA: '#1A1A2E', chartB: '#FF7A5A', chartGrid: 'rgba(0,0,0,0.08)',
    cardStyle: 'tinted',
    radius: 22, fieldRadius: 14, padding: 24,
    cardShadow: '0 1px 0 rgba(255,255,255,0.5) inset, 0 6px 18px rgba(26,26,46,0.06)',
    cols2: '1fr 1.4fr', cols3: '1fr 1.1fr 1.6fr',
    headerH: 72,
    titleLabel: 'mortgage',
    title: 'What can you afford?',
    subtitle: 'Tap in the loan details. Everything updates as you go.',
    cardTints: {
      inputs:  '#FFE2A3',   // peach
      results: '#C8D8F5',   // sky
      chart:   '#DDD0F5',   // lavender
      hero:    '#1A1A2E',   // ink (inverted)
      heroFg:  '#FFF8E7',
    },
  },

  bentoGlassy: {
    label: 'Bento · Glassy',
    sub:   'Glass tiles over a soft pastel wash. Backdrop blur, calm accents.',
    font:    '"Geist", -apple-system, system-ui, sans-serif',
    fontMono:'"Geist Mono", monospace',
    bg: 'linear-gradient(135deg, #EDE6F8 0%, #FCE3D4 50%, #D6E6F8 100%)',
    surface: 'transparent',
    card: 'rgba(255,255,255,0.55)',
    cardAlt: 'rgba(255,255,255,0.40)',
    border: 'rgba(255,255,255,0.50)',
    borderStr: 'rgba(255,255,255,0.70)',
    rule: 'rgba(26,26,46,0.08)',
    ink: '#1A1A2E', text: '#1A1A2E',
    muted: 'rgba(26,26,46,0.65)', subtle: 'rgba(26,26,46,0.42)',
    accent: '#5B6CBA', accentFg: '#FFFFFF',
    accentSoft: 'rgba(91,108,186,0.14)',
    chartA: '#1A1A2E', chartB: '#5B6CBA', chartGrid: 'rgba(26,26,46,0.08)',
    cardStyle: 'glass',
    radius: 20, fieldRadius: 12, padding: 24,
    cardShadow: '0 8px 32px rgba(26,26,46,0.10), inset 0 1px 0 rgba(255,255,255,0.7)',
    cols2: '1fr 1.3fr', cols3: '1fr 1fr 1.55fr',
    headerH: 72,
    titleLabel: 'mortgage',
    title: 'What can you afford?',
    subtitle: 'A calmer canvas. Tap the numbers in; the glass softens the rest.',
    cardTints: {
      inputs:  'rgba(252,227,212,0.50)',
      results: 'rgba(214,230,248,0.50)',
      chart:   'rgba(237,230,248,0.50)',
      hero:    'rgba(26,26,46,0.78)',
      heroFg:  '#FFFFFF',
    },
  },

  vessel: {
    label: 'Vessel',
    sub:   'Dark deep · neon green accent. Subtle glow on card edges.',
    font:    '"Geist", -apple-system, system-ui, sans-serif',
    fontMono:'"Geist Mono", monospace',
    bg: '#0A0A0A', surface: '#0A0A0A',
    card: '#0F0F0F', cardAlt: '#171717',
    border: '#1F1F1F', borderStr: '#2A2A2A',
    rule: '#1A1A1A',
    ink: '#FAFAFA', text: '#EDEDED', muted: '#8A8A8A', subtle: '#555555',
    accent: '#00DC82', accentFg: '#0A0A0A', accentSoft: 'rgba(0,220,130,0.12)',
    chartA: '#FAFAFA', chartB: '#00DC82', chartGrid: '#1A1A1A',
    cardStyle: 'glow',
    radius: 14, fieldRadius: 8, padding: 22,
    cardShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 0 32px rgba(0,220,130,0.05), 0 12px 40px rgba(0,0,0,0.5)',
    cols2: '1fr 1.2fr', cols3: '1fr 1fr 1.5fr',
    headerH: 64,
    titleLabel: 'MORTGAGE',
    title: 'What can you afford?',
    subtitle: 'Real numbers. Live calculation. No fluff.',
    cardTints: null,
  },

  terminal: {
    label: 'Terminal · Cyber',
    sub:   'Dark canvas with retro mono. Vercel-influenced surfaces, terminal flavor.',
    font:    '"Geist Mono", "SF Mono", monospace',
    fontMono:'"Geist Mono", monospace',
    bg: '#0A0A0A', surface: '#0A0A0A',
    card: '#0F0F0F', cardAlt: '#161616',
    border: '#1F1F1F', borderStr: '#2A2A2A',
    rule: '#1A1A1A',
    ink: '#E8E8E8', text: '#D4D4D4', muted: '#8A8A8A', subtle: '#5A5A5A',
    accent: '#4ADE80', accentFg: '#0A0A0A',
    accentSoft: 'rgba(74,222,128,0.14)',
    glowRgba: '74,222,128',
    chartA: '#E8E8E8', chartB: '#4ADE80', chartGrid: '#171717',
    cardStyle: 'glow',
    radius: 8, fieldRadius: 6, padding: 22,
    cardShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 0 24px rgba(74,222,128,0.06), 0 12px 40px rgba(0,0,0,0.4)',
    cols2: '1fr 1.2fr', cols3: '1fr 1fr 1.5fr',
    headerH: 60,
    titleLabel: '$ mortgage',
    title: 'What can you afford?',
    subtitle: 'Real numbers. Live calculation. Type and watch.',
    cardTints: null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
const cardSurface = (th, kind='generic') => {
  if (th.cardStyle === 'terminal') {
    return {
      background: th.card,
      border: `1px solid ${th.border}`,
      borderRadius: 0,
      boxShadow: 'none',
    };
  }
  if (th.cardStyle === 'glass') {
    const tint = th.cardTints && th.cardTints[kind];
    return {
      background: tint || th.card,
      border: `1px solid ${th.borderStr}`,
      borderRadius: th.radius,
      boxShadow: th.cardShadow,
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
    };
  }
  if (th.cardStyle === 'tinted' && th.cardTints && th.cardTints[kind]) {
    return {
      background: th.cardTints[kind],
      border: 'none',
      borderRadius: th.radius,
      boxShadow: th.cardShadow,
    };
  }
  if (th.cardStyle === 'glow') {
    return {
      background: th.card,
      border:`1px solid ${th.border}`,
      borderRadius: th.radius,
      boxShadow: th.cardShadow,
    };
  }
  return {
    background: th.card,
    border:`1px solid ${th.border}`,
    borderRadius: th.radius,
    boxShadow: th.cardShadow,
  };
};

const labelTextStyle = (th, color) => ({
  fontSize: th.cardStyle === 'terminal' ? 11 : 11,
  fontWeight: 600,
  color: color || th.muted,
  letterSpacing: th.uppercase ? 1.2 : 0.6,
  textTransform: 'uppercase',
  fontFamily: th.cardStyle === 'terminal' ? th.fontMono : 'inherit',
});

const numberStyle = (th, size) => ({
  fontFamily: th.fontMono,
  fontSize: size,
  fontWeight: th.monoEverything ? 500 : 600,
  color: th.ink,
  letterSpacing: size > 30 ? -1.2 : (size > 20 ? -0.5 : -0.3),
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
});

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────
const ThBrand = ({ th }) => {
  const brand = th.brandColor || th.ink;
  return (
    <div style={{display:'flex', alignItems:'center', gap:10}}>
      <div style={{
        width: 26, height: 26, borderRadius: th.radius >= 8 ? 6 : 0,
        background: th.cardStyle === 'terminal' ? 'transparent' : brand,
        color: th.cardStyle === 'terminal' ? brand : (th.accentFg || th.bg),
        border: th.cardStyle === 'terminal' ? `1px solid ${brand}` : 'none',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily: th.fontMono, fontSize:15, fontWeight:600, letterSpacing:-0.5,
      }}>c</div>
      <span style={{
        fontSize: 15, fontWeight: 600, letterSpacing: th.uppercase ? 0.5 : -0.3,
        color: brand,
        fontFamily: th.monoEverything ? th.fontMono : 'inherit',
        textTransform: th.uppercase ? 'uppercase' : 'none',
      }}>
        {th.monoEverything ? 'CALCGRINDER' : 'Calcgrinder'}
      </span>
    </div>
  );
};

const ThIconBtn = ({ th, I, ariaLabel }) => {
  const brand = th.brandColor || th.ink;
  return (
    <button aria-label={ariaLabel} style={{
      width:38, height:38, borderRadius: th.radius >= 8 ? '50%' : 0,
      border:'1px solid transparent',
      background:'transparent', color: brand, cursor:'pointer',
      display:'inline-flex', alignItems:'center', justifyContent:'center',
    }}>
      <I size={19} color={brand}/>
    </button>
  );
};

const ThPrimaryBtn = ({ th, children, size='md' }) => (
  <button style={{
    height: size==='sm' ? 32 : 38,
    padding: '0 16px',
    borderRadius: th.cardStyle === 'terminal' ? 0 : 8,
    fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit',
    letterSpacing: th.uppercase ? 0.6 : -0.1,
    background: th.accent, color: th.accentFg,
    border:`1px solid ${th.accent}`,
    cursor:'pointer', whiteSpace:'nowrap',
    textTransform: th.uppercase ? 'uppercase' : 'none',
    boxShadow: th.cardStyle === 'glow'
      ? `0 0 0 1px ${th.accent} inset, 0 0 24px ${th.accent}55, 0 4px 12px ${th.accent}33`
      : (th.cardStyle === 'terminal' ? 'none' : '0 1px 2px rgba(0,0,0,0.06)'),
    fontFamily: th.monoEverything ? th.fontMono : 'inherit',
  }}>{children}</button>
);

const ThProfile = ({ th }) => (
  <button style={{
    width:36, height:36, borderRadius: th.cardStyle === 'terminal' ? 0 : '50%',
    background: th.card, border:`1px solid ${th.borderStr}`,
    padding:0, cursor:'pointer', color: th.ink,
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    fontFamily: th.monoEverything ? th.fontMono : 'inherit',
    fontSize:12.5, fontWeight:600, letterSpacing:0.2,
  }}>AT</button>
);

const ThHeader = ({ th, user='registered', viewport='desktop' }) => {
  const mobile = viewport === 'mobile';
  return (
    <header style={{
      height: mobile ? Math.min(60, th.headerH) : th.headerH, flexShrink:0,
      background: th.bg, color: th.ink,
      borderBottom: `1px solid ${th.border === 'transparent' ? th.rule : th.border}`,
      display:'flex', alignItems:'center',
      padding: mobile ? '0 12px' : '0 28px',
      gap: mobile ? 4 : 6,
    }}>
      <ThBrand th={th}/>
      <span style={{flex:1}}/>
      <ThIconBtn th={th} I={Icons.Save} ariaLabel="Save"/>
      {user === 'registered' && <ThIconBtn th={th} I={Icons.Copy} ariaLabel="Clone"/>}
      <span style={{width: mobile ? 4 : 8}}/>
      {user === 'anonymous' ? (
        <ThPrimaryBtn th={th} size={mobile ? 'sm' : 'md'}>
          {mobile ? (th.monoEverything ? 'SIGNUP' : 'Sign up') : (th.monoEverything ? 'SIGN UP TO SAVE' : 'Sign up to save')}
        </ThPrimaryBtn>
      ) : (
        <ThProfile th={th}/>
      )}
    </header>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Field controls
// ─────────────────────────────────────────────────────────────────────────────
const ThLabel = ({ th, hint, children, fg }) => (
  <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:8}}>
    <span style={labelTextStyle(th, fg)}>{children}</span>
    {hint && (
      <span style={{fontSize:11, color: fg ? `${fg}99` : th.subtle,
        fontFamily: th.cardStyle === 'terminal' ? th.fontMono : 'inherit'}}>
        {hint}
      </span>
    )}
  </div>
);

const ThFieldBox = ({ th, fg, children, style }) => (
  <div style={{
    display:'flex', alignItems:'center', gap:0,
    height: 44, padding:'0 14px',
    background: th.cardStyle === 'terminal' ? 'transparent' : (th.cardAlt || 'rgba(0,0,0,0.04)'),
    border: `1px ${th.cardStyle === 'terminal' ? 'dashed' : 'solid'} ${th.cardStyle === 'terminal' ? th.rule : (th.borderStr || th.border)}`,
    borderRadius: th.fieldRadius,
    color: fg || th.ink,
    ...style,
  }}>{children}</div>
);

const ThCurrency = ({ th, value, label, hint, fg }) => (
  <React.Fragment>
    <ThLabel th={th} hint={hint} fg={fg}>{label}</ThLabel>
    <ThFieldBox th={th} fg={fg}>
      <span style={{fontFamily:th.fontMono, fontSize:15, color: fg ? `${fg}99` : th.muted, marginRight:6}}>$</span>
      <span style={{flex:1, ...numberStyle(th, 18), color: fg || th.ink}}>{value}</span>
    </ThFieldBox>
  </React.Fragment>
);

const ThPercentField = ({ th, value, label, hint, fg }) => (
  <React.Fragment>
    <ThLabel th={th} hint={hint} fg={fg}>{label}</ThLabel>
    <ThFieldBox th={th} fg={fg}>
      <span style={{flex:1, ...numberStyle(th, 18), color: fg || th.ink}}>{value}</span>
      <span style={{fontFamily:th.fontMono, fontSize:14, color: fg ? `${fg}99` : th.muted}}>%</span>
    </ThFieldBox>
  </React.Fragment>
);

const ThNumberField = ({ th, value, suffix, label, hint, fg }) => (
  <React.Fragment>
    <ThLabel th={th} hint={hint} fg={fg}>{label}</ThLabel>
    <ThFieldBox th={th} fg={fg}>
      <span style={{flex:1, ...numberStyle(th, 18), color: fg || th.ink}}>{value}</span>
      {suffix && <span style={{fontFamily:th.fontMono, fontSize:13, color: fg ? `${fg}99` : th.muted}}>{suffix}</span>}
    </ThFieldBox>
  </React.Fragment>
);

const ThSlider = ({ th, pct=20, label, hint, range=[0,50], fg }) => {
  const isCyber = th.label && th.label.includes('Cyber');
  const fillColor  = isCyber ? th.accent : (fg || th.ink);
  const thumbColor = isCyber ? th.accent : (fg || th.ink);
  const trackBg = th.cardStyle === 'terminal' ? 'transparent' : (th.cardAlt || 'rgba(0,0,0,0.06)');
  const trackBorder = th.cardStyle === 'terminal' ? `1px dashed ${th.rule}` : `1px solid ${th.border === 'transparent' ? 'rgba(0,0,0,0.08)' : th.border}`;
  const percent = (pct - range[0]) / (range[1] - range[0]) * 100;
  return (
    <React.Fragment>
      <ThLabel th={th} hint={hint} fg={fg}>{label}</ThLabel>
      <div style={{display:'flex', alignItems:'baseline', gap:6, marginBottom:12}}>
        <span style={{...numberStyle(th, 28), color: isCyber ? th.accent : (fg || th.ink)}}>{pct}</span>
        <span style={{fontSize:14, color: fg ? `${fg}99` : th.muted, fontWeight:500}}>%</span>
      </div>
      <div style={{
        position:'relative', height:6, background:trackBg, borderRadius: th.fieldRadius >= 6 ? 3 : 0,
        border: trackBorder,
      }}>
        <div style={{
          position:'absolute', top:-1, left:0, height:6,
          width:`${percent}%`, borderRadius: th.fieldRadius >= 6 ? 3 : 0, background: fillColor,
        }}/>
        <div style={{
          position:'absolute', top:-5, left:`calc(${percent}% - 7px)`,
          width:14, height:14, borderRadius: th.fieldRadius >= 6 ? '50%' : 0,
          background: th.card === '#0C0C0C' ? thumbColor : (fg ? fg : th.card),
          border:`2px solid ${thumbColor}`,
          boxShadow:'0 1px 2px rgba(0,0,0,0.1)',
        }}/>
      </div>
      <div style={{display:'flex', justifyContent:'space-between', marginTop:6,
        fontSize:10.5, color: fg ? `${fg}88` : th.subtle, fontFamily:th.fontMono}}>
        <span>{range[0]}%</span><span>{range[1]}%</span>
      </div>
    </React.Fragment>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sections — Inputs / Results / Chart
// ─────────────────────────────────────────────────────────────────────────────
const ThSectionCard = ({ th, kind, children, headerLabel, headerSub, fg }) => {
  const surface = cardSurface(th, kind);
  // For tinted Bento + hero kind, swap text color
  const localFg = fg;
  return (
    <div style={{...surface, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      {headerLabel && (
        <div style={{
          padding:'14px 20px 14px',
          borderBottom: `1px solid ${th.cardStyle === 'tinted' ? 'rgba(0,0,0,0.06)' : th.rule}`,
          display:'flex', alignItems:'baseline', gap:10,
        }}>
          <span style={labelTextStyle(th, localFg)}>{headerLabel}</span>
          {headerSub && (
            <span style={{fontSize:12, color: localFg ? `${localFg}99` : th.subtle, fontWeight:400, letterSpacing:-0.05,
              fontFamily: th.monoEverything ? th.fontMono : 'inherit'}}>
              {headerSub}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

const ThRow = ({ th, children, last, kind, dark }) => (
  <div style={{
    padding:`16px ${th.padding}px 16px`,
    borderBottom: last ? 'none' : `1px solid ${th.cardStyle === 'tinted' ? 'rgba(0,0,0,0.06)' : th.rule}`,
  }}>{children}</div>
);

const ThInputs = ({ th, fg }) => (
  <ThSectionCard th={th} kind="inputs" headerLabel={th.monoEverything ? 'LOAN.INPUTS' : 'Loan inputs'} fg={fg}>
    <ThRow th={th}>
      <ThCurrency th={th} fg={fg} value="450,000" label={th.monoEverything ? 'PURCHASE PRICE' : 'Purchase price'}/>
    </ThRow>
    <ThRow th={th}>
      <ThSlider th={th} fg={fg} pct={calcData.downPct}
        label={th.monoEverything ? 'DOWN PAYMENT' : 'Down payment'}
        hint={th.monoEverything ? '// % of price' : 'of price'}/>
    </ThRow>
    <ThRow th={th}>
      <ThPercentField th={th} fg={fg} value="5.85"
        label={th.monoEverything ? 'INTEREST RATE' : 'Interest rate'}
        hint={th.monoEverything ? '// APR fixed' : 'APR · fixed'}/>
    </ThRow>
    <ThRow th={th} last>
      <ThNumberField th={th} fg={fg} value="30" suffix={th.monoEverything ? 'YR' : 'years'}
        label={th.monoEverything ? 'TERM' : 'Term'}/>
    </ThRow>
  </ThSectionCard>
);

const ThHero = ({ th, fg, big=true }) => {
  const isCyber = th.label && th.label.includes('Cyber');
  const valueColor = isCyber ? th.accent : (fg || th.ink);
  return (
  <div>
    <ThLabel th={th} fg={fg}>{th.monoEverything ? 'MONTHLY PAYMENT' : 'Monthly payment'}</ThLabel>
    <div style={{display:'flex', alignItems:'baseline', gap:4, marginTop:-2}}>
      <span style={{...numberStyle(th, big?46:36), color: valueColor}}>
        {th.monoEverything ? '$2,653.71' : calcData.monthly}
      </span>
      <span style={{fontSize:18, color: fg ? `${fg}99` : th.muted, fontWeight:500, marginLeft:2,
        fontFamily: th.monoEverything ? th.fontMono : 'inherit'}}>/mo</span>
    </div>
    <div style={{
      marginTop:14, paddingTop:12, borderTop:`1px solid ${th.cardStyle === 'tinted' ? 'rgba(0,0,0,0.08)' : th.rule}`,
      fontSize:12, color: fg ? `${fg}cc` : th.muted, lineHeight:1.5,
      fontFamily: th.monoEverything ? th.fontMono : 'inherit',
    }}>
      {th.monoEverything
        ? '// principal + interest only. taxes/PMI not included.'
        : 'Principal + interest only. Taxes, insurance, and PMI not included.'}
    </div>
  </div>
  );
};

const ThStat = ({ th, label, value, fg }) => (
  <div>
    <ThLabel th={th} fg={fg}>{label}</ThLabel>
    <div style={{...numberStyle(th, 24), color: fg || th.ink, marginTop:-2}}>{value}</div>
  </div>
);

const ThResults = ({ th, layout='2col' }) => {
  // For Bento, the hero card is inverted (ink bg, cream text)
  const heroIsInverted = (th.cardStyle === 'tinted' || th.cardStyle === 'glass') && th.cardTints && th.cardTints.hero;
  const heroFg = heroIsInverted ? th.cardTints.heroFg : undefined;
  const statsFg = undefined;

  if (heroIsInverted) {
    // Two stacked cards for Bento: hero (ink) + stats (sky)
    return (
      <div style={{display:'flex', flexDirection:'column', gap:16}}>
        <div style={{
          background: th.cardTints.hero, borderRadius: th.radius,
          padding: `${th.padding+4}px ${th.padding}px ${th.padding}px`,
          boxShadow: th.cardShadow,
          ...(th.cardStyle === 'glass' ? {
            backdropFilter: 'blur(20px) saturate(140%)',
            WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          } : {}),
        }}>
          <ThHero th={th} fg={heroFg}/>
        </div>
        <ThSectionCard th={th} kind="results"
          headerLabel={th.monoEverything ? 'BREAKDOWN' : 'Breakdown'} fg={statsFg}>
          <ThRow th={th}><ThStat th={th} fg={statsFg}
            label={th.monoEverything ? 'DOWN PAYMENT' : 'Down payment'} value={calcData.downAmount}/></ThRow>
          <ThRow th={th}><ThStat th={th} fg={statsFg}
            label={th.monoEverything ? 'TOTAL INTEREST' : 'Total interest'} value={calcData.totalInt}/></ThRow>
          <ThRow th={th} last><ThStat th={th} fg={statsFg}
            label={th.monoEverything ? 'TOTAL COST' : 'Total cost'} value={calcData.totalCost}/></ThRow>
        </ThSectionCard>
      </div>
    );
  }
  return (
    <ThSectionCard th={th} kind="results"
      headerLabel={th.monoEverything ? 'RESULT' : 'Your result'}>
      <ThRow th={th}><ThHero th={th}/></ThRow>
      <ThRow th={th}><ThStat th={th}
        label={th.monoEverything ? 'DOWN PAYMENT' : 'Down payment'} value={calcData.downAmount}/></ThRow>
      <ThRow th={th}><ThStat th={th}
        label={th.monoEverything ? 'TOTAL INTEREST' : 'Total interest'} value={calcData.totalInt}/></ThRow>
      <ThRow th={th} last><ThStat th={th}
        label={th.monoEverything ? 'TOTAL COST' : 'Total cost'} value={calcData.totalCost}/></ThRow>
    </ThSectionCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Chart
// ─────────────────────────────────────────────────────────────────────────────
const ThChart = ({ th, w=600, h=380 }) => {
  const pad = { l:48, r:18, t:14, b:28 };
  const xs = (y) => pad.l + (y/30) * (w - pad.l - pad.r);
  const yMax = 2800;
  const ys = (v) => h - pad.b - (v/yMax) * (h - pad.t - pad.b);
  const pathFor = (k) => chartData.map((d,i) => `${i===0?'M':'L'} ${xs(d.y)} ${ys(d[k])}`).join(' ');
  const areaFor = (k) => `${pathFor(k)} L ${xs(30)} ${h-pad.b} L ${xs(0)} ${h-pad.b} Z`;
  const fg = th.cardStyle === 'tinted' ? th.ink : th.ink;
  const muted = th.cardStyle === 'tinted' ? 'rgba(26,26,46,0.65)' : th.muted;
  const subtle = th.cardStyle === 'tinted' ? 'rgba(26,26,46,0.45)' : th.subtle;

  return (
    <div style={{padding:`18px ${th.padding}px ${th.padding}px`}}>
      <div style={{display:'flex', alignItems:'baseline', gap:10, marginBottom:14}}>
        <h3 style={{margin:0, fontSize:14.5, fontWeight:600, color:fg, letterSpacing:-0.2,
          fontFamily: th.monoEverything ? th.fontMono : 'inherit',
          textTransform: th.uppercase ? 'uppercase' : 'none',
        }}>
          {th.monoEverything ? 'PAYMENT.SPLIT' : 'How each payment splits'}
        </h3>
        <span style={{flex:1}}/>
        <span style={{display:'inline-flex', gap:10, fontSize:11, color:muted,
          fontFamily: th.monoEverything ? th.fontMono : 'inherit'}}>
          <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
            <span style={{width:9, height:2, background:th.chartA}}/>{th.monoEverything?'INT':'Interest'}
          </span>
          <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
            <span style={{width:9, height:2, background:th.chartB}}/>{th.monoEverything?'PRN':'Principal'}
          </span>
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%', height:'auto', display:'block'}}>
        {[0, 700, 1400, 2100, 2800].map(g => (
          <g key={g}>
            <line x1={pad.l} x2={w-pad.r} y1={ys(g)} y2={ys(g)} stroke={th.chartGrid} strokeWidth={1}
              strokeDasharray={th.cardStyle === 'terminal' ? '2 3' : 'none'}/>
            <text x={pad.l-7} y={ys(g)+4} fontSize={10} textAnchor="end" fill={subtle}
              fontFamily={th.fontMono}>
              {g===0?'$0':`$${(g/1000).toFixed(1)}k`}
            </text>
          </g>
        ))}
        {[0,10,20,30].map(y => (
          <text key={y} x={xs(y)} y={h-pad.b+15} fontSize={10} textAnchor="middle"
            fill={subtle} fontFamily={th.fontMono}>{th.monoEverything?'Y'+y:'Yr '+y}</text>
        ))}
        <path d={areaFor('interest')}  fill={th.chartA} fillOpacity={0.06}/>
        <path d={areaFor('principal')} fill={th.chartB} fillOpacity={th.cardStyle === 'glow' ? 0.20 : 0.10}/>
        <path d={pathFor('interest')}  stroke={th.chartA} strokeWidth={2} fill="none"
          style={th.cardStyle === 'glow' ? { filter: `drop-shadow(0 0 6px ${th.chartA}99)` } : null}/>
        <path d={pathFor('principal')} stroke={th.chartB} strokeWidth={2} fill="none"
          style={th.cardStyle === 'glow' ? { filter: `drop-shadow(0 0 6px ${th.chartB}aa)` } : null}/>
        {chartData.map((d,i) => (
          <g key={i}>
            <circle cx={xs(d.y)} cy={ys(d.interest)}  r={2.5} fill={th.card} stroke={th.chartA} strokeWidth={1.5}/>
            <circle cx={xs(d.y)} cy={ys(d.principal)} r={2.5} fill={th.card} stroke={th.chartB} strokeWidth={1.5}/>
          </g>
        ))}
        <line x1={xs(18.5)} x2={xs(18.5)} y1={pad.t} y2={h-pad.b}
          stroke={th.borderStr} strokeWidth={1} strokeDasharray="3 3"/>
        <text x={xs(18.5)+5} y={pad.t+11} fontSize={10} fill={muted}
          fontFamily={th.monoEverything ? th.fontMono : 'inherit'}>
          {th.monoEverything ? '// crossover @ y19' : 'crossover · yr 19'}
        </text>
      </svg>
    </div>
  );
};

const ThChartCard = ({ th }) => (
  <ThSectionCard th={th} kind="chart"
    headerLabel={th.monoEverything ? 'PAYMENT.COMPOSITION' : 'Payment composition'}
    headerSub={th.monoEverything ? '// how each month splits' : 'how each month splits'}>
    <ThChart th={th}/>
  </ThSectionCard>
);

// ─────────────────────────────────────────────────────────────────────────────
// Hero block (page title)
// ─────────────────────────────────────────────────────────────────────────────
const ThPageHero = ({ th, mobile }) => (
  <div style={{marginBottom: mobile ? 22 : 28}}>
    <div style={{
      fontSize:11.5, fontWeight:500, color:th.subtle,
      letterSpacing: th.uppercase ? 1.5 : 0.6, textTransform:'uppercase', marginBottom:8,
      fontFamily: th.monoEverything ? th.fontMono : 'inherit',
    }}>{th.titleLabel}</div>
    <h1 style={{
      margin:0, fontSize: mobile ? 28 : 36, fontWeight:600, letterSpacing:-1.0,
      color:th.ink, lineHeight:1.05,
      fontFamily: th.monoEverything ? th.fontMono : 'inherit',
      textTransform: th.uppercase ? 'uppercase' : 'none',
    }}>{th.title}</h1>
    <p style={{margin:'10px 0 0', fontSize:14, color:th.muted, lineHeight:1.55, maxWidth:580,
      fontFamily: th.monoEverything ? th.fontMono : 'inherit',
    }}>{th.subtitle}</p>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ThemedCalculator — composes header + hero + layout
// ─────────────────────────────────────────────────────────────────────────────
const ThemedCalculator = ({ themeKey='editorial', layout='2col', viewport='desktop', user='registered' }) => {
  const th = THEMES[themeKey];
  const mobile = viewport === 'mobile';

  // Glow gets a subtle radial gradient bg whose hue follows the theme's
  // `glowRgba` (defaults to Vercel green).
  const g = th.glowRgba || '0,220,130';
  const pageBg = th.cardStyle === 'glow'
    ? `radial-gradient(900px 600px at 20% -100px, rgba(${g},0.07), transparent 60%), radial-gradient(800px 500px at 90% 110%, rgba(${g},0.05), transparent 60%), ${th.bg}`
    : th.bg;

  // Layout cols
  let mainGrid = null;
  if (mobile) {
    mainGrid = (
      <div style={{display:'flex', flexDirection:'column', gap:16}}>
        <ThInputs th={th}/>
        <ThResults th={th}/>
        <ThChartCard th={th}/>
      </div>
    );
  } else if (layout === '3col') {
    mainGrid = (
      <div style={{
        display:'grid', gridTemplateColumns: th.cols3, gap:20, alignItems:'start',
      }}>
        <ThInputs th={th}/>
        <ThResults th={th} layout="3col"/>
        <ThChartCard th={th}/>
      </div>
    );
  } else {
    // 2-col: inputs + results side-by-side, chart full width below
    mainGrid = (
      <React.Fragment>
        <div style={{
          display:'grid', gridTemplateColumns: th.cols2, gap:20, alignItems:'start',
          marginBottom:20,
        }}>
          <ThInputs th={th}/>
          <ThResults th={th} layout="2col"/>
        </div>
        <ThChartCard th={th}/>
      </React.Fragment>
    );
  }

  return (
    <div style={{
      background: pageBg, color: th.text, width:'100%', height:'100%',
      fontFamily: th.font, fontSize:14, letterSpacing:-0.05,
      display:'flex', flexDirection:'column', overflow:'hidden',
      WebkitFontSmoothing:'antialiased',
    }}>
      <ThHeader th={th} user={user} viewport={viewport}/>
      <div style={{flex:1, overflow:'auto'}}>
        <div style={{
          maxWidth: layout === '3col' ? 1200 : 1080, margin:'0 auto',
          padding: mobile ? '24px 16px 40px' : '40px 32px 48px',
        }}>
          <ThPageHero th={th} mobile={mobile}/>
          {mainGrid}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ThemedCalculator, THEMES });
