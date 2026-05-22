// Calcgrinder — Visitor view, 3-column layout
// Inputs | Results | Chart. All inside the Editorial Cream theme.
// Pixel-distinct from the editor's 2-column visitor view — same theme + tokens,
// different rhythm: side-by-side rather than sectioned.

// ─────────────────────────────────────────────────────────────────────────────
// Small card primitives, tuned for the 3-column rhythm (tighter than the
// 2-column visitor view).
// ─────────────────────────────────────────────────────────────────────────────
const V3Card = ({ v, children, style }) => (
  <div style={{
    background: v.card, border:`1px solid ${v.border}`, borderRadius:10,
    boxShadow:'0 1px 2px rgba(0,0,0,0.03)',
    display:'flex', flexDirection:'column', overflow:'hidden',
    ...style,
  }}>{children}</div>
);

const V3ColHead = ({ v, label, sub }) => (
  <div style={{
    padding:'14px 20px 14px', borderBottom:`1px solid ${v.rule}`,
    display:'flex', alignItems:'baseline', gap:10,
  }}>
    <span style={{
      fontSize:11, fontWeight:600, color:v.muted,
      letterSpacing:0.7, textTransform:'uppercase',
    }}>{label}</span>
    {sub && (
      <span style={{fontSize:12, color:v.subtle, fontWeight:400, letterSpacing:-0.05}}>
        {sub}
      </span>
    )}
  </div>
);

const V3Row = ({ children, last }) => (
  <div style={{
    padding:'16px 20px 16px',
    borderBottom: last ? 'none' : null, // handled by Card divider system
  }}>{children}</div>
);

const V3Label = ({ v, children, hint }) => (
  <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:8}}>
    <span style={{
      fontSize:11, fontWeight:600, color:v.muted,
      letterSpacing:0.6, textTransform:'uppercase',
    }}>{children}</span>
    {hint && <span style={{fontSize:11.5, color:v.subtle}}>{hint}</span>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Input controls — compact, suitable for 3-column widths.
// ─────────────────────────────────────────────────────────────────────────────
const V3CurrencyInput = ({ v, value, label, hint }) => (
  <React.Fragment>
    <V3Label v={v} hint={hint}>{label}</V3Label>
    <div style={{
      display:'flex', alignItems:'center', gap:0,
      height:42, padding:'0 12px 0 12px',
      background: v.cardAlt, border:`1px solid ${v.border}`, borderRadius:7,
    }}>
      <span style={{fontFamily:'"Geist Mono",monospace', fontSize:15, color:v.muted, marginRight:6}}>$</span>
      <span style={{
        flex:1, fontFamily:'"Geist Mono",monospace', fontSize:18, fontWeight:600,
        color:v.ink, letterSpacing:-0.3, fontVariantNumeric:'tabular-nums',
      }}>{value}</span>
    </div>
  </React.Fragment>
);

const V3PercentSlider = ({ v, pct=20, label, hint, range=[0,50] }) => (
  <React.Fragment>
    <V3Label v={v} hint={hint}>{label}</V3Label>
    <div style={{display:'flex', alignItems:'baseline', gap:6, marginBottom:10}}>
      <span style={{
        fontFamily:'"Geist Mono",monospace', fontSize:26, fontWeight:600,
        color:v.ink, letterSpacing:-0.8, fontVariantNumeric:'tabular-nums', lineHeight:1,
      }}>{pct}</span>
      <span style={{fontSize:15, color:v.muted, fontWeight:500}}>%</span>
    </div>
    <div style={{
      position:'relative', height:6, background:v.cardAlt, borderRadius:3,
      border:`1px solid ${v.border}`,
    }}>
      <div style={{
        position:'absolute', top:-1, left:0, height:6,
        width:`${(pct - range[0]) / (range[1] - range[0]) * 100}%`,
        borderRadius:3, background:v.ink,
      }}/>
      <div style={{
        position:'absolute', top:-5,
        left:`calc(${(pct - range[0]) / (range[1] - range[0]) * 100}% - 7px)`,
        width:14, height:14, borderRadius:'50%',
        background:v.card, border:`2px solid ${v.ink}`,
        boxShadow:'0 1px 2px rgba(0,0,0,0.1)',
      }}/>
    </div>
    <div style={{
      display:'flex', justifyContent:'space-between', marginTop:6,
      fontSize:10.5, color:v.subtle, fontFamily:'"Geist Mono",monospace',
    }}>
      <span>{range[0]}%</span><span>{range[1]}%</span>
    </div>
  </React.Fragment>
);

const V3NumberField = ({ v, value, suffix, label, hint }) => (
  <React.Fragment>
    <V3Label v={v} hint={hint}>{label}</V3Label>
    <div style={{
      display:'flex', alignItems:'center',
      height:42, padding:'0 12px',
      background: v.cardAlt, border:`1px solid ${v.border}`, borderRadius:7,
    }}>
      <span style={{
        flex:1, fontFamily:'"Geist Mono",monospace', fontSize:18, fontWeight:600,
        color:v.ink, letterSpacing:-0.3, fontVariantNumeric:'tabular-nums',
      }}>{value}</span>
      {suffix && (
        <span style={{fontFamily:'"Geist Mono",monospace', fontSize:14, color:v.muted}}>
          {suffix}
        </span>
      )}
    </div>
  </React.Fragment>
);

const V3PercentField = ({ v, value, label, hint }) => (
  <React.Fragment>
    <V3Label v={v} hint={hint}>{label}</V3Label>
    <div style={{
      display:'flex', alignItems:'center',
      height:42, padding:'0 12px',
      background: v.cardAlt, border:`1px solid ${v.border}`, borderRadius:7,
    }}>
      <span style={{
        flex:1, fontFamily:'"Geist Mono",monospace', fontSize:18, fontWeight:600,
        color:v.ink, letterSpacing:-0.3, fontVariantNumeric:'tabular-nums',
      }}>{value}</span>
      <span style={{fontFamily:'"Geist Mono",monospace', fontSize:14, color:v.muted}}>%</span>
    </div>
  </React.Fragment>
);

// ─────────────────────────────────────────────────────────────────────────────
// Result rows — readonly display
// ─────────────────────────────────────────────────────────────────────────────
const V3HeroResult = ({ v, label, value, suffix, note }) => (
  <div>
    <V3Label v={v}>{label}</V3Label>
    <div style={{display:'flex', alignItems:'baseline', gap:4, marginTop:-2}}>
      <span style={{
        fontFamily:'"Geist Mono",monospace', fontSize:46, fontWeight:600,
        color:v.ink, letterSpacing:-1.4, lineHeight:1.0,
        fontVariantNumeric:'tabular-nums',
      }}>{value}</span>
      {suffix && (
        <span style={{fontSize:18, color:v.muted, fontWeight:500, marginLeft:2}}>{suffix}</span>
      )}
    </div>
    {note && (
      <div style={{
        marginTop:14, paddingTop:12, borderTop:`1px solid ${v.rule}`,
        fontSize:12, color:v.muted, lineHeight:1.5,
      }}>{note}</div>
    )}
  </div>
);

const V3Result = ({ v, label, value }) => (
  <div>
    <V3Label v={v}>{label}</V3Label>
    <div style={{
      fontFamily:'"Geist Mono",monospace', fontSize:24, fontWeight:600,
      color:v.ink, letterSpacing:-0.5, lineHeight:1,
      fontVariantNumeric:'tabular-nums', marginTop:-2,
    }}>{value}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Chart for the 3-col layout — taller, narrower aspect than the 2-col version.
// ─────────────────────────────────────────────────────────────────────────────
const V3Chart = ({ v }) => {
  const data = [
    { y: 0,  interest: 2160, principal: 493 },
    { y: 5,  interest: 1950, principal: 703 },
    { y: 10, interest: 1670, principal: 983 },
    { y: 15, interest: 1290, principal: 1363 },
    { y: 20, interest: 815,  principal: 1838 },
    { y: 25, interest: 190,  principal: 2463 },
    { y: 30, interest: 10,   principal: 2643 },
  ];
  const W = 480, H = 380, pad = { l:48, r:18, t:14, b:28 };
  const xs = (y) => pad.l + (y/30) * (W - pad.l - pad.r);
  const yMax = 2800;
  const ys = (val) => H - pad.b - (val/yMax) * (H - pad.t - pad.b);
  const pathFor = (k) => data.map((d,i) => `${i===0?'M':'L'} ${xs(d.y)} ${ys(d[k])}`).join(' ');
  const areaFor = (k) => `${pathFor(k)} L ${xs(30)} ${H-pad.b} L ${xs(0)} ${H-pad.b} Z`;

  return (
    <div style={{padding:'18px 20px 20px'}}>
      <div style={{display:'flex', alignItems:'baseline', gap:10, marginBottom:14}}>
        <h3 style={{margin:0, fontSize:14.5, fontWeight:600, color:v.ink, letterSpacing:-0.2}}>
          How each payment splits
        </h3>
        <span style={{flex:1}}/>
        <span style={{display:'inline-flex', gap:10, fontSize:11, color:v.muted}}>
          <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
            <span style={{width:9, height:2, background:v.chartA}}/>Interest
          </span>
          <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
            <span style={{width:9, height:2, background:v.chartB}}/>Principal
          </span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', height:'auto', display:'block'}}>
        {[0, 700, 1400, 2100, 2800].map(g => (
          <g key={g}>
            <line x1={pad.l} x2={W-pad.r} y1={ys(g)} y2={ys(g)} stroke={v.chartGrid} strokeWidth={1}/>
            <text x={pad.l-7} y={ys(g)+4} fontSize={10} textAnchor="end" fill={v.subtle}
              fontFamily='"Geist Mono",monospace'>
              {g===0?'$0':`$${(g/1000).toFixed(1)}k`}
            </text>
          </g>
        ))}
        {[0,10,20,30].map(y => (
          <text key={y} x={xs(y)} y={H-pad.b+15} fontSize={10} textAnchor="middle"
            fill={v.subtle} fontFamily='"Geist Mono",monospace'>Yr {y}</text>
        ))}
        <path d={areaFor('interest')}  fill={v.chartA} fillOpacity={0.06}/>
        <path d={areaFor('principal')} fill={v.chartB} fillOpacity={0.10}/>
        <path d={pathFor('interest')}  stroke={v.chartA} strokeWidth={2} fill="none"/>
        <path d={pathFor('principal')} stroke={v.chartB} strokeWidth={2} fill="none"/>
        {data.map((d,i) => (
          <g key={i}>
            <circle cx={xs(d.y)} cy={ys(d.interest)}  r={2.5} fill={v.card} stroke={v.chartA} strokeWidth={1.5}/>
            <circle cx={xs(d.y)} cy={ys(d.principal)} r={2.5} fill={v.card} stroke={v.chartB} strokeWidth={1.5}/>
          </g>
        ))}
        <line x1={xs(18.5)} x2={xs(18.5)} y1={pad.t} y2={H-pad.b}
          stroke={v.borderStr} strokeWidth={1} strokeDasharray="3 3"/>
        <text x={xs(18.5)+5} y={pad.t+11} fontSize={10} fill={v.muted} fontFamily="inherit">crossover · yr 19</text>
      </svg>

      <div style={{
        marginTop:16, paddingTop:14, borderTop:`1px solid ${v.rule}`,
        display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 16px',
      }}>
        <div>
          <div style={{fontSize:10.5, fontWeight:600, color:v.muted,
            letterSpacing:0.6, textTransform:'uppercase'}}>First payment</div>
          <div style={{fontSize:14, fontWeight:600, color:v.ink, marginTop:4,
            fontFamily:'"Geist Mono",monospace', fontVariantNumeric:'tabular-nums'}}>
            $2,160 <span style={{color:v.muted, fontWeight:500}}>interest</span>
          </div>
          <div style={{fontSize:13, color:v.muted, marginTop:2,
            fontFamily:'"Geist Mono",monospace', fontVariantNumeric:'tabular-nums'}}>
            $&nbsp;&nbsp;&nbsp;493 <span>principal</span>
          </div>
        </div>
        <div>
          <div style={{fontSize:10.5, fontWeight:600, color:v.muted,
            letterSpacing:0.6, textTransform:'uppercase'}}>Last payment</div>
          <div style={{fontSize:14, fontWeight:600, color:v.ink, marginTop:4,
            fontFamily:'"Geist Mono",monospace', fontVariantNumeric:'tabular-nums'}}>
            $&nbsp;&nbsp;&nbsp;&nbsp;10 <span style={{color:v.muted, fontWeight:500}}>interest</span>
          </div>
          <div style={{fontSize:13, color:v.muted, marginTop:2,
            fontFamily:'"Geist Mono",monospace', fontVariantNumeric:'tabular-nums'}}>
            $2,643 <span>principal</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VisitorView3Col — full 3-column layout under the cream visitor header
// ─────────────────────────────────────────────────────────────────────────────
const VisitorView3Col = ({ theme='light', user='registered' }) => {
  const v = visTheme[theme];

  // helpers to render a card with internal dividers between rows
  const StackedCard = ({ children }) => (
    <V3Card v={v}>
      {React.Children.toArray(children).filter(Boolean).map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div style={{height:1, background:v.rule}}/>}
          {c}
        </React.Fragment>
      ))}
    </V3Card>
  );

  return (
    <div style={{
      background: v.bg, color: v.text, width:'100%', height:'100%',
      fontFamily:'"Geist", -apple-system, system-ui, sans-serif',
      fontSize:14, letterSpacing:-0.05, display:'flex', flexDirection:'column',
      overflow:'hidden', WebkitFontSmoothing:'antialiased',
    }}>
      <VisitorHeader v={v} user={user}/>

      <div style={{flex:1, overflow:'auto', background: v.bg}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'40px 32px 56px'}}>

          {/* Hero */}
          <div style={{marginBottom:28}}>
            <div style={{
              fontSize:11.5, fontWeight:500, color:v.subtle,
              letterSpacing:0.6, textTransform:'uppercase', marginBottom:8,
            }}>Mortgage</div>
            <h1 style={{
              margin:0, fontSize:36, fontWeight:600, letterSpacing:-1.0,
              color:v.ink, lineHeight:1.05,
            }}>What can you afford?</h1>
            <p style={{margin:'8px 0 0', fontSize:14, color:v.muted, lineHeight:1.55, maxWidth:600}}>
              Enter the loan details on the left. The result and breakdown update live.
            </p>
          </div>

          {/* 3 columns: inputs · results · chart */}
          <div style={{
            display:'grid',
            gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.55fr)',
            gap:20, alignItems:'start',
          }}>

            {/* Column 1 — Inputs */}
            <StackedCard>
              <V3ColHead v={v} label="Loan inputs"/>
              <V3Row>
                <V3CurrencyInput v={v} label="Purchase price" value="450,000"/>
              </V3Row>
              <V3Row>
                <V3PercentSlider v={v} pct={20} label="Down payment" hint="of price"/>
              </V3Row>
              <V3Row>
                <V3PercentField v={v} value="5.85" label="Interest rate" hint="APR · fixed"/>
              </V3Row>
              <V3Row>
                <V3NumberField v={v} value="30" suffix="years" label="Term"/>
              </V3Row>
            </StackedCard>

            {/* Column 2 — Results */}
            <StackedCard>
              <V3ColHead v={v} label="Your result"/>
              <V3Row>
                <V3HeroResult v={v}
                  label="Monthly payment"
                  value="$2,653.71"
                  suffix="/mo"
                  note="Principal + interest only. Taxes, insurance, and PMI not included."
                />
              </V3Row>
              <V3Row>
                <V3Result v={v} label="Down payment" value="$90,000"/>
              </V3Row>
              <V3Row>
                <V3Result v={v} label="Total interest" value="$595,335"/>
              </V3Row>
              <V3Row>
                <V3Result v={v} label="Total cost" value="$1,045,335"/>
              </V3Row>
            </StackedCard>

            {/* Column 3 — Chart */}
            <V3Card v={v}>
              <V3ColHead v={v} label="Payment composition" sub="how each month splits"/>
              <V3Chart v={v}/>
            </V3Card>

          </div>

          {/* Footer caption */}
          <div style={{
            marginTop:28, paddingTop:18, borderTop:`1px solid ${v.border}`,
            display:'flex', alignItems:'center', gap:14, color:v.muted, fontSize:12,
          }}>
            <span>Built with</span>
            <div style={{display:'flex', alignItems:'center', gap:8, color:v.ink}}>
              <div style={{
                width:18, height:18, borderRadius:4, background:v.ink, color:v.bg,
                fontFamily:'"Geist Mono",monospace', fontSize:11, fontWeight:600,
                display:'inline-flex', alignItems:'center', justifyContent:'center',
              }}>c</div>
              <span style={{fontWeight:600, letterSpacing:-0.2}}>Calcgrinder</span>
            </div>
            <span style={{flex:1}}/>
            <span style={{color:v.subtle}}>v1 · Mortgage Calculator · published 4 days ago</span>
          </div>

        </div>
      </div>
    </div>
  );
};

Object.assign(window, { VisitorView3Col });
