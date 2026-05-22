// Calcgrinder — Account Dashboard
// Consumes chrome.jsx (loaded first) for tokens / icons / TopBar / Avatar / etc.
// All shell + control primitives come from window globals.

const { useState } = React;

// ─────────────────────────────────────────────────────────────────────────────
// Sample data
// ─────────────────────────────────────────────────────────────────────────────
const cgCalcs = [
  { id:'c1', title:'Mortgage Calculator',     desc:'30/15-year amortization with PMI, taxes, and extra-payment toggles.', edited:'2 hours ago',  state:'Published' },
  { id:'c2', title:'Retirement Planner',      desc:'Compounds contributions against expected returns and inflation; supports Roth + traditional brackets.', edited:'Yesterday',     state:'Published' },
  { id:'c3', title:'Restaurant Tip Splitter', desc:'Pre-tax base, configurable tip %, and uneven splits across the party.', edited:'3 days ago',  state:'Draft' },
  { id:'c4', title:'Compound Interest',       desc:'Quick principal + rate + term lookup with a monthly contributions slider.', edited:'last week',  state:'Published' },
  { id:'c5', title:'Take-home Pay (UK)',      desc:'PAYE income tax, NI bands, student loan plans 1/2/4/5 + postgrad.', edited:'2 weeks ago',  state:'Draft' },
  { id:'c6', title:'Solar ROI',               desc:'Panel array sizing against household kWh draw and local feed-in rates.', edited:'3 weeks ago', state:'Published' },
];

const cgTemplates = [
  { id:'t1', title:'Loan Repayment', desc:'Generic loan repayment calculator. Principal, rate, term — outputs monthly cost and total interest.' },
  { id:'t2', title:'Unit Converter', desc:'Tabbed converter scaffold: length, mass, temperature, volume. Add tabs as needed.' },
  { id:'t3', title:'Break-even',     desc:'Fixed + variable cost model with a price/quantity break-even chart.' },
  { id:'t4', title:'BMI + Body fat', desc:'Two-input health calculator with metric/imperial toggle.' },
];

// Sysadmin view — calculators owned by other users, surfaced in the
// fourth dashboard section. Each entry has an `owner` username + the
// usual title/desc/edited/state shape. Volume is intentionally large to
// also exercise the section's max-height + internal scroll.
const cgUserCalcs = [
  { id:'u1',  title:'Crypto Tax Estimator',   owner:'mholloway',     desc:'UK CGT bands applied to FIFO disposals across multiple wallets.',    edited:'12 min ago',  state:'Published' },
  { id:'u2',  title:'Macros for Cutting',     owner:'tess.fitz',     desc:'TDEE-driven protein/carb/fat split with a deficit slider.',          edited:'1 hour ago',  state:'Published' },
  { id:'u3',  title:'Pet Insurance Compare',  owner:'rajiv.k',       desc:'Yearly premium versus typical claim ceilings across five providers.',edited:'3 hours ago', state:'Draft' },
  { id:'u4',  title:'Studio Lease Calculator',owner:'okafor.m',      desc:'£/sqft + service charge + business rates rolled into a monthly figure.',edited:'Yesterday',state:'Published' },
  { id:'u5',  title:'Recipe Scaler',          owner:'noor.q',        desc:'Servings up/down with metric/imperial conversions per ingredient.',  edited:'2 days ago',  state:'Draft' },
  { id:'u6',  title:'EV Charging Cost',       owner:'pcarrington',   desc:'Home tariff vs. public rapid charging on a per-mile basis.',         edited:'2 days ago',  state:'Published' },
  { id:'u7',  title:'Heat-pump Sizing',       owner:'isla.j',        desc:'Heat loss × room volume — outputs recommended kW capacity.',         edited:'4 days ago',  state:'Published' },
  { id:'u8',  title:'Bike Gear Ratios',       owner:'dom.atkin',     desc:'Cadence + chainring/cog combinations charted against road speed.',   edited:'last week',   state:'Draft' },
  { id:'u9',  title:'VAT Reverse Lookup',     owner:'tess.fitz',     desc:'Find pre-tax price from a gross figure across UK/EU rates.',         edited:'last week',   state:'Published' },
  { id:'u10', title:'Print Estimator',        owner:'mholloway',     desc:'Sheet-fed cost-per-piece with cover stock + finishing options.',     edited:'2 weeks ago', state:'Published' },
  { id:'u11', title:'Pension Bridge',         owner:'rajiv.k',       desc:'Fills the income gap between early retirement and state pension age.',edited:'3 weeks ago',state:'Draft' },
  { id:'u12', title:'Roast Coffee Yield',     owner:'cafe.margin',   desc:'Green weight → roasted weight loss curve and cup yield.',            edited:'last month',  state:'Published' },
];

const cgScenarios = [
  { calc:'Mortgage Calculator', items:[
    { name:'House #1 — Brixton flat', saved:'2 days ago' },
    { name:'House #2 — Hove terrace', saved:'2 days ago' },
    { name:'Stretch budget · 5.2% APR', saved:'1 week ago' },
  ]},
  { calc:'Retirement Planner', items:[
    { name:'Retire at 60', saved:'4 days ago' },
    { name:'Retire at 65 · aggressive', saved:'2 weeks ago' },
  ]},
  { calc:'Solar ROI', items:[
    { name:'12 panel south-facing', saved:'last month' },
  ]},
];

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────
const Hero = ({ t, mobile }) => (
  <div style={{
    display:'flex', gap:12, alignItems:'stretch',
    flexDirection: mobile ? 'column' : 'row',
  }}>
    <button style={{
      flex: mobile ? '0 0 auto' : '1 1 60%',
      display:'flex', alignItems:'center', gap:14, textAlign:'left',
      padding:'18px 20px', borderRadius:10,
      background:t.accent, color:t.accentFg,
      border:`1px solid ${t.accent}`, cursor:'pointer', fontFamily:'inherit',
      boxShadow:`0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 16px ${t.accent}33`,
    }}>
      <div style={{
        width:38, height:38, borderRadius:8,
        background:'rgba(255,255,255,0.16)',
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}>
        <Icons.Plus size={20} stroke={2}/>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:15, fontWeight:600, lineHeight:1.25, letterSpacing:-0.2}}>Build a new calculator</div>
        <div style={{fontSize:12.5, opacity:0.85, marginTop:2, fontWeight:400}}>Start from a blank slate</div>
      </div>
      <Icons.ArrowR size={16}/>
    </button>

    {!mobile && (
      <button style={{
        flex:'1 1 40%', display:'flex', alignItems:'center', gap:14, textAlign:'left',
        padding:'18px 20px', borderRadius:10, background:t.surface,
        border:`1px solid ${t.border}`, cursor:'pointer', fontFamily:'inherit',
        color:t.text,
      }}>
        <div style={{
          width:38, height:38, borderRadius:8, background:t.surface2,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          color:t.textMuted, border:`1px solid ${t.border}`,
        }}>
          <Icons.LayoutGrid size={18}/>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:14, fontWeight:600, lineHeight:1.25, letterSpacing:-0.15, color:t.text}}>Start from a template</div>
          <div style={{fontSize:12.5, color:t.textMuted, marginTop:2}}>12 curated by sysadmin</div>
        </div>
      </button>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible section
// ─────────────────────────────────────────────────────────────────────────────
// `tint` paints the entire section card with a coloured wash instead of
// the default surface white. Used by the sysadmin User Calculators block
// to differentiate without resorting to a left border or a section pill.
// The actual cards inside continue to sit on `t.surface` so they read
// against the wash.
const Section = ({ t, title, count, hint, expanded, children, defaultExpanded, tint, scrollContent }) => {
  const [open, setOpen] = useState(expanded ?? defaultExpanded ?? false);
  const isOpen = expanded !== undefined ? expanded : open;
  const tints = {
    danger: { bg: t.dangerSoft, border: t.dangerBorder },
  };
  const wash = tint ? tints[tint] : null;
  return (
    <section style={{
      background: wash ? wash.bg : t.surface,
      border:`1px solid ${wash ? wash.border : t.border}`,
      borderRadius:10, overflow:'hidden',
    }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:'100%', height:52, display:'flex', alignItems:'center',
        padding:'0 16px 0 14px', gap:10, background:'transparent',
        border:'none', cursor:'pointer', fontFamily:'inherit', color:t.text, textAlign:'left',
      }}>
        <span style={{
          width:20, height:20, display:'inline-flex', alignItems:'center', justifyContent:'center',
          color:t.textMuted, transition:'transform .15s',
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
        }}>
          <Icons.ChevD size={16}/>
        </span>
        <span style={{fontSize:14.5, fontWeight:600, letterSpacing:-0.15}}>{title}</span>
        <span style={{
          fontSize:11.5, fontWeight:500, color:t.textMuted,
          padding:'2px 7px', background:t.surface2, borderRadius:999,
          border:`1px solid ${t.border}`, fontFamily:'"Geist Mono", monospace', letterSpacing:0,
        }}>{count}</span>
        {hint && !isOpen && (
          <span style={{fontSize:12, color:t.textSubtle, fontWeight:400, marginLeft:4}}>· {hint}</span>
        )}
        <span style={{flex:1}}/>
      </button>
      {isOpen && (
        // Max-height threshold = 2 card rows (128 + 12 + 128 = 268) + section
        // content padding (18 top + 18 bottom = 36) ≈ 304. Sections under that
        // height grow naturally; once content exceeds 304 the inner div
        // becomes a scroll container so the section never grows arbitrarily.
        <div style={{
          padding:'18px 16px 18px',
          borderTop:`1px solid ${wash ? wash.border : t.border}`,
          maxHeight: scrollContent ?? 304,
          overflowY:'auto',
        }}>{children}</div>
      )}
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Calculator + Template cards
// ─────────────────────────────────────────────────────────────────────────────
// `showOwner` swaps the footer's `Edited X` label for `by <user> · Edited X`.
// `kebabOpen` renders the popover (Open / Delete) over the card; the calling
// surface decides which card to anchor it to.
const CalcCard = ({ t, calc, showOwner = false, kebabOpen = false }) => (
  <div style={{
    position:'relative', background:t.surface, border:`1px solid ${t.border}`,
    borderRadius:8, padding:'14px 14px 12px', display:'flex', flexDirection:'column',
    gap:10, minHeight:128, cursor:'pointer', boxShadow:t.shadow,
  }}>
    <div style={{display:'flex', alignItems:'flex-start', gap:8}}>
      <div style={{
        width:30, height:30, borderRadius:6, background:t.surface2,
        border:`1px solid ${t.border}`, color:t.textMuted,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}>
        <Icons.Calc size={15}/>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{
          fontSize:13.5, fontWeight:600, color:t.text, letterSpacing:-0.15,
          lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{calc.title}</div>
      </div>
      <div style={{position:'relative'}}>
        <IconBtn icon={Icons.Kebab} t={t} ariaLabel="More"
          active={kebabOpen}
          style={{margin:'-4px -6px -4px 0'}}/>
        {kebabOpen && <CardKebabPopover t={t} owned={showOwner}/>}
      </div>
    </div>
    <p style={{
      margin:0, fontSize:12.5, lineHeight:1.45, color:t.textMuted,
      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
    }}>{calc.desc}</p>
    <div style={{flex:1}}/>
    <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
      <span style={{
        fontSize:11.5, color:t.textSubtle, fontWeight:400,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0,
      }}>
        {showOwner ? (
          <React.Fragment>
            by <span style={{
              color:t.textMuted, fontWeight:500,
              fontFamily:'"Geist Mono", monospace', fontSize:11,
            }}>{calc.owner}</span>
            <span style={{padding:'0 5px'}}>·</span>
            Edited {calc.edited}
          </React.Fragment>
        ) : <React.Fragment>Edited {calc.edited}</React.Fragment>}
      </span>
      <span style={{flex:1}}/>
      <Pill kind={calc.state==='Published' ? 'published' : 'draft'} t={t}>{calc.state}</Pill>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// CardKebabPopover — small popover anchored to the card's kebab button.
// Two rows: Open (navigates to editor) and Delete (opens destructive sheet).
// Delete row is danger-coloured; the rest matches the avatar popover idiom.
// ─────────────────────────────────────────────────────────────────────────────
const CardKebabPopover = ({ t, owned = false }) => {
  const row = (icon, label, danger = false) => {
    const I = icon;
    return (
      <div style={{
        display:'flex', alignItems:'center', gap:10, padding:'0 10px',
        height:32, borderRadius:6, fontSize:13, fontWeight:500,
        color: danger ? t.dangerText : t.text, cursor:'pointer',
        userSelect:'none', letterSpacing:-0.05,
      }}>
        <I size={13}/><span style={{flex:1}}>{label}</span>
      </div>
    );
  };
  return (
    <div style={{
      position:'absolute', right:-4, top:'calc(100% + 4px)', width:148,
      background:t.surface, border:`1px solid ${t.border}`, borderRadius:8,
      boxShadow:t.shadowLg, padding:4, zIndex:25,
    }}>
      {row(Icons.External, 'Open')}
      <div style={{height:1, background:t.border, margin:'4px 2px'}}/>
      {row(Icons.Trash, 'Delete', true)}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DeleteCalcSheet — sysadmin destructive confirm. Reuses the bottom-sheet
// pattern from settings.jsx (DeleteAccountSheet): dim overlay rgba(0,0,0,0.20),
// 16px top corners, drag handle, shadowLg, primary destructive + ghost Cancel.
// Body explicitly names the owner so a sysadmin can't misclick across two
// users with similarly-titled calculators.
// ─────────────────────────────────────────────────────────────────────────────
const DeleteCalcSheet = ({ t, viewport = 'desktop', calc }) => {
  const isMobile = viewport === 'mobile';
  return (
    <div style={{
      position:'absolute', inset:0, zIndex:50,
      display:'flex', flexDirection:'column', justifyContent:'flex-end',
      background:'rgba(0,0,0,0.20)',
    }}>
      <div style={{
        width:'100%', maxWidth: isMobile ? '100%' : 520,
        margin: isMobile ? 0 : '0 auto', background:t.surface,
        borderTopLeftRadius:16, borderTopRightRadius:16,
        borderTop:`1px solid ${t.border}`, boxShadow:t.shadowLg,
        padding:'12px 24px 24px',
      }}>
        <div style={{
          width:36, height:4, borderRadius:2, background:t.borderStr,
          margin:'0 auto 16px',
        }}/>
        <div style={{display:'flex', gap:14, alignItems:'flex-start'}}>
          <div style={{
            width:40, height:40, borderRadius:8,
            background:t.dangerSoft, color:t.danger,
            border:`1px solid ${t.dangerBorder}`,
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            flexShrink:0,
          }}>
            <Icons.Trash size={18}/>
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{
              fontSize:16, fontWeight:600, color:t.text,
              letterSpacing:-0.2, lineHeight:1.3,
            }}>Delete «{calc.title}»?</div>
            <p style={{
              margin:'6px 0 0', fontSize:13.5, color:t.textMuted, lineHeight:1.55,
            }}>
              Owned by{' '}
              <span style={{
                color:t.text, fontWeight:500,
                fontFamily:'"Geist Mono", monospace', fontSize:12.5,
              }}>{calc.owner}</span>.
              This calculator will be soft-deleted and can still be
              recovered by the owner within 30 days.
            </p>
          </div>
        </div>
        <div style={{
          display:'flex', gap:8, marginTop:20,
          justifyContent: isMobile ? 'stretch' : 'flex-end',
          flexDirection: isMobile ? 'column-reverse' : 'row',
        }}>
          <Btn variant="ghost" size="md" t={t}
            style={{height:40, justifyContent:'center',
                    flex: isMobile ? '1 1 auto' : '0 0 auto'}}>
            Cancel
          </Btn>
          <button style={{
            height:40, padding:'0 16px', borderRadius:6,
            background:t.danger, color:t.dangerFg,
            border:`1px solid ${t.danger}`,
            fontFamily:'inherit', fontSize:13.5, fontWeight:600, letterSpacing:-0.05,
            cursor:'pointer',
            display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
            flex: isMobile ? '1 1 auto' : '0 0 auto',
          }}>
            <Icons.Trash size={14}/>
            Delete calculator
          </button>
        </div>
      </div>
    </div>
  );
};

const TemplateCard = ({ t, tpl }) => (
  <div style={{
    position:'relative', background:t.surface2, border:`1px dashed ${t.borderStr}`,
    borderRadius:8, padding:'14px 14px 12px', display:'flex', flexDirection:'column',
    gap:10, minHeight:128,
  }}>
    <div style={{display:'flex', alignItems:'center', gap:8}}>
      <div style={{
        width:30, height:30, borderRadius:6, background:t.surface,
        border:`1px solid ${t.border}`, color:t.textMuted,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}>
        <Icons.LayoutGrid size={14}/>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{
          fontSize:13.5, fontWeight:600, color:t.text, letterSpacing:-0.15, lineHeight:1.3,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{tpl.title}</div>
      </div>
      <span style={{
        fontSize:10, fontWeight:600, color:t.textMuted,
        padding:'2px 6px', background:t.surface, border:`1px solid ${t.border}`,
        borderRadius:4, letterSpacing:0.4, textTransform:'uppercase',
      }}>Template</span>
    </div>
    <p style={{
      margin:0, fontSize:12.5, lineHeight:1.45, color:t.textMuted,
      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
    }}>{tpl.desc}</p>
    <div style={{flex:1}}/>
    <Btn variant="secondary" size="sm" icon={Icons.Copy} t={t} style={{alignSelf:'flex-start'}}>Clone</Btn>
  </div>
);

// EmptyMyCalcs has moved to states.jsx as <EmptyOrErrorState variant='empty'>.
// This shim preserves the call-site below and supplies the dashboard-specific copy.
const EmptyMyCalcs = ({ t }) => (
  <EmptyOrErrorState
    variant="empty"
    icon={Icons.Calc}
    title="No calculators yet"
    body="Build your first calculator to see it here."
    primaryAction={{ label: 'Build a new calculator', icon: Icons.Plus }}
    t={t}
  />
);

const Scenarios = ({ t }) => (
  <div style={{display:'flex', flexDirection:'column', gap:18}}>
    {cgScenarios.map(group => (
      <div key={group.calc}>
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          fontSize:11.5, fontWeight:600, color:t.textMuted,
          textTransform:'uppercase', letterSpacing:0.6, padding:'0 4px 8px',
        }}>
          <Icons.Calc size={12}/>
          <span>{group.calc}</span>
          <span style={{flex:1, height:1, background:t.border, marginLeft:4}}/>
        </div>
        <div style={{display:'flex', flexDirection:'column'}}>
          {group.items.map((s,i) => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 10px 10px 6px', borderRadius:6,
              borderTop: i===0 ? 'none' : `1px solid ${t.border}`,
            }}>
              <div style={{width:6, height:6, borderRadius:'50%', background:t.borderStr,
                marginLeft:4, marginRight:2, flexShrink:0,}}/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:13, fontWeight:500, color:t.text, letterSpacing:-0.1}}>{s.name}</div>
                <div style={{fontSize:11.5, color:t.textSubtle, marginTop:2}}>Saved {s.saved}</div>
              </div>
              <button style={{
                height:26, padding:'0 10px', borderRadius:5, fontSize:12, fontWeight:500,
                background:'transparent', border:`1px solid ${t.border}`, color:t.text,
                cursor:'pointer', fontFamily:'inherit',
                display:'inline-flex', alignItems:'center', gap:5,
              }}>Open <Icons.ArrowR size={11}/></button>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────
const Dashboard = ({
  theme = 'light',
  viewport = 'desktop',
  popoverOpen = false,
  empty = false,
  sections = { calcs:true, templates:false, scenarios:false, userCalcs:false },
  isSysadmin = false,
  // Extra calculators are appended to `cgCalcs` to demonstrate the
  // section's max-height + internal scroll. The base set fits in two rows
  // without scrolling, so we pad with sample entries that would.
  manyCalcs = false,
  // When set, renders the destructive confirm sheet over the dashboard.
  // Caller passes the calc whose Delete action was tapped.
  deleteSheetTarget = null,
  // For showing one user-calc card with its kebab popover open.
  kebabOpenUserCalcId = null,
}) => {
  const t = cgTokens[theme];
  const mobile = viewport === 'mobile';

  const myCalcs = manyCalcs
    ? [...cgCalcs, ...cgUserCalcs.slice(0, 6).map(c => ({...c, id:'m-'+c.id, state:c.state}))]
    : cgCalcs;

  return (
    <div style={{
      background:t.bg, color:t.text, width:'100%', height:'100%',
      fontFamily:'"Geist", -apple-system, system-ui, sans-serif',
      fontSize:14, letterSpacing:-0.05, display:'flex', flexDirection:'column',
      overflow:'hidden', WebkitFontSmoothing:'antialiased',
      position:'relative',
    }}>
      {mobile
        ? <TopBarMobile t={t}/>
        : <TopBarDesktop t={t} popoverOpen={popoverOpen}/>
      }

      <main style={{flex:1, overflow:'auto', padding: mobile ? '20px 16px 32px' : '32px 32px 48px'}}>
        <div style={{
          maxWidth: mobile ? 'none' : 960, margin:'0 auto',
          display:'flex', flexDirection:'column', gap: mobile ? 18 : 28,
        }}>
          {!mobile && (
            <div>
              <div style={{
                fontSize:11.5, fontWeight:500, color:t.textSubtle,
                letterSpacing:0.6, textTransform:'uppercase', marginBottom:6,
              }}>Account</div>
              <h1 style={{
                margin:0, fontSize:24, fontWeight:600, letterSpacing:-0.6,
                color:t.text, lineHeight:1.15,
                display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
              }}>
                <span>Welcome back, Ada</span>
                {isSysadmin && <SysadminPill t={t} style={{transform:'translateY(-1px)'}}/>}
              </h1>
            </div>
          )}

          <Hero t={t} mobile={mobile}/>

          <div style={{display:'flex', flexDirection:'column', gap:10, marginTop: mobile ? 4 : 8}}>
            <Section t={t} title="My Calculators" count={empty ? 0 : myCalcs.length} expanded={sections.calcs}>
              {empty ? <EmptyMyCalcs t={t}/> : (
                <div style={{
                  display:'grid',
                  gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 12,
                }}>
                  {myCalcs.map(c => <CalcCard key={c.id} t={t} calc={c}/>)}
                </div>
              )}
            </Section>

            <Section t={t} title="Templates" count={cgTemplates.length} hint="Curated by sysadmin" expanded={sections.templates}>
              <div style={{
                display:'grid',
                gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 12,
              }}>
                {cgTemplates.map(c => <TemplateCard key={c.id} t={t} tpl={c}/>)}
              </div>
            </Section>

            <Section t={t} title="My Scenarios"
              count={cgScenarios.reduce((n,g)=>n+g.items.length,0)}
              expanded={sections.scenarios}>
              <Scenarios t={t}/>
            </Section>

            {isSysadmin && (
              // Fourth section, sysadmin-only. Same shape as the others —
              // only the red wash and the per-card owner footer differ. Default
              // collapsed; expanded state honours the `sections.userCalcs` flag.
              <Section t={t} title="User Calculators"
                count={cgUserCalcs.length}
                hint="All users — sysadmin view"
                expanded={sections.userCalcs}
                tint="danger">
                <div style={{
                  display:'grid',
                  gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 12,
                }}>
                  {cgUserCalcs.map(c => (
                    <CalcCard
                      key={c.id} t={t} calc={c}
                      showOwner
                      kebabOpen={kebabOpenUserCalcId === c.id}
                    />
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      </main>

      {deleteSheetTarget && (
        <DeleteCalcSheet t={t} viewport={viewport} calc={deleteSheetTarget}/>
      )}
    </div>
  );
};

Object.assign(window, { Dashboard, DeleteCalcSheet, cgUserCalcs });
