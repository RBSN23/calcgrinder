// Calcgrinder — Editor element extensions
// Adds Chart and Text-block element types to the editor alongside Cells,
// the unified "+ Add" picker, mixed-element grid + drawer, and a Grid
// collapse control. Chart EDITING is NOT done here — it happens in the
// Builder via editor-builder.jsx's ChartSettingsInline. The grid is only
// a listing / navigation surface for Charts.

const { useState: elUseState } = React;

// ─────────────────────────────────────────────────────────────────────────────
// Element pill — Cells re-use chrome.jsx's `Pill` via Input/Output kinds;
// Chart (teal) and Text (neutral outlined) are local variants here.
// ─────────────────────────────────────────────────────────────────────────────
const ElementPill = ({ kind, t, style }) => {
  if (kind === 'Input' || kind === 'Output') {
    return <Pill kind={kind === 'Input' ? 'input' : 'output'} t={t} style={style}>{kind}</Pill>;
  }
  const isDark = t.bg === cgTokens.dark.bg;
  const palette = kind === 'Chart'
    ? (isDark
        ? { bg: 'rgba(20,184,166,0.16)', fg: '#5EEAD4', dot: '#14B8A6' }
        : { bg: '#F0FDFA',               fg: '#0F766E', dot: '#14B8A6' })
    : /* Text */ { bg: 'transparent', fg: t.textMuted, dot: t.textSubtle, border: t.borderStr };
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'1px 7px 1px 6px', borderRadius:999,
      fontSize:10.5, fontWeight:500, lineHeight:'15px',
      background: palette.bg, color: palette.fg, letterSpacing:0.1,
      textTransform:'uppercase',
      border: palette.border ? `1px solid ${palette.border}` : 'none',
      ...style,
    }}>
      <span style={{width:4, height:4, borderRadius:'50%', background:palette.dot}}/>
      {kind}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Mini chart-type icons — abstract SVG glyphs for the 4×3 type-picker grid
// inside the chart configurator (defined in editor-builder.jsx but using
// these icons). 60×34 viewBox, currentColor-driven.
// ─────────────────────────────────────────────────────────────────────────────
const CTI = ({ children }) => (
  <svg viewBox="0 0 60 34" width="48" height="28" fill="none"
    stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const ChartTypeIcons = {
  line: () => (
    <CTI>
      <path d="M3 26 L14 18 L24 22 L34 10 L46 14 L57 6"/>
      <path d="M3 30 L14 26 L24 28 L34 22 L46 24 L57 18" opacity="0.5"/>
    </CTI>
  ),
  bar: () => (
    <CTI>
      <rect x="5"  y="14" width="7" height="16" fill="currentColor" stroke="none"/>
      <rect x="17" y="8"  width="7" height="22" fill="currentColor" stroke="none"/>
      <rect x="29" y="18" width="7" height="12" fill="currentColor" stroke="none"/>
      <rect x="41" y="11" width="7" height="19" fill="currentColor" stroke="none"/>
      <rect x="53" y="20" width="4" height="10" fill="currentColor" stroke="none"/>
    </CTI>
  ),
  area: () => (
    <CTI>
      <path d="M3 30 L3 22 L14 14 L24 18 L34 8 L46 12 L57 4 L57 30 Z" fill="currentColor" fillOpacity="0.20" stroke="none"/>
      <path d="M3 22 L14 14 L24 18 L34 8 L46 12 L57 4"/>
    </CTI>
  ),
  pie: () => (
    <CTI>
      <circle cx="22" cy="17" r="13" fill="currentColor" fillOpacity="0.20"/>
      <path d="M22 17 L22 4 A13 13 0 0 1 33.3 23.5 Z" fill="currentColor" stroke="none"/>
      <path d="M22 17 L33.3 23.5 A13 13 0 0 1 13 26.5 Z" fill="currentColor" fillOpacity="0.55" stroke="none"/>
    </CTI>
  ),
  donut: () => (
    <CTI>
      <circle cx="22" cy="17" r="13" fill="currentColor" fillOpacity="0.18"/>
      <path d="M22 17 L22 4 A13 13 0 0 1 33.3 23.5 L 28 20 A 6 6 0 0 0 22 11 Z" fill="currentColor" stroke="none"/>
      <circle cx="22" cy="17" r="6.5" stroke="currentColor" fill="none" strokeWidth="1.6"/>
    </CTI>
  ),
  stackedBar: () => (
    <CTI>
      <rect x="5"  y="20" width="7" height="10" fill="currentColor" stroke="none"/>
      <rect x="5"  y="13" width="7" height="6"  fill="currentColor" fillOpacity="0.55" stroke="none"/>
      <rect x="5"  y="7"  width="7" height="5"  fill="currentColor" fillOpacity="0.25" stroke="none"/>
      <rect x="17" y="18" width="7" height="12" fill="currentColor" stroke="none"/>
      <rect x="17" y="11" width="7" height="6"  fill="currentColor" fillOpacity="0.55" stroke="none"/>
      <rect x="17" y="5"  width="7" height="5"  fill="currentColor" fillOpacity="0.25" stroke="none"/>
      <rect x="29" y="14" width="7" height="16" fill="currentColor" stroke="none"/>
      <rect x="29" y="8"  width="7" height="5"  fill="currentColor" fillOpacity="0.55" stroke="none"/>
      <rect x="29" y="3"  width="7" height="4"  fill="currentColor" fillOpacity="0.25" stroke="none"/>
      <rect x="41" y="10" width="7" height="20" fill="currentColor" stroke="none"/>
      <rect x="41" y="4"  width="7" height="5"  fill="currentColor" fillOpacity="0.55" stroke="none"/>
    </CTI>
  ),
  comparisonBar: () => (
    <CTI>
      <rect x="7"  y="14" width="6" height="16" fill="currentColor" stroke="none"/>
      <rect x="14" y="18" width="6" height="12" fill="currentColor" fillOpacity="0.40" stroke="none"/>
      <rect x="27" y="9"  width="6" height="21" fill="currentColor" stroke="none"/>
      <rect x="34" y="12" width="6" height="18" fill="currentColor" fillOpacity="0.40" stroke="none"/>
      <rect x="47" y="17" width="6" height="13" fill="currentColor" stroke="none"/>
      <rect x="54" y="21" width="3" height="9"  fill="currentColor" fillOpacity="0.40" stroke="none"/>
    </CTI>
  ),
  sparkline: () => (
    <CTI>
      <path d="M3 22 L9 16 L15 19 L21 11 L27 15 L33 8 L39 13 L45 6 L51 10 L57 4"
        strokeWidth="1.4"/>
    </CTI>
  ),
  waterfall: () => (
    <CTI>
      <rect x="3"  y="20" width="7" height="10" fill="currentColor" fillOpacity="0.45" stroke="none"/>
      <rect x="13" y="14" width="7" height="6"  fill="currentColor" stroke="none"/>
      <rect x="23" y="9"  width="7" height="5"  fill="currentColor" stroke="none"/>
      <rect x="33" y="9"  width="7" height="6"  fill="currentColor" fillOpacity="0.45" stroke="none"/>
      <rect x="43" y="15" width="7" height="6"  fill="currentColor" fillOpacity="0.45" stroke="none"/>
      <rect x="53" y="4"  width="4" height="26" fill="none" stroke="currentColor"/>
    </CTI>
  ),
  bullet: () => (
    <CTI>
      <rect x="3"  y="14" width="18" height="8" fill="currentColor" fillOpacity="0.18" stroke="none"/>
      <rect x="21" y="14" width="18" height="8" fill="currentColor" fillOpacity="0.32" stroke="none"/>
      <rect x="39" y="14" width="18" height="8" fill="currentColor" fillOpacity="0.50" stroke="none"/>
      <rect x="3"  y="16" width="32" height="4" fill="currentColor" stroke="none"/>
      <line x1="42" y1="11" x2="42" y2="25" stroke="currentColor" strokeWidth="2"/>
    </CTI>
  ),
  heatmap: () => (
    <CTI>
      {[0,1,2,3].map(r => [0,1,2,3,4].map(c => {
        const a = 0.1 + ((r+c) % 4) * 0.20;
        return <rect key={`${r}-${c}`} x={4 + c*11} y={2 + r*7} width="10" height="6"
          fill="currentColor" fillOpacity={a} stroke="none"/>;
      }))}
    </CTI>
  ),
  radial: () => (
    <CTI>
      <circle cx="30" cy="17" r="11" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" fill="none"/>
      <path d="M30 6 A11 11 0 0 1 41 17" stroke="currentColor" strokeWidth="3" fill="none"/>
    </CTI>
  ),
};

// 12 chart types — row-major order for the 4×3 tile grid.
const CHART_TYPES = [
  { k:'line',          label:'Line',         hasAxes:true,  hasSmooth:true,  group:'Series' },
  { k:'bar',           label:'Bar',          hasAxes:true,                    group:'Series' },
  { k:'area',          label:'Area',         hasAxes:true,  hasSmooth:true,  group:'Series' },
  { k:'pie',           label:'Pie',          hasAxes:false,                   group:'Proportion' },
  { k:'donut',         label:'Donut',        hasAxes:false,                   group:'Proportion' },
  { k:'stackedBar',    label:'Stacked bar',  hasAxes:true,                    group:'Multi-dim' },
  { k:'comparisonBar', label:'Compare bar',  hasAxes:true,                    group:'Multi-dim' },
  { k:'heatmap',       label:'Heatmap',      hasAxes:true,                    group:'Multi-dim' },
  { k:'waterfall',     label:'Waterfall',    hasAxes:true,                    group:'Contribution' },
  { k:'sparkline',     label:'Sparkline',    hasAxes:false,                   group:'Single value' },
  { k:'bullet',        label:'Bullet',       hasAxes:false,                   group:'Single value' },
  { k:'radial',        label:'Radial',       hasAxes:false,                   group:'Single value' },
];
const CHART_TYPE_BY_K = Object.fromEntries(CHART_TYPES.map(c => [c.k, c]));

// ─────────────────────────────────────────────────────────────────────────────
// Demo elements — used by the new grid/drawer artboards.
// Default chart for the calculator is the principal-vs-interest line chart.
// ─────────────────────────────────────────────────────────────────────────────
const cgExtras = {
  intro_text: {
    kind: 'text', id: 'intro_text', tag: 'Text',
    content: 'Calculate your monthly mortgage payment and lifetime cost. Adjust the price, deposit, rate and term — everything updates as you go.',
  },
  revenue_trend: {
    kind: 'chart', id: 'revenue_trend', tag: 'Chart',
    chartType: 'line',
    title: 'How each payment splits',
    subtitle: 'Across the life of the loan',
    domainCell: 'term_months',
    series: [
      { cell:'monthly_interest_part',  label:'Interest',  color:'#1F1C16' },
      { cell:'monthly_principal_part', label:'Principal', color:'#4F46E5' },
      { cell:'monthly_pmi_part',       label:'PMI',       color:'#A78BFA' },
    ],
    legend: 'auto', axisLabels: 'auto', smooth: true, animate: true,
  },
};

const cgAllElements = [
  cgExtras.intro_text,
  ...cgCells.map(c => ({ kind:'cell', tag:c.type, ...c })),
  cgExtras.revenue_trend,
];

// ─────────────────────────────────────────────────────────────────────────────
// Add-element picker — shared row + popover + bottom sheet.
// ─────────────────────────────────────────────────────────────────────────────
const ADD_OPTIONS = [
  { k:'cell',  label:'Cell',  desc:'Input or output value',         icon:Icons.Hash },
  { k:'chart', label:'Chart', desc:'Visualisation of cell values',  icon:Icons.ChartBar },
  { k:'text',  label:'Text',  desc:'Heading or descriptive text',   icon:Icons.Type },
];

const AddOptionRow = ({ t, opt, compact }) => {
  const I = opt.icon;
  return (
    <button style={{
      display:'flex', alignItems:'center', gap:12,
      width:'100%', height: compact ? 60 : 52,
      padding: compact ? '0 14px' : '0 12px',
      borderRadius:8, background:'transparent', border:'none', cursor:'pointer',
      color:t.text, fontFamily:'inherit', textAlign:'left',
    }}>
      <span style={{
        width: compact ? 38 : 32, height: compact ? 38 : 32, flexShrink:0,
        borderRadius:7, background: t.surface2, border:`1px solid ${t.border}`,
        color: t.text,
        display:'inline-flex', alignItems:'center', justifyContent:'center',
      }}><I size={ compact ? 17 : 15}/></span>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize: compact ? 14 : 13, fontWeight:600, color:t.text,
          letterSpacing:-0.1, lineHeight:1.3}}>{opt.label}</div>
        <div style={{fontSize: compact ? 12 : 11.5, color:t.textMuted,
          marginTop:1, lineHeight:1.3}}>{opt.desc}</div>
      </div>
      <Icons.ChevR size={14} color={t.textSubtle}/>
    </button>
  );
};

const AddElementPicker = ({ t, placement='down', anchor='right' }) => (
  <div style={{
    position:'absolute', width:248, zIndex:50,
    ...(placement === 'down' ? { top:'calc(100% + 6px)' } : { bottom:'calc(100% + 6px)' }),
    ...(anchor === 'right' ? { right:0 } : { left:0 }),
    background:t.surface, border:`1px solid ${t.border}`, borderRadius:10,
    boxShadow:t.shadowLg, padding:6, color:t.text,
  }}>
    <div style={{
      padding:'6px 10px 8px', fontSize:11, fontWeight:600, color:t.textSubtle,
      letterSpacing:0.4, textTransform:'uppercase',
    }}>Add element</div>
    {ADD_OPTIONS.map(opt => <AddOptionRow key={opt.k} t={t} opt={opt}/>)}
  </div>
);

const AddElementSheet = ({ t }) => (
  <React.Fragment>
    <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.22)', zIndex:39}}/>
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, zIndex:40,
      background:t.surface,
      borderTopLeftRadius:16, borderTopRightRadius:16,
      borderTop:`1px solid ${t.border}`,
      boxShadow:'0 -10px 28px rgba(0,0,0,0.20), 0 -2px 8px rgba(0,0,0,0.08)',
      padding:'10px 12px 22px', color:t.text,
    }}>
      <div style={{width:36, height:4, borderRadius:2, background:t.borderStr,
        margin:'0 auto 12px'}}/>
      <div style={{padding:'2px 6px 10px', fontSize:13, fontWeight:600, color:t.text,
        letterSpacing:-0.1}}>Add element</div>
      {ADD_OPTIONS.map(opt => <AddOptionRow key={opt.k} t={t} opt={opt} compact/>)}
    </div>
  </React.Fragment>
);

const AddElementBtn = ({ t, compact, pickerOpen, pickerPlacement='down', pickerAnchor='right' }) => (
  <div style={{position:'relative'}}>
    <button aria-label="Add element" style={{
      height: compact ? 26 : 28,
      width: compact ? 26 : 'auto',
      padding: compact ? 0 : '0 10px 0 8px',
      borderRadius:6, cursor:'pointer', fontFamily:'inherit',
      background: pickerOpen ? t.accent : t.accentSoft,
      color: pickerOpen ? t.accentFg : t.accentText,
      border:`1px solid ${t.accent}`,
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5,
      fontSize:12, fontWeight:500,
    }}>
      <Icons.Plus size={ compact ? 13 : 12} stroke={2}/>
      {!compact && 'Add'}
    </button>
    {pickerOpen && <AddElementPicker t={t} placement={pickerPlacement} anchor={pickerAnchor}/>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Column widths
//   CELL_COL_W   178px — same as before (room for value/formula 3-line clamp)
//   CHART_COL_W   96px — chart and text-block columns
// ─────────────────────────────────────────────────────────────────────────────
const CELL_COL_W  = COL_W;
const CHART_COL_W = 96;

const colWidthFor = (el) => el.kind === 'cell' ? CELL_COL_W : CHART_COL_W;

// ─────────────────────────────────────────────────────────────────────────────
// Column renderers — Chart and Text. Narrower than Cell columns; Chart cols
// support a brief highlight pulse when their kebab jumps to the builder.
// ─────────────────────────────────────────────────────────────────────────────
const ChartColumnHeader = ({ t, el, expanded, pulse }) => (
  <div style={{
    height: GRID_HEADER_H, padding:'8px 8px', display:'flex', flexDirection:'column',
    gap:6, justifyContent:'space-between', borderBottom:`1px solid ${t.border}`,
    background: expanded ? t.surface2 : t.surface, position:'relative',
    ...(pulse ? {
      outline: `2px solid ${t.accent}`,
      outlineOffset: -2,
      boxShadow: `0 0 0 6px ${t.accentSoft}, 0 0 18px ${t.accent}66`,
    } : {}),
  }}>
    <div style={{
      fontFamily:'"Geist Mono", monospace', fontSize:12.5, color:t.text, fontWeight:500,
      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:0,
    }}>{el.id}</div>
    <div style={{display:'flex', alignItems:'center', gap:4}}>
      <ElementPill kind="Chart" t={t}/>
      <span style={{flex:1}}/>
      <button aria-label="Edit chart in builder" style={{
        width:20, height:20, borderRadius:4, border:'none', background:'transparent',
        color: expanded ? t.text : t.textMuted, cursor:'pointer',
        display:'inline-flex', alignItems:'center', justifyContent:'center',
      }}><Icons.Kebab size={12}/></button>
    </div>
  </div>
);

const ChartColumnData = ({ t, el, pulse }) => {
  const type = CHART_TYPE_BY_K[el.chartType];
  return (
    <div style={{
      height: GRID_DATA_H, padding:'10px 8px',
      borderBottom:`1px solid ${t.border}`, background:t.surface,
      display:'flex', flexDirection:'column', justifyContent:'flex-start', gap:4, minWidth:0,
      position:'relative',
      ...(pulse ? {
        boxShadow: `inset 0 0 0 2px ${t.accent}, 0 0 18px ${t.accent}66`,
      } : {}),
    }}>
      <div style={{display:'flex', alignItems:'center', gap:4, color:t.text, minWidth:0}}>
        <span style={{color: t.text, flexShrink:0, width:18, height:14,
          display:'inline-flex', alignItems:'center'}}>
          {ChartTypeIcons[el.chartType] && ChartTypeIcons[el.chartType]()}
        </span>
        <span style={{
          fontFamily:'"Geist Mono", monospace', fontSize:11.5, fontWeight:500,
          color:t.text, letterSpacing:0,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{type ? type.label : el.chartType}{el.series ? ` · ${el.series.length}` : ''}</span>
      </div>
      <div style={{
        fontSize:11, color:t.textSubtle, lineHeight:1.35,
        overflow:'hidden', textOverflow:'ellipsis',
        display:'-webkit-box', WebkitBoxOrient:'vertical', WebkitLineClamp:2,
      }}>edits in builder ↓</div>
    </div>
  );
};

const TextColumnHeader = ({ t, el, expanded }) => (
  <div style={{
    height: GRID_HEADER_H, padding:'8px 8px', display:'flex', flexDirection:'column',
    gap:6, justifyContent:'space-between', borderBottom:`1px solid ${t.border}`,
    background: expanded ? t.surface2 : t.surface, position:'relative',
  }}>
    <div style={{
      fontFamily:'"Geist Mono", monospace', fontSize:12.5, color:t.text, fontWeight:500,
      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:0,
    }}>{el.id}</div>
    <div style={{display:'flex', alignItems:'center', gap:4}}>
      <ElementPill kind="Text" t={t}/>
      <span style={{flex:1}}/>
      <button aria-label="Edit text in builder" style={{
        width:20, height:20, borderRadius:4, border:'none', background:'transparent',
        color: expanded ? t.text : t.textMuted, cursor:'pointer',
        display:'inline-flex', alignItems:'center', justifyContent:'center',
      }}><Icons.Kebab size={12}/></button>
    </div>
  </div>
);

const TextColumnData = ({ t, el }) => (
  <div style={{
    height: GRID_DATA_H, padding:'10px 8px',
    borderBottom:`1px solid ${t.border}`, background:t.surface, overflow:'hidden',
  }}>
    <div style={{
      display:'-webkit-box', WebkitBoxOrient:'vertical', WebkitLineClamp:3,
      overflow:'hidden', textOverflow:'ellipsis',
      fontSize:11, lineHeight:1.4, color:t.text, fontWeight:400,
      letterSpacing:-0.05,
    }}>{el.content}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// GridPanelExt — desktop grid with mixed elements, collapse, and pulse.
// Chart/Text columns are listing-only (kebab jumps to builder).
// Only CELLS expand inline (via HeaderSettings) — same as before this pass.
// ─────────────────────────────────────────────────────────────────────────────
const CELL_EXPANSION_H = 290;
const COLLAPSED_H = 40;

const GridPanelExt = ({
  t,
  elements = cgAllElements,
  expandedCellId = null,       // only cells expand inline now
  pulseChartId = null,         // chart column gets a 600ms highlight pulse
  addPickerOpen = false,
  gridEdgeRendersPicker = true, // if false, host renders picker at top level
  importOpen = false,
  collapsed = false,
  onToggleCollapse,
}) => {
  const expandedCell = expandedCellId
    ? elements.find(el => el.id === expandedCellId && el.kind === 'cell')
    : null;
  const isCellExpanded = !!expandedCell;
  const expansionH = isCellExpanded ? CELL_EXPANSION_H : 0;
  // toolbar (34) + header (56) + expansion + data (72)
  const totalH = collapsed ? COLLAPSED_H
                : 34 + GRID_HEADER_H + expansionH + GRID_DATA_H + 1;

  // grid template
  const trackList = elements.map(el => `${colWidthFor(el)}px`).join(' ');
  const colSpec = `120px ${trackList} 56px`;

  return (
    <div style={{
      height: totalH, flexShrink:0, background:t.surface,
      borderBottom:`1px solid ${t.border}`, position:'relative',
      display:'flex', flexDirection:'column', overflow:'visible',
      transition:'height .2s',
    }}>
      {/* Toolbar strip */}
      <div style={{
        height:COLLAPSED_H, display:'flex', alignItems:'center', padding:'0 16px', gap:10,
        borderBottom: collapsed ? 'none' : `1px solid ${t.border}`,
        background:t.surface2, flexShrink:0, position:'relative',
      }}>
        <Icons.Hash size={12} color={t.textMuted}/>
        <span style={{fontSize:11.5, fontWeight:600, color:t.textMuted,
          textTransform:'uppercase', letterSpacing:0.5}}>Elements</span>
        <span style={{fontSize:11, color:t.textSubtle,
          fontFamily:'"Geist Mono", monospace', padding:'2px 7px', borderRadius:4,
          background:t.surface, border:`1px solid ${t.border}`}}>{elements.length}</span>

        <div style={{position:'relative'}}>
          <button aria-label="Import cells from code" title="Import cells from code" style={{
            width:24, height:24, borderRadius:5, border:'1px solid transparent',
            background: importOpen ? t.accentSoft : 'transparent',
            color: importOpen ? t.accent : t.textMuted,
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer',
          }}>
            <Icons.Sparkle size={13}/>
          </button>
          {importOpen && <ImportPopover t={t}/>}
        </div>

        <span style={{flex:1}}/>
        <Btn variant="ghost"     size="sm" icon={Icons.Search} t={t}/>
        <Btn variant="secondary" size="sm" icon={Icons.Save}   t={t}>Save</Btn>

        {/* Grid collapse toggle */}
        <button aria-label={collapsed ? 'Expand grid' : 'Collapse grid'}
          title={collapsed ? 'Expand grid' : 'Collapse grid'}
          onClick={onToggleCollapse} style={{
            width:28, height:24, borderRadius:5,
            background:'transparent', border:`1px solid ${t.border}`,
            color:t.textMuted, cursor:'pointer',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            marginLeft:4,
          }}>
          {collapsed ? <Icons.ChevD size={12}/> : <Icons.ChevD size={12} style={{transform:'rotate(180deg)'}}/>}
        </button>
      </div>

      {/* Scrollable grid — hidden when collapsed */}
      {!collapsed && (
        <div style={{flex:1, overflow:'auto', position:'relative'}}>
          <div style={{
            display:'grid', gridTemplateColumns: colSpec,
            gridTemplateRows: isCellExpanded
              ? `${GRID_HEADER_H + CELL_EXPANSION_H}px ${GRID_DATA_H}px`
              : `${GRID_HEADER_H}px ${GRID_DATA_H}px`,
            minWidth:'min-content',
          }}>
            {/* Row label: header */}
            <div style={{
              padding:'0 10px', display:'flex', flexDirection:'column', justifyContent:'flex-end',
              paddingBottom:8, borderBottom:`1px solid ${t.border}`, background:t.surface2,
              position:'sticky', left:0, zIndex:2, borderRight:`1px solid ${t.border}`,
            }}>
              <div style={{fontSize:10.5, fontWeight:600, color:t.textMuted,
                textTransform:'uppercase', letterSpacing:0.5}}>Element</div>
            </div>

            {elements.map(el => {
              const isExp = el.id === expandedCellId && el.kind === 'cell';
              const pulse = el.id === pulseChartId && el.kind === 'chart';
              return (
                <div key={el.id} style={{
                  borderRight:`1px solid ${t.border}`, background:t.surface,
                  display:'flex', flexDirection:'column',
                }}>
                  {el.kind === 'cell'  && <GridColumnHeader t={t} cell={el} expanded={isExp}/>}
                  {el.kind === 'chart' && <ChartColumnHeader t={t} el={el} pulse={pulse}/>}
                  {el.kind === 'text'  && <TextColumnHeader  t={t} el={el}/>}
                  {isCellExpanded && (
                    isExp
                      ? <HeaderSettings t={t} cell={el}/>
                      : <div style={{flex:1, background:t.bg, borderBottom:`1px solid ${t.border}`}}/>
                  )}
                </div>
              );
            })}

            {/* + Add column at the end */}
            <div style={{
              borderRight:`1px solid ${t.border}`, background:t.surface2,
              display:'flex', alignItems:'flex-start', justifyContent:'center',
              paddingTop:14, position:'relative',
              gridRow: isCellExpanded ? 'span 2' : 'span 1',
            }}>
              <AddColumnButton t={t} pickerOpen={addPickerOpen} renderPicker={gridEdgeRendersPicker}/>
            </div>

            {/* Row label: data */}
            <div style={{
              padding:'0 10px', display:'flex', alignItems:'center',
              borderBottom:`1px solid ${t.border}`, background:t.surface2,
              position:'sticky', left:0, zIndex:2, borderRight:`1px solid ${t.border}`,
              fontSize:11.5, color:t.textMuted, fontWeight:500,
            }}>Value / Content</div>

            {elements.map(el => {
              const pulse = el.id === pulseChartId && el.kind === 'chart';
              return (
                <div key={el.id} style={{borderRight:`1px solid ${t.border}`}}>
                  {el.kind === 'cell'  && <GridColumnData t={t} cell={el}/>}
                  {el.kind === 'chart' && <ChartColumnData t={t} el={el} pulse={pulse}/>}
                  {el.kind === 'text'  && <TextColumnData  t={t} el={el}/>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const AddColumnButton = ({ t, pickerOpen, renderPicker = true }) => (
  <div style={{position:'relative'}}>
    <button aria-label="Add element" style={{
      width:30, height:30, borderRadius:6,
      border: pickerOpen ? `1px solid ${t.accent}` : `1px dashed ${t.borderStr}`,
      background: pickerOpen ? t.accentSoft : t.surface,
      color: pickerOpen ? t.accent : t.textMuted, cursor:'pointer',
      display:'inline-flex', alignItems:'center', justifyContent:'center',
    }}><Icons.Plus size={14}/></button>
    {pickerOpen && renderPicker && <AddElementPicker t={t} placement="down" anchor="right"/>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Mobile drawer rows — Chart + Text. (Cells use GridDrawerRow from editor-grid.)
// All drawer rows are the same full-width layout regardless of element kind.
// ─────────────────────────────────────────────────────────────────────────────
const GridDrawerChartRow = ({ t, el }) => {
  const type = CHART_TYPE_BY_K[el.chartType];
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'104px 1fr auto auto',
      gap:10, alignItems:'flex-start', padding:'10px 10px 10px 14px',
      borderBottom:`1px solid ${t.border}`, background:t.surface,
    }}>
      <div style={{
        fontFamily:'"Geist Mono", monospace', fontSize:12, color:t.text,
        fontWeight:500, lineHeight:1.5,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      }}>{el.id}</div>
      <div style={{minWidth:0}}>
        <div style={{display:'flex', alignItems:'center', gap:6, color:t.text}}>
          <span style={{color:t.text, display:'inline-flex'}}>
            {ChartTypeIcons[el.chartType] && ChartTypeIcons[el.chartType]()}
          </span>
          <span style={{
            fontFamily:'"Geist Mono", monospace', fontSize:12, fontWeight:500,
            color:t.text, letterSpacing:0,
          }}>{type ? type.label : el.chartType}</span>
        </div>
        <div style={{
          fontFamily:'"Geist Mono", monospace', fontSize:11.5, color:t.textMuted,
          marginTop:3,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{el.series ? `${el.series.length} series` : ''}</div>
      </div>
      <ElementPill kind="Chart" t={t} style={{marginTop:2}}/>
      <button aria-label="Edit chart" style={{
        width:22, height:22, borderRadius:4, border:'none', background:'transparent',
        color:t.textMuted, cursor:'pointer',
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        marginTop:2,
      }}><Icons.Kebab size={12}/></button>
    </div>
  );
};

const GridDrawerTextRow = ({ t, el }) => (
  <div style={{
    display:'grid', gridTemplateColumns:'104px 1fr auto auto',
    gap:10, alignItems:'flex-start', padding:'10px 10px 10px 14px',
    borderBottom:`1px solid ${t.border}`, background:t.surface,
  }}>
    <div style={{
      fontFamily:'"Geist Mono", monospace', fontSize:12, color:t.text,
      fontWeight:500, lineHeight:1.5,
      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
    }}>{el.id}</div>
    <div style={{
      display:'-webkit-box', WebkitBoxOrient:'vertical', WebkitLineClamp:3,
      overflow:'hidden', textOverflow:'ellipsis',
      fontSize:12, lineHeight:1.45, color:t.text, fontWeight:400, minWidth:0,
    }}>{el.content}</div>
    <ElementPill kind="Text" t={t} style={{marginTop:2}}/>
    <button aria-label="Edit text" style={{
      width:22, height:22, borderRadius:4, border:'none', background:'transparent',
      color:t.textMuted, cursor:'pointer',
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      marginTop:2,
    }}><Icons.Kebab size={12}/></button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// GridDrawerMobileExt — drawer that handles all three element kinds.
// Chart focused-expand is rendered by editor-builder.jsx's MobileChartCard
// (passed in via `chartExpandRender` so this file doesn't import builder).
// ─────────────────────────────────────────────────────────────────────────────
const GridDrawerMobileExt = ({
  t,
  elements = cgAllElements,
  expandedElementId,
  chartExpandRender,         // (el) => JSX  — host renders the chart card
  addSheetOpen = false,
  drawerHeight,
}) => {
  const expanded = expandedElementId ? elements.find(el => el.id === expandedElementId) : null;
  const isChart  = expanded && expanded.kind === 'chart';
  const height = expanded ? (drawerHeight || '70%') : '34%';
  return (
    <div style={{
      flexShrink:0, background:t.surface,
      borderTop:`1px solid ${t.border}`, height,
      display:'flex', flexDirection:'column', overflow:'hidden', position:'relative',
    }}>
      <div style={{
        height:28, flexShrink:0,
        display:'flex', alignItems:'center', padding:'0 14px', gap:8,
        background:t.surface2, borderBottom:`1px solid ${t.border}`,
      }}>
        <Icons.Hash size={11} color={t.textMuted}/>
        <span style={{fontSize:10.5, fontWeight:600, color:t.textMuted,
          textTransform:'uppercase', letterSpacing:0.5}}>Elements</span>
        <span style={{fontSize:10.5, color:t.textSubtle,
          fontFamily:'"Geist Mono", monospace', padding:'1px 6px', borderRadius:4,
          background:t.surface, border:`1px solid ${t.border}`}}>{elements.length}</span>
      </div>
      {isChart && chartExpandRender ? (
        chartExpandRender(expanded)
      ) : expanded && expanded.kind === 'cell' ? (
        <GridDrawerExpandedCard t={t} cell={expanded}/>
      ) : (
        <div style={{flex:1, overflow:'auto', position:'relative'}}>
          {elements.map(el => {
            if (el.kind === 'cell')  return <GridDrawerRow      key={el.id} t={t} cell={el}/>;
            if (el.kind === 'chart') return <GridDrawerChartRow key={el.id} t={t} el={el}/>;
            if (el.kind === 'text')  return <GridDrawerTextRow  key={el.id} t={t} el={el}/>;
            return null;
          })}
          <button aria-label="Add element" style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            width:'100%', padding:'12px 14px',
            background:'transparent', border:'none',
            borderBottom:`1px solid ${t.border}`,
            color:t.accent, cursor:'pointer', fontFamily:'inherit',
            fontSize:12, fontWeight:500, letterSpacing:-0.05,
          }}>
            <span style={{
              width:18, height:18, borderRadius:4,
              border:`1px dashed ${t.accent}`,
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              color:t.accent,
            }}><Icons.Plus size={10}/></span>
            Add element
          </button>
        </div>
      )}
      {addSheetOpen && <AddElementSheet t={t}/>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EditorExt — desktop + mobile shell with the new mixed-element grid.
// Chart editing now happens in the Builder via expandChart + chart-state props,
// not via expandedElementId. (expandedCellId still works for cell column edits.)
// ─────────────────────────────────────────────────────────────────────────────
const EditorExt = ({
  theme = 'light',
  viewport = 'desktop',
  elements = cgAllElements,
  expandedCellId = null,
  pulseChartId = null,
  // builder-side chart configurator state
  expandChart = false,
  chartType = 'line',
  chartTab = 'data',
  chartShowWarning = null,
  chartScrollOffset = 0,
  // grid collapse
  collapsed = false,
  // pickers
  pickerOpen = null,           // gridEdge | builderToolbar | footer
  addSheetOpen = false,
  // mobile
  mobileGridOpen = true,
  drawerHeight = null,
  mobileExpandChart = false,   // when true on mobile, the chart row appears expanded
  showHoverAdd = false,
}) => {
  const t = cgTokens[theme];
  const mobile = viewport === 'mobile';

  if (mobile) {
    return <EditorExtMobile t={t} theme={theme}
      elements={elements}
      mobileExpandChart={mobileExpandChart}
      chartType={chartType}
      chartTab={chartTab}
      chartShowWarning={chartShowWarning}
      chartScrollOffset={chartScrollOffset}
      drawerHeight={drawerHeight}
      addSheetOpen={addSheetOpen}
      pickerOpen={pickerOpen}/>;
  }

  const gridEdgePickerOpen      = pickerOpen === 'gridEdge';
  const builderToolbarPickerOpen = pickerOpen === 'builderToolbar';

  return (
    <div style={{
      background:t.bg, color:t.text, width:'100%', height:'100%',
      fontFamily:'"Geist", -apple-system, system-ui, sans-serif',
      fontSize:14, letterSpacing:-0.05, display:'flex', flexDirection:'column',
      overflow:'hidden', WebkitFontSmoothing:'antialiased',
    }}>
      <TopBarDesktop t={t} tabs={[
        { label:'Dashboard', active:false },
        { label:'Mortgage Calculator', active:true },
      ]}/>
      <GridPanelExt t={t} elements={elements}
        expandedCellId={expandedCellId}
        pulseChartId={pulseChartId}
        addPickerOpen={gridEdgePickerOpen}
        gridEdgeRendersPicker={false}
        collapsed={collapsed}/>
      <ResizeHandle t={t}/>
      <BuilderToolbarExt t={t} pickerOpen={builderToolbarPickerOpen}/>
      <div style={{flex:1, overflow:'auto', background: visTheme[theme].bg}}>
        <BuilderCanvas t={t} theme={theme}
          expandChart={expandChart}
          chartType={chartType}
          chartTab={chartTab}
          chartShowWarning={chartShowWarning}
          showHoverAdd={showHoverAdd}/>
      </div>

      {/* Top-level overlay for the grid-edge + Add picker so it escapes
          the grid panel's overflow:auto and floats above the builder. */}
      {gridEdgePickerOpen && (
        <div style={{
          position:'absolute', top: 48 + COLLAPSED_H + 14 + 30 + 6,
          right: 14, zIndex: 80, width: 248,
          background:t.surface, border:`1px solid ${t.border}`, borderRadius:10,
          boxShadow:t.shadowLg, padding:6, color:t.text,
        }}>
          <div style={{
            padding:'6px 10px 8px', fontSize:11, fontWeight:600, color:t.textSubtle,
            letterSpacing:0.4, textTransform:'uppercase',
          }}>Add element</div>
          {ADD_OPTIONS.map(opt => <AddOptionRow key={opt.k} t={t} opt={opt}/>)}
        </div>
      )}
    </div>
  );
};

// Builder toolbar with the new + Add button (replaces editor.jsx's BuilderToolbar)
const BuilderToolbarExt = ({ t, pickerOpen }) => (
  <div style={{
    height:44, flexShrink:0, position:'relative',
    borderBottom:`1px solid ${t.border}`, background:t.surface,
    display:'flex', alignItems:'center', padding:'0 16px', gap:8,
  }}>
    <Btn variant="ghost" size="sm" icon={Icons.External} t={t}>Preview</Btn>
    <div className="cg-vp-icons" style={{
      display:'inline-flex', padding:2, borderRadius:7,
      background:t.surface2, border:`1px solid ${t.border}`,
    }}>
      {[
        { k:'desktop', I:Icons.Desktop, label:'Desktop', active:true },
        { k:'tablet',  I:Icons.Tablet,  label:'Tablet' },
        { k:'mobile',  I:Icons.Phone,   label:'Mobile' },
      ].map(opt => (
        <button key={opt.k} aria-label={opt.label} title={opt.label} style={{
          width:28, height:24, borderRadius:5, border:'none',
          background: opt.active ? t.surface : 'transparent',
          color: opt.active ? t.text : t.textMuted, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          boxShadow: opt.active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        }}><opt.I size={13}/></button>
      ))}
    </div>
    <span style={{flex:1}}/>
    <HiddenPill t={t}/>
    <AddElementBtn t={t} pickerOpen={pickerOpen}/>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// EditorExtMobile — mobile shell. Chart row focused-expand renders a small
// chart preview + the new ChartSettingsInline (compact mode).
// ─────────────────────────────────────────────────────────────────────────────
const EditorExtMobile = ({ t, theme, elements, mobileExpandChart, chartType, chartTab, chartShowWarning, chartScrollOffset, drawerHeight, addSheetOpen, pickerOpen }) => {
  const v = visTheme[theme];
  const footerH = 52;
  const footerPickerOpen = pickerOpen === 'footer';
  // The chart row id (only one chart in cgAllElements)
  const chartEl = elements.find(el => el.kind === 'chart');
  const expandedElementId = mobileExpandChart && chartEl ? chartEl.id : null;

  const chartExpandRender = (el) => (
    <MobileChartCard t={t} el={{ ...el, chartType }}
      tab={chartTab}
      showWarning={chartShowWarning}
      scrollOffset={chartScrollOffset}/>
  );

  return (
    <div style={{
      background:t.bg, color:t.text, width:'100%', height:'100%',
      fontFamily:'"Geist", -apple-system, system-ui, sans-serif',
      fontSize:14, letterSpacing:-0.05, display:'flex', flexDirection:'column',
      overflow:'hidden', position:'relative',
    }}>
      {/* Top bar 1 */}
      <header style={{
        height:48, borderBottom:`1px solid ${t.border}`, background:t.surface,
        display:'flex', alignItems:'center', padding:'0 10px', gap:8, flexShrink:0,
      }}>
        <button style={{
          width:34, height:34, borderRadius:6, background:'transparent', border:'none',
          color:t.text, display:'inline-flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', margin:'0 -6px 0 -4px',
        }}><Icons.Menu size={18}/></button>
        <Wordmark t={t} mini/>
        <span style={{
          fontSize:13, fontWeight:600, color:t.text, letterSpacing:-0.1,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          minWidth:0, maxWidth:120,
        }}>Mortgage</span>
        <span style={{flex:1}}/>
        <Avatar initials="AT" t={t} size={26}/>
      </header>

      {/* Toolbar 2 */}
      <div style={{
        height:44, flexShrink:0,
        borderBottom:`1px solid ${t.border}`, background:t.surface,
        display:'flex', alignItems:'center', padding:'0 10px', gap:8,
      }}>
        <ThemePicker t={t} compact/>
        <div className="cg-vp-icons" style={{
          display:'inline-flex', padding:2, borderRadius:7,
          background:t.surface2, border:`1px solid ${t.border}`,
        }}>
          {[
            { k:'mobile',  I:Icons.Phone,   label:'Mobile', active:true },
            { k:'tablet',  I:Icons.Tablet,  label:'Tablet' },
            { k:'desktop', I:Icons.Desktop, label:'Desktop' },
          ].map(opt => (
            <button key={opt.k} aria-label={opt.label} title={opt.label} style={{
              width:24, height:22, borderRadius:5, border:'none',
              background: opt.active ? t.surface : 'transparent',
              color: opt.active ? t.text : t.textMuted, cursor:'pointer',
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              boxShadow: opt.active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}><opt.I size={12}/></button>
          ))}
        </div>
        <span style={{flex:1}}/>
        <button aria-label="Preview" style={{
          height:28, width:28, borderRadius:6, background:'transparent',
          border:`1px solid ${t.border}`, color:t.text, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}><Icons.External size={13}/></button>
      </div>

      {/* Body */}
      <div style={{
        flex:1, minHeight:0, display:'flex', flexDirection:'column',
        background:v.bg, overflow:'hidden',
      }}>
        <div style={{flex:1, overflow:'auto', background:v.bg}}>
          <BuilderCanvas t={t} theme={theme} viewport="mobile"/>
        </div>
        <GridDrawerMobileExt t={t}
          elements={elements}
          expandedElementId={expandedElementId}
          chartExpandRender={chartExpandRender}
          drawerHeight={drawerHeight}
          addSheetOpen={addSheetOpen}/>
      </div>

      {/* Footer nav */}
      <nav style={{
        height: footerH, flexShrink:0, background:t.surface,
        borderTop:`1px solid ${t.border}`,
        display:'flex', alignItems:'center', padding:'0 10px', gap:8,
        paddingBottom: 'env(safe-area-inset-bottom)',
        position:'relative',
      }}>
        <button aria-label="Import" style={{
          width:36, height:36, borderRadius:8,
          background:'transparent', color:t.text, border:'1px solid transparent',
          cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}><Icons.Sparkle size={16}/></button>
        <span style={{flex:1}}/>
        <button aria-label="Toggle grid" style={{
          height:32, padding:'0 12px 0 10px', borderRadius:999,
          display:'inline-flex', alignItems:'center', gap:8,
          background: t.accentSoft, color: t.accentText,
          border:`1px solid ${t.accent}`,
          cursor:'pointer', fontFamily:'inherit',
          fontSize:12.5, fontWeight:500, letterSpacing:-0.1,
        }}>
          <Icons.Hash size={13}/>
          <span>Grid</span>
          <span style={{
            width:22, height:13, borderRadius:7, padding:1,
            background: t.accent, position:'relative', display:'inline-block',
            marginLeft:2,
          }}>
            <span style={{
              width:11, height:11, borderRadius:'50%', background:'#fff',
              position:'absolute', top:1, left:10,
              boxShadow:'0 1px 2px rgba(0,0,0,0.2)',
            }}/>
          </span>
        </button>
        <span style={{flex:1}}/>
        <HiddenPill t={t} compact/>
        <AddElementBtn t={t} compact pickerOpen={footerPickerOpen} pickerPlacement="up"/>
      </nav>
    </div>
  );
};

Object.assign(window, {
  ElementPill, ChartTypeIcons, CHART_TYPES, CHART_TYPE_BY_K,
  cgExtras, cgAllElements,
  AddElementPicker, AddElementSheet, AddElementBtn, AddOptionRow,
  ChartColumnHeader, ChartColumnData, TextColumnHeader, TextColumnData,
  GridPanelExt, GridDrawerMobileExt, GridDrawerChartRow, GridDrawerTextRow,
  EditorExt, EditorExtMobile, BuilderToolbarExt,
  CELL_COL_W, CHART_COL_W,
});
