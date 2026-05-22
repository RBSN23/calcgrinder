// Calcgrinder — Editor builder panel
// The bottom panel: visitor-identical render + inline edit affordances.
// Hidden cells appear as glowing dots between cards (consume 0 space).

const { useState: bUseState } = React;

// ─────────────────────────────────────────────────────────────────────────────
// Visitor theme — distinct from editor chrome. Warm cream + ink, no accent.
// ─────────────────────────────────────────────────────────────────────────────

// Context: when false, the canvas renders as a clean public/visitor view
// (no edit affordances, no hidden-cell dots, no add seams).
//
// Lock plumbing (visitor view): when `lockedIds` is a Set, every editable
// Input cell renders a lock toggle in the top-right slot (replacing the
// builder's pencil). Locked widgets desaturate per spec. `valueOverrides`
// lets the visitor view show user-edited values without mutating cgCells.
const BuilderModeCtx = React.createContext({
  interactive: true,
  lockedIds: null,
  onToggleLock: null,
  valueOverrides: null,
});
const useBuilderMode = () => React.useContext(BuilderModeCtx);
const visTheme = {
  light: {
    bg:        '#F4F1EC',
    card:      '#FFFFFF',
    cardAlt:   '#F8F5F0',
    border:    '#E5E2DC',
    borderStr: '#D2CEC6',
    ink:       '#16140F',
    text:      '#1F1C16',
    muted:     '#6F6A60',
    subtle:    '#9A958A',
    rule:      '#EAE6DF',
    chartA:    '#1F1C16',   // dark ink (interest)
    chartB:    '#B79E70',   // warm tan (principal)
    chartGrid: '#E9E4DC',
  },
  dark: {
    bg:        '#14110D',
    card:      '#1C1915',
    cardAlt:   '#221F1A',
    border:    '#2A2620',
    borderStr: '#3A3530',
    ink:       '#F5F0E6',
    text:      '#EDE8DE',
    muted:     '#9A958A',
    subtle:    '#6F6A60',
    rule:      '#26221C',
    chartA:    '#EDE8DE',
    chartB:    '#C9AE7A',
    chartGrid: '#2A2620',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Selection ring colour comes from editor chrome (indigo). Pass `t` for that.
// ─────────────────────────────────────────────────────────────────────────────
const editAffordances = (t, selected) => ({
  borderColor: selected ? t.accent : undefined,
  boxShadow: selected
    ? `0 0 0 3px ${t.accentSoft}, 0 4px 12px rgba(28,25,23,0.06)`
    : '0 1px 2px rgba(28,25,23,0.04)',
});

// Top-left grip + top-right pencil that sit ON the card without pushing layout.
// Lock-mode override: when the canvas is running in visitor + lock mode and
// `cell` is an Input, the top-right slot becomes a lock toggle instead.
// Output cells / chart cards / text blocks render nothing in lock mode.
const CardAffordances = ({ t, v, selected, cell }) => {
  const ctx = useBuilderMode();
  // Lock-mode branch (visitor view's per-field lock toggle)
  if (ctx.lockedIds) {
    if (!cell || cell.type !== 'Input') return null;
    const locked = ctx.lockedIds.has(cell.id);
    return (
      <button
        aria-label={locked ? `Unlock ${cell.label}` : `Lock ${cell.label}`}
        onClick={() => ctx.onToggleLock && ctx.onToggleLock(cell.id)}
        style={{
          position:'absolute', top:8, right:8, width:24, height:24, borderRadius:6,
          background: locked ? t.accentSoft : 'transparent',
          border:`1px solid ${locked ? t.accent : v.border}`,
          color: locked ? t.accent : v.muted,
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', padding:0,
        }}>
        {locked ? <Icons.LockFilled size={12}/> : <Icons.LockOpen size={12}/>}
      </button>
    );
  }
  if (!ctx.interactive) return null;
  return (
  <React.Fragment>
    <button aria-label="Drag" style={{
      position:'absolute', top:6, left:6, width:22, height:22, borderRadius:5,
      background: selected ? t.surface : v.card,
      border:`1px solid ${selected ? t.accent : v.border}`,
      color: selected ? t.accent : v.muted,
      display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'grab',
      opacity: selected ? 1 : 0.85,
    }}><Icons.Grip size={11}/></button>
    <button aria-label="Edit" style={{
      position:'absolute', top:6, right:6, width:22, height:22, borderRadius:5,
      background: selected ? t.accent : v.card,
      border:`1px solid ${selected ? t.accent : v.border}`,
      color: selected ? t.accentFg : v.muted,
      display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
      opacity: selected ? 1 : 0.85,
    }}><Icons.Pencil size={10}/></button>
  </React.Fragment>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CellCard — renders an input or output in the visitor look. Selectable.
// When `expandedCell` matches, an inline settings panel is rendered INSIDE
// the card (does push layout — that's the spec'd behaviour for inline expand).
// ─────────────────────────────────────────────────────────────────────────────
const CellCard = ({ t, v, cell, big, selected, expanded }) => {
  const ctx = useBuilderMode();
  // Lock state — only meaningful for editable Input cells.
  const locked = !!(ctx.lockedIds && cell.type === 'Input' && ctx.lockedIds.has(cell.id));
  // Visitor-side value override (when the user has edited away from
  // scenario defaults). cgCells stays the source of truth for labels/types.
  const displayValue = (ctx.valueOverrides && ctx.valueOverrides[cell.id] != null)
    ? ctx.valueOverrides[cell.id] : cell.value;
  // Format display
  const inputVal = String(displayValue).startsWith('=') ? null : displayValue;
  const result = (() => {
    if (cell.id === 'monthly_payment') return '$2,653.71';
    if (cell.id === 'total_interest')  return '$595,335';
    if (cell.id === 'total_cost')      return '$1,045,335';
    if (cell.id === 'down_payment')    return '$90,000';
    return cell.value;
  })();

  return (
    <div style={{
      position:'relative', background: v.card,
      border:`1px solid ${v.border}`, borderRadius:0,
      padding: big ? '24px 22px 24px' : '18px 20px',
      ...editAffordances(t, selected),
      transition:'box-shadow .15s, border-color .15s',
    }}>
      <CardAffordances t={t} v={v} selected={selected} cell={cell}/>
      <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom: big ? 12 : 6, paddingLeft:24, paddingRight:24}}>
        <div style={{
          fontSize: 11, fontWeight:600, color:v.muted,
          letterSpacing:0.6, textTransform:'uppercase',
        }}>{cell.label}</div>
        {cell.type === 'Output' && (
          <span style={{
            fontSize:9.5, fontWeight:600, color:v.subtle,
            letterSpacing:0.6, textTransform:'uppercase',
            padding:'1px 5px', border:`1px solid ${v.border}`, borderRadius:3,
          }}>Computed</span>
        )}
      </div>

      {cell.type === 'Input' && cell.id === 'down_payment_pct' ? (
        (() => {
          // Parse the integer percent out of either the override or default value.
          const pct = parseFloat(String(displayValue).replace('%','')) || 0;
          const pctClamped = Math.max(0, Math.min(50, pct));
          const trackPct = (pctClamped / 50) * 100;
          return (
          <div style={{paddingLeft:0}}>
            <div style={{display:'flex', alignItems:'baseline', gap:6, marginBottom:10}}>
              <span style={{fontFamily:'"Geist Mono",monospace', fontSize:big?44:28, fontWeight:600,
                color:v.ink, letterSpacing:-1, fontVariantNumeric:'tabular-nums'}}>{pct}</span>
              <span style={{fontSize:big?22:16, color:v.muted, fontWeight:500}}>%</span>
            </div>
            {/* Slider — desaturates when locked, value above stays full opacity */}
            <div style={{opacity: locked ? 0.4 : 1, transition:'opacity .15s'}}>
              <div style={{height:6, background:v.cardAlt, borderRadius:3, position:'relative', border:`1px solid ${v.border}`}}>
                <div style={{position:'absolute', top:-1, left:0, height:6, width:`${trackPct}%`, borderRadius:3, background:v.ink}}/>
                <div style={{position:'absolute', top:-5, left:`calc(${trackPct}% - 7px)`, width:14, height:14, borderRadius:'50%',
                  background:v.card, border:`2px solid ${v.ink}`, boxShadow:'0 1px 2px rgba(0,0,0,0.1)'}}/>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', marginTop:6,
                fontSize:11, color:v.subtle, fontFamily:'"Geist Mono",monospace'}}>
                <span>0%</span><span>50%</span>
              </div>
            </div>
          </div>
          );
        })()
      ) : cell.type === 'Input' ? (
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          padding: '8px 12px', borderRadius:6,
          background: v.cardAlt, border:`1px solid ${v.border}`,
          cursor: locked ? 'default' : 'text',
        }}>
          <span style={{fontSize:14, color:v.muted, fontFamily:'"Geist Mono",monospace'}}>
            {cell.value_type==='currency' ? '$' : cell.value_type==='percent' ? '' : ''}
          </span>
          <span style={{
            flex:1, fontFamily:'"Geist Mono",monospace', fontSize: big?22:18, fontWeight:600,
            color:v.ink, letterSpacing:-0.3, fontVariantNumeric:'tabular-nums',
          }}>{String(displayValue).replace('$','').replace('%','')}</span>
          {cell.value_type==='percent' && <span style={{fontSize:14, color:v.muted, fontFamily:'"Geist Mono",monospace'}}>%</span>}
        </div>
      ) : (
        // Output display
        <div style={{display:'flex', alignItems:'baseline', gap:4}}>
          <span style={{
            fontFamily:'"Geist Mono",monospace',
            fontSize: big ? 52 : 24, fontWeight: big ? 600 : 600,
            color:v.ink, letterSpacing: big ? -1.4 : -0.5, lineHeight:1,
            fontVariantNumeric:'tabular-nums',
          }}>{result}</span>
          {big && cell.id==='monthly_payment' && (
            <span style={{fontSize:18, color:v.muted, fontWeight:500, marginLeft:2}}>/mo</span>
          )}
        </div>
      )}

      {big && cell.id === 'monthly_payment' && !expanded && (
        <div style={{marginTop:14, paddingTop:12, borderTop:`1px solid ${v.rule}`,
          display:'flex', gap:18, fontSize:12, color:v.muted}}>
          <span>Principal $2,160 · Interest $493 <span style={{color:v.subtle}}>· month 1</span></span>
        </div>
      )}

      {expanded && <CellSettingsInline t={t} v={v} cell={cell}/>}
    </div>
  );
};

// Inline cell settings (the in-builder expanded edit form)
const CellSettingsInline = ({ t, v, cell }) => (
  <div style={{
    marginTop:18, padding:'14px 14px 16px', borderRadius:8,
    background:t.surface, border:`1px solid ${t.border}`,
    boxShadow: t.shadowMd,
  }}>
    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>
      <Icons.Pencil size={12} color={t.textMuted}/>
      <span style={{fontSize:11, fontWeight:600, color:t.text, letterSpacing:0.4, textTransform:'uppercase'}}>Cell settings</span>
      <span style={{
        fontSize:11, fontFamily:'"Geist Mono",monospace', color:t.textMuted,
        padding:'1px 6px', borderRadius:4, background:t.surface2, border:`1px solid ${t.border}`,
      }}>{cell.id}</span>
      <span style={{flex:1}}/>
      <Pill kind={cell.type==='Output'?'output':'input'} t={t}>{cell.type}</Pill>
    </div>

    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 12px'}}>
      <Field t={t} label="Label"><TextInput t={t} value={cell.label}/></Field>
      <Field t={t} label="Display widget"><Select t={t} value={cell.widget} icon={Icons.Sliders}/></Field>
      <Field t={t} label="Display format"><TextInput t={t} value="$ 0,0.00" mono/></Field>
      <Field t={t} label="Editability">
        <SegToggle t={t} value="readonly" options={[
          { k:'editable', label:'Editable', I:Icons.Pencil },
          { k:'readonly', label:'Readonly', I:Icons.Lock },
        ]}/>
      </Field>
      {cell.type==='Output' && (
        <div style={{gridColumn:'1 / -1'}}>
          <Field t={t} label="Formula">
            <div style={{
              padding:'10px 12px', borderRadius:6,
              background:t.surface2, border:`1px solid ${t.borderStr}`,
            }}>
              <Formula formula={cell.value} t={t} size={13}/>
            </div>
          </Field>
        </div>
      )}
    </div>
    <div style={{display:'flex', gap:6, marginTop:12}}>
      <Btn variant="primary" size="sm" icon={Icons.Check} t={t}>Save</Btn>
      <Btn variant="ghost"   size="sm" t={t}>Cancel</Btn>
      <span style={{flex:1}}/>
      <Btn variant="ghost"   size="sm" icon={Icons.EyeOff} t={t} style={{color:t.textMuted}}>Hide cell</Btn>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Hidden-cell glowing dot. Height-0; overlays the seam between two cards.
// ─────────────────────────────────────────────────────────────────────────────
const HiddenDot = ({ t, v, cell, onOpen }) => {
  const { interactive } = useBuilderMode();
  if (!interactive) return null;     // public visitors don't see hidden cells
  return (
  <div style={{height:0, overflow:'visible', position:'relative', zIndex:2}}>
    {/* faint seam line that the dot floats above */}
    <div style={{
      position:'absolute', left:0, right:0, top:0, height:1,
      background: v ? v.rule : 'rgba(0,0,0,0.08)',
      transform:'translateY(-0.5px)',
    }}/>
    <button onClick={onOpen} aria-label={`Hidden cell: ${cell.id}`}
      title={`Hidden · ${cell.id}`}
      style={{
        position:'absolute', top:0, left:'50%',
        transform:'translate(-50%, -50%)',
        width:10, height:10, borderRadius:'50%',
        background: `radial-gradient(circle at 35% 30%, ${t.accentHov}, ${t.accent} 70%)`,
        boxShadow: `0 0 0 4px ${t.accentSoft}, 0 0 14px 4px rgba(99,102,241,0.40)`,
        border:'none', cursor:'pointer', padding:0,
        animation: 'cgPulse 2.4s ease-in-out infinite',
      }}/>
  </div>
  );
};
HiddenDot.displayName = 'HiddenDot';

// ─────────────────────────────────────────────────────────────────────────────
// Section + Slot. A Slot is a vertical container of cards w/ flush seams.
// ─────────────────────────────────────────────────────────────────────────────
const VisitorSection = ({ t, v, title, subtitle, children, extraTopGap=false }) => (
  <section style={{marginTop: extraTopGap ? 56 : 40}}>
    <div style={{marginBottom:16, display:'flex', alignItems:'baseline', gap:14}}>
      <h2 style={{
        margin:0, fontSize:22, fontWeight:600, letterSpacing:-0.5,
        color:v.ink, lineHeight:1.15, fontFamily:'inherit',
      }}>{title}</h2>
      {subtitle && (
        <span style={{fontSize:13, color:v.muted, fontWeight:400}}>{subtitle}</span>
      )}
      <span style={{flex:1, height:1, background:v.rule}}/>
    </div>
    {children}
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// AddSeam — the between-cards hover-only "+" affordance.
// Default: 1px seam line (same as before). On hover (or when forceHovered):
// an indigo bar + circular "+" overlays the seam; cards do not shift.
// ─────────────────────────────────────────────────────────────────────────────
const AddSeam = ({ v, t, forceHovered }) => {
  const { interactive } = useBuilderMode();
  // In visitor mode, the seam is just a plain 1px rule (no hover bar/button).
  if (!interactive) {
    return <div style={{height:1, background:v.rule}}/>;
  }
  return (
  <div className={`cg-seam${forceHovered ? ' cg-seam--show' : ''}`}
    style={{
      height:1, background:v.rule, position:'relative', overflow:'visible',
    }}>
    {/* Hit area (taller than the visible line) */}
    <div className="cg-seam-hit" style={{
      position:'absolute', left:0, right:0, top:-10, height:20,
      cursor:'pointer', zIndex:3,
    }}>
      <div className="cg-seam-bar" style={{
        position:'absolute', left:10, right:10, top:'50%',
        transform:'translateY(-50%)',
        height:3, borderRadius:2,
        background: t.accent, opacity:0, transition:'opacity .12s',
        pointerEvents:'none',
      }}/>
      <div className="cg-seam-btn" style={{
        position:'absolute', left:'50%', top:'50%',
        transform:'translate(-50%, -50%) scale(0.7)',
        width:22, height:22, borderRadius:11,
        background: t.accent, color: t.accentFg,
        display:'flex', alignItems:'center', justifyContent:'center',
        opacity:0, transition:'opacity .12s, transform .12s',
        boxShadow:`0 2px 8px ${t.accent}55, 0 0 0 4px ${t.accentSoft}`,
        pointerEvents:'none',
      }}>
        <Icons.Plus size={12} stroke={2.5}/>
      </div>
    </div>
  </div>
  );
};
AddSeam.displayName = 'AddSeam';

const Slot = ({ v, children, label, t, forceHoverAt }) => {
  const arr = React.Children.toArray(children).filter(Boolean);
  return (
    <div style={{
      position:'relative',
      background:v.card,
      border:`1px solid ${v.border}`,
      borderRadius:10, overflow:'visible',
      boxShadow:'0 1px 2px rgba(0,0,0,0.03)',
      display:'flex', flexDirection:'column',
    }}>
      {arr.map((child, i) => {
        const prev = arr[i-1];
        const isDot     = child.type && child.type.displayName === 'HiddenDot';
        const prevIsDot = prev && prev.type && prev.type.displayName === 'HiddenDot';
        // Render an AddSeam before each child EXCEPT when this or the previous
        // is a HiddenDot (the dot draws its own seam line so we'd double up).
        const showSeam = i > 0 && !isDot && !prevIsDot;
        return (
          <React.Fragment key={i}>
            {showSeam && <AddSeam v={v} t={t} forceHovered={forceHoverAt === i}/>}
            {child}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Text/title block (a kind of slot child)
// ─────────────────────────────────────────────────────────────────────────────
const TextBlock = ({ t, v, title, body, selected }) => (
  <div style={{
    position:'relative', padding:'20px 24px 22px', background:v.card,
    ...editAffordances(t, selected),
    borderRadius:0,
  }}>
    <CardAffordances t={t} v={v} selected={selected}/>
    <h3 style={{
      margin:0, fontSize:16, fontWeight:600, color:v.ink, letterSpacing:-0.2,
      lineHeight:1.3, paddingLeft:24, paddingRight:24,
    }}>{title}</h3>
    {body && (
      <p style={{
        margin:'6px 0 0', fontSize:13, color:v.muted, lineHeight:1.5,
        paddingLeft:24, paddingRight:24,
      }}>{body}</p>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Chart card — analytic line chart + edit affordances + inline settings
// ─────────────────────────────────────────────────────────────────────────────
const chartData = [
  { y: 0,  interest: 2160, principal: 493 },
  { y: 5,  interest: 1950, principal: 703 },
  { y: 10, interest: 1670, principal: 983 },
  { y: 15, interest: 1290, principal: 1363 },
  { y: 20, interest: 815,  principal: 1838 },
  { y: 25, interest: 190,  principal: 2463 },
  { y: 30, interest: 10,   principal: 2643 },
];

const ChartCard = ({ t, v, selected, expanded, width=800, height=300, chartType='line', chartTab='data', chartShowWarning=null }) => {
  const pad = { l:50, r:24, t:14, b:32 };
  const W = width, H = height;
  const xs = (y) => pad.l + (y/30) * (W - pad.l - pad.r);
  const yMax = 2800;
  const ys = (val) => H - pad.b - (val/yMax) * (H - pad.t - pad.b);
  const pathFor = (key) => chartData.map((d,i) => `${i===0?'M':'L'} ${xs(d.y)} ${ys(d[key])}`).join(' ');
  const areaFor = (key) => `${pathFor(key)} L ${xs(30)} ${H-pad.b} L ${xs(0)} ${H-pad.b} Z`;

  // Branch on chartType — line uses the existing hardcoded preview;
  // other types use components from charts.jsx wrapped in a v-themed bundle.
  const useAltPreview = chartType && chartType !== 'line';
  const altPreview = useAltPreview && typeof window !== 'undefined' && window.renderChartPreview
    ? window.renderChartPreview(chartType, v, { width: W, height: H })
    : null;

  return (
    <div style={{
      position:'relative', background:v.card, borderRadius:0,
      padding:'22px 26px 18px',
      ...editAffordances(t, selected),
    }}>
      <CardAffordances t={t} v={v} selected={selected}/>
      {altPreview ? (
        <div style={{paddingLeft:24, paddingRight:24, paddingBottom:6}}>
          {altPreview}
        </div>
      ) : (
      <React.Fragment>
      <div style={{display:'flex', alignItems:'baseline', gap:12, marginBottom:14, paddingLeft:24, paddingRight:24}}>
        <h3 style={{margin:0, fontSize:16, fontWeight:600, color:v.ink, letterSpacing:-0.2}}>
          Principal vs interest over term
        </h3>
        <span style={{flex:1}}/>
        <span style={{display:'inline-flex', gap:14, fontSize:11.5, color:v.muted}}>
          <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
            <span style={{width:10, height:2, background:v.chartA}}/>Interest
          </span>
          <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
            <span style={{width:10, height:2, background:v.chartB}}/>Principal
          </span>
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', height:'auto', display:'block'}}>
        {/* gridlines */}
        {[0, 700, 1400, 2100, 2800].map(g => (
          <g key={g}>
            <line x1={pad.l} x2={W-pad.r} y1={ys(g)} y2={ys(g)} stroke={v.chartGrid} strokeWidth={1}/>
            <text x={pad.l-8} y={ys(g)+4} fontSize={10.5} textAnchor="end" fill={v.subtle} fontFamily='"Geist Mono",monospace'>
              {g===0?'$0':`$${(g/1000).toFixed(1)}k`}
            </text>
          </g>
        ))}
        {/* x-axis ticks */}
        {[0,5,10,15,20,25,30].map(y => (
          <text key={y} x={xs(y)} y={H-pad.b+16} fontSize={10.5} textAnchor="middle"
            fill={v.subtle} fontFamily='"Geist Mono",monospace'>Yr {y}</text>
        ))}
        {/* areas */}
        <path d={areaFor('interest')}  fill={v.chartA} fillOpacity={0.06}/>
        <path d={areaFor('principal')} fill={v.chartB} fillOpacity={0.10}/>
        {/* lines */}
        <path d={pathFor('interest')}  stroke={v.chartA} strokeWidth={2} fill="none"/>
        <path d={pathFor('principal')} stroke={v.chartB} strokeWidth={2} fill="none"/>
        {/* end dots */}
        {chartData.map((d,i) => (
          <g key={i}>
            <circle cx={xs(d.y)} cy={ys(d.interest)}  r={2.5} fill={v.card} stroke={v.chartA} strokeWidth={1.5}/>
            <circle cx={xs(d.y)} cy={ys(d.principal)} r={2.5} fill={v.card} stroke={v.chartB} strokeWidth={1.5}/>
          </g>
        ))}
        {/* crossover annotation */}
        <line x1={xs(18.5)} x2={xs(18.5)} y1={pad.t} y2={H-pad.b} stroke={v.borderStr} strokeWidth={1} strokeDasharray="3 3"/>
        <text x={xs(18.5)+6} y={pad.t+12} fontSize={10.5} fill={v.muted} fontFamily="inherit">crossover · yr 19</text>
      </svg>
      </React.Fragment>
      )}

      {expanded && <ChartSettingsInline t={t} v={v} chartType={chartType} tab={chartTab} showWarning={chartShowWarning}/>}
    </div>
  );
};

// New tabbed ChartSettingsInline lives in chart-settings.jsx (loaded after this).
// This stub exists only so older mocks that still render ChartCard without
// chartType see a sensible fallback. The real component is in chart-settings.jsx.
const ChartSettingsInline = ({ t, v, chartType = 'line', tab = 'data', showWarning = null, mobile = false }) => (
  typeof window !== 'undefined' && window.ChartSettingsInlineImpl
    ? <window.ChartSettingsInlineImpl t={t} v={v} chartType={chartType} tab={tab} showWarning={showWarning} mobile={mobile}/>
    : null
);

// ─────────────────────────────────────────────────────────────────────────────
// Hidden-cells pill popover (lists hidden cells anchored to the toolbar pill)
// ─────────────────────────────────────────────────────────────────────────────
const HiddenCellsPopover = ({ t, anchorRight=110, placement='down' }) => {
  const hidden = cgCells.filter(c => c.hidden);
  const up = placement === 'up';
  return (
    <div style={{
      position:'absolute',
      ...(up
        ? { bottom:'calc(100% + 6px)' }
        : { top:'calc(100% + 6px)' }),
      right:anchorRight,
      width:280, background:t.surface, border:`1px solid ${t.border}`,
      borderRadius:10, boxShadow:t.shadowLg, padding:6, zIndex:40,
    }}>
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 8px 8px'}}>
        <Icons.EyeOff size={12} color={t.textMuted}/>
        <span style={{fontSize:11, fontWeight:600, color:t.text, letterSpacing:0.4, textTransform:'uppercase'}}>Hidden cells</span>
        <span style={{
          fontSize:11, color:t.textMuted, fontFamily:'"Geist Mono",monospace',
          padding:'1px 6px', borderRadius:4, background:t.surface2, border:`1px solid ${t.border}`,
        }}>{hidden.length}</span>
      </div>
      <div style={{height:1, background:t.border, margin:'0 2px 4px'}}/>
      {hidden.map(c => (
        <div key={c.id} style={{
          display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
          borderRadius:6, cursor:'pointer',
        }}>
          <span style={{
            width:8, height:8, borderRadius:'50%',
            background:`radial-gradient(circle at 35% 30%, ${t.accentHov}, ${t.accent} 70%)`,
            boxShadow:`0 0 0 3px ${t.accentSoft}`,
          }}/>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:13, fontWeight:500, color:t.text, fontFamily:'"Geist Mono",monospace',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{c.id}</div>
            <div style={{fontSize:11, color:t.textSubtle, marginTop:1,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{c.description}</div>
          </div>
          <Icons.ArrowR size={12} color={t.textSubtle}/>
        </div>
      ))}
      <div style={{height:1, background:t.border, margin:'4px 2px'}}/>
      <div style={{padding:'6px 8px', fontSize:11.5, color:t.textSubtle}}>
        Click a cell to scroll & open its settings.
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BuilderCanvas — composes the visitor view + dots + chart for the mortgage
// calculator. `selected` = id of selected card (drives inline expansion).
// ─────────────────────────────────────────────────────────────────────────────
const BuilderCanvas = ({ t, theme='light', selected, expandChart, viewport='desktop', showHoverAdd=false, interactive=true, chartType='line', chartTab='data', chartShowWarning=null,
  // Lock-mode plumbing (visitor view per-field locks)
  lockedIds=null, onToggleLock=null, valueOverrides=null,
  // Scenario state slots
  scenarioHeader=null, topRightSlot=null }) => {
  const v = visTheme[theme];
  const cell = (id) => cgCellById(id);
  const mobile = viewport === 'mobile';

  return (
  <BuilderModeCtx.Provider value={{ interactive, lockedIds, onToggleLock, valueOverrides }}>
    <div style={{
      background: v.bg, color:v.text, minHeight:'100%',
      fontFamily:'"Geist", -apple-system, system-ui, sans-serif',
      letterSpacing:-0.05, WebkitFontSmoothing:'antialiased',
    }}>
      <div style={{
        maxWidth: 920, margin:'0 auto',
        padding: mobile ? '28px 16px 56px' : '48px 32px 72px',
      }}>
        {/* Page header + optional Reset (top-right) */}
        <div style={{marginBottom: mobile ? 24 : 32, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16}}>
          <div style={{minWidth:0, flex:1}}>
            <div style={{
              fontSize:11.5, fontWeight:500, color:v.subtle,
              letterSpacing:0.6, textTransform:'uppercase', marginBottom:8,
            }}>Mortgage</div>
            <h1 style={{
              margin:0, fontSize: mobile ? 30 : 38, fontWeight:600, letterSpacing:-1.0,
              color:v.ink, lineHeight:1.05,
            }}>What can you afford?</h1>
            <p style={{margin:'10px 0 0', fontSize:14.5, color:v.muted, lineHeight:1.55, maxWidth:560}}>
              Enter the price, deposit, and rate. We'll work out the monthly cost
              and the total you'll pay across the life of the loan.
            </p>
          </div>
          {topRightSlot && <div style={{flexShrink:0, marginTop:4}}>{topRightSlot}</div>}
        </div>

        {/* Scenario header block (only present on a shared-scenario URL) */}
        {scenarioHeader && (
          <div style={{marginBottom: mobile ? 24 : 32}}>
            <div style={{height:1, background:v.rule, marginBottom: mobile ? 18 : 22}}/>
            {scenarioHeader}
            <div style={{height:1, background:v.rule, marginTop: mobile ? 18 : 22}}/>
          </div>
        )}

        {/* Section · Loan details */}
        <VisitorSection t={t} v={v} title="Loan details">
          <div style={{
            display:'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap:16,
          }}>
            <Slot v={v} t={t} label="left" forceHoverAt={showHoverAdd ? 3 : null}>
              <CellCard t={t} v={v} cell={cell('purchase_price')}    selected={selected==='purchase_price'}/>
              <HiddenDot t={t} v={v} cell={cell('loan_amount')}/>
              <CellCard t={t} v={v} cell={cell('down_payment_pct')}  selected={selected==='down_payment_pct'}/>
              <CellCard t={t} v={v} cell={cell('down_payment')}      selected={selected==='down_payment'}/>
            </Slot>
            <Slot v={v} t={t} label="right">
              <CellCard t={t} v={v} cell={cell('interest_rate')}     selected={selected==='interest_rate'}/>
              <HiddenDot t={t} v={v} cell={cell('monthly_rate')}/>
              <CellCard t={t} v={v} cell={cell('term_years')}        selected={selected==='term_years'}/>
            </Slot>
          </div>
        </VisitorSection>

        {/* Section · Results */}
        <VisitorSection t={t} v={v} title="Your result" extraTopGap>
          <div style={{
            display:'grid', gridTemplateColumns: mobile ? '1fr' : '1.4fr 1fr', gap:16,
          }}>
            <Slot v={v} t={t} label="primary">
              <CellCard t={t} v={v} cell={cell('monthly_payment')} big selected={selected==='monthly_payment'} expanded={selected==='monthly_payment'}/>
            </Slot>
            <Slot v={v} t={t} label="secondary">
              <CellCard t={t} v={v} cell={cell('total_interest')} selected={selected==='total_interest'}/>
              <HiddenDot t={t} v={v} cell={cell('total_paid')}/>
              <CellCard t={t} v={v} cell={cell('total_cost')}     selected={selected==='total_cost'}/>
            </Slot>
          </div>
        </VisitorSection>

        {/* Section · Chart */}
        <VisitorSection t={t} v={v} title="Payment composition" subtitle="how each month splits" extraTopGap>
          <Slot v={v} t={t} label="chart">
            <ChartCard t={t} v={v} selected={!!expandChart} expanded={!!expandChart} width={mobile?340:820} height={mobile?240:300}
              chartType={chartType} chartTab={chartTab} chartShowWarning={chartShowWarning}/>
          </Slot>
        </VisitorSection>
      </div>
    </div>
  </BuilderModeCtx.Provider>
  );
};

Object.assign(window, {
  BuilderCanvas, HiddenCellsPopover, visTheme,
});
