// Calcgrinder — Café Margin Studio
// Theme-parameterised. Takes `themeKey` mapped to THEMES from themes.jsx,
// renders the full 11-section calculator under that theme's chrome.
// Uses ThHeader (themes.jsx) for the surrounding chrome so the header
// adapts to whichever theme is selected.

// ─────────────────────────────────────────────────────────────────────────────
// Theme-derived token bundle. Builds on THEMES[key] from themes.jsx and adds
// semantic colours (pos/warn/neg), bullet bands, a 6-stop heat ramp, donut
// palette, etc. that aren't part of the base theme.
// ─────────────────────────────────────────────────────────────────────────────
const mkCm = (th) => {
  const terminal = th.cardStyle === 'terminal';
  const glow     = th.cardStyle === 'glow';
  const tinted   = th.cardStyle === 'tinted';
  const glass    = th.cardStyle === 'glass';
  const dark     = terminal || glow;

  // Theme identity (used to pick semantic palettes since two themes may share
  // a cardStyle but want different accents).
  const isMinimal  = th.label === 'Minimal · Linear';
  const isCg       = th.label === 'Calcgrinder · Light' || th.label === 'Calcgrinder · CI';
  const isCyber    = !!(th.label && th.label.includes('Cyber'));

  // Semantic deltas
  let pos, posSoft, warn, warnSoft, neg, negSoft;
  if (terminal) {
    pos='#22C55E';   posSoft='rgba(34,197,94,0.16)';
    warn='#FACC15';  warnSoft='rgba(250,204,21,0.14)';
    neg='#EF4444';   negSoft='rgba(239,68,68,0.14)';
  } else if (glow) {
    pos = th.accent;
    posSoft = th.accentSoft || 'rgba(0,220,130,0.14)';
    warn='#FACC15';  warnSoft='rgba(250,204,21,0.14)';
    neg='#EF4444';   negSoft='rgba(239,68,68,0.14)';
  } else if (tinted) {
    pos='#1F6E2A';   posSoft='#C8E6C9';
    warn='#B85C2A';  warnSoft='#FBD7AB';
    neg='#A02525';   negSoft='#FAD2D2';
  } else if (glass) {
    pos='#4F8C5C';   posSoft='rgba(79,140,92,0.18)';
    warn='#B8723E';  warnSoft='rgba(184,114,62,0.18)';
    neg='#A04D40';   negSoft='rgba(160,77,64,0.18)';
  } else if (isMinimal || isCg) {
    pos='#166534';   posSoft='#DCFCE7';
    warn='#B45309';  warnSoft='#FEF3C7';
    neg='#B91C1C';   negSoft='#FEE2E2';
  } else {
    // Editorial Cream
    pos='#5C7A3D';   posSoft='#E7EDD8';
    warn='#A86B22';  warnSoft='#F1E2CB';
    neg='#9C4B3F';   negSoft='#EFD9D2';
  }

  // Bullet bands — three tones light → darker, suited to each theme
  let bandLo, bandMid, bandHi;
  if (terminal) {
    bandLo='rgba(34,197,94,0.06)'; bandMid='rgba(34,197,94,0.12)'; bandHi='rgba(34,197,94,0.22)';
  } else if (glow) {
    bandLo='#171717'; bandMid='#1F1F1F'; bandHi='#2A2A2A';
  } else if (tinted) {
    bandLo='#F6E9C6'; bandMid='#F0DBA0'; bandHi='#E6C376';
  } else if (glass) {
    bandLo='rgba(255,255,255,0.35)'; bandMid='rgba(255,255,255,0.55)'; bandHi='rgba(255,255,255,0.75)';
  } else if (isMinimal) {
    bandLo='#F5F5F5'; bandMid='#E5E5E5'; bandHi='#D4D4D4';
  } else if (isCg) {
    bandLo='#F5F5F4'; bandMid='#E7E5E4'; bandHi='#D6D3D1';
  } else {
    bandLo='#EFEAE0'; bandMid='#E5DECF'; bandHi='#D9D0BC';
  }

  // Heatmap ramp (6 stops, light → dark)
  let heat;
  if (terminal) heat=['rgba(34,197,94,0.05)','rgba(34,197,94,0.14)','rgba(34,197,94,0.28)','rgba(34,197,94,0.50)','rgba(34,197,94,0.78)','#22C55E'];
  else if (glow) {
    heat = isCyber
      ? ['#0F0F0F','#16201A','#1E3527','#295B3D','#3A9A60','#4ADE80']
      : ['#0F0F0F','#102018','#13392A','#1B6A4D','#27A578','#00DC82'];
  }
  else if (tinted) heat=['#FFF1D2','#FFE2A3','#FFCD7A','#FFB050','#E58A30','#9C4F1A'];
  else if (glass) heat=['rgba(91,108,186,0.07)','rgba(91,108,186,0.18)','rgba(91,108,186,0.35)','rgba(91,108,186,0.55)','rgba(91,108,186,0.78)','#5B6CBA'];
  else if (isMinimal) heat=['#F5F5F5','#E3E4F5','#C7C9EE','#9DA3DD','#6F75D0','#4F46E5'];
  else if (isCg) heat=['#F5F5F4','#E3E4F5','#C7C9EE','#9DA3DD','#6F75D0','#4F46E5'];
  else heat=['#F4EFE3','#E9DFC4','#D9C99A','#C2A968','#A07F3D','#6E5121'];

  // Waterfall cost bar colour + softer "passthrough" cost colour
  let costBar = neg;
  let softCost;
  if (terminal) softCost='#FACC15';
  else if (glow) softCost='#FACC15';
  else if (tinted) softCost='#FFB050';
  else if (glass) softCost='#E8A172';
  else if (isMinimal || isCg) softCost='#E0A472';
  else softCost='#D6A290';

  // Donut palette (3 slices: primary / secondary / tertiary)
  let donutA = th.chartA;
  let donutB = th.chartB;
  let donutC;
  if (terminal) donutC='#15803D';
  else if (glow) {
    donutC = isCyber ? '#2E9B58' : '#2EAF7B';
  }
  else if (tinted) donutC='#FFCD7A';
  else if (glass) donutC='#B0B9D9';
  else if (isMinimal || isCg) donutC='#A8A8E0';
  else donutC='#D9C99A';

  // Mono number style helper
  const mono = (size=16, weight=600) => ({
    fontFamily: th.fontMono,
    fontSize: size, fontWeight: weight,
    color: th.ink,
    letterSpacing: size > 30 ? -1.2 : (size > 20 ? -0.5 : -0.3),
    fontVariantNumeric: 'tabular-nums', lineHeight: 1,
  });

  return {
    ...th,
    text: th.text || th.ink,
    pos, posSoft, warn, warnSoft, neg, negSoft,
    bandLo, bandMid, bandHi, heat,
    costBar, softCost,
    donutA, donutB, donutC,
    dark, tinted, terminal, glow, glass,
    isMinimal, isCg, isCyber,
    mono,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const CmCtx = React.createContext(null);
const useCm = () => React.useContext(CmCtx);

// ─────────────────────────────────────────────────────────────────────────────
// Section shell
// ─────────────────────────────────────────────────────────────────────────────
const Sec = ({ idx, title, sub, children, last }) => {
  const cm = useCm();
  return (
    <section style={{marginBottom: last ? 0 : 48}}>
      <div style={{
        display:'flex', alignItems:'baseline', gap:14, marginBottom:18,
      }}>
        <span style={{width:20, height:20, display:'inline-flex', alignItems:'center', justifyContent:'center'}}>
          <span style={{
            fontFamily:cm.fontMono, fontSize:11,
            color: cm.isCyber ? cm.accent : cm.subtle,
            fontWeight:500, letterSpacing:0.5,
          }}>{String(idx).padStart(2,'0')}</span>
        </span>
        <h2 style={{
          margin:0, fontSize:20, fontWeight:600, letterSpacing:cm.uppercase ? 0.6 : -0.4,
          color:cm.ink, lineHeight:1.2,
          fontFamily: cm.monoEverything ? cm.fontMono : 'inherit',
          textTransform: cm.uppercase ? 'uppercase' : 'none',
        }}>{title}</h2>
        {sub && <span style={{
          fontSize:12.5, color:cm.muted, fontWeight:400,
          fontFamily: cm.monoEverything ? cm.fontMono : 'inherit',
        }}>{cm.monoEverything ? `// ${sub}` : sub}</span>}
        <span style={{flex:1, height:1, background:cm.rule, marginLeft:4}}/>
      </div>
      {children}
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Card — uses cardSurface() from themes.jsx so Bento gets its tint per `kind`,
// while other themes render the standard card surface.
// ─────────────────────────────────────────────────────────────────────────────
const Card = ({ children, kind='generic', pad=true, style }) => {
  const cm = useCm();
  return (
    <div style={{
      ...cardSurface(cm, kind),
      padding: pad ? `${cm.padding}px ${cm.padding+2}px` : 0,
      ...style,
    }}>{children}</div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Form-field primitives
// ─────────────────────────────────────────────────────────────────────────────
const FieldLabel = ({ children, hint }) => {
  const cm = useCm();
  return (
    <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:7}}>
      <span style={{
        fontSize:10.5, fontWeight:600, color:cm.muted,
        letterSpacing: cm.uppercase ? 1.0 : 0.6, textTransform:'uppercase',
        fontFamily: cm.monoEverything ? cm.fontMono : 'inherit',
      }}>{children}</span>
      {hint && <span style={{
        fontSize:11, color:cm.subtle,
        fontFamily: cm.monoEverything ? cm.fontMono : 'inherit',
      }}>{hint}</span>}
    </div>
  );
};

const FieldBox = ({ children, style }) => {
  const cm = useCm();
  return (
    <div style={{
      display:'flex', alignItems:'center',
      height:42, padding:'0 12px',
      borderRadius: cm.fieldRadius,
      background: cm.terminal ? 'transparent' : cm.cardAlt,
      border:`1px ${cm.terminal ? 'dashed' : 'solid'} ${cm.terminal ? cm.rule : (cm.border === 'transparent' ? cm.borderStr : cm.border)}`,
      ...style,
    }}>{children}</div>
  );
};

const TextField = ({ label, value }) => {
  const cm = useCm();
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <FieldBox>
        <span style={{
          flex:1, fontSize:15, color:cm.ink, fontWeight:500, letterSpacing:-0.1,
          fontFamily: cm.monoEverything ? cm.fontMono : 'inherit',
        }}>{value}</span>
      </FieldBox>
    </div>
  );
};

const CurrencyField = ({ label, value, prefix='CHF', hint }) => {
  const cm = useCm();
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <FieldBox>
        <span style={{fontFamily:cm.fontMono, fontSize:13, color:cm.muted, marginRight:8}}>{prefix}</span>
        <span style={{flex:1, ...cm.mono(17), letterSpacing:-0.3}}>{value}</span>
      </FieldBox>
    </div>
  );
};

const NumberField = ({ label, value, suffix, hint }) => {
  const cm = useCm();
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <FieldBox>
        <span style={{flex:1, ...cm.mono(17), letterSpacing:-0.3}}>{value}</span>
        {suffix && <span style={{fontFamily:cm.fontMono, fontSize:13, color:cm.muted}}>{suffix}</span>}
      </FieldBox>
    </div>
  );
};

const Stepper = ({ label, value, hint }) => {
  const cm = useCm();
  const borderColor = cm.terminal ? cm.rule : (cm.border === 'transparent' ? cm.borderStr : cm.border);
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div style={{
        display:'flex', alignItems:'center', height:42,
        borderRadius: cm.fieldRadius,
        background: cm.terminal ? 'transparent' : cm.cardAlt,
        border:`1px ${cm.terminal ? 'dashed' : 'solid'} ${borderColor}`,
        overflow:'hidden',
      }}>
        <button style={{
          width:38, height:'100%', border:'none', borderRight:`1px ${cm.terminal ? 'dashed' : 'solid'} ${borderColor}`,
          background:'transparent', color:cm.ink, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          fontFamily:'inherit', fontSize:16,
        }}>−</button>
        <span style={{flex:1, textAlign:'center', ...cm.mono(17)}}>{value}</span>
        <button style={{
          width:38, height:'100%', border:'none', borderLeft:`1px ${cm.terminal ? 'dashed' : 'solid'} ${borderColor}`,
          background:'transparent', color:cm.ink, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          fontFamily:'inherit', fontSize:16,
        }}>+</button>
      </div>
    </div>
  );
};

const Slider = ({ label, value, pct, range, ticks, hint, suffix }) => {
  const cm = useCm();
  const fillC  = cm.isCyber ? cm.accent : cm.ink;
  const valueC = cm.isCyber ? cm.accent : cm.ink;
  const trackBg = cm.terminal ? 'transparent' : cm.cardAlt;
  const trackBorder = `1px ${cm.terminal ? 'dashed' : 'solid'} ${cm.terminal ? cm.rule : (cm.border === 'transparent' ? cm.borderStr : cm.border)}`;
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div style={{display:'flex', alignItems:'baseline', gap:6, marginBottom:10}}>
        <span style={{...cm.mono(22), color: valueC}}>{value}</span>
        {suffix && <span style={{fontSize:13, color:cm.muted, fontWeight:500}}>{suffix}</span>}
      </div>
      <div style={{position:'relative', height:6, background:trackBg,
        borderRadius: cm.fieldRadius >= 4 ? 3 : 0, border:trackBorder}}>
        <div style={{position:'absolute', top:-1, left:0, height:6, width:`${pct}%`,
          borderRadius: cm.fieldRadius >= 4 ? 3 : 0, background: fillC}}/>
        <div style={{
          position:'absolute', top:-5, left:`calc(${pct}% - 7px)`,
          width:14, height:14,
          borderRadius: cm.fieldRadius >= 4 ? '50%' : 0,
          background: cm.dark ? cm.bg : cm.card,
          border:`2px solid ${fillC}`,
          boxShadow:'0 1px 2px rgba(0,0,0,0.1)',
        }}/>
      </div>
      {ticks ? (
        <div style={{
          display:'grid', gridTemplateColumns: ticks.map(()=>'1fr').join(' '),
          marginTop:7, fontSize:10.5, color:cm.subtle, fontFamily:cm.fontMono,
        }}>
          {ticks.map((t, i) => (
            <span key={i} style={{
              textAlign: i===0 ? 'left' : (i===ticks.length-1 ? 'right' : 'center'),
            }}>{t}</span>
          ))}
        </div>
      ) : (
        <div style={{display:'flex', justifyContent:'space-between', marginTop:6,
          fontSize:10.5, color:cm.subtle, fontFamily:cm.fontMono}}>
          <span>{range[0]}</span><span>{range[1]}</span>
        </div>
      )}
    </div>
  );
};

const RadioGroup = ({ label, options, value, hint }) => {
  const cm = useCm();
  const borderColor = cm.terminal ? cm.rule : (cm.border === 'transparent' ? cm.borderStr : cm.border);
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div style={{
        display:'inline-flex', padding:2, borderRadius: cm.fieldRadius, width:'100%',
        background: cm.terminal ? 'transparent' : cm.cardAlt,
        border:`1px ${cm.terminal ? 'dashed' : 'solid'} ${borderColor}`,
      }}>
        {options.map(opt => {
          const active = opt === value;
          return (
            <div key={opt} style={{
              flex:1, height:36,
              borderRadius: cm.fieldRadius >= 4 ? Math.max(cm.fieldRadius-2,4) : 0,
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              fontSize:13, fontWeight:500, fontFamily:'inherit',
              background: active ? (cm.dark ? cm.cardAlt : cm.card) : 'transparent',
              color: active ? cm.ink : cm.muted,
              boxShadow: active && !cm.terminal ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              border: active ? `1px ${cm.terminal ? 'solid' : 'solid'} ${cm.terminal ? cm.accent : (cm.dark ? cm.borderStr : cm.borderStr)}` : '1px solid transparent',
              letterSpacing: -0.1,
            }}>{opt}</div>
          );
        })}
      </div>
    </div>
  );
};

const Dropdown = ({ label, value, hint }) => {
  const cm = useCm();
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <FieldBox>
        <span style={{flex:1, fontSize:14, color:cm.ink, fontWeight:500,
          fontFamily: cm.monoEverything ? cm.fontMono : 'inherit'}}>{value}</span>
        <Icons.ChevD size={13} color={cm.muted}/>
      </FieldBox>
    </div>
  );
};

const Toggle = ({ label, on, hint, inline }) => {
  const cm = useCm();
  const w = 36, h = 20;
  const borderColor = cm.terminal ? cm.rule : (cm.border === 'transparent' ? cm.borderStr : cm.border);
  return (
    <div style={{display:'flex', alignItems:'center', gap:12,
      ...(inline ? {} : { flexDirection:'column', alignItems:'stretch'}),
    }}>
      {!inline && <FieldLabel hint={hint}>{label}</FieldLabel>}
      <div style={{
        display:'flex', alignItems:'center', gap:10,
        ...(inline ? {flex:1} : {
          height:42, padding:'0 12px', borderRadius: cm.fieldRadius,
          background: cm.terminal ? 'transparent' : cm.cardAlt,
          border:`1px ${cm.terminal ? 'dashed' : 'solid'} ${borderColor}`,
        }),
      }}>
        <div style={{
          width:w, height:h, borderRadius: cm.terminal ? 0 : h/2,
          background: on ? (cm.isCyber ? cm.accent : cm.ink) : cm.borderStr,
          padding:2, position:'relative', flexShrink:0,
          transition:'background .15s',
        }}>
          <div style={{
            width:h-4, height:h-4, borderRadius: cm.terminal ? 0 : '50%',
            background: cm.terminal ? cm.bg : '#fff',
            position:'absolute', top:2, left: on ? w-h+2 : 2,
            boxShadow:'0 1px 2px rgba(0,0,0,0.2)',
            transition:'left .15s',
          }}/>
        </div>
        {inline && <span style={{
          fontSize:13.5, color:cm.ink, fontWeight:500, letterSpacing:-0.1,
          fontFamily: cm.monoEverything ? cm.fontMono : 'inherit',
        }}>{label}</span>}
        {!inline && <span style={{
          fontSize:13, color:cm.muted, fontWeight:500,
          fontFamily: cm.monoEverything ? cm.fontMono : 'inherit',
        }}>{on ? (cm.monoEverything ? 'ON' : 'On') : (cm.monoEverything ? 'OFF' : 'Off')}</span>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Pills (delta indicators)
// ─────────────────────────────────────────────────────────────────────────────
const Delta = ({ kind, children }) => {
  const cm = useCm();
  const map = {
    pos:  { bg: cm.posSoft,  fg: cm.pos  },
    warn: { bg: cm.warnSoft, fg: cm.warn },
    neg:  { bg: cm.negSoft,  fg: cm.neg  },
    flat: { bg: 'transparent', fg: cm.subtle },
  };
  const s = map[kind] || map.flat;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'2px 8px 2px 7px',
      borderRadius: cm.terminal ? 0 : 999,
      fontSize:11, fontWeight:500, lineHeight:'16px',
      background:s.bg, color:s.fg, letterSpacing:-0.05,
      fontFamily: cm.fontMono,
    }}>{children}</span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sparkline
// ─────────────────────────────────────────────────────────────────────────────
const Sparkline = ({ data, color, fill=true, w=180, h=28 }) => {
  const cm = useCm();
  if (!data || !data.length) return null;
  const stroke = color || cm.ink;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const xs = (i) => 1 + (i / (data.length-1)) * (w-2);
  const ys = (v) => h - 2 - ((v-min)/range) * (h-4);
  const line = data.map((v,i) => `${i===0?'M':'L'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');
  const area = `${line} L ${xs(data.length-1).toFixed(1)} ${h-1} L ${xs(0).toFixed(1)} ${h-1} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      {fill && <path d={area} fill={stroke} fillOpacity={cm.glow ? 0.18 : 0.10}/>}
      <path d={line} stroke={stroke} strokeWidth={1.5} fill="none"
        strokeLinejoin="round" strokeLinecap="round"
        style={cm.glow ? { filter: `drop-shadow(0 0 4px ${stroke}cc)` } : null}/>
      <circle cx={xs(data.length-1)} cy={ys(data[data.length-1])} r={2.5}
        fill={cm.card} stroke={stroke} strokeWidth={1.4}/>
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────────────────────
const KPI = ({ label, value, delta, deltaKind, spark, sparkColor }) => {
  const cm = useCm();
  return (
    <div style={{
      ...cardSurface(cm, 'results'),
      display:'flex', flexDirection:'column', overflow:'hidden',
      height:128,
    }}>
      <div style={{padding:'14px 16px 8px', flex:1}}>
        <div style={cm.mono(22)}>{value}</div>
        <div style={{
          fontSize:11, fontWeight:600, color:cm.muted, letterSpacing:0.5,
          textTransform:'uppercase', marginTop:4,
          fontFamily: cm.monoEverything ? cm.fontMono : 'inherit',
        }}>{label}</div>
        {delta ? (
          <div style={{marginTop:8}}><Delta kind={deltaKind}>{delta}</Delta></div>
        ) : (
          <div style={{marginTop:8, fontSize:11, color:cm.subtle, letterSpacing:-0.05}}>—</div>
        )}
      </div>
      <div style={{height:30, padding:'0 6px 4px', display:'flex', alignItems:'flex-end'}}>
        <Sparkline data={spark} color={sparkColor || cm.ink} h={26}/>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Waterfall
// ─────────────────────────────────────────────────────────────────────────────
const Waterfall = ({ items, h=280 }) => {
  const cm = useCm();
  let run = 0;
  const bars = items.map((it) => {
    if (it.kind === 'start') { run = it.value; return { ...it, top: it.value, bottom: 0 }; }
    if (it.kind === 'end')   { return { ...it, top: it.value, bottom: 0 }; }
    const newRun = run - it.value;
    const top = run, bottom = newRun;
    run = newRun;
    return { ...it, top, bottom };
  });
  const yMax = Math.max(...bars.map(b => b.top));
  const W = 1080, H = h;
  const pad = { l:0, r:0, t:18, b:54 };
  const barW = (W - pad.l - pad.r) / items.length * 0.62;
  const slotW = (W - pad.l - pad.r) / items.length;
  const ys = (val) => H - pad.b - (val / yMax) * (H - pad.t - pad.b);
  const xCenter = (i) => pad.l + slotW * (i + 0.5);
  const ticks = [0, 15000, 30000, 45000, 60000];
  const fmt = (n) => n === 0 ? '0' : `${(n/1000).toFixed(0)}k`;

  return (
    <div style={{width:'100%'}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', height:'auto', display:'block'}}>
        {ticks.map(g => (
          <g key={g}>
            <line x1={36} x2={W-8} y1={ys(g)} y2={ys(g)} stroke={cm.chartGrid} strokeWidth={1}
              strokeDasharray={cm.terminal ? '2 3' : 'none'}/>
            <text x={32} y={ys(g)+4} fontSize={10} textAnchor="end" fill={cm.subtle}
              fontFamily={cm.fontMono}>{fmt(g)}</text>
          </g>
        ))}
        <line x1={36} x2={W-8} y1={ys(0)} y2={ys(0)} stroke={cm.borderStr} strokeWidth={1}/>

        {bars.map((b, i) => {
          const colour = b.kind === 'start' || b.kind === 'end' ? cm.ink
            : b.kind === 'softcost' ? cm.softCost
            : cm.costBar;
          const x = xCenter(i) - barW/2;
          const yTop = ys(b.top);
          const yBot = ys(b.bottom);
          const barH = Math.max(2, yBot - yTop);
          const next = bars[i+1];
          return (
            <g key={i}>
              {next && (
                <line
                  x1={xCenter(i) + barW/2} x2={xCenter(i+1) - barW/2}
                  y1={yBot} y2={ys(next.top)}
                  stroke={cm.borderStr} strokeWidth={1} strokeDasharray="2 3"
                />
              )}
              <rect x={x} y={yTop} width={barW} height={barH} fill={colour}
                rx={cm.terminal ? 0 : 2}
                style={cm.glow && (b.kind==='start' || b.kind==='end') ? { filter:`drop-shadow(0 0 6px ${cm.accent}66)` } : null}/>
              <text x={xCenter(i)} y={yTop-6} fontSize={11} textAnchor="middle"
                fill={cm.ink} fontFamily={cm.fontMono}
                fontWeight={b.kind==='start'||b.kind==='end' ? 600 : 500}>
                {b.kind === 'start' || b.kind === 'end'
                  ? `CHF ${b.value.toLocaleString('en-US')}`
                  : `−${b.value.toLocaleString('en-US')}`}
              </text>
              <text x={xCenter(i)} y={H - pad.b + 18} fontSize={11} textAnchor="middle"
                fill={cm.muted}
                fontFamily={cm.monoEverything ? cm.fontMono : 'inherit'}>
                {b.label}
              </text>
              <text x={xCenter(i)} y={H - pad.b + 32} fontSize={9.5} textAnchor="middle"
                fill={cm.subtle} fontFamily={cm.fontMono}>
                CHF {b.value.toLocaleString('en-US')}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Bullet chart
// ─────────────────────────────────────────────────────────────────────────────
const Bullet = ({ label, actual, target, max, suffix='', exceeds }) => {
  const cm = useCm();
  const W = 360, H = 70;
  const trackY = 30, trackH = 26;
  const bandStops = [0.45, 0.75, 1.0];
  const bands = [cm.bandLo, cm.bandMid, cm.bandHi];
  const xs = (v) => (v / max) * W;
  return (
    <div>
      <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:10}}>
        <span style={{fontSize:13, color:cm.ink, fontWeight:600, letterSpacing:-0.1,
          fontFamily: cm.monoEverything ? cm.fontMono : 'inherit'}}>{label}</span>
        <span style={{flex:1}}/>
        <span style={cm.mono(13)}>{exceeds && '✓ '}{actual.toLocaleString('en-US')}{suffix}</span>
        <span style={{fontSize:11, color:cm.subtle, fontFamily:cm.fontMono}}>
          / {target.toLocaleString('en-US')}{suffix}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
        {bandStops.map((stop, i) => {
          const x0 = i === 0 ? 0 : xs(max * bandStops[i-1]);
          const x1 = xs(max * stop);
          return <rect key={i} x={x0} y={trackY} width={x1-x0} height={trackH} fill={bands[i]}/>;
        })}
        <rect x={0} y={trackY + 7} width={xs(actual)} height={trackH - 14}
          fill={exceeds ? cm.pos : cm.ink}
          rx={cm.terminal ? 0 : 2}
          style={cm.glow ? { filter: `drop-shadow(0 0 4px ${exceeds ? cm.pos : cm.ink}88)` } : null}/>
        <line x1={xs(target)} x2={xs(target)} y1={trackY - 4} y2={trackY + trackH + 4}
          stroke={cm.ink} strokeWidth={2.5}/>
        <text x={0} y={trackY + trackH + 16} fontSize={9.5} fill={cm.subtle}
          fontFamily={cm.fontMono}>low</text>
        <text x={xs(max * (bandStops[0] + bandStops[1])/2)} y={trackY + trackH + 16} fontSize={9.5}
          textAnchor="middle" fill={cm.subtle} fontFamily={cm.fontMono}>mid</text>
        <text x={W} y={trackY + trackH + 16} fontSize={9.5} textAnchor="end" fill={cm.subtle}
          fontFamily={cm.fontMono}>high</text>
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Heatmap
// ─────────────────────────────────────────────────────────────────────────────
const Heatmap = () => {
  const cm = useCm();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const grid = [
    [0.15,0.32,0.50,0.30,0.40,0.85,0.95,0.55,0.30,0.30,0.25,0.15],
    [0.15,0.35,0.50,0.30,0.42,0.88,0.95,0.60,0.30,0.32,0.30,0.20],
    [0.18,0.38,0.55,0.35,0.45,0.90,1.00,0.65,0.35,0.32,0.30,0.22],
    [0.20,0.40,0.55,0.35,0.45,0.92,1.00,0.65,0.38,0.35,0.32,0.25],
    [0.22,0.45,0.60,0.40,0.50,0.92,0.98,0.70,0.45,0.45,0.50,0.40],
    [0.10,0.25,0.78,0.95,1.00,0.95,0.78,0.55,0.42,0.38,0.30,0.20],
    [0.08,0.20,0.72,0.92,0.95,0.85,0.65,0.45,0.30,0.20,0.10,0.04],
  ];
  const hours = ['7a','8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p'];
  const heatAt = (v) => {
    const idx = Math.min(cm.heat.length-1, Math.floor(v * cm.heat.length));
    return cm.heat[idx];
  };
  const cellBorder = cm.terminal ? cm.rule : (cm.border === 'transparent' ? cm.rule : cm.border);

  return (
    <div>
      <div style={{display:'grid', gridTemplateColumns:'auto repeat(12, 1fr)', gap:3}}>
        <div/>
        {hours.map(h => (
          <div key={h} style={{
            fontSize:10, color:cm.subtle, fontFamily:cm.fontMono,
            textAlign:'center', paddingBottom:6,
          }}>{h}</div>
        ))}
        {grid.map((row, r) => (
          <React.Fragment key={r}>
            <div style={{
              fontSize:10.5, color:cm.muted, fontFamily:cm.fontMono,
              display:'flex', alignItems:'center', paddingRight:10, fontWeight:500,
            }}>{days[r]}</div>
            {row.map((v, c) => (
              <div key={c} style={{
                aspectRatio:'1.2 / 1', minHeight:24,
                background: heatAt(v),
                borderRadius: cm.terminal ? 0 : 3,
                border:`1px solid ${cellBorder}`,
              }}/>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div style={{display:'flex', alignItems:'center', gap:12, marginTop:14}}>
        <span style={{fontSize:10.5, color:cm.subtle, fontFamily:cm.fontMono}}>0 customers</span>
        <div style={{
          flex:1, height:8, borderRadius: cm.terminal ? 0 : 4, maxWidth:280,
          background: `linear-gradient(to right, ${cm.heat.join(',')})`,
          border:`1px solid ${cellBorder}`,
        }}/>
        <span style={{fontSize:10.5, color:cm.subtle, fontFamily:cm.fontMono}}>60+ customers</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Radial progress / Donut / Comparison bar
// ─────────────────────────────────────────────────────────────────────────────
const RadialProgress = ({ pct = 78 }) => {
  const cm = useCm();
  const r = 64, cx = 90, cy = 90;
  const circ = 2 * Math.PI * r;
  const filled = (pct/100) * circ;
  return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:10}}>
      <div style={{position:'relative', width:180, height:180}}>
        <svg viewBox="0 0 180 180" width={180} height={180}>
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={cm.dark ? cm.cardAlt : (cm.tinted ? 'rgba(0,0,0,0.10)' : cm.cardAlt)}
            strokeWidth={14}/>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={cm.pos} strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circ-filled}`}
            strokeDashoffset={circ * 0.25}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={cm.glow ? { filter: `drop-shadow(0 0 6px ${cm.pos})` } : null}/>
        </svg>
        <div style={{
          position:'absolute', inset:0, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
        }}>
          <div style={cm.isCyber ? {...cm.mono(40), color:cm.accent} : cm.mono(40)}>{pct}</div>
          <div style={{fontSize:10.5, color:cm.subtle, marginTop:2, letterSpacing:0.4,
            textTransform:'uppercase', fontWeight:500, fontFamily: cm.monoEverything ? cm.fontMono : 'inherit'}}>
            {cm.monoEverything ? 'OUT_OF_100' : 'out of 100'}
          </div>
        </div>
      </div>
      <span style={{
        display:'inline-flex', alignItems:'center', gap:5,
        padding:'3px 10px',
        borderRadius: cm.terminal ? 0 : 999,
        background:cm.posSoft, color:cm.pos,
        fontSize:11.5, fontWeight:600, letterSpacing:0.4, textTransform:'uppercase',
        fontFamily: cm.monoEverything ? cm.fontMono : 'inherit',
      }}>
        <span style={{width:5, height:5, borderRadius: cm.terminal ? 0 : '50%', background:cm.pos}}/>
        {cm.monoEverything ? 'HEALTHY' : 'Healthy'}
      </span>
    </div>
  );
};

const Donut = () => {
  const cm = useCm();
  const segs = [
    { label:'Espresso drinks', pct:58, color: cm.donutA },
    { label:'Food',            pct:27, color: cm.donutB },
    { label:'Other beverages', pct:15, color: cm.donutC },
  ];
  const r = 60, cx = 80, cy = 80;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{display:'flex', alignItems:'center', gap:18}}>
      <svg viewBox="0 0 160 160" width={160} height={160}>
        {segs.map((s, i) => {
          const len = (s.pct/100) * circ;
          const dash = `${len} ${circ-len}`;
          const node = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color} strokeWidth={22}
              strokeDasharray={dash}
              strokeDashoffset={-offset + circ * 0.25}
              transform={`rotate(-90 ${cx} ${cy})`}/>
          );
          offset += len;
          return node;
        })}
        <circle cx={cx} cy={cy} r={r-14}
          fill={cm.tinted || cm.glass ? 'transparent' : cm.card}/>
      </svg>
      <div style={{display:'flex', flexDirection:'column', gap:9}}>
        {segs.map(s => (
          <div key={s.label} style={{display:'flex', alignItems:'center', gap:8}}>
            <span style={{
              width:9, height:9,
              borderRadius: cm.terminal ? 0 : 2, background:s.color,
            }}/>
            <span style={{
              fontSize:12.5, color:cm.ink, fontWeight:500, flex:1,
              fontFamily: cm.monoEverything ? cm.fontMono : 'inherit',
            }}>{s.label}</span>
            <span style={{...cm.mono(12.5, 500), color:cm.muted}}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ComparisonBar = () => {
  const cm = useCm();
  const metrics = [
    { label:'Revenue', wk: 0.70, we: 1.00 },
    { label:'Profit',  wk: 0.55, we: 0.90 },
    { label:'Cups',    wk: 0.85, we: 1.00 },
    { label:'Tickets', wk: 0.78, we: 0.95 },
    { label:'Margin',  wk: 0.92, we: 0.85 },
  ];
  const W = 420, H = 180, padB = 26, padT = 24;
  const slotW = W / metrics.length;
  const barW = slotW * 0.30;
  const ys = (v) => H - padB - v * (H - padB - padT);
  return (
    <div>
      <div style={{display:'flex', gap:14, marginBottom:12, fontSize:11.5, color:cm.muted,
        fontFamily: cm.monoEverything ? cm.fontMono : 'inherit'}}>
        <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
          <span style={{width:10, height:10,
            borderRadius: cm.terminal ? 0 : 2, background:cm.ink}}/>Weekday
        </span>
        <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
          <span style={{width:10, height:10,
            borderRadius: cm.terminal ? 0 : 2, background:cm.donutB}}/>Weekend
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
        <line x1={0} x2={W} y1={ys(0)} y2={ys(0)} stroke={cm.borderStr}/>
        {metrics.map((m, i) => {
          const cx = slotW * (i + 0.5);
          return (
            <g key={m.label}>
              <rect x={cx - barW - 2} y={ys(m.wk)} width={barW} height={ys(0) - ys(m.wk)}
                fill={cm.ink}/>
              <rect x={cx + 2} y={ys(m.we)} width={barW} height={ys(0) - ys(m.we)}
                fill={cm.donutB}/>
              <text x={cx} y={H - 6} fontSize={11} textAnchor="middle" fill={cm.muted}
                fontFamily={cm.monoEverything ? cm.fontMono : 'inherit'}>{m.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Amortization table
// ─────────────────────────────────────────────────────────────────────────────
const amortRows = [
  { y:1, open:18000, pay:2703, int: 720,  princ:1983, close:16017 },
  { y:2, open:16017, pay:2703, int: 641,  princ:2062, close:13955 },
  { y:3, open:13955, pay:2703, int: 558,  princ:2145, close:11810 },
  { y:4, open:11810, pay:2703, int: 472,  princ:2231, close: 9579 },
  { y:5, open: 9579, pay:2703, int: 383,  princ:2320, close: 7259 },
  { y:6, open: 7259, pay:2703, int: 290,  princ:2413, close: 4846 },
  { y:7, open: 4846, pay:2703, int: 194,  princ:2509, close: 2337 },
  { y:8, open: 2337, pay:2435, int:  98,  princ:2337, close:    0 },
];
const amortSum = amortRows.reduce((a, r) => ({
  pay: a.pay + r.pay, int: a.int + r.int, princ: a.princ + r.princ,
}), { pay:0, int:0, princ:0 });

const AmortTable = () => {
  const cm = useCm();
  const fmt = (n) => `CHF ${n.toLocaleString('en-US')}`;
  const borderColor = cm.border === 'transparent' ? cm.rule : cm.border;
  const cellTh = {
    fontSize:11, fontWeight:600, color:cm.muted, letterSpacing:0.5,
    textTransform:'uppercase', padding:'12px 16px', textAlign:'right',
    borderBottom:`1px solid ${borderColor}`,
    background: cm.tinted ? 'rgba(0,0,0,0.04)' : cm.cardAlt,
    fontFamily: cm.monoEverything ? cm.fontMono : 'inherit',
  };
  const cellTd = {
    ...cm.mono(13, 500), padding:'12px 16px', textAlign:'right',
    borderBottom:`1px solid ${cm.rule}`,
  };
  const footTd = {
    ...cm.mono(13, 600), padding:'14px 16px', textAlign:'right',
    background: cm.tinted ? 'rgba(0,0,0,0.04)' : cm.cardAlt,
    borderTop:`1px solid ${borderColor}`,
  };
  return (
    <table style={{width:'100%', borderCollapse:'collapse'}}>
      <thead>
        <tr>
          <th style={{...cellTh, textAlign:'left'}}>Year</th>
          <th style={cellTh}>Opening balance</th>
          <th style={cellTh}>Payment</th>
          <th style={cellTh}>Interest</th>
          <th style={cellTh}>Principal</th>
          <th style={cellTh}>Closing balance</th>
        </tr>
      </thead>
      <tbody>
        {amortRows.map(r => (
          <tr key={r.y}>
            <td style={{...cellTd, textAlign:'left', color:cm.muted}}>{r.y}</td>
            <td style={cellTd}>{fmt(r.open)}</td>
            <td style={cellTd}>{fmt(r.pay)}</td>
            <td style={{...cellTd, color:cm.muted}}>{fmt(r.int)}</td>
            <td style={cellTd}>{fmt(r.princ)}</td>
            <td style={cellTd}>{r.close === 0 ? <span style={{color:cm.pos}}>CHF 0</span> : fmt(r.close)}</td>
          </tr>
        ))}
        <tr>
          <td style={{...footTd, textAlign:'left', color:cm.muted}}>Σ</td>
          <td style={footTd}>—</td>
          <td style={footTd}>{fmt(amortSum.pay)}</td>
          <td style={footTd}>{fmt(amortSum.int)}</td>
          <td style={footTd}>{fmt(amortSum.princ)}</td>
          <td style={footTd}>—</td>
        </tr>
      </tbody>
    </table>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sparkline data
// ─────────────────────────────────────────────────────────────────────────────
const sparkData = {
  rev:   [49,50,52,51,53,55,57,56,58,59,60,61],
  profit:[5.2,5.5,5.8,5.7,6.3,6.8,7.2,7.4,7.6,7.9,8.0,8.15],
  margin:[60.5,61,60.8,61.2,61.4,61.5,61.6,61.8,62.0,62.1,62.0,62],
  be:    [203,201,199,195,193,190,188,186,183,181,179,178],
  ltv:   [410,408,415,412,410,413,411,414,412,411,413,412],
};

// ─────────────────────────────────────────────────────────────────────────────
// Page-level hero + body
// ─────────────────────────────────────────────────────────────────────────────
const CafeBody = () => {
  const cm = useCm();
  return (
    <div style={{maxWidth:1180, margin:'0 auto', padding:'44px 32px 64px'}}>

      {/* Hero */}
      <div style={{marginBottom:36}}>
        <div style={{
          fontSize:11.5, fontWeight:500, color:cm.subtle,
          letterSpacing: cm.uppercase ? 1.5 : 0.6, textTransform:'uppercase', marginBottom:8,
          fontFamily: cm.monoEverything ? cm.fontMono : 'inherit',
        }}>{cm.monoEverything ? '// SMALL_BUSINESS · CASH_FLOW' : 'Small business · pricing & cash flow'}</div>
        <h1 style={{
          margin:0, fontSize:40, fontWeight:600,
          letterSpacing: cm.uppercase ? -0.5 : -1.2,
          color:cm.ink, lineHeight:1.05,
          fontFamily: cm.monoEverything ? cm.fontMono : 'inherit',
          textTransform: cm.uppercase ? 'uppercase' : 'none',
        }}>{cm.monoEverything ? 'CAFE_MARGIN.STUDIO' : 'Café Margin Studio'}</h1>
        <p style={{margin:'12px 0 0', fontSize:15.5, color:cm.muted,
          lineHeight:1.5, maxWidth:640,
          fontFamily: cm.monoEverything ? cm.fontMono : 'inherit'}}>
          {cm.monoEverything
            ? '$ price_menu --plan-week --see-where-money-goes'
            : 'Price your menu, plan your week, see where the money actually goes.'}
        </p>
      </div>

      {/* 1 — Your café */}
      <Sec idx={1} title={cm.uppercase ? 'Your café' : 'Your café'} sub="the basics">
        <Card kind="inputs">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'18px 22px'}}>
            <TextField  label="Café name"   value="Kaffee Nordwand"/>
            <TextField  label="City / locale" value="Zürich"/>
            <Stepper    label="Open days per week" value={6}/>
            <Stepper    label="Seats" value={28}/>
            <RadioGroup label="Pricing strategy" value="Mid-market"
              options={['Value','Mid-market','Premium']}/>
            <Dropdown   label="Concept" value="Specialty espresso bar"/>
          </div>
        </Card>
      </Sec>

      {/* 2 — Volume */}
      <Sec idx={2} title="Volume assumptions" sub="how busy the place runs">
        <Card kind="inputs">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'20px 24px'}}>
            <Slider label="Average cups per day" value="240" pct={(240-50)/(500-50)*100}
              range={['50','500']} hint="cups/day"/>
            <CurrencyField label="Average ticket size" value="8.50" hint="excl. card fees"/>
            <Slider label="Weekday-to-weekend ratio" value="Even" pct={50}
              ticks={['Weekday-heavy','Even','Weekend-heavy']}/>
            <Slider label="Repeat-customer share" value="42" suffix="%"
              pct={42/80*100} range={['0%','80%']}/>
            <Slider label="Food attach rate" value="35" suffix="%"
              pct={35} range={['0%','100%']}/>
            <Slider label="Peak-hour share" value="28" suffix="%"
              pct={28/60*100} range={['0%','60%']}/>
            <Slider label="Seasonality swing" value="18" suffix="%"
              pct={18/50*100} range={['0%','50%']}/>
          </div>
        </Card>
      </Sec>

      {/* 3 — Costs */}
      <Sec idx={3} title="Cost structure" sub="what the month eats">
        <Card kind="inputs">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'20px 24px'}}>
            <CurrencyField label="Rent (monthly)" value="6,800"/>
            <CurrencyField label="Staff cost (monthly)" value="18,400"/>
            <CurrencyField label="COGS — coffee per cup" value="0.85"/>
            <CurrencyField label="COGS — food per item" value="2.10"/>
            <CurrencyField label="Utilities + sundries" value="1,950" hint="monthly"/>
            <CurrencyField label="Marketing" value="600" hint="monthly"/>
            <Toggle label="VAT included in prices" on={true} hint="display + accounting"/>
            <Slider label="Card-processing fee" value="1.6" suffix="%"
              pct={1.6/4*100} range={['0%','4%']}/>
          </div>
        </Card>
      </Sec>

      {/* 4 — Goals */}
      <Sec idx={4} title="Goals" sub="what 'good' looks like">
        <Card kind="inputs">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'20px 24px'}}>
            <CurrencyField label="Target monthly profit" value="9,000"/>
            <Slider label="Target gross margin" value="65" suffix="%"
              pct={(65-40)/(80-40)*100} range={['40%','80%']}/>
            <Slider label="Reinvestment % of profit" value="20" suffix="%"
              pct={20/50*100} range={['0%','50%']}/>
            <Stepper label="Hours owner works per week" value={50}/>
          </div>
        </Card>
      </Sec>

      {/* 5 — Snapshot KPIs */}
      <Sec idx={5} title="Snapshot" sub="this month at a glance">
        <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:14}}>
          <KPI label="Monthly revenue" value="CHF 61,200"
            delta="▲ 8% vs. last quarter" deltaKind="pos"
            spark={sparkData.rev} sparkColor={cm.pos}/>
          <KPI label="Monthly profit" value="CHF 8,150"
            delta="▼ 9% vs. target" deltaKind="warn"
            spark={sparkData.profit}/>
          <KPI label="Gross margin" value="62%"
            delta="▲ 1.4pp vs. last quarter" deltaKind="pos"
            spark={sparkData.margin} sparkColor={cm.pos}/>
          <KPI label="Break-even cups/day" value="178"
            delta="▼ 12 vs. last quarter" deltaKind="pos"
            spark={sparkData.be} sparkColor={cm.pos}/>
          <KPI label="Customer LTV" value="CHF 412"
            spark={sparkData.ltv} sparkColor={cm.muted}/>
        </div>
      </Sec>

      {/* 6 — Waterfall */}
      <Sec idx={6} title="Where the money goes" sub="a typical month, gross to net">
        <Card kind="chart">
          <Waterfall items={[
            { label:'Gross revenue', value:61200, kind:'start' },
            { label:'COGS · coffee', value:6120,  kind:'cost' },
            { label:'COGS · food',   value:4560,  kind:'cost' },
            { label:'Staff',         value:18400, kind:'cost' },
            { label:'Rent',          value:6800,  kind:'cost' },
            { label:'Utilities',     value:1950,  kind:'cost' },
            { label:'Marketing',     value:600,   kind:'cost' },
            { label:'Card fees',     value:980,   kind:'cost' },
            { label:'VAT (passthr.)',value:13640, kind:'softcost' },
            { label:'Net profit',    value:8150,  kind:'end' },
          ]}/>
        </Card>
      </Sec>

      {/* 7 — Bullets */}
      <Sec idx={7} title="Targets" sub="actual vs. plan">
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14}}>
          <Card kind="results">
            <Bullet label="Monthly profit" actual={8150} target={9000} max={12000} suffix=" CHF"/>
          </Card>
          <Card kind="results">
            <Bullet label="Gross margin" actual={62} target={65} max={80} suffix="%"/>
          </Card>
          <Card kind="results">
            <Bullet label="Cups per day" actual={240} target={220} max={280} exceeds/>
          </Card>
        </div>
      </Sec>

      {/* 8 — Heatmap */}
      <Sec idx={8} title="Capacity heatmap" sub="customers per hour, typical week">
        <Card kind="chart">
          <Heatmap/>
        </Card>
      </Sec>

      {/* 9 — Plan health */}
      <Sec idx={9} title="Plan health" sub="three quick reads">
        <div style={{display:'grid', gridTemplateColumns:'1fr 1.05fr 1.2fr', gap:14}}>
          <Card kind="results">
            <div style={{fontSize:11, fontWeight:600, color:cm.muted, letterSpacing:0.5,
              textTransform:'uppercase', marginBottom:18,
              fontFamily: cm.monoEverything ? cm.fontMono : 'inherit'}}>Margin health</div>
            <RadialProgress pct={78}/>
          </Card>
          <Card kind="results">
            <div style={{fontSize:11, fontWeight:600, color:cm.muted, letterSpacing:0.5,
              textTransform:'uppercase', marginBottom:18,
              fontFamily: cm.monoEverything ? cm.fontMono : 'inherit'}}>Revenue mix</div>
            <Donut/>
          </Card>
          <Card kind="results">
            <div style={{fontSize:11, fontWeight:600, color:cm.muted, letterSpacing:0.5,
              textTransform:'uppercase', marginBottom:6,
              fontFamily: cm.monoEverything ? cm.fontMono : 'inherit'}}>Weekday vs. weekend</div>
            <ComparisonBar/>
          </Card>
        </div>
      </Sec>

      {/* 10 — Stress test */}
      <Sec idx={10} title="Stress test" sub="what-ifs">
        <Card kind="results">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12}}>
            <Toggle inline on={false} label="Rent goes up 15%"/>
            <Toggle inline on={true}  label="Lose 20% of weekday traffic"/>
            <Toggle inline on={false} label="Add a weekend brunch menu"/>
          </div>
          <div style={{
            marginTop:18, display:'grid', gridTemplateColumns:'1fr 1fr', gap:14,
          }}>
            <div style={{
              background: cm.isCyber ? cm.accentSoft : (cm.terminal ? 'transparent' : cm.cardAlt),
              border:`1px ${cm.terminal ? 'dashed' : 'solid'} ${cm.isCyber ? cm.accent : (cm.terminal ? cm.rule : (cm.border === 'transparent' ? cm.borderStr : cm.border))}`,
              borderRadius: cm.fieldRadius,
              padding:'16px 18px',
            }}>
              <div style={{fontSize:11, fontWeight:600, color:cm.muted,
                letterSpacing:0.5, textTransform:'uppercase', marginBottom:6,
                fontFamily: cm.monoEverything ? cm.fontMono : 'inherit'}}>
                Adjusted monthly profit
              </div>
              <div style={{display:'flex', alignItems:'baseline', gap:10}}>
                <span style={cm.isCyber ? {...cm.mono(22), color: cm.accent} : cm.mono(22)}>CHF 5,920</span>
                <Delta kind="warn">−27% vs. baseline</Delta>
              </div>
            </div>
            <div style={{
              background: cm.isCyber ? cm.accentSoft : (cm.terminal ? 'transparent' : cm.cardAlt),
              border:`1px ${cm.terminal ? 'dashed' : 'solid'} ${cm.isCyber ? cm.accent : (cm.terminal ? cm.rule : (cm.border === 'transparent' ? cm.borderStr : cm.border))}`,
              borderRadius: cm.fieldRadius,
              padding:'16px 18px',
            }}>
              <div style={{fontSize:11, fontWeight:600, color:cm.muted,
                letterSpacing:0.5, textTransform:'uppercase', marginBottom:6,
                fontFamily: cm.monoEverything ? cm.fontMono : 'inherit'}}>
                Adjusted break-even cups/day
              </div>
              <div style={{display:'flex', alignItems:'baseline', gap:10}}>
                <span style={cm.isCyber ? {...cm.mono(22), color: cm.accent} : cm.mono(22)}>211</span>
                <Delta kind="warn">+33 cups needed</Delta>
              </div>
            </div>
          </div>
          <p style={{margin:'16px 2px 0', fontSize:12.5, color:cm.muted, lineHeight:1.5,
            fontFamily: cm.monoEverything ? cm.fontMono : 'inherit'}}>
            {cm.monoEverything
              ? '// toggle scenarios above to stress-test the plan. numbers update live.'
              : 'Toggle scenarios above to stress-test the plan. Numbers update live.'}
          </p>
        </Card>
      </Sec>

      {/* 11 — Amortization table */}
      <Sec idx={11} title="Espresso machine financing"
        sub="CHF 18,000 · 4.2% APR · 8-year amortization" last>
        <Card kind="chart" pad={false}>
          <AmortTable/>
        </Card>
      </Sec>

      {/* Footer */}
      <div style={{
        marginTop:48, paddingTop:18, borderTop:`1px solid ${cm.border === 'transparent' ? cm.rule : cm.border}`,
        display:'flex', alignItems:'center', gap:14, color:cm.muted, fontSize:12,
        fontFamily: cm.monoEverything ? cm.fontMono : 'inherit',
      }}>
        <span>{cm.monoEverything ? '// built_with' : 'Built with'}</span>
        <div style={{display:'flex', alignItems:'center', gap:8, color:cm.ink}}>
          <div style={{
            width:18, height:18, borderRadius: cm.terminal ? 0 : 4,
            background: cm.terminal ? 'transparent' : cm.ink,
            border: cm.terminal ? `1px solid ${cm.ink}` : 'none',
            color: cm.terminal ? cm.ink : cm.bg,
            fontFamily:cm.fontMono, fontSize:11, fontWeight:600,
            display:'inline-flex', alignItems:'center', justifyContent:'center',
          }}>c</div>
          <span style={{fontWeight:600, letterSpacing:-0.2}}>
            {cm.monoEverything ? 'CALCGRINDER' : 'Calcgrinder'}
          </span>
        </div>
        <span style={{flex:1}}/>
        <span style={{color:cm.subtle}}>v1 · Café Margin Studio · published 2 days ago</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CafeMarginCalculator — top-level wrapper, takes a themeKey
// ─────────────────────────────────────────────────────────────────────────────
const CafeMarginCalculator = ({ themeKey='editorial', user='registered' }) => {
  const th = THEMES[themeKey];
  const cm = mkCm(th);

  // Glow page background — hue follows theme's glowRgba (defaults to Vercel green).
  const g = cm.glowRgba || '0,220,130';
  const pageBg = cm.glow
    ? `radial-gradient(900px 600px at 20% -100px, rgba(${g},0.07), transparent 60%), radial-gradient(800px 500px at 90% 110%, rgba(${g},0.05), transparent 60%), ${cm.bg}`
    : cm.bg;

  return (
    <CmCtx.Provider value={cm}>
      <div style={{
        background: pageBg, color: cm.text, width:'100%', height:'100%',
        fontFamily: cm.font, fontSize:14, letterSpacing:-0.05,
        display:'flex', flexDirection:'column', overflow:'hidden',
        WebkitFontSmoothing:'antialiased',
      }}>
        <ThHeader th={cm} user={user}/>
        <div style={{flex:1, overflow:'auto'}}>
          <CafeBody/>
        </div>
      </div>
    </CmCtx.Provider>
  );
};

Object.assign(window, { CafeMarginCalculator });
