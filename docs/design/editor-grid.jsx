// Calcgrinder — Editor data + Grid panel
// Cells, formulas, helpers, and the inverted-spreadsheet grid.

const { useState: gridUseState } = React;

// ─────────────────────────────────────────────────────────────────────────────
// The mortgage calculator's cells. Order matters — drives column order.
// ─────────────────────────────────────────────────────────────────────────────
const cgCells = [
  { id:'purchase_price',    type:'Input',  hidden:false, widget:'Currency input', value:'$450,000',   value_type:'currency', label:'Purchase price',           description:'Home sale price before any deposit.' },
  { id:'down_payment_pct',  type:'Input',  hidden:false, widget:'Percent slider', value:'20%',         value_type:'percent',  label:'Down payment',             description:'Deposit as percent of price.' },
  { id:'down_payment',      type:'Output', hidden:false, widget:'Number display', value:'=purchase_price * down_payment_pct', value_type:'currency', label:'Down payment ($)', description:'Computed cash down.' },
  { id:'loan_amount',       type:'Output', hidden:true,  widget:'(hidden)',       value:'=purchase_price - down_payment',     value_type:'currency', label:'Loan amount',     description:'Internal — used by PMT().' },
  { id:'interest_rate',     type:'Input',  hidden:false, widget:'Percent input',  value:'5.85%',       value_type:'percent',  label:'Interest rate',            description:'Annual fixed rate (APR).' },
  { id:'term_years',        type:'Input',  hidden:false, widget:'Number stepper', value:'30',          value_type:'integer',  label:'Term',                     description:'Length of loan, in years.' },
  { id:'monthly_rate',      type:'Output', hidden:true,  widget:'(hidden)',       value:'=interest_rate / 12', value_type:'decimal', label:'Monthly rate', description:'Internal — APR / 12.' },
  { id:'monthly_payment',   type:'Output', hidden:false, widget:'Big stat',       value:'=PMT(monthly_rate, term_years*12, -loan_amount)', value_type:'currency', label:'Monthly payment',  description:'Principal + interest each month.' },
  { id:'total_paid',        type:'Output', hidden:true,  widget:'(hidden)',       value:'=monthly_payment * term_years * 12', value_type:'currency', label:'Total paid', description:'Internal — used by total_cost.' },
  { id:'total_interest',    type:'Output', hidden:false, widget:'Stat',           value:'=total_paid - loan_amount',          value_type:'currency', label:'Total interest', description:'Lifetime interest paid.' },
  { id:'total_cost',        type:'Output', hidden:false, widget:'Stat',           value:'=total_paid + down_payment',         value_type:'currency', label:'Total cost',     description:'Everything you pay over the loan.' },
];

const cgCellById = (id) => cgCells.find(c => c.id === id);

// ─────────────────────────────────────────────────────────────────────────────
// Formula syntax highlighting. Returns array of styled spans.
// ─────────────────────────────────────────────────────────────────────────────
const cgTokenizeFormula = (formula) => {
  // Strip leading =
  const body = formula.startsWith('=') ? formula.slice(1) : formula;
  const tokens = [];
  const re = /([A-Z][A-Z0-9_]*\()|([a-z_][a-z0-9_]*)|(\d+(?:\.\d+)?)|([+\-*/(),])|(\s+)/g;
  let m, last = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) tokens.push({ t:'text', v:body.slice(last, m.index) });
    if (m[1]) tokens.push({ t:'fn',   v:m[1] });
    else if (m[2]) tokens.push({ t:'ref',  v:m[2] });
    else if (m[3]) tokens.push({ t:'num',  v:m[3] });
    else if (m[4]) tokens.push({ t:'op',   v:m[4] });
    else if (m[5]) tokens.push({ t:'ws',   v:m[5] });
    last = re.lastIndex;
  }
  if (last < body.length) tokens.push({ t:'text', v:body.slice(last) });
  return tokens;
};

const Formula = ({ formula, t, size=12.5, multiline=false }) => {
  const colors = {
    fn:  t.accent,
    ref: t.text,
    num: t.text === '#F5F5F4' ? '#A78BFA' : '#7C3AED',
    op:  t.textMuted,
    text:t.text,
    ws:  t.text,
  };
  const tokens = cgTokenizeFormula(formula);
  return (
    <span style={{
      fontFamily:'"Geist Mono", monospace', fontSize:size, lineHeight:1.4,
      fontVariantLigatures:'none', letterSpacing:0, fontWeight:500,
      color:t.text, whiteSpace: multiline ? 'normal' : 'nowrap',
      wordBreak: multiline ? 'break-word' : 'normal',
      overflowWrap: multiline ? 'anywhere' : 'normal',
    }}>
      <span style={{color:t.textSubtle}}>=</span>
      {tokens.map((tk, i) => (
        <span key={i} style={{
          color: colors[tk.t],
          textDecoration: tk.t==='ref' ? `underline dotted ${t.borderStr}` : 'none',
          textUnderlineOffset: 3,
          fontWeight: tk.t==='fn' ? 600 : (tk.t==='ref' ? 500 : 400),
        }}>{tk.v}</span>
      ))}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Header settings — the inline panel that drops out of a column header.
// ─────────────────────────────────────────────────────────────────────────────
const Field = ({ t, label, children }) => (
  <div style={{display:'flex', flexDirection:'column', gap:5, minWidth:0}}>
    <label style={{
      fontSize:10.5, fontWeight:500, color:t.textMuted,
      letterSpacing:0.4, textTransform:'uppercase',
    }}>{label}</label>
    {children}
  </div>
);

const Select = ({ t, value, icon:I, style }) => (
  <div style={{
    height:30, padding:'0 8px 0 9px', borderRadius:6,
    background:t.surface, border:`1px solid ${t.borderStr}`,
    display:'inline-flex', alignItems:'center', gap:6,
    fontSize:12.5, color:t.text, fontFamily:'inherit', fontWeight:500, minWidth:0,
    ...style,
  }}>
    {I && <I size={12}/>}
    <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{value}</span>
    <Icons.ChevD size={12}/>
  </div>
);

const TextInput = ({ t, value, mono, style }) => (
  <div style={{
    height:30, padding:'0 9px', borderRadius:6,
    background:t.surface, border:`1px solid ${t.borderStr}`,
    display:'inline-flex', alignItems:'center',
    fontSize:12.5, color:t.text,
    fontFamily: mono ? '"Geist Mono", monospace' : 'inherit',
    minWidth:0, ...style,
  }}>
    <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{value}</span>
  </div>
);

const SegToggle = ({ t, options, value, accent }) => (
  <div style={{
    display:'inline-flex', padding:2, borderRadius:7,
    background:t.surface2, border:`1px solid ${t.border}`,
  }}>
    {options.map(opt => {
      const active = opt.k === value;
      return (
        <div key={opt.k} style={{
          height:24, padding:'0 10px', borderRadius:5,
          display:'inline-flex', alignItems:'center', gap:5,
          fontSize:12, fontWeight:500, fontFamily:'inherit',
          background: active ? t.surface : 'transparent',
          color: active ? (accent ? t.accentText : t.text) : t.textMuted,
          boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          border: active ? `1px solid ${accent ? t.accent : t.border}` : '1px solid transparent',
        }}>
          {opt.I && <opt.I size={11}/>}
          {opt.label}
        </div>
      );
    })}
  </div>
);

const HeaderSettings = ({ t, cell, onClose }) => (
  <div style={{
    padding:'12px 12px 14px', borderTop:`1px solid ${t.border}`,
    background:t.surface2,
    display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px',
  }}>
    <div style={{gridColumn:'1 / -1', display:'flex', alignItems:'center', gap:8, marginBottom:-2}}>
      <span style={{fontSize:11, fontWeight:600, color:t.text, letterSpacing:0.4, textTransform:'uppercase'}}>Column settings</span>
      <span style={{flex:1}}/>
      <IconBtn icon={Icons.X} t={t} size={12} ariaLabel="Close" onClick={onClose}/>
    </div>

    <Field t={t} label="Label"><TextInput t={t} value={cell.label}/></Field>
    <Field t={t} label="Value type"><Select t={t} value={cell.value_type} icon={cell.value_type==='currency'?Icons.Dollar:cell.value_type==='percent'?Icons.Percent:Icons.Hash}/></Field>

    <Field t={t} label="Display widget"><Select t={t} value={cell.widget} icon={Icons.Sliders}/></Field>
    <Field t={t} label="Display format"><TextInput t={t} value={cell.value_type==='currency'?'$ 0,0':cell.value_type==='percent'?'0.00 %':'0'} mono/></Field>

    <Field t={t} label="Visibility">
      <SegToggle t={t} value={cell.hidden?'hidden':'visible'} options={[
        { k:'visible', label:'Visible', I:Icons.Eye },
        { k:'hidden',  label:'Hidden',  I:Icons.EyeOff },
      ]}/>
    </Field>

    <Field t={t} label="Editability">
      <SegToggle t={t} value={cell.type==='Input'?'editable':'readonly'} options={[
        { k:'editable', label:'Editable', I:Icons.Pencil },
        { k:'readonly', label:'Readonly', I:Icons.Lock },
      ]}/>
    </Field>

    <div style={{gridColumn:'1 / -1'}}>
      <Field t={t} label="Description">
        <div style={{
          minHeight:48, padding:'8px 10px', borderRadius:6,
          background:t.surface, border:`1px solid ${t.borderStr}`,
          fontSize:12.5, color:t.text, lineHeight:1.45,
        }}>{cell.description}</div>
      </Field>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Grid panel
// ─────────────────────────────────────────────────────────────────────────────
const COL_W = 178;
const GRID_HEADER_H = 56;
const GRID_DATA_H = 72;

const GridColumnHeader = ({ t, cell, expanded, onToggle }) => {
  const isOutput = cell.type === 'Output';
  return (
    <div style={{
      height: GRID_HEADER_H, padding:'8px 10px', display:'flex', flexDirection:'column',
      gap:6, justifyContent:'space-between', borderBottom:`1px solid ${t.border}`,
      background: expanded ? t.surface2 : t.surface, position:'relative',
    }}>
      <div style={{
        fontFamily:'"Geist Mono", monospace', fontSize:12.5, color:t.text, fontWeight:500,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:0,
      }}>{cell.id}</div>
      <div style={{display:'flex', alignItems:'center', gap:6}}>
        <Pill kind={isOutput?'output':'input'} t={t}>{cell.type}</Pill>
        {cell.hidden && (
          <span title="Hidden" style={{
            color:t.textSubtle, display:'inline-flex', alignItems:'center',
          }}><Icons.EyeOff size={11}/></span>
        )}
        <span style={{flex:1}}/>
        <button onClick={onToggle} aria-label="Column settings" style={{
          width:20, height:20, borderRadius:4, border:'none', background:'transparent',
          color: expanded ? t.text : t.textMuted, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}><Icons.Kebab size={12}/></button>
      </div>
    </div>
  );
};

const GridColumnData = ({ t, cell }) => {
  const isFormula = String(cell.value).startsWith('=');
  // 3-line clamp container — supplies the truncation '…' for long formulas/values
  const clamp = {
    display:'-webkit-box', WebkitBoxOrient:'vertical', WebkitLineClamp:3,
    overflow:'hidden', textOverflow:'ellipsis',
    // Make the ellipsis itself muted/grey
    color: t.textMuted,
  };
  return (
    <div style={{
      height: GRID_DATA_H, padding:'10px 10px', display:'flex', alignItems:'flex-start',
      borderBottom:`1px solid ${t.border}`, background:t.surface,
      overflow:'hidden',
    }}>
      <div style={clamp}>
        {isFormula ? (
          <Formula formula={cell.value} t={t} multiline/>
        ) : (
          <span style={{
            fontFamily:'"Geist Mono", monospace', fontSize:12.5, fontWeight:500,
            color:t.text, letterSpacing:0,
            wordBreak:'break-word', overflowWrap:'anywhere',
          }}>{cell.value}</span>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Import-from-code — anchored popover (desktop) + bottom sheet (mobile).
// Body is shared so the two stay in lockstep.
// ─────────────────────────────────────────────────────────────────────────────
const importExample = `# inputs
price        : currency = 450_000
down_pct     : percent  = 0.20
rate         : percent  = 0.0585
term_years   : int      = 30

# outputs
monthly      = PMT(rate/12, term_years*12,
                   -price*(1 - down_pct))
total_cost   = monthly * term_years * 12
             + price * down_pct`;

// Demo data for the preview step — kept small so it reads at a glance but
// long enough to exercise the internal scroll behaviour.
const importPreviewDemo = {
  new: [
    { id:'property_tax_rate', summary:'input · percent · default 1.20%' },
    { id:'monthly_tax',       summary:'output · currency · formula' },
  ],
  replaced: [
    { id:'interest_rate',     summary:'5.85% → 6.20%' },
    { id:'down_payment_pct',  summary:'20% → 25%' },
  ],
  unchanged: [
    { id:'purchase_price',    summary:'' },
    { id:'term_years',        summary:'' },
    { id:'monthly_payment',   summary:'' },
  ],
};

const importErrorsDemo = [
  { line:3, msg:"unknown type 'currrency' — did you mean 'currency'?" },
  { line:7, msg:"missing value after '=' in formula" },
];

// Single error row — small triangle glyph + "Line N: <message>" in danger red.
const ImportErrorRow = ({ t, line, msg }) => (
  <div style={{
    display:'flex', alignItems:'flex-start', gap:7,
    padding:'6px 0 0', color: t.dangerText,
    fontSize:11.5, lineHeight:1.45,
  }}>
    <span style={{flexShrink:0, marginTop:1, color:t.danger,
      display:'inline-flex', alignItems:'center'}}>
      <Icons.Alert size={12}/>
    </span>
    <span style={{minWidth:0}}>
      <span style={{fontFamily:'"Geist Mono", monospace', fontWeight:500}}>
        Line {line}:
      </span>{' '}
      {msg}
    </span>
  </div>
);

// One row of the diff preview list.
const ImportPreviewRow = ({ t, kind, id, summary }) => {
  const label = { 'new':'NEW', replaced:'REPLACED', unchanged:'UNCHANGED' }[kind];
  const muted = kind === 'unchanged';
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'auto minmax(0,1fr) minmax(0,auto)',
      alignItems:'center', columnGap:10,
      padding:'7px 14px',
      opacity: muted ? 0.55 : 1,
      borderTop:`1px solid ${t.border}`,
    }}>
      <Pill kind={kind} t={t}>{label}</Pill>
      <span style={{
        fontFamily:'"Geist Mono", monospace', fontSize:12, fontWeight:500,
        color:t.text, letterSpacing:0,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      }}>{id}</span>
      <span style={{
        fontFamily:'"Geist Mono", monospace', fontSize:11, fontWeight:400,
        color: t.textMuted, textAlign:'right', justifySelf:'end',
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      }}>{summary}</span>
    </div>
  );
};

// State 1 / 2 — paste surface. `errors` toggles the inline error list +
// disabled primary button.
const ImportBody = ({ t, compact, errors }) => {
  const hasErrors = !!(errors && errors.length);
  return (
    <React.Fragment>
      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
        <Icons.Sparkle size={13} color={t.accent}/>
        <span style={{fontSize: compact ? 14 : 13, fontWeight:600, color:t.text,
          letterSpacing:-0.1}}>Paste code</span>
      </div>
      <p style={{margin:'0 0 12px', fontSize:12, color:t.textMuted, lineHeight:1.45}}>
        Paste a code block describing cells. Calcgrinder will create or update
        columns.
      </p>
      <div style={{
        minHeight: compact ? 170 : 160,
        padding:'10px 12px', borderRadius:6,
        background:t.surface2,
        border:`1px solid ${hasErrors ? t.dangerBorder : t.border}`,
        fontFamily:'"Geist Mono", monospace',
        fontSize: compact ? 11.5 : 12, lineHeight:1.55,
        color: t.textSubtle, whiteSpace:'pre-wrap', overflow:'hidden',
      }}>{importExample}</div>

      {hasErrors && (
        <div style={{marginTop:8, display:'flex', flexDirection:'column', gap:2}}>
          {errors.map((e,i) => <ImportErrorRow key={i} t={t} {...e}/>)}
        </div>
      )}

      <div style={{display:'flex', gap:8, marginTop:12, alignItems:'center'}}>
        <Btn variant="primary" size="sm" t={t}
          disabled={hasErrors}
          title={hasErrors ? 'Fix errors to preview' : undefined}
          style={{
            ...(compact ? {flex:1} : null),
            ...(hasErrors ? {opacity:0.45, cursor:'not-allowed'} : null),
          }}>
          Preview changes
        </Btn>
        <Btn variant="ghost" size="sm" t={t}>Cancel</Btn>
      </div>
      <p style={{margin:'10px 2px 0', fontSize:11, color:t.textSubtle, lineHeight:1.4}}>
        {hasErrors
          ? `Fix ${errors.length} error${errors.length===1?'':'s'} above to enable preview.`
          : "We'll show what will be added or changed before applying."}
      </p>
    </React.Fragment>
  );
};

// State 3 — diff preview. Header + scrollable list + footer, all in one column.
// `scrollTop` lets callers mock a mid-scroll position for the design canvas.
const ImportPreviewBody = ({ t, compact, listMaxHeight=220, scrollTop=0 }) => {
  const rows = [
    ...importPreviewDemo.new.map(r => ({ kind:'new',       ...r })),
    ...importPreviewDemo.replaced.map(r => ({ kind:'replaced',  ...r })),
    ...importPreviewDemo.unchanged.map(r => ({ kind:'unchanged', ...r })),
  ];
  const newN  = importPreviewDemo.new.length;
  const replN = importPreviewDemo.replaced.length;
  const unchN = importPreviewDemo.unchanged.length;

  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollTop;
  }, [scrollTop]);

  return (
    <div style={{display:'flex', flexDirection:'column', minHeight:0}}>
      {/* Header */}
      <div style={{flexShrink:0}}>
        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
          <Icons.Sparkle size={13} color={t.accent}/>
          <span style={{fontSize: compact ? 14 : 13, fontWeight:600, color:t.text,
            letterSpacing:-0.1}}>Preview changes</span>
        </div>
        <div style={{fontSize:11.5, color:t.textMuted, lineHeight:1.45, marginBottom:10}}>
          <span style={{color:t.text, fontWeight:500}}>{newN}</span> new
          <span style={{color:t.textSubtle, margin:'0 6px'}}>·</span>
          <span style={{color:t.text, fontWeight:500}}>{replN}</span> updated
          <span style={{color:t.textSubtle, margin:'0 6px'}}>·</span>
          <span style={{color:t.text, fontWeight:500}}>{unchN}</span> unchanged.
          {' '}Apply to commit.
        </div>
      </div>

      {/* Scrollable list — bleeds to the popover/sheet edges via negative margin */}
      <div ref={scrollRef} style={{
        margin:'0 -14px',
        maxHeight: listMaxHeight, overflowY:'auto',
        borderTop:`1px solid ${t.border}`,
        borderBottom:`1px solid ${t.border}`,
        background: t.surface,
      }}>
        {rows.map((row, i) => (
          <ImportPreviewRow key={row.id} t={t} {...row}/>
        ))}
      </div>

      {/* Footer */}
      <div style={{flexShrink:0, display:'flex', gap:8, alignItems:'center',
        marginTop:12, flexWrap: compact ? 'wrap' : 'nowrap'}}>
        <Btn variant="primary" size="sm" t={t} style={compact ? {flex:1} : null}>
          Apply changes
        </Btn>
        <Btn variant="ghost" size="sm" t={t}>Back to code</Btn>
        <Btn variant="ghost" size="sm" t={t}
          style={compact ? {marginLeft:'auto'} : null}>Cancel</Btn>
      </div>
    </div>
  );
};

// Step router — picks the right body for the given step.
//   'paste'   → ImportBody  (existing — unchanged behaviour)
//   'errors'  → ImportBody with inline errors + disabled primary
//   'preview' → ImportPreviewBody (diff list)
const ImportContent = ({ t, step='paste', compact, previewScrollTop=0, listMaxHeight }) => {
  if (step === 'preview') {
    return <ImportPreviewBody t={t} compact={compact}
      scrollTop={previewScrollTop}
      listMaxHeight={listMaxHeight}/>;
  }
  if (step === 'errors') {
    return <ImportBody t={t} compact={compact} errors={importErrorsDemo}/>;
  }
  return <ImportBody t={t} compact={compact}/>;
};

const ImportPopover = ({ t, step='paste', previewScrollTop=0 }) => (
  <div style={{
    position:'absolute', top:'calc(100% + 6px)', left:-8, width:420, zIndex:50,
    background:t.surface, border:`1px solid ${t.border}`, borderRadius:10,
    boxShadow:t.shadowLg, padding:'14px 14px 12px', color:t.text,
    display:'flex', flexDirection:'column',
    maxHeight: step === 'preview' ? 460 : undefined,
  }}>
    <ImportContent t={t} step={step}
      previewScrollTop={previewScrollTop}
      listMaxHeight={220}/>
  </div>
);

const ImportSheet = ({ t, step='paste', previewScrollTop=0 }) => (
  <React.Fragment>
    {/* subtle dim — sheet is swipe-dismissable, not blocking */}
    <div style={{
      position:'absolute', inset:0, background:'rgba(0,0,0,0.20)', zIndex:39,
    }}/>
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, zIndex:40,
      background:t.surface,
      borderTopLeftRadius:16, borderTopRightRadius:16,
      borderTop:`1px solid ${t.border}`,
      boxShadow:'0 -10px 28px rgba(0,0,0,0.20), 0 -2px 8px rgba(0,0,0,0.08)',
      padding:'10px 14px 22px', color:t.text,
      display:'flex', flexDirection:'column',
      maxHeight: step === 'preview' ? '78%' : undefined,
    }}>
      <div style={{
        width:36, height:4, borderRadius:2, background:t.borderStr,
        margin:'0 auto 14px', flexShrink:0,
      }}/>
      <ImportContent t={t} step={step} compact
        previewScrollTop={previewScrollTop}
        listMaxHeight={260}/>
    </div>
  </React.Fragment>
);

const GridPanel = ({ t, expandedCol, importOpen=false, importStep='paste', previewScrollTop=0, viewport='desktop', height = 220 }) => {
  // Compute total expanded contribution (only one allowed in mocks).
  const isAnyExpanded = !!expandedCol;
  const expandedHeight = 290; // settings panel height

  // Row labels column on the left (sticky)
  const rowLabel = (txt, sub) => (
    <div style={{
      padding:'0 10px', display:'flex', flexDirection:'column', justifyContent:'center',
      borderBottom:`1px solid ${t.border}`, background:t.surface2,
    }}>
      <div style={{fontSize:10.5, fontWeight:600, color:t.textMuted,
        textTransform:'uppercase', letterSpacing:0.5}}>{txt}</div>
      {sub && <div style={{fontSize:11, color:t.textSubtle, marginTop:2}}>{sub}</div>}
    </div>
  );

  return (
    <div style={{
      height, flexShrink:0, background:t.surface,
      borderBottom:`1px solid ${t.border}`, position:'relative',
      display:'flex', flexDirection:'column', overflow:'visible',
    }}>
      {/* Grid toolbar strip */}
      <div style={{
        height:34, display:'flex', alignItems:'center', padding:'0 16px', gap:10,
        borderBottom:`1px solid ${t.border}`, background:t.surface2,
        flexShrink:0, position:'relative',
      }}>
        <Icons.Hash size={12} color={t.textMuted}/>
        <span style={{fontSize:11.5, fontWeight:600, color:t.textMuted,
          textTransform:'uppercase', letterSpacing:0.5}}>Cells</span>
        <span style={{fontSize:11, color:t.textSubtle,
          fontFamily:'"Geist Mono", monospace', padding:'2px 7px', borderRadius:4,
          background:t.surface, border:`1px solid ${t.border}`}}>{cgCells.length}</span>

        {/* Import — anchor point for the popover */}
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
          {importOpen && viewport === 'desktop' && <ImportPopover t={t} step={importStep} previewScrollTop={previewScrollTop}/>}
        </div>

        <span style={{flex:1}}/>
        <Btn variant="ghost" size="sm" icon={Icons.Search} t={t}/>
        <Btn variant="secondary" size="sm" icon={Icons.Save} t={t}>Save</Btn>
      </div>

      {/* Scrollable grid */}
      <div style={{flex:1, overflow:'auto', position:'relative'}}>
        <div style={{
          display:'grid',
          gridTemplateColumns: `120px repeat(${cgCells.length}, ${COL_W}px) 56px`,
          gridTemplateRows: `${GRID_HEADER_H + (isAnyExpanded ? expandedHeight : 0)}px ${GRID_DATA_H}px`,
          minWidth:'min-content',
        }}>
          {/* Row label: header row */}
          <div style={{
            padding:'0 10px', display:'flex', flexDirection:'column', justifyContent:'flex-end',
            paddingBottom:8, borderBottom:`1px solid ${t.border}`, background:t.surface2,
            position:'sticky', left:0, zIndex:2, borderRight:`1px solid ${t.border}`,
          }}>
            <div style={{fontSize:10.5, fontWeight:600, color:t.textMuted,
              textTransform:'uppercase', letterSpacing:0.5}}>Cell</div>
          </div>

          {/* Header cells */}
          {cgCells.map(cell => {
            const expanded = cell.id === expandedCol;
            return (
              <div key={cell.id} style={{
                borderRight:`1px solid ${t.border}`, background:t.surface,
                display:'flex', flexDirection:'column',
              }}>
                <GridColumnHeader t={t} cell={cell} expanded={expanded}/>
                {/* Expansion fills remaining row 1 height */}
                {isAnyExpanded && (
                  expanded
                    ? <HeaderSettings t={t} cell={cell}/>
                    : <div style={{flex:1, background:t.bg, borderBottom:`1px solid ${t.border}`}}/>
                )}
              </div>
            );
          })}

          {/* + column at the end */}
          <div style={{
            borderRight:`1px solid ${t.border}`, background:t.surface2,
            display:'flex', alignItems:'flex-start', justifyContent:'center',
            paddingTop:14, gridRow: isAnyExpanded ? 'span 2' : 'span 1',
          }}>
            <button aria-label="Add column" style={{
              width:30, height:30, borderRadius:6, border:`1px dashed ${t.borderStr}`,
              background:t.surface, color:t.textMuted, cursor:'pointer',
              display:'inline-flex', alignItems:'center', justifyContent:'center',
            }}><Icons.Plus size={14}/></button>
          </div>

          {/* Row label: data row */}
          <div style={{
            padding:'0 10px', display:'flex', alignItems:'center',
            borderBottom:`1px solid ${t.border}`, background:t.surface2,
            position:'sticky', left:0, zIndex:2, borderRight:`1px solid ${t.border}`,
            fontSize:11.5, color:t.textMuted, fontWeight:500,
          }}>Value / Formula</div>

          {/* Data row cells */}
          {cgCells.map(cell => (
            <div key={cell.id} style={{borderRight:`1px solid ${t.border}`}}>
              <GridColumnData t={t} cell={cell}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { GridPanel, cgCells, cgCellById, Formula, ImportPopover, ImportSheet, HeaderSettings });

// ─────────────────────────────────────────────────────────────────────────────
// GridDrawerMobile — bottom-docked drawer.
// Vertical rows: cell id (mono) · value/formula (3-line clamp) · Pill + Kebab.
// Default drawer height ~30%; capped at 50% when a row's settings are expanded.
// ─────────────────────────────────────────────────────────────────────────────
const GridDrawerRow = ({ t, cell, editing, expanded }) => {
  const isFormula = String(cell.value).startsWith('=');
  const isOutput  = cell.type === 'Output';

  if (editing) {
    return (
      <div style={{
        display:'grid', gridTemplateColumns:'104px 1fr auto',
        gap:10, alignItems:'center', padding:'10px 14px',
        borderBottom:`1px solid ${t.border}`,
        background: t.accentSoft,
        outline:`1px solid ${t.accent}`, outlineOffset:-1,
      }}>
        <div style={{
          fontFamily:'"Geist Mono", monospace', fontSize:12, color:t.text,
          fontWeight:500, lineHeight:1.35,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{cell.id}</div>
        <div style={{
          minHeight:30, padding:'6px 9px', borderRadius:5,
          background:t.surface, border:`1px solid ${t.accent}`,
          fontFamily:'"Geist Mono", monospace', fontSize:12, lineHeight:1.45,
          color:t.text, fontWeight:500,
          display:'flex', alignItems:'center', gap:2,
          boxShadow:`0 0 0 3px ${t.accentSoft}`,
        }}>
          {isFormula
            ? <Formula formula={cell.value} t={t} size={12}/>
            : <span>{cell.value}</span>}
          <span style={{
            display:'inline-block', width:1.5, height:14, background:t.accent,
            marginLeft:2,
          }}/>
        </div>
        <Pill kind={isOutput?'output':'input'} t={t}>{cell.type}</Pill>
      </div>
    );
  }

  return (
    <React.Fragment>
      <div style={{
        display:'grid', gridTemplateColumns:'104px 1fr auto auto',
        gap:10, alignItems:'flex-start', padding:'10px 10px 10px 14px',
        borderBottom: expanded ? 'none' : `1px solid ${t.border}`,
        background: expanded ? t.surface2 : t.surface,
      }}>
        <div style={{
          fontFamily:'"Geist Mono", monospace', fontSize:12, color:t.text,
          fontWeight:500, lineHeight:1.5,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{cell.id}</div>
        <div style={{
          display:'-webkit-box', WebkitBoxOrient:'vertical', WebkitLineClamp:3,
          overflow:'hidden', textOverflow:'ellipsis',
          fontFamily:'"Geist Mono", monospace', fontSize:12, lineHeight:1.5,
          color: t.textMuted, minWidth:0,
        }}>
          {isFormula
            ? <Formula formula={cell.value} t={t} size={12} multiline/>
            : <span style={{color:t.text, fontWeight:500,
                wordBreak:'break-word', overflowWrap:'anywhere'}}>{cell.value}</span>}
        </div>
        <Pill kind={isOutput?'output':'input'} t={t} style={{marginTop:2}}>{cell.type}</Pill>
        <button aria-label="Cell settings" style={{
          width:22, height:22, borderRadius:4, border:'none', background:'transparent',
          color: expanded ? t.text : t.textMuted, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          marginTop:2,
        }}><Icons.Kebab size={12}/></button>
      </div>
      {expanded && (
        <div style={{borderBottom:`1px solid ${t.border}`,
          borderTop:`1px solid ${t.border}`, background:t.surface2}}>
          <HeaderSettings t={t} cell={cell}/>
        </div>
      )}
    </React.Fragment>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Drawer expanded card — shown alone when a row's Kebab is tapped.
// Sits flush at top of drawer content area (under the CELLS header strip).
// Drawer height is content-driven, capped externally at 70% of canvas.
// ─────────────────────────────────────────────────────────────────────────────
const GridDrawerExpandedCard = ({ t, cell, onClose }) => {
  const isOutput = cell.type === 'Output';
  return (
    <div style={{
      display:'flex', flexDirection:'column', minHeight:0,
      background: t.surface, height:'100%',
    }}>
      {/* Card header — name + Pill on left, close chevron on right */}
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        padding:'10px 10px 10px 14px', flexShrink:0,
        borderBottom:`1px solid ${t.border}`, background:t.surface,
      }}>
        <span style={{
          fontFamily:'"Geist Mono", monospace', fontSize:12, color:t.text,
          fontWeight:500, lineHeight:1.35,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          minWidth:0, maxWidth:'60%',
        }}>{cell.id}</span>
        <Pill kind={isOutput?'output':'input'} t={t}>{cell.type}</Pill>
        <span style={{flex:1}}/>
        <button aria-label="Close cell settings" onClick={onClose} style={{
          width:22, height:22, borderRadius:4, border:'none', background:'transparent',
          color:t.textMuted, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}><Icons.ChevD size={14}/></button>
      </div>
      {/* HeaderSettings (existing component) — scrolls internally if needed */}
      <div style={{flex:1, minHeight:0, overflow:'auto', background:t.surface2}}>
        <HeaderSettings t={t} cell={cell}/>
      </div>
    </div>
  );
};

const GridDrawerMobile = ({ t, editingRowId, expandedRowId, scrollOffset=0, drawerHeight }) => {
  const expandedCell = expandedRowId ? cgCellById(expandedRowId) : null;
  // Default ~30% when no expansion; when expanded, height is content-driven via
  // `drawerHeight` prop (caller passes the desired height, capped at 70% of
  // the canvas externally).
  const height = expandedCell
    ? (drawerHeight || '55%')
    : '30%';
  return (
    <div style={{
      flexShrink:0, background:t.surface,
      borderTop:`1px solid ${t.border}`,
      height,
      display:'flex', flexDirection:'column', overflow:'hidden',
    }}>
      <div style={{
        height:28, flexShrink:0,
        display:'flex', alignItems:'center', padding:'0 14px', gap:8,
        background:t.surface2, borderBottom:`1px solid ${t.border}`,
      }}>
        <Icons.Hash size={11} color={t.textMuted}/>
        <span style={{fontSize:10.5, fontWeight:600, color:t.textMuted,
          textTransform:'uppercase', letterSpacing:0.5}}>Cells</span>
        <span style={{fontSize:10.5, color:t.textSubtle,
          fontFamily:'"Geist Mono", monospace', padding:'1px 6px', borderRadius:4,
          background:t.surface, border:`1px solid ${t.border}`}}>{cgCells.length}</span>
      </div>
      {expandedCell ? (
        <GridDrawerExpandedCard t={t} cell={expandedCell}/>
      ) : (
        <div style={{flex:1, overflow:'auto', position:'relative'}}>
          <div style={{marginTop: -scrollOffset}}>
            {cgCells.map(cell => (
              <GridDrawerRow key={cell.id} t={t} cell={cell}
                editing={editingRowId === cell.id}
                expanded={false}/>
            ))}
            <button aria-label="Add cell" style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              width:'100%', padding:'12px 14px',
              background:'transparent', border:'none',
              borderBottom:`1px solid ${t.border}`,
              color:t.textMuted, cursor:'pointer', fontFamily:'inherit',
              fontSize:12, fontWeight:500, letterSpacing:-0.05,
            }}>
              <span style={{
                width:18, height:18, borderRadius:4,
                border:`1px dashed ${t.borderStr}`,
                display:'inline-flex', alignItems:'center', justifyContent:'center',
              }}><Icons.Plus size={10}/></span>
              Add cell
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

Object.assign(window, { GridDrawerMobile });

