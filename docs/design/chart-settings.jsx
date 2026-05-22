// Calcgrinder — Chart configurator (tabbed) + mobile chart card.
// Loaded AFTER editor-builder.jsx, editor-elements.jsx and charts.jsx.
// Exports:
//   - window.renderChartPreview(chartType, v, {width,height}) — used by
//     editor-builder.jsx's ChartCard to render a live preview that varies
//     with the chart type. Wraps charts.jsx components with a theme derived
//     from the builder's visitor theme `v`.
//   - window.ChartSettingsInlineImpl — the actual tabbed settings panel
//     that editor-builder.jsx's ChartSettingsInline stub forwards to.
//   - window.MobileChartCard — the compact chart card rendered inside the
//     mobile drawer's focused-expand state.

const { useState: csUseState } = React;

// ─────────────────────────────────────────────────────────────────────────────
// Build a chart-themes-style bundle from the builder's visitor theme `v`.
// Lets us use charts.jsx components (Pie / Bullet / etc.) inside the card.
// ─────────────────────────────────────────────────────────────────────────────
const chartThemeFromV = (v) => ({
  name: 'visitor',
  bg: v.bg, surface: v.card, surface2: v.cardAlt, surface3: v.cardAlt,
  border: v.border, borderStr: v.borderStr,
  text: v.ink, textMuted: v.muted, textSubtle: v.subtle,
  accent: v.chartB, accentHov: v.chartB,
  accentSoft: 'rgba(0,0,0,0.05)',
  accentFg: '#fff', accentText: v.chartB,
  canvasBg: v.card,
  pal: {
    series: [v.chartA, v.chartB, '#A78BFA', '#78716C', '#F59E0B'],
    heat:   ['#F4EFE3','#E9DFC4','#D9C99A','#C2A968','#A07F3D','#6E5121'],
    pos:    '#5C7A3D', posSoft: '#E7EDD8',
    neg:    '#9C4B3F', negSoft: '#EFD9D2',
    neutral: v.borderStr,
  },
  cardShadow: 'none', glow: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// renderChartPreview — returns JSX for a chart-type preview in the builder
// card. For 'line' we let editor-builder.jsx use its existing hardcoded
// principal-vs-interest chart (returns null). For other types we wrap a
// charts.jsx component in a small header + chart layout.
// ─────────────────────────────────────────────────────────────────────────────
window.renderChartPreview = (chartType, v) => {
  if (!chartType || chartType === 'line') return null;
  const ct = chartThemeFromV(v);
  const map = {
    bar:           { title:'Sales by region',         sub:'Q1 totals, six regions',         Comp: window.ChartBar },
    area:          { title:'Monthly visitors',        sub:'Stacked by traffic source',       Comp: window.ChartArea },
    pie:           { title:'Marketing channels',      sub:'Share of acquisition',           Comp: window.ChartPie },
    donut:         { title:'Marketing channels',      sub:'Share of acquisition',           Comp: window.ChartDonut },
    stackedBar:    { title:'Quarterly revenue',       sub:'By product line',                Comp: window.ChartStackedBar },
    comparisonBar: { title:'Current vs proposed',     sub:'Monthly spend, four categories', Comp: window.ChartComparisonBar },
    waterfall:     { title:'Q1 \u2192 Q2 revenue bridge',sub:'Drivers of change',            Comp: window.ChartWaterfall },
    bullet:        { title:'Q1 revenue',              sub:'Actual vs target',               Comp: window.ChartBullet },
    heatmap:       { title:'Sessions by hour \u00d7 weekday', sub:'Past 28 days',           Comp: window.ChartHeatmap },
    radial:        { title:'Goal progress',           sub:'Two ring fills',                 Comp: window.ChartRadialPair },
    sparkline:     { title:'KPI sparklines',          sub:'Inline series, no axes',         Comp: window.SparklinePairCard },
  };
  const entry = map[chartType];
  if (!entry || !entry.Comp) return null;
  const Comp = entry.Comp;
  return (
    <div>
      <div style={{display:'flex', alignItems:'baseline', gap:12, marginBottom:10}}>
        <h3 style={{margin:0, fontSize:16, fontWeight:600, color:v.ink, letterSpacing:-0.2}}>
          {entry.title}
        </h3>
        <span style={{fontSize:12.5, color:v.muted}}>{entry.sub}</span>
      </div>
      <div style={{width:'100%', minHeight: 220, display:'flex', flexDirection:'column'}}>
        <Comp t={ct}/>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab pill — Type · Data · Style
// ─────────────────────────────────────────────────────────────────────────────
const TabBar = ({ t, value, tabs, onChange, compact }) => (
  <div style={{
    display:'inline-flex', padding:3, borderRadius:8,
    background:t.surface2, border:`1px solid ${t.border}`, gap:0,
  }}>
    {tabs.map(tab => {
      const active = tab.k === value;
      return (
        <button key={tab.k} onClick={() => onChange && onChange(tab.k)} style={{
          height: compact ? 24 : 26, padding: compact ? '0 12px' : '0 14px',
          borderRadius:5, border:'none', cursor:'pointer', fontFamily:'inherit',
          background: active ? t.surface : 'transparent',
          color: active ? t.text : t.textMuted,
          fontSize: compact ? 12 : 12.5, fontWeight: active ? 600 : 500,
          letterSpacing:-0.05,
          boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        }}>{tab.label}</button>
      );
    })}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Chart-type tile (4×3 grid in Type tab)
// ─────────────────────────────────────────────────────────────────────────────
const ChartTypeTile = ({ t, type, selected, compact }) => (
  <button style={{
    width:'100%', height: compact ? 56 : 64, borderRadius:8, cursor:'pointer',
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    gap: compact ? 2 : 4, fontFamily:'inherit',
    background: selected ? t.accentSoft : t.surface,
    border: selected ? `2px solid ${t.accent}` : `1px solid ${t.border}`,
    color: selected ? t.accentText : t.text,
    padding: 0,
  }}>
    {ChartTypeIcons[type.k] && ChartTypeIcons[type.k]()}
    <span style={{fontSize: compact ? 10 : 11, fontWeight:500, letterSpacing:-0.05}}>
      {type.label}
    </span>
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Type tab — 4×3 grid, optional smart-defaults warning banner above.
// ─────────────────────────────────────────────────────────────────────────────
const TypeTab = ({ t, chartType, showWarning, compact }) => (
  <div style={{display:'flex', flexDirection:'column', gap: compact ? 10 : 12}}>
    {showWarning && (
      <div style={{
        padding:'10px 12px', borderRadius:6,
        background: t.bg === cgTokens.dark.bg ? 'rgba(245,158,11,0.10)' : '#FEF3C7',
        border:`1px solid ${t.bg === cgTokens.dark.bg ? 'rgba(245,158,11,0.30)' : '#FDE68A'}`,
        display:'flex', alignItems:'center', gap:10,
      }}>
        <span style={{flexShrink:0, color: t.bg === cgTokens.dark.bg ? '#FCD34D' : '#92400E',
          display:'inline-flex'}}>
          <Icons.Sparkle size={14}/>
        </span>
        <span style={{fontSize:11.5, color: t.bg === cgTokens.dark.bg ? '#FCD34D' : '#92400E',
          flex:1, lineHeight:1.4}}>{showWarning}</span>
        <Btn variant="primary" size="sm" t={t}>Confirm</Btn>
        <span style={{fontSize:11, color: t.bg === cgTokens.dark.bg ? '#FCD34D' : '#92400E',
          opacity:0.8}}>or pick a different type</span>
      </div>
    )}
    <div style={{
      display:'grid', gridTemplateColumns:'repeat(4, 1fr)',
      gap: compact ? 6 : 8,
    }}>
      {CHART_TYPES.map(type => (
        <ChartTypeTile key={type.k} t={t} type={type}
          selected={type.k === chartType} compact={compact}/>
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Data tab — type-specific bindings with user-friendly labels.
// Reuses Field / Select / TextInput from editor-grid.jsx.
// ─────────────────────────────────────────────────────────────────────────────
const cellOptionsForArray   = '12 entries · month_1 \u2026 month_360';
const cellOptionsForScalar  = 'monthly_payment · $2,653.71';
const cellOptionsForLabels  = '5 entries · "Direct", "Search", \u2026';
const cellOptionsForValues  = '5 entries · 18, 24, 38, \u2026';

// One series row used by Line / Bar / Area / Stacked Bar
const SeriesPickerRow = ({ t, series, onPlaceholder, last, compact }) => (
  <div style={{
    display:'grid', gridTemplateColumns: compact ? '18px 1fr 28px 22px' : '20px 1fr 1fr 38px 28px',
    gap: compact ? 6 : 8, alignItems:'center', padding: compact ? '6px 0' : '8px 0',
    borderBottom: last ? 'none' : `1px solid ${t.border}`,
  }}>
    <span style={{color:t.textSubtle, display:'inline-flex', justifyContent:'center', cursor:'grab'}}>
      <Icons.Grip size={12}/>
    </span>
    <Select t={t} value={series.cell || 'Choose which value to plot'}
      icon={Icons.Hash}/>
    {!compact && <TextInput t={t} value={series.label}/>}
    <div style={{
      height:30, padding:'0 6px', borderRadius:6,
      background:t.surface, border:`1px solid ${t.borderStr}`,
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      cursor:'pointer',
    }}>
      <span style={{
        width: compact ? 14 : 16, height: compact ? 14 : 16, borderRadius:3,
        background:series.color,
        border:`1px solid ${t.borderStr}`,
      }}/>
    </div>
    <button aria-label="Remove" style={{
      width: compact ? 22 : 26, height: compact ? 22 : 26, borderRadius:5,
      border:'none', background:'transparent',
      color:t.textMuted, cursor:'pointer',
      display:'inline-flex', alignItems:'center', justifyContent:'center',
    }}><Icons.X size={11}/></button>
  </div>
);

// Friendly label table (per type)
const FIELD_LABELS = {
  line:          { xAxis:'X-axis', list:'Lines',         addLabel:'+ Add a line' },
  bar:           { xAxis:'X-axis', list:'Bars',          addLabel:'+ Add a bar' },
  area:          { xAxis:'X-axis', list:'Areas',         addLabel:'+ Add an area' },
  stackedBar:    { xAxis:'X-axis', list:'Stack layers',  addLabel:'+ Add a layer' },
  pie:           {},
  donut:         {},
  comparisonBar: {},
  sparkline:     {},
  waterfall:     {},
  bullet:        {},
  heatmap:       {},
  radial:        {},
};

// Multi-series variant (Line/Bar/Area/StackedBar)
const DataTab_MultiSeries = ({ t, chartType, series, compact }) => {
  const lbl = FIELD_LABELS[chartType];
  return (
    <div style={{display:'flex', flexDirection:'column', gap: compact ? 12 : 14}}>
      <div style={{display:'flex', flexDirection:'column', gap:5}}>
        <label style={{fontSize:11, fontWeight:500, color:t.textMuted,
          letterSpacing:0.4, textTransform:'uppercase'}}>{lbl.xAxis}</label>
        <Select t={t} value={`term_months \u00b7 ${cellOptionsForArray}`} icon={Icons.Hash}/>
      </div>

      <div>
        <div style={{display:'flex', alignItems:'baseline', gap:10, marginBottom:6}}>
          <span style={{fontSize:11, fontWeight:600, color:t.textMuted,
            letterSpacing:0.4, textTransform:'uppercase'}}>{lbl.list}</span>
          <span style={{fontSize:11.5, color:t.textSubtle, letterSpacing:-0.05}}>
            Drag the grip-handle to reorder.
          </span>
          <span style={{flex:1}}/>
          <span style={{fontSize:11, color:t.textSubtle, fontFamily:'"Geist Mono", monospace'}}>
            {series.length} / 6
          </span>
        </div>
        <div style={{
          padding: compact ? '0 8px' : '0 10px', borderRadius:8, background:t.surface,
          border:`1px solid ${t.border}`,
        }}>
          {!compact && (
            <div style={{
              display:'grid', gridTemplateColumns:'20px 1fr 1fr 38px 28px', gap:8,
              padding:'8px 0 6px', borderBottom:`1px solid ${t.border}`,
              fontSize:10, color:t.textSubtle, letterSpacing:0.4, textTransform:'uppercase',
              fontWeight:500,
            }}>
              <span/><span>Cell</span><span>Label</span>
              <span style={{textAlign:'center'}}>Colour</span><span/>
            </div>
          )}
          {series.map((s, i) => (
            <SeriesPickerRow key={i} t={t} series={s}
              last={i === series.length-1} compact={compact}/>
          ))}
        </div>
        <button style={{
          marginTop:8, height:30, padding:'0 12px 0 10px', borderRadius:6,
          background:'transparent', color:t.accent, border:`1px dashed ${t.borderStr}`,
          display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:500,
          cursor:'pointer', fontFamily:'inherit',
        }}>
          <Icons.Plus size={12} stroke={2}/>
          {lbl.addLabel.replace(/^\+ /,'')}
        </button>
      </div>
    </div>
  );
};

// Pie / Donut variant
const DataTab_Pie = ({ t, isDonut, compact }) => (
  <div style={{display:'flex', flexDirection:'column', gap:12}}>
    <div style={{display:'flex', flexDirection:'column', gap:5}}>
      <label style={{fontSize:11, fontWeight:500, color:t.textMuted,
        letterSpacing:0.4, textTransform:'uppercase'}}>Slice labels</label>
      <Select t={t} value={`channels \u00b7 ${cellOptionsForLabels}`} icon={Icons.Hash}/>
    </div>
    <div style={{display:'flex', flexDirection:'column', gap:5}}>
      <label style={{fontSize:11, fontWeight:500, color:t.textMuted,
        letterSpacing:0.4, textTransform:'uppercase'}}>Slice sizes</label>
      <Select t={t} value={`channel_share \u00b7 ${cellOptionsForValues}`} icon={Icons.Hash}/>
    </div>
    {isDonut && (
      <React.Fragment>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div style={{display:'flex', flexDirection:'column', gap:5}}>
            <label style={{fontSize:11, fontWeight:500, color:t.textMuted,
              letterSpacing:0.4, textTransform:'uppercase'}}>Centre label</label>
            <TextInput t={t} value="Total revenue"/>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:5}}>
            <label style={{fontSize:11, fontWeight:500, color:t.textMuted,
              letterSpacing:0.4, textTransform:'uppercase'}}>Centre value</label>
            <Select t={t} value="(sum of slices)" icon={Icons.Sigma || Icons.Hash}/>
          </div>
        </div>
      </React.Fragment>
    )}
    <div style={{fontSize:11.5, color:t.textSubtle, lineHeight:1.4}}>
      Choose a value with multiple entries for labels, and a matching value with
      the same number of entries for sizes.
    </div>
  </div>
);

// Thresholds tabs (Bullet)
const ThresholdsTabs = ({ t, mode='fixed', compact }) => (
  <div>
    <div style={{
      display:'inline-flex', padding:2, borderRadius:7, marginBottom:10,
      background:t.surface2, border:`1px solid ${t.border}`,
    }}>
      {[{k:'fixed', label:'Fixed thresholds'}, {k:'cells', label:'From cells'}].map(opt => {
        const active = opt.k === mode;
        return (
          <div key={opt.k} style={{
            height:24, padding:'0 10px', borderRadius:5,
            display:'inline-flex', alignItems:'center',
            fontSize:12, fontWeight:500, fontFamily:'inherit',
            background: active ? t.surface : 'transparent',
            color: active ? t.text : t.textMuted,
            boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            border: active ? `1px solid ${t.border}` : '1px solid transparent',
          }}>
            {opt.label}
          </div>
        );
      })}
    </div>
    {mode === 'fixed' ? (
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
        {[
          {label:'Poor up to',  value:'20,000'},
          {label:'Okay up to',  value:'40,000'},
          {label:'Good up to',  value:'60,000'},
        ].map(f => (
          <div key={f.label} style={{display:'flex', flexDirection:'column', gap:5}}>
            <label style={{fontSize:10.5, fontWeight:500, color:t.textMuted,
              letterSpacing:0.4, textTransform:'uppercase'}}>{f.label}</label>
            <TextInput t={t} value={`$ ${f.value}`} mono/>
          </div>
        ))}
      </div>
    ) : (
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
        {['poor_max','okay_max','good_max'].map(c => (
          <Select key={c} t={t} value={c} icon={Icons.Hash}/>
        ))}
      </div>
    )}
  </div>
);

// Bullet variant
const DataTab_Bullet = ({ t, compact }) => (
  <div style={{display:'flex', flexDirection:'column', gap:14}}>
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
      <div style={{display:'flex', flexDirection:'column', gap:5}}>
        <label style={{fontSize:11, fontWeight:500, color:t.textMuted,
          letterSpacing:0.4, textTransform:'uppercase'}}>Actual value</label>
        <Select t={t} value="q1_revenue \u00b7 48,000" icon={Icons.Hash}/>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:5}}>
        <label style={{fontSize:11, fontWeight:500, color:t.textMuted,
          letterSpacing:0.4, textTransform:'uppercase'}}>Target</label>
        <Select t={t} value="q1_target \u00b7 50,000" icon={Icons.Hash}/>
      </div>
    </div>
    <div>
      <label style={{fontSize:11, fontWeight:500, color:t.textMuted,
        letterSpacing:0.4, textTransform:'uppercase', display:'block', marginBottom:8}}>
        Performance bands
      </label>
      <ThresholdsTabs t={t} mode="fixed" compact={compact}/>
      <p style={{margin:'8px 2px 0', fontSize:11.5, color:t.textSubtle, lineHeight:1.4}}>
        Three colour bands behind the actual-value bar. The target tick sits over them.
      </p>
    </div>
  </div>
);

// Comparison Bar variant — v1 takes two cell-arrays as side-by-side bars.
// (Compare-Mode — overlaying two scenarios on any chart — is deferred to v2.)
//
// Bindings:
//   · X-axis  — shared category axis (single picker)
//   · Labels  — optional display names for the two series in the legend.
//                Default "Series A" / "Series B". Empty falls back to the
//                underlying cell name.
//   · Series A — single cell-array picker (renders as bar 1)
//   · Series B — single cell-array picker (renders as bar 2)
const DataTab_ComparisonBar = ({ t, v, compact }) => {
  // Use the visitor chart palette for the swatches so the legend in the
  // preview above and the swatches here stay aligned.
  const swatchA = v ? v.chartA : t.accent;
  const swatchB = v ? v.chartB : t.text;
  const Swatch = ({ color }) => (
    <div style={{
      height:30, padding:'0 6px', borderRadius:6, flexShrink:0,
      background:t.surface, border:`1px solid ${t.borderStr}`,
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      cursor:'pointer',
    }}>
      <span style={{
        width:16, height:16, borderRadius:3,
        background: color, border:`1px solid ${t.borderStr}`,
      }}/>
    </div>
  );
  // Compact row: [swatch] [cell picker]. Wide row: [swatch] [cell picker]
  // [label input]. Labels live in their own row above on both densities so
  // the optional-row affordance reads clearly.
  return (
    <div style={{display:'flex', flexDirection:'column', gap: compact ? 12 : 14}}>
      {/* X-axis — shared category axis */}
      <div style={{display:'flex', flexDirection:'column', gap:5}}>
        <label style={{fontSize:11, fontWeight:500, color:t.textMuted,
          letterSpacing:0.4, textTransform:'uppercase'}}>X-axis</label>
        <Select t={t} value={`categories · 4 entries · "Rent", "Staff", …`} icon={Icons.Hash}/>
      </div>

      {/* Labels — optional legend names */}
      <div>
        <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:5}}>
          <label style={{fontSize:11, fontWeight:500, color:t.textMuted,
            letterSpacing:0.4, textTransform:'uppercase'}}>Labels</label>
          <span style={{fontSize:11, color:t.textSubtle, letterSpacing:0,
            textTransform:'none', fontWeight:500}}>· optional</span>
          <span style={{flex:1}}/>
          <span style={{fontSize:11, color:t.textSubtle, letterSpacing:-0.05,
            lineHeight:1.3, textAlign:'right', maxWidth: compact ? 160 : 280}}>
            {compact ? 'Shown in the legend.' : 'Shown in the legend. Leave empty to use the cell name.'}
          </span>
        </div>
        <div style={{display:'grid',
          gridTemplateColumns: compact ? '1fr 1fr' : '1fr 1fr',
          gap: compact ? 6 : 8}}>
          <div style={{display:'flex', alignItems:'center', gap:6}}>
            <span style={{flexShrink:0, width:10, height:10, borderRadius:2,
              background: swatchA, border:`1px solid ${t.borderStr}`}}/>
            <TextInput t={t} value="Series A" style={{flex:1, minWidth:0}}/>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:6}}>
            <span style={{flexShrink:0, width:10, height:10, borderRadius:2,
              background: swatchB, border:`1px solid ${t.borderStr}`}}/>
            <TextInput t={t} value="Series B" style={{flex:1, minWidth:0}}/>
          </div>
        </div>
      </div>

      {/* Series A + B */}
      <div>
        <div style={{display:'flex', alignItems:'baseline', gap:10, marginBottom:6}}>
          <span style={{fontSize:11, fontWeight:600, color:t.textMuted,
            letterSpacing:0.4, textTransform:'uppercase'}}>Series</span>
          <span style={{fontSize:11.5, color:t.textSubtle, letterSpacing:-0.05}}>
            Two values plotted side by side.
          </span>
        </div>
        <div style={{
          padding: compact ? '4px 8px' : '4px 10px', borderRadius:8, background:t.surface,
          border:`1px solid ${t.border}`,
        }}>
          {[
            { key:'A', cell:'current_spend',  swatch:swatchA },
            { key:'B', cell:'proposed_spend', swatch:swatchB },
          ].map((row, i, arr) => (
            <div key={row.key} style={{
              display:'grid',
              gridTemplateColumns: compact ? '38px 1fr 38px' : '38px 1fr 38px',
              gap: compact ? 6 : 8, alignItems:'center',
              padding: compact ? '6px 0' : '8px 0',
              borderBottom: i === arr.length-1 ? 'none' : `1px solid ${t.border}`,
            }}>
              <span style={{
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                height:24, padding:'0 8px', borderRadius:5,
                background:t.surface2, border:`1px solid ${t.border}`,
                fontSize:10.5, fontWeight:600, color:t.textMuted,
                letterSpacing:0.4, textTransform:'uppercase',
              }}>{row.key}</span>
              <Select t={t} value={`${row.cell} · 4 entries · currency`} icon={Icons.Hash}/>
              <Swatch color={row.swatch}/>
            </div>
          ))}
        </div>
        <p style={{margin:'8px 2px 0', fontSize:11.5, color:t.textSubtle, lineHeight:1.4}}>
          Pick a value with multiple entries for each series. Both series
          must have the same number of entries as the X-axis.
        </p>
      </div>
    </div>
  );
};

// Generic placeholder for the other 5 types (not detailed)
const DataTab_Generic = ({ t, chartType }) => {
  const type = CHART_TYPE_BY_K[chartType];
  const friendlyLabel = {
    sparkline:     'Values',
    waterfall:     'Steps · Change at each step',
    heatmap:       'Columns · Rows · Cell colours',
    radial:        'Current value · Goal · Centre label',
  }[chartType] || '';
  return (
    <div style={{
      padding:'14px 16px', borderRadius:8,
      background:t.surface2, border:`1px dashed ${t.border}`,
      fontSize:12, color:t.textMuted, lineHeight:1.45,
    }}>
      <div style={{fontSize:11, fontWeight:600, color:t.text, marginBottom:4,
        letterSpacing:0.4, textTransform:'uppercase'}}>
        {type ? type.label : chartType}
      </div>
      Fields: <span style={{color:t.text}}>{friendlyLabel}</span>.
      Follows the same pattern as Line / Pie / Bullet but with type-specific labels.
    </div>
  );
};

const DataTab = ({ t, v, chartType, series, compact }) => {
  if (['line','bar','area','stackedBar'].includes(chartType))
    return <DataTab_MultiSeries t={t} chartType={chartType} series={series} compact={compact}/>;
  if (chartType === 'pie')   return <DataTab_Pie t={t} isDonut={false} compact={compact}/>;
  if (chartType === 'donut') return <DataTab_Pie t={t} isDonut={true}  compact={compact}/>;
  if (chartType === 'bullet') return <DataTab_Bullet t={t} compact={compact}/>;
  if (chartType === 'comparisonBar') return <DataTab_ComparisonBar t={t} v={v} compact={compact}/>;
  return <DataTab_Generic t={t} chartType={chartType}/>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Style tab — title, subtitle, legend, axes, animation, smooth, card-level.
// ─────────────────────────────────────────────────────────────────────────────
const StyleRow = ({ t, label, hint, disabled, children, last, compact }) => (
  <div style={{
    display:'grid', gridTemplateColumns: compact ? '110px 1fr' : '140px 1fr 180px', gap:12,
    alignItems:'center',
    padding: compact ? '8px 0' : '10px 0',
    borderBottom: last ? 'none' : `1px solid ${t.border}`,
    opacity: disabled ? 0.45 : 1,
  }}>
    <label style={{fontSize:11, fontWeight:500, color:t.textMuted,
      letterSpacing:0.4, textTransform:'uppercase'}}>{label}</label>
    <div>{children}</div>
    {!compact && <span style={{fontSize:11.5, color:t.textSubtle, letterSpacing:-0.05}}>{hint}</span>}
  </div>
);

const SmallToggle = ({ t, on }) => (
  <span style={{
    display:'inline-block', width:32, height:18, borderRadius:9, padding:1,
    background: on ? t.accent : t.borderStr,
    position:'relative', cursor:'pointer', transition:'background .15s',
  }}>
    <span style={{
      width:14, height:14, borderRadius:'50%', background:'#fff',
      position:'absolute', top:1, left: on ? 16 : 1,
      boxShadow:'0 1px 2px rgba(0,0,0,0.2)', transition:'left .15s',
    }}/>
  </span>
);

const StyleTab = ({ t, chartType, compact }) => {
  const type = CHART_TYPE_BY_K[chartType] || CHART_TYPES[0];
  return (
    <div style={{display:'flex', flexDirection:'column'}}>
      <StyleRow t={t} label="Title" compact={compact}>
        <TextInput t={t} value="How each payment splits"/>
      </StyleRow>
      <StyleRow t={t} label="Subtitle" compact={compact}>
        <TextInput t={t} value="Across the life of the loan"/>
      </StyleRow>
      <StyleRow t={t} label="Legend" hint="Auto shows when there are 2+ series" compact={compact}>
        <SegToggle t={t} value="auto" options={[
          { k:'auto',   label:'Auto'   },
          { k:'always', label:'Always' },
          { k:'hide',   label:'Hide'   },
        ]}/>
      </StyleRow>
      <StyleRow t={t} label="Axis labels"
        hint={type.hasAxes ? 'Auto hides labels when crowded' : 'Not applicable \u2014 chart has no axes'}
        disabled={!type.hasAxes} compact={compact}>
        <SegToggle t={t} value={type.hasAxes ? 'auto' : 'hide'} options={[
          { k:'auto',   label:'Auto'   },
          { k:'always', label:'Always' },
          { k:'hide',   label:'Hide'   },
        ]}/>
      </StyleRow>
      <StyleRow t={t} label="Animate on change" hint="Ease-out, no hard cuts" compact={compact}>
        <SmallToggle t={t} on={true}/>
      </StyleRow>
      {type.hasSmooth && (
        <StyleRow t={t} label="Smooth lines" hint="Catmull-Rom curves" compact={compact}>
          <SmallToggle t={t} on={true}/>
        </StyleRow>
      )}

      {/* Card-level visual settings */}
      <div style={{height:1, background:t.border, margin: compact ? '12px -4px 10px' : '14px -4px 12px'}}/>
      <div style={{fontSize:11, fontWeight:600, color:t.textMuted,
        letterSpacing:0.4, textTransform:'uppercase', marginBottom: compact ? 6 : 8}}>
        Card style
      </div>

      <StyleRow t={t} label="Accent" hint="Highlight colour used by this card" compact={compact}>
        <div style={{display:'inline-flex', gap:6}}>
          {['#4F46E5','#1F1C16','#B79E70','#5C7A3D'].map((c, i) => (
            <span key={c} style={{
              width:24, height:24, borderRadius:6,
              background:c, border: i===0 ? `2px solid ${t.text}` : `1px solid ${t.borderStr}`,
              boxShadow: i===0 ? `0 0 0 2px ${t.surface}` : 'none',
              cursor:'pointer',
            }}/>
          ))}
        </div>
      </StyleRow>
      <StyleRow t={t} label="Background tint" hint="Subtle wash behind the card" compact={compact}>
        <SegToggle t={t} value="none" options={[
          { k:'none',   label:'None'   },
          { k:'soft',   label:'Soft'   },
          { k:'strong', label:'Strong' },
        ]}/>
      </StyleRow>
      <StyleRow t={t} label="Border" hint="" compact={compact}>
        <SegToggle t={t} value="hairline" options={[
          { k:'none',     label:'None'     },
          { k:'hairline', label:'Hairline' },
          { k:'strong',   label:'Strong'   },
        ]}/>
      </StyleRow>
      <StyleRow t={t} label="Size hint" hint="Builder layout suggestion" last compact={compact}>
        <SegToggle t={t} value="wide" options={[
          { k:'narrow', label:'Narrow' },
          { k:'wide',   label:'Wide'   },
          { k:'full',   label:'Full'   },
        ]}/>
      </StyleRow>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ChartSettingsInlineImpl — the tabbed settings panel below the chart.
// Receives `t` (editor token bundle) and `v` (visitor theme — used only for
// colour-swatch defaults so saved series colours match the chart).
// ─────────────────────────────────────────────────────────────────────────────
const ChartSettingsInlineImpl = ({ t, v, chartType='line', tab='data', showWarning=null, mobile=false }) => {
  // Series shape used by the Data tab. Three series for Line/Bar/Area; one
  // for Pie/Bullet/etc. v.chartA/v.chartB drive defaults for series 1+2.
  const series = [
    { cell:'monthly_interest_part',  label:'Interest',  color: v.chartA },
    { cell:'monthly_principal_part', label:'Principal', color: v.chartB },
    { cell:'monthly_pmi_part',       label:'PMI',       color:'#A78BFA' },
  ];
  return (
    <div style={{
      marginTop:18, padding: mobile ? '12px 12px 16px' : '14px 14px 16px',
      borderRadius:8,
      background:t.surface, border:`1px solid ${t.border}`,
      boxShadow: t.shadowMd, position:'relative',
    }}>
      {/* Header — tabs on the left, name pill + close on the right */}
      <div style={{
        display:'flex', alignItems:'center', gap:8, marginBottom:14,
      }}>
        <TabBar t={t} value={tab} tabs={[
          { k:'type',  label:'Type'  },
          { k:'data',  label:'Data'  },
          { k:'style', label:'Style' },
        ]} compact={mobile}/>
        <span style={{flex:1}}/>
        {!mobile && (
          <span style={{
            fontSize:11, fontFamily:'"Geist Mono",monospace', color:t.textMuted,
            padding:'1px 6px', borderRadius:4, background:t.surface2, border:`1px solid ${t.border}`,
          }}>revenue_trend</span>
        )}
        <Pill kind="output" t={t}>Chart</Pill>
        <button aria-label="Close chart settings" style={{
          width:24, height:24, borderRadius:5, border:'none', background:'transparent',
          color:t.textMuted, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          marginLeft:4,
        }}><Icons.ChevD size={14}/></button>
      </div>

      {tab === 'type'  && <TypeTab  t={t} chartType={chartType} showWarning={showWarning} compact={mobile}/>}
      {tab === 'data'  && <DataTab  t={t} v={v} chartType={chartType} series={series} compact={mobile}/>}
      {tab === 'style' && <StyleTab t={t} chartType={chartType} compact={mobile}/>}
    </div>
  );
};

// Re-export to the global stub in editor-builder.jsx
window.ChartSettingsInlineImpl = ChartSettingsInlineImpl;

// ─────────────────────────────────────────────────────────────────────────────
// MobileChartCard — used by editor-elements.jsx's GridDrawerMobileExt as the
// chart focused-expand state inside the mobile drawer. Shows a small live
// preview (~120px tall) of the chart, then the tabbed settings.
// ─────────────────────────────────────────────────────────────────────────────
const MobileChartCard = ({ t, el, tab='data', showWarning=null, scrollOffset=0 }) => {
  const v = visTheme.light; // mobile drawer always uses the light visitor theme for the preview
  const ct = chartThemeFromV(v);
  // Pick a renderer for the preview
  const previewMap = {
    line:          { Comp: null /* hardcoded below */ },
    bar:           { Comp: window.ChartBar },
    area:          { Comp: window.ChartArea },
    pie:           { Comp: window.ChartPie },
    donut:         { Comp: window.ChartDonut },
    stackedBar:    { Comp: window.ChartStackedBar },
    comparisonBar: { Comp: window.ChartComparisonBar },
    waterfall:     { Comp: window.ChartWaterfall },
    bullet:        { Comp: window.ChartBullet },
    heatmap:       { Comp: window.ChartHeatmap },
    radial:        { Comp: window.ChartRadialPair },
    sparkline:     { Comp: window.SparklinePairCard },
  };
  const Renderer = previewMap[el.chartType] && previewMap[el.chartType].Comp;
  return (
    <div style={{
      display:'flex', flexDirection:'column', minHeight:0,
      background: t.surface, height:'100%',
    }}>
      {/* Card header */}
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        padding:'10px 10px 10px 14px', flexShrink:0,
        borderBottom:`1px solid ${t.border}`, background:t.surface,
      }}>
        <span style={{
          fontFamily:'"Geist Mono", monospace', fontSize:12, color:t.text,
          fontWeight:500, lineHeight:1.35, maxWidth:'52%',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{el.id}</span>
        <ElementPill kind="Chart" t={t}/>
        <span style={{flex:1}}/>
        <button aria-label="Close" style={{
          width:22, height:22, borderRadius:4, border:'none', background:'transparent',
          color:t.textMuted, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}><Icons.ChevD size={14}/></button>
      </div>

      {/* Scrollable body — preview + configurator. scrollOffset simulates
          the user having scrolled the card. */}
      <div style={{flex:1, minHeight:0, overflow:'auto', background:t.surface2,
        position:'relative'}}>
        <div style={{marginTop: -scrollOffset}}>
          {/* Live preview — small (~120px), uses the visitor v look */}
          <div style={{
            padding:'10px 14px 0', background: t.surface2,
          }}>
            <div style={{
              background: v.card, border:`1px solid ${v.border}`, borderRadius:6,
              padding:'10px 12px',
            }}>
              <div style={{
                fontSize:11.5, fontWeight:600, color:v.ink,
                letterSpacing:-0.1, marginBottom:6,
              }}>{el.title || 'Live preview'}</div>
              <div style={{minHeight:108}}>
                {el.chartType === 'line'
                  ? <MiniLinePreview v={v}/>
                  : (Renderer ? <Renderer t={ct}/> : null)}
              </div>
            </div>
          </div>

          {/* Tabbed settings */}
          <div style={{padding:'10px 14px 18px'}}>
            <ChartSettingsInlineImpl t={t} v={v}
              chartType={el.chartType} tab={tab}
              showWarning={showWarning} mobile/>
          </div>
        </div>

        {/* Tiny scroll-indicator pip on the right edge */}
        <div style={{
          position:'absolute', top:0, bottom:0, right:2, width:3,
          pointerEvents:'none',
        }}>
          <div style={{
            position:'absolute', top: scrollOffset > 0 ? '30%' : '4%',
            left:0, width:3, height:'30%', borderRadius:2,
            background: t.textSubtle, opacity:0.4,
          }}/>
        </div>
      </div>
    </div>
  );
};

// Mini line-chart preview for mobile (matches the principal-vs-interest look
// from ChartCard, but tiny). 3 lines.
const MiniLinePreview = ({ v }) => {
  const W = 320, H = 110;
  const pad = { l:30, r:8, t:6, b:18 };
  const series = [
    { color: v.chartA, data: [60, 55, 48, 40, 30, 18, 5] },
    { color: v.chartB, data: [10, 18, 28, 42, 58, 76, 92] },
    { color: '#A78BFA', data: [5, 8, 12, 16, 20, 24, 26] },
  ];
  const yMax = 100;
  const xs = (i) => pad.l + (i / 6) * (W - pad.l - pad.r);
  const ys = (val) => H - pad.b - (val / yMax) * (H - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', height:'auto', display:'block'}}>
      {[0, 50, 100].map(g => (
        <line key={g} x1={pad.l} x2={W-pad.r} y1={ys(g)} y2={ys(g)}
          stroke={v.chartGrid} strokeWidth={1}/>
      ))}
      {['Y0','Y10','Y20','Y30'].map((lbl, i) => (
        <text key={lbl} x={pad.l + (i/3) * (W - pad.l - pad.r)}
          y={H-pad.b+12} fontSize={9} textAnchor="middle"
          fill={v.subtle} fontFamily='"Geist Mono",monospace'>{lbl}</text>
      ))}
      {series.map((s, i) => (
        <path key={i}
          d={s.data.map((v, j) => `${j===0?'M':'L'} ${xs(j)} ${ys(v)}`).join(' ')}
          fill="none" stroke={s.color} strokeWidth={1.75}/>
      ))}
    </svg>
  );
};

window.MobileChartCard = MobileChartCard;

Object.assign(window, {
  TabBar, ChartTypeTile, TypeTab, DataTab, StyleTab,
  ChartSettingsInlineImpl, MobileChartCard,
  chartThemeFromV,
});
