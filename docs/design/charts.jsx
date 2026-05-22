// Calcgrinder — Charts gallery (visitor-view renders)
// Pure SVG. No external chart libs. Pass A: design vocabulary only.
//
// Each chart sits in a card matching the editor-builder.jsx Slot style:
//   border 1px, radius 10, subtle shadow, small title + optional subtitle,
//   chart body with ~18-20px internal padding.
//
// Gallery is rendered three times on the canvas:
//   · Calcgrinder Light   (cgTokens.light + indigo accent #4F46E5)
//   · Calcgrinder Dark    (cgTokens.dark  + lifted indigo)
//   · Vessel · Glow       (THEMES.vessel — neon green on deep neutral)

// ─────────────────────────────────────────────────────────────────────────────
// Chart palettes (per-mode 5-stop series colours + heatmap ramp + semantics)
// Sequences are NEUTRAL-leaning, not full rainbow — chosen so 3 series in the
// same chart read as a hierarchy (most important first) and not as a parade.
// ─────────────────────────────────────────────────────────────────────────────
const chartPalette = {
  cgLight: {
    series:  ['#4F46E5', '#1C1917', '#A5B4FC', '#78716C', '#F59E0B'],
    heat:    ['#F5F5F4', '#E4E5F8', '#C7C9EE', '#9DA3DD', '#6F75D0', '#4F46E5'],
    pos:     '#16A34A', posSoft: '#DCFCE7',
    neg:     '#DC2626', negSoft: '#FEE2E2',
    neutral: '#D6D3D1', // muted-neutral fill (comparison-bar "other" series, waterfall totals)
  },
  cgDark: {
    series:  ['#818CF8', '#F5F5F4', '#C7D2FE', '#A8A29E', '#F59E0B'],
    heat:    ['#1F1D1B', '#262647', '#363873', '#52549F', '#7378CC', '#A5B4FC'],
    pos:     '#4ADE80', posSoft: 'rgba(74,222,128,0.18)',
    neg:     '#F87171', negSoft: 'rgba(248,113,113,0.16)',
    neutral: '#3C3835',
  },
  vesselGlow: {
    series:  ['#00DC82', '#FAFAFA', '#1FAA7C', '#888888', '#FFC857'],
    heat:    ['#161616', '#142C20', '#16553B', '#108A55', '#00B96E', '#00DC82'],
    pos:     '#00DC82', posSoft: 'rgba(0,220,130,0.18)',
    neg:     '#F87171', negSoft: 'rgba(248,113,113,0.14)',
    neutral: '#2A2A2A',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Chart-theme tokens — composed from cgTokens + palette + name + canvas bg.
// Used to color every primitive below. Each chart receives `t` and reads only
// from this shape; never from cgTokens directly.
// ─────────────────────────────────────────────────────────────────────────────
const chartThemes = {
  cgLight: {
    name: 'Calcgrinder · Light',
    ...cgTokens.light,
    canvasBg: cgTokens.light.bg,
    pal: chartPalette.cgLight,
    cardShadow: '0 1px 2px rgba(28,25,23,0.04), 0 1px 1px rgba(28,25,23,0.03)',
    glow: false,
  },
  cgDark: {
    name: 'Calcgrinder · Dark',
    ...cgTokens.dark,
    canvasBg: cgTokens.dark.bg,
    pal: chartPalette.cgDark,
    cardShadow: '0 1px 2px rgba(0,0,0,0.4), 0 1px 1px rgba(0,0,0,0.3)',
    glow: false,
  },
  vesselGlow: {
    name: 'Vessel · Glow',
    bg:         '#0A0A0A',
    surface:    '#0F0F0F',
    surface2:   '#171717',
    surface3:   '#1F1F1F',
    border:     '#1F1F1F',
    borderStr:  '#2A2A2A',
    text:       '#EDEDED',
    textMuted:  '#8A8A8A',
    textSubtle: '#555555',
    accent:     '#00DC82',
    accentHov:  '#22EE9A',
    accentSoft: 'rgba(0,220,130,0.12)',
    accentFg:   '#0A0A0A',
    accentText: '#00DC82',
    canvasBg:   'radial-gradient(900px 600px at 20% -100px, rgba(0,220,130,0.08), transparent 60%), radial-gradient(800px 500px at 90% 110%, rgba(0,220,130,0.05), transparent 60%), #0A0A0A',
    pal:        chartPalette.vesselGlow,
    cardShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 0 24px rgba(0,220,130,0.05), 0 12px 32px rgba(0,0,0,0.5)',
    glow:       true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
// Catmull-Rom → cubic-bezier smoothing. Returns an SVG path "d" string for a
// pleasant curve through the given [x,y] points (used by Line/Area/Sparkline).
const smoothPath = (pts) => {
  if (!pts.length) return '';
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ');
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
};

const fmtMoney = (n) => {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
};

const MONO = '"Geist Mono", monospace';
const SANS = '"Geist", -apple-system, system-ui, sans-serif';

// ─────────────────────────────────────────────────────────────────────────────
// Card frame — matches the builder Slot/cell vocabulary: rounded outer
// container, hairline border, subtle shadow. Title (text) + optional subtitle
// (textMuted) sit in a soft top region; chart body has 16-20px internal pad.
// ─────────────────────────────────────────────────────────────────────────────
const ChartCard = ({ t, title, subtitle, width, height, children, bodyPad = 18 }) => (
  <div style={{
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 10,
    boxShadow: t.cardShadow,
    width, // optional fixed; usually grid sizes us
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: SANS,
  }}>
    <div style={{ padding: '14px 18px 12px' }}>
      <div style={{
        fontSize: 13.5, fontWeight: 600, color: t.text, letterSpacing: -0.2, lineHeight: 1.3,
      }}>{title}</div>
      {subtitle && (
        <div style={{ marginTop: 2, fontSize: 11.5, color: t.textMuted, letterSpacing: -0.05 }}>
          {subtitle}
        </div>
      )}
    </div>
    <div style={{
      flex: 1, minHeight: height,
      padding: `0 ${bodyPad}px ${bodyPad}px`,
      display: 'flex', flexDirection: 'column',
    }}>
      {children}
    </div>
  </div>
);

// Inline legend chip used by several charts.
const LegendRow = ({ t, items, mono = false, mt = 6 }) => (
  <div style={{
    display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: mt,
    fontSize: 11, color: t.textMuted, fontFamily: mono ? MONO : SANS, letterSpacing: -0.05,
  }}>
    {items.map((it, i) => (
      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: it.swatch === 'line' ? 12 : 9,
          height: it.swatch === 'line' ? 2 : 9,
          borderRadius: it.swatch === 'line' ? 0 : 2,
          background: it.color,
          boxShadow: t.glow && it.swatch !== 'line'
            ? `0 0 6px ${it.color}66` : undefined,
        }}/>
        <span>{it.label}</span>
      </span>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Line — 3 series over months
// ─────────────────────────────────────────────────────────────────────────────
const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const lineData = [
  { revenue: 38, cost: 28, profit: 10 },
  { revenue: 42, cost: 30, profit: 12 },
  { revenue: 46, cost: 31, profit: 15 },
  { revenue: 43, cost: 32, profit: 11 },
  { revenue: 49, cost: 33, profit: 16 },
  { revenue: 54, cost: 34, profit: 20 },
  { revenue: 58, cost: 36, profit: 22 },
  { revenue: 56, cost: 37, profit: 19 },
  { revenue: 62, cost: 38, profit: 24 },
  { revenue: 65, cost: 39, profit: 26 },
  { revenue: 68, cost: 41, profit: 27 },
  { revenue: 72, cost: 42, profit: 30 },
];

const ChartLine = ({ t }) => {
  const W = 408, H = 200;
  const pad = { l: 36, r: 14, t: 10, b: 24 };
  const yMax = 80, yMin = 0;
  const xs = (i) => pad.l + (i / (lineData.length - 1)) * (W - pad.l - pad.r);
  const ys = (v) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const ticks = [0, 20, 40, 60, 80];
  const series = [
    { key: 'revenue', color: t.pal.series[0], label: 'Revenue' },
    { key: 'cost',    color: t.pal.series[3], label: 'Cost' },
    { key: 'profit',  color: t.pal.series[1], label: 'Profit' },
  ];
  return (
    <React.Fragment>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map(g => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={ys(g)} y2={ys(g)} stroke={t.border} strokeWidth={1}/>
            <text x={pad.l - 6} y={ys(g) + 3.5} fontSize={10} textAnchor="end"
              fill={t.textSubtle} fontFamily={MONO}>${g}k</text>
          </g>
        ))}
        {lineData.map((_, i) => i % 2 === 0 && (
          <text key={i} x={xs(i)} y={H - pad.b + 13} fontSize={10} textAnchor="middle"
            fill={t.textSubtle} fontFamily={MONO}>{monthLabels[i]}</text>
        ))}
        {series.map(s => {
          const pts = lineData.map((d, i) => [xs(i), ys(d[s.key])]);
          return (
            <path key={s.key} d={smoothPath(pts)} fill="none" stroke={s.color}
              strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
              style={t.glow ? { filter: `drop-shadow(0 0 4px ${s.color}99)` } : null}/>
          );
        })}
        {series.map(s => lineData.map((d, i) => (
          <circle key={`${s.key}-${i}`} cx={xs(i)} cy={ys(d[s.key])} r={2}
            fill={t.surface} stroke={s.color} strokeWidth={1.25}/>
        )))}
      </svg>
      <LegendRow t={t} items={series.map(s => ({ label: s.label, color: s.color, swatch: 'line' }))}/>
    </React.Fragment>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Bar — single series (sales by region)
// ─────────────────────────────────────────────────────────────────────────────
const barData = [
  { label: 'NW', value: 42 },
  { label: 'NE', value: 58 },
  { label: 'SW', value: 36 },
  { label: 'SE', value: 64 },
  { label: 'MW', value: 49 },
  { label: 'PNW', value: 52 },
];

const ChartBar = ({ t }) => {
  const W = 408, H = 200;
  const pad = { l: 36, r: 14, t: 10, b: 24 };
  const yMax = 80;
  const innerW = W - pad.l - pad.r;
  const barW = innerW / barData.length * 0.6;
  const slot = innerW / barData.length;
  const ys = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const ticks = [0, 20, 40, 60, 80];
  return (
    <React.Fragment>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map(g => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={ys(g)} y2={ys(g)} stroke={t.border} strokeWidth={1}/>
            <text x={pad.l - 6} y={ys(g) + 3.5} fontSize={10} textAnchor="end"
              fill={t.textSubtle} fontFamily={MONO}>${g}k</text>
          </g>
        ))}
        {barData.map((d, i) => {
          const cx = pad.l + slot * (i + 0.5);
          const y = ys(d.value);
          const h = H - pad.b - y;
          return (
            <g key={d.label}>
              <rect x={cx - barW/2} y={y} width={barW} height={h} rx={2} ry={2}
                fill={t.pal.series[0]}
                style={t.glow ? { filter: `drop-shadow(0 0 6px ${t.pal.series[0]}55)` } : null}/>
              <text x={cx} y={H - pad.b + 13} fontSize={10} textAnchor="middle"
                fill={t.textSubtle} fontFamily={MONO}>{d.label}</text>
            </g>
          );
        })}
      </svg>
      <LegendRow t={t} items={[{ label: 'Sales (Q1)', color: t.pal.series[0], swatch: 'box' }]}/>
    </React.Fragment>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Area — stacked area (3 traffic sources)
// ─────────────────────────────────────────────────────────────────────────────
const areaData = [
  // direct, organic, paid
  [12,  20,  8],
  [14,  22,  9],
  [13,  24, 10],
  [16,  26, 11],
  [18,  30, 12],
  [17,  32, 14],
  [20,  35, 15],
  [22,  37, 17],
  [21,  40, 18],
  [24,  44, 19],
  [25,  46, 20],
  [28,  50, 22],
];

const ChartArea = ({ t }) => {
  const W = 408, H = 200;
  const pad = { l: 36, r: 14, t: 10, b: 24 };
  const stackTotals = areaData.map(d => d[0] + d[1] + d[2]);
  const yMax = Math.ceil(Math.max(...stackTotals) / 20) * 20;
  const xs = (i) => pad.l + (i / (areaData.length - 1)) * (W - pad.l - pad.r);
  const ys = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  // Build cumulative-top points per layer
  const layers = [0, 1, 2].map(layerIdx => {
    return areaData.map((d, i) => {
      const sumBelow = d.slice(0, layerIdx).reduce((a, b) => a + b, 0);
      return [xs(i), ys(sumBelow + d[layerIdx])];
    });
  });
  const bottomLine = (yVal) => areaData.map((_, i) => [xs(i), ys(yVal[i])]);
  const layerColors = [t.pal.series[0], t.pal.series[2], t.pal.series[3]];
  const ticks = [0, yMax / 2, yMax];
  return (
    <React.Fragment>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map(g => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={ys(g)} y2={ys(g)} stroke={t.border} strokeWidth={1}/>
            <text x={pad.l - 6} y={ys(g) + 3.5} fontSize={10} textAnchor="end"
              fill={t.textSubtle} fontFamily={MONO}>{g}k</text>
          </g>
        ))}
        {areaData.map((_, i) => i % 2 === 0 && (
          <text key={i} x={xs(i)} y={H - pad.b + 13} fontSize={10} textAnchor="middle"
            fill={t.textSubtle} fontFamily={MONO}>{monthLabels[i]}</text>
        ))}
        {/* Stacked filled areas, bottom layer first */}
        {[2, 1, 0].map(layerIdx => {
          // Top of this layer
          const top = layers[layerIdx];
          // Bottom: sum of layers below, or zero
          const bottomVals = areaData.map((d) => d.slice(0, layerIdx).reduce((a, b) => a + b, 0));
          const bottom = bottomLine(bottomVals);
          const topPath = smoothPath(top);
          const bottomPath = smoothPath([...bottom].reverse()).replace(/^M/, 'L');
          const d = `${topPath} ${bottomPath} Z`;
          return (
            <g key={layerIdx}>
              <path d={d} fill={layerColors[layerIdx]} fillOpacity={t.glow ? 0.4 : 0.35}/>
              <path d={topPath} fill="none" stroke={layerColors[layerIdx]} strokeWidth={1.5}
                strokeLinecap="round" strokeLinejoin="round"/>
            </g>
          );
        })}
      </svg>
      <LegendRow t={t} items={[
        { label: 'Direct', color: layerColors[0], swatch: 'box' },
        { label: 'Organic', color: layerColors[1], swatch: 'box' },
        { label: 'Paid', color: layerColors[2], swatch: 'box' },
      ]}/>
    </React.Fragment>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 4 & 5. Pie / Donut (shared geometry; Pie has labels, Donut has center total)
// ─────────────────────────────────────────────────────────────────────────────
const pieData = [
  { label: 'Search',    value: 38, },
  { label: 'Social',    value: 24, },
  { label: 'Email',     value: 18, },
  { label: 'Referral',  value: 12, },
  { label: 'Direct',    value:  8, },
];

const arcPath = (cx, cy, r, a0, a1) => {
  const large = (a1 - a0) % (2 * Math.PI) > Math.PI ? 1 : 0;
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
};
const ringArc = (cx, cy, rOut, rIn, a0, a1) => {
  const large = (a1 - a0) % (2 * Math.PI) > Math.PI ? 1 : 0;
  const x0o = cx + rOut * Math.cos(a0), y0o = cy + rOut * Math.sin(a0);
  const x1o = cx + rOut * Math.cos(a1), y1o = cy + rOut * Math.sin(a1);
  const x0i = cx + rIn  * Math.cos(a0), y0i = cy + rIn  * Math.sin(a0);
  const x1i = cx + rIn  * Math.cos(a1), y1i = cy + rIn  * Math.sin(a1);
  return `M ${x0o} ${y0o} A ${rOut} ${rOut} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rIn} ${rIn} 0 ${large} 0 ${x0i} ${y0i} Z`;
};

// Compose pie/donut slice colors as an indigo/accent ramp
const pieColors = (t) => {
  const a = t.pal.series[0];
  // 5 tones lightening from accent for pie/donut readability
  if (t.name === 'Vessel · Glow') return ['#00DC82', '#1FAA7C', '#3F8F70', '#5C7C6E', '#7D9088'];
  if (t.name === 'Calcgrinder · Dark') return ['#A5B4FC', '#818CF8', '#6366F1', '#4F46E5', '#3730A3'];
  return ['#4F46E5', '#6366F1', '#818CF8', '#A5B4FC', '#C7D2FE'];
};

const ChartPie = ({ t }) => {
  const W = 408, H = 200, cx = 110, cy = 96, r = 78;
  const total = pieData.reduce((s, d) => s + d.value, 0);
  const colors = pieColors(t);
  let acc = -Math.PI / 2;
  const slices = pieData.map((d, i) => {
    const a0 = acc;
    const a1 = acc + (d.value / total) * Math.PI * 2;
    acc = a1;
    const aMid = (a0 + a1) / 2;
    const pct = Math.round((d.value / total) * 100);
    return { d, a0, a1, aMid, pct, color: colors[i] };
  });
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 18 }}>
      <svg viewBox={`0 0 ${W * 0.55} ${H}`} style={{ width: '55%', height: 'auto' }}>
        {slices.map((s, i) => (
          <path key={i} d={arcPath(cx, cy, r, s.a0, s.a1)} fill={s.color}
            stroke={t.surface} strokeWidth={1.5}/>
        ))}
        {/* Inside-slice labels for big slices (>=15%) */}
        {slices.map((s, i) => {
          if (s.pct < 14) return null;
          const lx = cx + r * 0.6 * Math.cos(s.aMid);
          const ly = cy + r * 0.6 * Math.sin(s.aMid);
          return (
            <text key={`il-${i}`} x={lx} y={ly + 3.5} fontSize={11} fontWeight={600}
              textAnchor="middle" fill={i < 2 ? '#FFFFFF' : (t.glow ? '#0A0A0A' : '#FFFFFF')}
              fontFamily={MONO}>{s.pct}%</text>
          );
        })}
        {/* Leader-line labels for small slices */}
        {slices.map((s, i) => {
          if (s.pct >= 14) return null;
          const x0 = cx + r * Math.cos(s.aMid);
          const y0 = cy + r * Math.sin(s.aMid);
          const x1 = cx + (r + 10) * Math.cos(s.aMid);
          const y1 = cy + (r + 10) * Math.sin(s.aMid);
          const right = Math.cos(s.aMid) >= 0;
          const x2 = right ? x1 + 6 : x1 - 6;
          return (
            <g key={`ll-${i}`}>
              <polyline points={`${x0},${y0} ${x1},${y1} ${x2},${y1}`}
                fill="none" stroke={t.textSubtle} strokeWidth={0.75}/>
              <text x={x2 + (right ? 2 : -2)} y={y1 + 3} fontSize={10}
                textAnchor={right ? 'start' : 'end'} fill={t.textMuted}
                fontFamily={MONO}>{s.pct}%</text>
            </g>
          );
        })}
      </svg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
            <span style={{
              width: 9, height: 9, borderRadius: 2, background: s.color,
              boxShadow: t.glow ? `0 0 6px ${s.color}55` : undefined, flexShrink: 0,
            }}/>
            <span style={{ color: t.text, flex: 1 }}>{s.d.label}</span>
            <span style={{ color: t.textMuted, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
              {s.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ChartDonut = ({ t }) => {
  const W = 408, H = 200, cx = 110, cy = 96, rOut = 78, rIn = 50;
  const total = pieData.reduce((s, d) => s + d.value, 0);
  const colors = pieColors(t);
  let acc = -Math.PI / 2;
  const slices = pieData.map((d, i) => {
    const a0 = acc;
    const a1 = acc + (d.value / total) * Math.PI * 2;
    acc = a1;
    return { d, a0, a1, color: colors[i] };
  });
  const totalRevenue = '$24,500';
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ position: 'relative', width: '55%' }}>
        <svg viewBox={`0 0 ${W * 0.55} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {slices.map((s, i) => (
            <path key={i} d={ringArc(cx, cy, rOut, rIn, s.a0, s.a1)} fill={s.color}
              stroke={t.surface} strokeWidth={1.5}
              style={t.glow && i === 0 ? { filter: `drop-shadow(0 0 8px ${s.color}66)` } : null}/>
          ))}
          <text x={cx} y={cy - 4} fontSize={20} fontWeight={600} textAnchor="middle"
            fill={t.text} fontFamily={MONO} letterSpacing={-0.6}>{totalRevenue}</text>
          <text x={cx} y={cy + 14} fontSize={10} textAnchor="middle"
            fill={t.textMuted} fontFamily={SANS}
            style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>Total revenue</text>
        </svg>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0 }}/>
            <span style={{ color: t.text, flex: 1 }}>{s.d.label}</span>
            <span style={{ color: t.textMuted, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(s.d.value / total * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Stacked bar — 4 quarters × 3 product lines
// ─────────────────────────────────────────────────────────────────────────────
const stackData = [
  { q: 'Q1', a: 18, b: 12, c: 7 },
  { q: 'Q2', a: 22, b: 14, c: 9 },
  { q: 'Q3', a: 26, b: 13, c: 11 },
  { q: 'Q4', a: 31, b: 16, c: 14 },
];

const ChartStackedBar = ({ t }) => {
  const W = 408, H = 200;
  const pad = { l: 36, r: 14, t: 10, b: 24 };
  const innerW = W - pad.l - pad.r;
  const barW = innerW / stackData.length * 0.45;
  const slot = innerW / stackData.length;
  const yMax = 80;
  const ys = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const ticks = [0, 20, 40, 60, 80];
  const colors = [t.pal.series[0], t.pal.series[2], t.pal.series[3]];
  const labels = ['Core', 'Premium', 'Add-ons'];
  return (
    <React.Fragment>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map(g => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={ys(g)} y2={ys(g)} stroke={t.border} strokeWidth={1}/>
            <text x={pad.l - 6} y={ys(g) + 3.5} fontSize={10} textAnchor="end"
              fill={t.textSubtle} fontFamily={MONO}>${g}k</text>
          </g>
        ))}
        {stackData.map((d, i) => {
          const cx = pad.l + slot * (i + 0.5);
          let cursor = H - pad.b;
          const parts = [
            { v: d.a, color: colors[0] },
            { v: d.b, color: colors[1] },
            { v: d.c, color: colors[2] },
          ];
          return (
            <g key={d.q}>
              {parts.map((p, j) => {
                const h = (p.v / yMax) * (H - pad.t - pad.b);
                const y = cursor - h;
                cursor -= h;
                return <rect key={j} x={cx - barW/2} y={y} width={barW} height={h}
                  fill={p.color}/>;
              })}
              <text x={cx} y={H - pad.b + 13} fontSize={10} textAnchor="middle"
                fill={t.textSubtle} fontFamily={MONO}>{d.q}</text>
            </g>
          );
        })}
      </svg>
      <LegendRow t={t} items={labels.map((l, i) => ({ label: l, color: colors[i], swatch: 'box' }))}/>
    </React.Fragment>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. Comparison bar — Current vs Proposed across 4 categories
// ─────────────────────────────────────────────────────────────────────────────
const compareData = [
  { label: 'Rent',   a: 1800, b: 1600 },
  { label: 'Food',   a:  720, b:  580 },
  { label: 'Travel', a:  340, b:  220 },
  { label: 'Misc',   a:  280, b:  240 },
];

const ChartComparisonBar = ({ t }) => {
  const W = 408, H = 200;
  const pad = { l: 44, r: 14, t: 10, b: 24 };
  const innerW = W - pad.l - pad.r;
  const slot = innerW / compareData.length;
  const barW = slot * 0.32;
  const yMax = 2000;
  const ys = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const ticks = [0, 500, 1000, 1500, 2000];
  const colorA = t.pal.series[0];
  const colorB = t.pal.neutral;
  return (
    <React.Fragment>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map(g => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={ys(g)} y2={ys(g)} stroke={t.border} strokeWidth={1}/>
            <text x={pad.l - 6} y={ys(g) + 3.5} fontSize={10} textAnchor="end"
              fill={t.textSubtle} fontFamily={MONO}>${g}</text>
          </g>
        ))}
        {compareData.map((d, i) => {
          const cx = pad.l + slot * (i + 0.5);
          const yA = ys(d.a), hA = H - pad.b - yA;
          const yB = ys(d.b), hB = H - pad.b - yB;
          return (
            <g key={d.label}>
              <rect x={cx - barW - 2} y={yA} width={barW} height={hA} rx={2} fill={colorA}/>
              <rect x={cx + 2}        y={yB} width={barW} height={hB} rx={2} fill={colorB}/>
              <text x={cx} y={H - pad.b + 13} fontSize={10} textAnchor="middle"
                fill={t.textSubtle} fontFamily={MONO}>{d.label}</text>
            </g>
          );
        })}
      </svg>
      <LegendRow t={t} items={[
        { label: 'Current', color: colorA, swatch: 'box' },
        { label: 'Proposed', color: colorB, swatch: 'box' },
      ]}/>
    </React.Fragment>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. Sparkline — minimal silhouette in a small frame
// ─────────────────────────────────────────────────────────────────────────────
const sparkAsc      = [10, 12, 11, 14, 16, 15, 18, 20, 22, 21, 25, 28];
const sparkVolatile = [22, 16, 24, 12, 28, 14, 26, 10, 24, 18, 30, 16];

const ChartSparkline = ({ t, data, color, w = 168, h = 30 }) => {
  const pad = { l: 1, r: 1, t: 4, b: 4 };
  const min = Math.min(...data), max = Math.max(...data);
  const xs = (i) => pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r);
  const ys = (v) => h - pad.b - ((v - min) / Math.max(1, (max - min))) * (h - pad.t - pad.b);
  const pts = data.map((v, i) => [xs(i), ys(v)]);
  const linePath = smoothPath(pts);
  const fillPath = `${linePath} L ${xs(data.length - 1)} ${h - pad.b} L ${xs(0)} ${h - pad.b} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h, display: 'block' }}>
      <path d={fillPath} fill={color} fillOpacity={t.glow ? 0.22 : 0.14}/>
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round"
        style={t.glow ? { filter: `drop-shadow(0 0 4px ${color}aa)` } : null}/>
    </svg>
  );
};

const SparklinePairCard = ({ t }) => {
  const rows = [
    { label: 'Sessions', value: '12,480', delta: '+18%', color: t.pal.series[0], data: sparkAsc, deltaColor: t.pal.pos },
    { label: 'Bounce rate', value: '34.2%', delta: '−2.1%', color: t.pal.series[3], data: sparkVolatile, deltaColor: t.pal.pos },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 14,
          paddingTop: i === 0 ? 0 : 12,
          borderTop: i === 0 ? 'none' : `1px solid ${t.border}`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: t.textMuted, letterSpacing: 0.6,
              textTransform: 'uppercase', fontWeight: 600 }}>{r.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: t.text,
                letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
              <span style={{ fontSize: 11, color: r.deltaColor, fontWeight: 600,
                fontFamily: MONO }}>{r.delta}</span>
            </div>
          </div>
          <ChartSparkline t={t} data={r.data} color={r.color}/>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. Waterfall — contribution from Q1 to Q2
// ─────────────────────────────────────────────────────────────────────────────
const waterfallData = [
  { label: 'Q1',         value: 120, kind: 'start' },
  { label: 'New cust.',  value:  28, kind: 'pos' },
  { label: 'Upsell',     value:  14, kind: 'pos' },
  { label: 'Churn',      value: -12, kind: 'neg' },
  { label: 'Discount',   value:  -6, kind: 'neg' },
  { label: 'Seasonal',   value:  18, kind: 'pos' },
  { label: 'Q2',         value: 162, kind: 'end' },
];

const ChartWaterfall = ({ t }) => {
  const W = 408, H = 200;
  const pad = { l: 36, r: 14, t: 10, b: 32 };
  const innerW = W - pad.l - pad.r;
  const slot = innerW / waterfallData.length;
  const barW = slot * 0.62;
  // Cumulative model
  let run = 0;
  const bars = waterfallData.map(d => {
    if (d.kind === 'start' || d.kind === 'end') {
      const out = { ...d, from: 0, to: d.value };
      run = d.value;
      return out;
    }
    const from = run;
    const to = run + d.value;
    run = to;
    return { ...d, from, to };
  });
  const yMax = Math.ceil(Math.max(...bars.map(b => Math.max(b.from, b.to))) / 50) * 50;
  const ys = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const ticks = [0, yMax / 2, yMax];
  const colorPos = t.pal.pos;
  const colorNeg = t.pal.neg;
  const colorEnd = t.text;
  const colorStart = t.pal.neutral;
  return (
    <React.Fragment>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map(g => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={ys(g)} y2={ys(g)} stroke={t.border} strokeWidth={1}/>
            <text x={pad.l - 6} y={ys(g) + 3.5} fontSize={10} textAnchor="end"
              fill={t.textSubtle} fontFamily={MONO}>${g}k</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const cx = pad.l + slot * (i + 0.5);
          const yLo = ys(Math.max(b.from, b.to));
          const yHi = ys(Math.min(b.from, b.to));
          const h = yHi - yLo;
          let fill, stroke = 'none';
          if (b.kind === 'pos') fill = colorPos;
          else if (b.kind === 'neg') fill = colorNeg;
          else if (b.kind === 'end') { fill = 'transparent'; stroke = colorEnd; }
          else { fill = colorStart; }
          return (
            <g key={i}>
              {b.kind === 'end' ? (
                <rect x={cx - barW/2} y={ys(b.to)} width={barW} height={H - pad.b - ys(b.to)}
                  fill={t.surface2} stroke={colorEnd} strokeWidth={1.5}/>
              ) : (
                <rect x={cx - barW/2} y={yLo} width={barW} height={Math.max(2, h)}
                  fill={fill} rx={2}/>
              )}
              {/* Connector */}
              {i < bars.length - 1 && (
                <line x1={cx + barW/2} x2={pad.l + slot * (i + 1.5) - barW/2}
                  y1={ys(b.to)} y2={ys(b.to)}
                  stroke={t.textSubtle} strokeWidth={0.75} strokeDasharray="2 3"/>
              )}
              <text x={cx} y={H - pad.b + 13} fontSize={9.5} textAnchor="middle"
                fill={t.textSubtle} fontFamily={MONO}>{b.label}</text>
              {(b.kind === 'pos' || b.kind === 'neg') && (
                <text x={cx} y={yLo - 4} fontSize={9.5} textAnchor="middle"
                  fontWeight={600}
                  fill={b.kind === 'pos' ? colorPos : colorNeg} fontFamily={MONO}>
                  {b.value > 0 ? '+' : ''}{b.value}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <LegendRow t={t} items={[
        { label: 'Increase', color: colorPos, swatch: 'box' },
        { label: 'Decrease', color: colorNeg, swatch: 'box' },
        { label: 'Total',    color: colorEnd, swatch: 'box' },
      ]}/>
    </React.Fragment>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. Bullet — value vs target, three qualitative bands
// ─────────────────────────────────────────────────────────────────────────────
const ChartBullet = ({ t, label='Q1 revenue', actual=48, target=50, max=60, bands=[20, 40, 60], suffix='k' }) => {
  const W = 408, H = 80;
  const pad = { l: 14, r: 14, t: 14, b: 14 };
  const innerW = W - pad.l - pad.r;
  const x = (v) => pad.l + (v / max) * innerW;
  const barY = pad.t + 22;
  const barH = 18;
  const actualH = 9;
  // 3 bands: low (0→bands[0]) light, mid (bands[0]→bands[1]) mid, high (bands[1]→bands[2]) high
  const bandColors = t.glow
    ? ['#171717', '#1F1F1F', '#2A2A2A']
    : (t.name === 'Calcgrinder · Dark'
       ? ['#1F1D1B', '#2A2724', '#3C3835']
       : ['#F5F5F4', '#E7E5E4', '#D6D3D1']);
  const segments = [
    { from: 0,         to: bands[0], color: bandColors[0] },
    { from: bands[0],  to: bands[1], color: bandColors[1] },
    { from: bands[1],  to: bands[2], color: bandColors[2] },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: t.textMuted, letterSpacing: 0.6,
          textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
        <span style={{ flex: 1 }}/>
        <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: t.text,
          letterSpacing: -0.4 }}>${actual}{suffix}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: t.textMuted }}>
          / ${target}{suffix} target
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Bands */}
        {segments.map((s, i) => (
          <rect key={i} x={x(s.from)} y={barY} width={x(s.to) - x(s.from)} height={barH}
            fill={s.color}/>
        ))}
        {/* Actual */}
        <rect x={x(0)} y={barY + (barH - actualH) / 2} width={x(actual) - x(0)} height={actualH}
          fill={t.pal.series[0]} rx={1.5}
          style={t.glow ? { filter: `drop-shadow(0 0 6px ${t.pal.series[0]}77)` } : null}/>
        {/* Target tick */}
        <line x1={x(target)} x2={x(target)} y1={barY - 4} y2={barY + barH + 4}
          stroke={t.text} strokeWidth={2}/>
        {/* Scale */}
        {[0, bands[0], bands[1], bands[2]].map(v => (
          <text key={v} x={x(v)} y={H - 4} fontSize={9.5}
            textAnchor={v === 0 ? 'start' : v === max ? 'end' : 'middle'}
            fill={t.textSubtle} fontFamily={MONO}>${v}{suffix}</text>
        ))}
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 11. Heatmap — 7 hours × 7 days
// ─────────────────────────────────────────────────────────────────────────────
const heatDays  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const heatHours = ['6a','9a','12p','3p','6p','9p','12a'];
// Plausible engagement pattern (0..1 intensity)
const heatVals = [
  [0.2, 0.5, 0.7, 0.8, 0.7, 0.4, 0.1],
  [0.2, 0.5, 0.8, 0.8, 0.7, 0.4, 0.1],
  [0.3, 0.6, 0.8, 0.9, 0.7, 0.5, 0.2],
  [0.2, 0.5, 0.7, 0.8, 0.8, 0.5, 0.2],
  [0.2, 0.4, 0.6, 0.7, 0.8, 0.7, 0.4],
  [0.1, 0.3, 0.5, 0.6, 0.7, 0.8, 0.6],
  [0.1, 0.3, 0.6, 0.7, 0.6, 0.5, 0.3],
];

const ChartHeatmap = ({ t }) => {
  const W = 408, H = 240;
  const pad = { l: 36, r: 14, t: 6, b: 38 };
  const cols = heatHours.length;
  const rows = heatDays.length;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const cw = innerW / cols, ch = innerH / rows;
  // Build a 6-stop ramp
  const ramp = t.pal.heat;
  const pickColor = (v) => {
    const idx = Math.min(ramp.length - 1, Math.floor(v * (ramp.length - 0.001)));
    return ramp[idx];
  };
  return (
    <React.Fragment>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Cells */}
        {heatVals.map((row, ri) => row.map((v, ci) => (
          <rect key={`${ri}-${ci}`}
            x={pad.l + ci * cw + 1} y={pad.t + ri * ch + 1}
            width={cw - 2} height={ch - 2} rx={2}
            fill={pickColor(v)}/>
        )))}
        {/* Row labels (days) */}
        {heatDays.map((day, ri) => (
          <text key={day} x={pad.l - 6} y={pad.t + ri * ch + ch / 2 + 3}
            fontSize={10} textAnchor="end" fill={t.textMuted} fontFamily={MONO}>{day}</text>
        ))}
        {/* Col labels (hours) */}
        {heatHours.map((h, ci) => (
          <text key={h} x={pad.l + ci * cw + cw / 2} y={pad.t + innerH + 13}
            fontSize={10} textAnchor="middle" fill={t.textMuted} fontFamily={MONO}>{h}</text>
        ))}
        {/* Scale legend */}
        {ramp.map((c, i) => (
          <rect key={i} x={pad.l + i * 22} y={H - 14} width={20} height={8} rx={1.5}
            fill={c}/>
        ))}
        <text x={pad.l + ramp.length * 22 + 4} y={H - 7} fontSize={9.5}
          fill={t.textSubtle} fontFamily={MONO}>low → high</text>
      </svg>
    </React.Fragment>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 12. Radial progress — ring with center % and subtitle
// ─────────────────────────────────────────────────────────────────────────────
const ChartRadial = ({ t, pct, label, sub }) => {
  const size = 120, stroke = 12;
  const cx = size / 2, cy = size / 2;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', height: '100%' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.surface2} strokeWidth={stroke}/>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.pal.series[0]} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${filled} ${circ}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={t.glow ? { filter: `drop-shadow(0 0 6px ${t.pal.series[0]}aa)` } : null}/>
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column',
        }}>
          <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 600,
            color: t.text, letterSpacing: -0.6, lineHeight: 1 }}>
            {pct}<span style={{ fontSize: 18, color: t.textMuted }}>%</span>
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11.5, color: t.text, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
};

const ChartRadialPair = ({ t }) => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12,
    paddingTop: 4, paddingBottom: 4 }}>
    <ChartRadial t={t} pct={85} label="Annual goal" sub="of $50k revenue"/>
    <div style={{ width: 1, height: 92, background: t.border }}/>
    <ChartRadial t={t} pct={42} label="Quarter target" sub="of $24k subs"/>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Section group label (small uppercase pill above each row of chart cards)
// ─────────────────────────────────────────────────────────────────────────────
const GroupLabel = ({ t, children }) => (
  <div style={{
    fontSize: 10.5, color: t.textMuted, letterSpacing: 1.2,
    textTransform: 'uppercase', fontWeight: 600, marginTop: 24, marginBottom: 10,
    display: 'flex', alignItems: 'center', gap: 10,
  }}>
    <span>{children}</span>
    <span style={{ flex: 1, height: 1, background: t.border }}/>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Gallery — lays out every chart card in a grid, grouped by category.
// ─────────────────────────────────────────────────────────────────────────────
const ChartsGallery = ({ themeKey = 'cgLight' }) => {
  const t = chartThemes[themeKey];
  return (
    <div style={{
      background: t.canvasBg, color: t.text, minHeight: '100%',
      fontFamily: SANS, padding: '32px 36px 48px',
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Top header */}
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: t.text,
          letterSpacing: -0.5 }}>Chart gallery</h1>
        <span style={{ fontSize: 13, color: t.textMuted, letterSpacing: -0.05 }}>
          {t.name}
        </span>
        <span style={{ flex: 1 }}/>
        <span style={{
          fontSize: 11, color: t.textMuted, fontFamily: MONO,
          padding: '3px 8px', borderRadius: 4,
          background: t.surface2, border: `1px solid ${t.border}`,
        }}>11 types · visitor render</span>
      </div>

      {/* Group: Series over domain */}
      <GroupLabel t={t}>Series over a domain</GroupLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <ChartCard t={t} title="Revenue, cost, profit" subtitle="Last 12 months">
          <ChartLine t={t}/>
        </ChartCard>
        <ChartCard t={t} title="Sales by region" subtitle="Q1 totals, six regions">
          <ChartBar t={t}/>
        </ChartCard>
        <ChartCard t={t} title="Monthly visitors" subtitle="Stacked by traffic source">
          <ChartArea t={t}/>
        </ChartCard>
      </div>

      {/* Group: Proportions */}
      <GroupLabel t={t}>Proportions</GroupLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <ChartCard t={t} title="Marketing channels" subtitle="Share of acquisition · Pie">
          <ChartPie t={t}/>
        </ChartCard>
        <ChartCard t={t} title="Marketing channels" subtitle="Share of acquisition · Donut">
          <ChartDonut t={t}/>
        </ChartCard>
      </div>

      {/* Group: Multi-dimensional */}
      <GroupLabel t={t}>Multi-dimensional</GroupLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <ChartCard t={t} title="Quarterly revenue" subtitle="By product line · stacked">
          <ChartStackedBar t={t}/>
        </ChartCard>
        <ChartCard t={t} title="Current vs proposed" subtitle="Monthly spend, four categories">
          <ChartComparisonBar t={t}/>
        </ChartCard>
        <ChartCard t={t} title="Sessions by hour × weekday" subtitle="Past 28 days">
          <ChartHeatmap t={t}/>
        </ChartCard>
      </div>

      {/* Group: Single value */}
      <GroupLabel t={t}>Single value</GroupLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <ChartCard t={t} title="Quarterly performance" subtitle="Actual vs target · bullet">
          <ChartBullet t={t}/>
        </ChartCard>
        <ChartCard t={t} title="Goal progress" subtitle="Two ring fills">
          <ChartRadialPair t={t}/>
        </ChartCard>
        <ChartCard t={t} title="KPI sparklines" subtitle="Inline series, no axes">
          <SparklinePairCard t={t}/>
        </ChartCard>
      </div>

      {/* Group: Contribution */}
      <GroupLabel t={t}>Contribution</GroupLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <ChartCard t={t} title="Q1 → Q2 revenue bridge" subtitle="Drivers of change · waterfall">
            <ChartWaterfall t={t}/>
          </ChartCard>
        </div>
        {/* Empty space-keeper so layout reads as 2/3 + 1/3; second cell
            holds a smaller bullet variant (single-value contributor). */}
        <ChartCard t={t} title="Monthly burn" subtitle="Tracking against runway">
          <ChartBullet t={t} label="Burn this month" actual={38} target={45}
            max={60} bands={[20, 45, 60]}/>
        </ChartCard>
      </div>
    </div>
  );
};

Object.assign(window, {
  chartPalette, chartThemes, ChartsGallery,
  // expose individual chart renderers in case future passes want to mix
  ChartCard, ChartLine, ChartBar, ChartArea, ChartPie, ChartDonut,
  ChartStackedBar, ChartComparisonBar, ChartSparkline, SparklinePairCard,
  ChartWaterfall, ChartBullet, ChartHeatmap, ChartRadial, ChartRadialPair,
});
