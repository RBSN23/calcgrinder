// Calcgrinder — Editor shell
// Wires the top bar (breadcrumb + theme picker), grid panel, resize handle,
// builder toolbar, and builder canvas. Reads chrome + grid + builder from window.

const { useState: edUseState } = React;

// ─────────────────────────────────────────────────────────────────────────────
// Editor-scoped CSS: hidden-cell pulse + between-cards hover-add affordance.
// Injected once.
// ─────────────────────────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('cg-editor-css')) {
  const s = document.createElement('style');
  s.id = 'cg-editor-css';
  s.textContent = `
    @keyframes cgPulse {
      0%, 100% { box-shadow: 0 0 0 4px rgba(99,102,241,0.18), 0 0 14px 4px rgba(99,102,241,0.35); }
      50%      { box-shadow: 0 0 0 6px rgba(99,102,241,0.10), 0 0 18px 7px rgba(99,102,241,0.55); }
    }
    .cg-vp-icons button { transition: background .12s, color .12s; }

    /* Between-cards "+ Add" hover affordance.
       The seam itself stays 1px; on hover/forced state the indigo bar and
       circular + fade in WITHOUT changing the seam's layout height. */
    .cg-seam-hit:hover .cg-seam-bar,
    .cg-seam--show .cg-seam-bar { opacity: 1; }
    .cg-seam-hit:hover .cg-seam-btn,
    .cg-seam--show .cg-seam-btn { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  `;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme picker — used in the top app bar. Has a `compact` mode for mobile
// that drops the theme name and keeps only swatch + word.
// ─────────────────────────────────────────────────────────────────────────────
const ThemePicker = ({ t, compact }) => (
  <div style={{
    height:28, padding: compact ? '0 8px' : '0 10px 0 8px', borderRadius:6,
    background:t.surface, border:`1px solid ${t.border}`,
    display:'inline-flex', alignItems:'center', gap: compact ? 6 : 8,
    fontSize: compact ? 11.5 : 12.5, color:t.text, fontFamily:'inherit', cursor:'pointer',
  }}>
    <span style={{
      width: compact ? 12 : 14, height: compact ? 12 : 14, borderRadius:3,
      background:'linear-gradient(135deg,#F4F1EC 0%, #FFFFFF 60%, #E5E2DC 100%)',
      border:`1px solid ${t.borderStr}`,
    }}/>
    {!compact && (
      <span style={{fontSize:11, color:t.textMuted, fontWeight:500, letterSpacing:0.3, textTransform:'uppercase'}}>Theme</span>
    )}
    <span style={{fontWeight:500}}>{compact ? 'Theme' : 'Editorial · Cream'}</span>
    <Icons.ChevD size={11}/>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Resize handle (visual only)
// ─────────────────────────────────────────────────────────────────────────────
const ResizeHandle = ({ t }) => (
  <div style={{
    height:6, flexShrink:0, background:t.bg, borderTop:`1px solid ${t.border}`,
    borderBottom:`1px solid ${t.border}`,
    position:'relative', cursor:'row-resize',
  }}>
    <div style={{
      position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)',
      width:36, height:3, borderRadius:2, background:t.borderStr,
    }}/>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Hidden-cells pill (compact on mobile)
// ─────────────────────────────────────────────────────────────────────────────
const HiddenPill = ({ t, compact, active }) => {
  const hiddenCount = cgCells.filter(c => c.hidden).length;
  if (hiddenCount === 0) return null;
  return (
    <button style={{
      height: compact ? 26 : 28, padding: compact ? '0 8px 0 7px' : '0 10px 0 8px',
      borderRadius:999,
      background: active ? t.accentSoft : t.surface2,
      color: active ? t.accentText : t.text,
      border:`1px solid ${active ? t.accent : t.border}`,
      display:'inline-flex', alignItems:'center', gap:6,
      fontSize: compact ? 11 : 12, fontWeight:500, fontFamily:'inherit', cursor:'pointer',
    }}>
      <span style={{
        width:8, height:8, borderRadius:'50%',
        background:`radial-gradient(circle at 35% 30%, ${t.accentHov}, ${t.accent} 70%)`,
        boxShadow:`0 0 0 3px ${t.accentSoft}`,
      }}/>
      {hiddenCount} hidden{compact ? '' : ' cells'}
      <Icons.ChevD size={10}/>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// + Add Cell button (icon-only on mobile)
// ─────────────────────────────────────────────────────────────────────────────
const AddCellBtn = ({ t, compact }) => (
  <button style={{
    height: compact ? 26 : 28,
    width: compact ? 26 : 'auto',
    padding: compact ? 0 : '0 10px 0 8px',
    borderRadius:6, cursor:'pointer', fontFamily:'inherit',
    background: t.accentSoft, color: t.accentText,
    border:`1px solid ${t.accent}`,
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5,
    fontSize:12, fontWeight:500,
  }}>
    <Icons.Plus size={ compact ? 13 : 12} stroke={2}/>
    {!compact && 'Add cell'}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Builder panel toolbar (theme picker removed; + Add Cell added)
// ─────────────────────────────────────────────────────────────────────────────
const BuilderToolbar = ({ t, viewport='desktop', hiddenPopover }) => {
  const compact = viewport === 'mobile';
  return (
    <div style={{
      height: compact ? 40 : 44, flexShrink:0, position:'relative',
      borderBottom:`1px solid ${t.border}`, background:t.surface,
      display:'flex', alignItems:'center', padding: compact ? '0 10px' : '0 16px',
      gap: compact ? 6 : 8,
    }}>
      {/* LEFT side: Preview, viewport picker, (theme picker on desktop only) */}
      {compact ? (
        <button style={{
          height:26, width:26, borderRadius:6, background:'transparent',
          border:`1px solid ${t.border}`, color:t.text, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}><Icons.External size={13}/></button>
      ) : (
        <Btn variant="ghost" size="sm" icon={Icons.External} t={t}>Preview</Btn>
      )}

      <div className="cg-vp-icons" style={{
        display:'inline-flex', padding:2, borderRadius:7,
        background:t.surface2, border:`1px solid ${t.border}`, gap:0,
      }}>
        {[
          { k:'desktop', I:Icons.Desktop, label:'Desktop' },
          { k:'tablet',  I:Icons.Tablet,  label:'Tablet' },
          { k:'mobile',  I:Icons.Phone,   label:'Mobile' },
        ].map(opt => {
          const active = opt.k === viewport;
          return (
            <button key={opt.k} title={opt.label} aria-label={opt.label} style={{
              width: compact ? 24 : 28, height: compact ? 22 : 24, borderRadius:5, border:'none',
              background: active ? t.surface : 'transparent',
              color: active ? t.text : t.textMuted,
              cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}><opt.I size={ compact ? 12 : 13}/></button>
          );
        })}
      </div>

      {!compact && <ThemePicker t={t}/>}

      <span style={{flex:1}}/>

      {/* RIGHT side: hidden cells pill, + Add cell */}
      <HiddenPill t={t} compact={compact} active={hiddenPopover}/>
      <AddCellBtn t={t} compact={compact}/>

      {hiddenPopover && <HiddenCellsPopover t={t} anchorRight={compact ? 96 : 130}/>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Editor — main composed view
// ─────────────────────────────────────────────────────────────────────────────
const Editor = ({
  theme = 'light',
  viewport = 'desktop',
  expandedCol = null,
  selectedCell = null,
  expandChart = false,
  hiddenPopover = false,
  importOpen = false,             // desktop — anchored popover
  importSheetOpen = false,        // mobile  — bottom sheet
  importStep = 'paste',           // 'paste' | 'errors' | 'preview'
  importPreviewScroll = 0,        // scrollTop for preview list (design canvas)
  showHoverAdd = false,
  mobilePane = 'builder',         // legacy — unused on mobile, kept for compat
  mobileGridOpen = false,         // mobile  — Grid drawer docked at bottom
  editingRowId = null,            // mobile drawer — row in inline-edit state
  expandedRowId = null,           // mobile drawer — row whose Kebab is expanded
  drawerScrollOffset = 0,         // mobile drawer — px scrolled inside drawer
  drawerHeight = null,            // mobile drawer — explicit height when expanded
}) => {
  const t = cgTokens[theme];
  const mobile = viewport === 'mobile';
  // Sized to fit toolbar (34) + header (56) + data row (72) + 1px borders,
  // no empty filler below. Expanded grows by the header-settings panel (290).
  const gridHeight = expandedCol ? 454 : 164;

  if (mobile) {
    return <EditorMobile t={t} theme={theme}
      gridOpen={mobileGridOpen}
      importSheetOpen={importSheetOpen}
      importStep={importStep}
      importPreviewScroll={importPreviewScroll}
      hiddenPopover={hiddenPopover}
      editingRowId={editingRowId}
      expandedRowId={expandedRowId}
      drawerScrollOffset={drawerScrollOffset}
      drawerHeight={drawerHeight}/>;
  }

  return (
    <div style={{
      background:t.bg, color:t.text, width:'100%', height:'100%',
      fontFamily:'"Geist", -apple-system, system-ui, sans-serif',
      fontSize:14, letterSpacing:-0.05, display:'flex', flexDirection:'column',
      overflow:'hidden', WebkitFontSmoothing:'antialiased',
    }}>
      <TopBarDesktop t={t}
        tabs={[
          { label:'Dashboard', active:false },
          { label:'Mortgage Calculator', active:true },
        ]}
      />

      <GridPanel t={t} expandedCol={expandedCol} importOpen={importOpen} importStep={importStep} previewScrollTop={importPreviewScroll} height={gridHeight}/>
      <ResizeHandle t={t}/>
      <BuilderToolbar t={t} viewport="desktop" hiddenPopover={hiddenPopover}/>

      <div style={{flex:1, overflow:'auto', background: visTheme[theme].bg}}>
        <BuilderCanvas t={t} theme={theme}
          selected={selectedCell} expandChart={expandChart}
          showHoverAdd={showHoverAdd}/>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Mobile fallback — single top app bar line (theme picker integrated),
// segmented Grid / Builder toggle below (no EDITING badge).
// ─────────────────────────────────────────────────────────────────────────────
const EditorMobile = ({ t, theme, gridOpen=false, importSheetOpen=false, importStep='paste', importPreviewScroll=0, hiddenPopover=false, editingRowId=null, expandedRowId=null, drawerScrollOffset=0, drawerHeight=null }) => {
  const v = visTheme[theme];
  const footerH = 52;
  return (
    <div style={{
      background:t.bg, color:t.text, width:'100%', height:'100%',
      fontFamily:'"Geist", -apple-system, system-ui, sans-serif',
      fontSize:14, letterSpacing:-0.05, display:'flex', flexDirection:'column',
      overflow:'hidden', position:'relative',
    }}>
      {/* Bar 1 — app top bar (unchanged) */}
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

      {/* Bar 2 — header toolbar: theme · viewport · spacer · Preview */}
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
            { k:'desktop', I:Icons.Desktop, label:'Desktop' },
            { k:'tablet',  I:Icons.Tablet,  label:'Tablet' },
            { k:'mobile',  I:Icons.Phone,   label:'Mobile', active:true },
          ].map(opt => (
            <button key={opt.k} title={opt.label} aria-label={opt.label} style={{
              width:24, height:22, borderRadius:5, border:'none',
              background: opt.active ? t.surface : 'transparent',
              color: opt.active ? t.text : t.textMuted,
              cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center',
              boxShadow: opt.active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}><opt.I size={12}/></button>
          ))}
        </div>
        <span style={{flex:1}}/>
        <button aria-label="Preview" title="Preview" style={{
          height:28, width:28, borderRadius:6, background:'transparent',
          border:`1px solid ${t.border}`, color:t.text, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}><Icons.External size={13}/></button>
      </div>

      {/* Body — Builder always present; Grid drawer docks to bottom when open */}
      <div style={{
        flex:1, minHeight:0, display:'flex', flexDirection:'column',
        background:v.bg, overflow:'hidden',
      }}>
        <div style={{flex:1, overflow:'auto', background:v.bg}}>
          <BuilderCanvas t={t} theme={theme} viewport="mobile"/>
        </div>
        {gridOpen && <GridDrawerMobile t={t}
          editingRowId={editingRowId}
          expandedRowId={expandedRowId}
          scrollOffset={drawerScrollOffset}
          drawerHeight={drawerHeight}/>}
      </div>

      {/* Footer nav (sticky bottom) */}
      <nav style={{
        height: footerH, flexShrink:0, background:t.surface,
        borderTop:`1px solid ${t.border}`,
        display:'flex', alignItems:'center', padding:'0 10px', gap:8,
        paddingBottom: 'env(safe-area-inset-bottom)',
        position:'relative',
      }}>
        {/* LEFT — magic-code import button */}
        <button aria-label="Import cells from code" title="Import cells from code" style={{
          width:36, height:36, borderRadius:8,
          background: importSheetOpen ? t.accentSoft : 'transparent',
          color: importSheetOpen ? t.accent : t.text,
          border:`1px solid ${importSheetOpen ? t.accent : 'transparent'}`,
          cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}><Icons.Sparkle size={16}/></button>

        <span style={{flex:1}}/>

        {/* CENTER — Grid overlay toggle */}
        <button aria-label="Toggle grid overlay" aria-pressed={gridOpen} style={{
          height:32, padding:'0 12px 0 10px', borderRadius:999,
          display:'inline-flex', alignItems:'center', gap:8,
          background: gridOpen ? t.accentSoft : t.surface2,
          color: gridOpen ? t.accentText : t.text,
          border:`1px solid ${gridOpen ? t.accent : t.border}`,
          cursor:'pointer', fontFamily:'inherit',
          fontSize:12.5, fontWeight:500, letterSpacing:-0.1,
        }}>
          <Icons.Hash size={13}/>
          <span>Grid</span>
          {/* tiny switch glyph */}
          <span style={{
            width:22, height:13, borderRadius:7, padding:1,
            background: gridOpen ? t.accent : t.borderStr,
            position:'relative', display:'inline-block', transition:'background .15s',
            marginLeft:2,
          }}>
            <span style={{
              width:11, height:11, borderRadius:'50%', background:'#fff',
              position:'absolute', top:1, left: gridOpen ? 10 : 1,
              boxShadow:'0 1px 2px rgba(0,0,0,0.2)', transition:'left .15s',
            }}/>
          </span>
        </button>

        <span style={{flex:1}}/>

        {/* RIGHT — hidden pill + Add cell */}
        <HiddenPill t={t} compact active={hiddenPopover}/>
        <AddCellBtn t={t} compact/>

        {hiddenPopover && <HiddenCellsPopover t={t} anchorRight={10} placement="up"/>}
      </nav>

      {importSheetOpen && <ImportSheet t={t} step={importStep} previewScrollTop={importPreviewScroll}/>}
    </div>
  );
};

Object.assign(window, { Editor });
