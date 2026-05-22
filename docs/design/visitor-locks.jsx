// Calcgrinder — Visitor View · per-field locks + shared-scenario state
// ─────────────────────────────────────────────────────────────────────────────
// Composes on top of BuilderCanvas (visitor-view's shell). Adds:
//   · ScenarioHeader  — the block between calculator description and the
//                       first section. Shown when a calculator is loaded
//                       via a scenario URL.
//   · ResetBtn        — small secondary button anchored at the top-right of
//                       the page header. Visible only when state ≠ initial.
//   · LockableVisitorView — full visitor shell that threads lock state +
//                       scenario header into BuilderCanvas. Reuses the
//                       existing VisitorHeader / VisitorFooter unchanged.
//   · SaveScenarioSheet — bottom sheet for saving a scenario. Adds a
//                       description field and pre-selection of the current
//                       scenario (when the user is in a shared-scenario
//                       state) — the Save button label becomes "Overwrite".
//
// All visuals consume `cgTokens` (chrome) for accents + `visTheme` (cream)
// for cards, ink and rules. No new colours invented.

const { useState: lockUseState } = React;

// ─────────────────────────────────────────────────────────────────────────────
// ScenarioHeader
// ─────────────────────────────────────────────────────────────────────────────
// "Scenario:" label · scenario title (sentence-case, weight 500)
// optional description (muted) · "by <user> · saved <date>" small + muted.
// `modified=true` appends an italic "(modified)" suffix to the title and
// greys the description to ~60% opacity (no longer accurately describes
// what's shown).
const ScenarioHeader = ({ v, t, scenario, modified=false }) => (
  <div style={{display:'flex', flexDirection:'column', gap:6}}>
    <div style={{
      display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap',
    }}>
      <span style={{
        fontSize:11.5, fontWeight:500, color:v.subtle,
        letterSpacing:0.6, textTransform:'uppercase',
      }}>Scenario</span>
      <span style={{
        fontSize:19, fontWeight:500, color:v.ink, letterSpacing:-0.3,
        lineHeight:1.25,
      }}>
        {scenario.title}
        {modified && (
          <span style={{
            marginLeft:8, fontSize:14, fontStyle:'italic', fontWeight:400,
            color:v.muted, letterSpacing:0,
          }}>(modified)</span>
        )}
      </span>
    </div>
    {scenario.description && (
      <p style={{
        margin:0, fontSize:14, color:v.muted, lineHeight:1.5, maxWidth:600,
        opacity: modified ? 0.6 : 1,
        transition:'opacity .15s',
      }}>{scenario.description}</p>
    )}
    <div style={{
      fontSize:12, color:v.subtle, marginTop:2,
      display:'flex', alignItems:'center', gap:6, flexWrap:'wrap',
    }}>
      <span>by</span>
      <span style={{
        fontFamily:'"Geist Mono", monospace', color:v.muted,
      }}>@{scenario.author}</span>
      <span style={{color:v.subtle}}>·</span>
      <span>saved {scenario.savedAt}</span>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ResetBtn — small secondary button, anchored top-right of page header.
// Rendered only when caller decides state has diverged from initial.
// ─────────────────────────────────────────────────────────────────────────────
const ResetBtn = ({ v, t, onClick, label='Reset' }) => (
  <button onClick={onClick} style={{
    height:32, padding:'0 12px', borderRadius:6,
    background: v.card, color: v.ink,
    border:`1px solid ${v.borderStr}`,
    fontFamily:'inherit', fontSize:13, fontWeight:500, letterSpacing:-0.05,
    display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer',
    whiteSpace:'nowrap', lineHeight:1,
  }}>
    <Icons.Refresh size={13}/>
    {label}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// LockableVisitorView — visitor shell that supports per-field locks +
// scenario header + reset button. Wraps BuilderCanvas (interactive=false).
//
// Props:
//   theme            — 'light' | 'dark' (visTheme)
//   user             — 'anonymous' | 'registered'
//   viewport         — 'desktop' | 'mobile'
//   lockedIds        — Set<string> of cell ids that are locked
//   valueOverrides   — { [cellId]: string } user-edited values (overrides cgCells)
//   scenario         — { title, description, author, savedAt } | null
//   modified         — true if user has changed any value from the scenario baseline
//   showReset        — render Reset button when state ≠ initial
// ─────────────────────────────────────────────────────────────────────────────
const LockableVisitorView = ({
  theme='light',
  user='registered',
  viewport='desktop',
  lockedIds=new Set(),
  valueOverrides=null,
  scenario=null,
  modified=false,
  showReset=false,
}) => {
  const v = visTheme[theme];
  const t = cgTokens[theme];
  const mobile = viewport === 'mobile';

  return (
    <div style={{
      background: v.bg, color: v.text, width:'100%', height:'100%',
      fontFamily:'"Geist", -apple-system, system-ui, sans-serif',
      fontSize:14, letterSpacing:-0.05, display:'flex', flexDirection:'column',
      overflow:'hidden', WebkitFontSmoothing:'antialiased',
    }}>
      <VisitorHeader v={v} user={user} mobile={mobile}/>

      <div style={{flex:1, overflow:'auto', background: v.bg}}>
        <BuilderCanvas
          t={t} theme={theme}
          viewport={viewport}
          interactive={false}
          lockedIds={lockedIds}
          valueOverrides={valueOverrides}
          scenarioHeader={scenario
            ? <ScenarioHeader v={v} t={t} scenario={scenario} modified={modified}/>
            : null}
          topRightSlot={showReset ? <ResetBtn v={v} t={t}/> : null}
        />
        <VisitorFooter v={v}/>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SaveScenarioSheet — bottom sheet, cream-themed, with optional Description
// field and an existing-scenarios picker. Used in two modes:
//   mode='new'        — empty name + description, list shows existing
//                       scenarios but none pre-selected. Save label: "Save".
//   mode='overwrite'  — user is in a shared-scenario state. Their current
//                       scenario is pre-selected (highlighted + "(current)"
//                       tag). Name + description pre-filled from it.
//                       Save label: "Overwrite". They can deselect to save
//                       as a new scenario (label flips back to "Save").
// ─────────────────────────────────────────────────────────────────────────────
const VFieldLabel = ({ v, children }) => (
  <div style={{
    fontSize:11, fontWeight:600, color:v.muted,
    letterSpacing:0.5, textTransform:'uppercase', marginBottom:6,
  }}>{children}</div>
);

const VTextInput = ({ v, value, placeholder }) => (
  <div style={{
    height:38, padding:'0 12px', borderRadius:7,
    background: v.card, border:`1px solid ${v.borderStr}`,
    display:'flex', alignItems:'center',
  }}>
    <span style={{
      flex:1, fontSize:14, color: value ? v.ink : v.subtle,
      fontWeight: value ? 500 : 400, letterSpacing:-0.1,
      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
    }}>{value || placeholder}</span>
  </div>
);

const VTextArea = ({ v, value, placeholder, rows=2 }) => (
  <div style={{
    padding:'10px 12px', borderRadius:7, minHeight: rows * 20 + 20,
    background: v.card, border:`1px solid ${v.borderStr}`,
    display:'flex', alignItems:'flex-start',
  }}>
    <span style={{
      flex:1, fontSize:13.5, color: value ? v.text : v.subtle,
      fontWeight: 400, letterSpacing:-0.05, lineHeight:1.5,
    }}>{value || placeholder}</span>
  </div>
);

// One row in the existing-scenarios picker. Clicking it pre-fills name +
// description and turns Save into Overwrite.
const ScenarioRow = ({ v, t, scenario, selected, isCurrent, last }) => (
  <div style={{
    display:'flex', alignItems:'center', gap:10,
    padding:'10px 12px',
    background: selected ? t.accentSoft : 'transparent',
    borderBottom: last ? 'none' : `1px solid ${v.rule}`,
    cursor:'pointer',
  }}>
    {/* Radio dot */}
    <div style={{
      width:16, height:16, borderRadius:'50%', flexShrink:0,
      border:`1.5px solid ${selected ? t.accent : v.borderStr}`,
      background: selected ? t.accent : 'transparent',
      display:'inline-flex', alignItems:'center', justifyContent:'center',
    }}>
      {selected && <div style={{
        width:5, height:5, borderRadius:'50%', background: t.accentFg,
      }}/>}
    </div>
    <div style={{flex:1, minWidth:0}}>
      <div style={{
        fontSize:13.5, fontWeight:500, color: v.ink,
        letterSpacing:-0.1, display:'flex', alignItems:'center', gap:6,
      }}>
        <span style={{
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          minWidth:0,
        }}>{scenario.title}</span>
        {isCurrent && (
          <span style={{
            fontSize:10.5, fontWeight:500, color: t.accentText,
            background: t.accentSoft, border:`1px solid ${t.accentSoft}`,
            padding:'1px 6px', borderRadius:4, letterSpacing:0.2,
            flexShrink:0,
          }}>(current)</span>
        )}
      </div>
      <div style={{
        fontSize:12, color:v.muted, marginTop:1, letterSpacing:-0.05,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      }}>saved {scenario.savedAt}</div>
    </div>
  </div>
);

const SaveScenarioSheet = ({
  theme='light',
  viewport='desktop',
  mode='new',                 // 'new' | 'overwrite'
  scenarios=[],               // array of { id, title, savedAt }
  currentScenarioId=null,     // id pre-selected in 'overwrite' mode
  name='',
  description='',
}) => {
  const v = visTheme[theme];
  const t = cgTokens[theme];
  const isMobile = viewport === 'mobile';
  const isOverwrite = mode === 'overwrite';
  const saveLabel = isOverwrite ? 'Overwrite' : 'Save';
  const saveIcon  = isOverwrite ? Icons.Save  : Icons.Bookmark;

  return (
    <div style={{
      position:'absolute', inset:0, zIndex:50,
      display:'flex', flexDirection:'column', justifyContent:'flex-end',
      background:'rgba(0,0,0,0.20)',
    }}>
      <div style={{
        width:'100%',
        maxWidth: isMobile ? '100%' : 520,
        margin: isMobile ? 0 : '0 auto',
        background: v.bg,
        borderTopLeftRadius:16, borderTopRightRadius:16,
        borderTop:`1px solid ${v.border}`,
        boxShadow:'0 -18px 48px rgba(22,20,15,0.22), 0 -2px 8px rgba(22,20,15,0.10)',
        padding: isMobile ? '12px 20px 22px' : '12px 24px 22px',
        display:'flex', flexDirection:'column', gap:14,
      }}>
        {/* Drag handle */}
        <div style={{
          width:36, height:4, borderRadius:2, background:v.borderStr,
          margin:'0 auto 2px',
        }}/>

        {/* Title row */}
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <div style={{
            width:32, height:32, borderRadius:7, background:v.card,
            border:`1px solid ${v.border}`, color:v.ink,
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            flexShrink:0,
          }}>
            <Icons.Bookmark size={15}/>
          </div>
          <div style={{minWidth:0, flex:1}}>
            <div style={{
              fontSize:15.5, fontWeight:600, color:v.ink, letterSpacing:-0.2,
            }}>{isOverwrite ? 'Save scenario' : 'Save scenario'}</div>
            <div style={{
              fontSize:12, color:v.muted, marginTop:1, lineHeight:1.4,
            }}>{isOverwrite
              ? 'Update your current scenario, or save as a new one.'
              : 'Save the current input values so you can return to them later.'}</div>
          </div>
        </div>

        {/* Name */}
        <div>
          <VFieldLabel v={v}>Name</VFieldLabel>
          <VTextInput v={v} value={name} placeholder="My scenario"/>
        </div>

        {/* Description (NEW) */}
        <div>
          <VFieldLabel v={v}>Description <span style={{color:v.subtle, fontWeight:500, textTransform:'none', letterSpacing:0}}>· optional</span></VFieldLabel>
          <VTextArea v={v} value={description}
            placeholder="Describe this scenario (optional)" rows={2}/>
        </div>

        {/* Existing-scenarios picker */}
        {scenarios.length > 0 && (
          <div>
            <VFieldLabel v={v}>Or overwrite an existing scenario</VFieldLabel>
            <div style={{
              borderRadius:7, border:`1px solid ${v.borderStr}`,
              background:v.card, overflow:'hidden',
            }}>
              {scenarios.map((s, i) => (
                <ScenarioRow key={s.id}
                  v={v} t={t}
                  scenario={s}
                  selected={isOverwrite && s.id === currentScenarioId}
                  isCurrent={s.id === currentScenarioId}
                  last={i === scenarios.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          display:'flex', gap:8, marginTop:4,
          justifyContent: isMobile ? 'stretch' : 'flex-end',
          flexDirection: isMobile ? 'column-reverse' : 'row',
        }}>
          <button style={{
            height:40, padding:'0 16px', borderRadius:7,
            background: 'transparent', color: v.ink,
            border:`1px solid transparent`,
            fontFamily:'inherit', fontSize:13.5, fontWeight:500, letterSpacing:-0.05,
            cursor:'pointer',
            display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
            flex: isMobile ? '1 1 auto' : '0 0 auto',
          }}>Cancel</button>
          <button style={{
            height:40, padding:'0 18px', borderRadius:7,
            background: v.ink, color: v.bg,
            border:`1px solid ${v.ink}`,
            fontFamily:'inherit', fontSize:13.5, fontWeight:600, letterSpacing:-0.05,
            cursor:'pointer', boxShadow:'0 1px 0 rgba(255,255,255,0.18) inset, 0 4px 12px rgba(22,20,15,0.18)',
            display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
            flex: isMobile ? '1 1 auto' : '0 0 auto',
          }}>
            {React.createElement(saveIcon, { size:14 })}
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  ScenarioHeader, ResetBtn, LockableVisitorView, SaveScenarioSheet,
});
