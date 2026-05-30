// ledger-ui.jsx
// Shared building blocks for the Financial Ledger screens.
// Banker-grade chrome — sidebar, top nav, KPI cards, transaction rows,
// inputs styled to feel like Streamlit widgets but rendered hi-fi.

// ─── Brand mark ────────────────────────────────────────────────────────────
function LedgerMark({ size = 18, t }) {
  // Stacked diamond — geometric, no flourish. Lime fill on dark, green on light.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      <rect x="3" y="3" width="18" height="18" rx="4" fill={t.accent} />
      <path d="M8 12.5 11 15.5 16.5 9" stroke={t.accentInk} strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// ─── Icon set (inline strokes, no library) ────────────────────────────────
const Icon = ({ name, size = 16, color = 'currentColor', strokeWidth = 1.6 }) => {
  const p = {
    plus:    'M12 5v14M5 12h14',
    search:  'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16ZM21 21l-4.3-4.3',
    arrowUp: 'M7 17 17 7M17 17V7H7',
    arrowDn: 'M17 7 7 17M7 7v10h10',
    arrowR:  'M5 12h14M13 6l6 6-6 6',
    download:'M12 4v12M6 14l6 6 6-6M4 22h16',
    filter:  'M4 5h16M7 12h10M10 19h4',
    cal:     'M4 6h16v15H4zM4 10h16M9 3v4M15 3v4',
    chev:    'M6 9l6 6 6-6',
    close:   'M6 6l12 12M18 6 6 18',
    check:   'M4 12l5 5L20 6',
    sort:    'M8 6v12M5 9l3-3 3 3M16 18V6M13 15l3 3 3-3',
    sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8',
    dot:     'M12 12h.01',
    lock:    'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z',
    info:    'M12 8h.01M11 12h1v5h1',
    logout:  'M10 17l-5-5 5-5M5 12h14M14 4h6v16h-6',
    chart:   'M4 20V8M10 20v-6M16 20V4M22 20H2',
    user:    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
    eye:     'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    eyeoff:  'M3 3l18 18M10.5 5.2A10 10 0 0 1 22 12s-1 2-3 4M6 6.5C3.5 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.5 9.5A3 3 0 0 0 14.5 14.5',
    chip:    'M9 4v3m6-3v3M9 17v3m6-3v3M4 9h3m-3 6h3m10-6h3m-3 6h3M6 6h12v12H6z',
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round"
         style={{ display: 'block', flexShrink: 0 }}>
      <path d={p} />
    </svg>
  );
};

// ─── Category swatches ─────────────────────────────────────────────────────
// Each category has a stable color so the eye learns the ledger.
const CATEGORY_PALETTE = {
  'Salary':           { hue: 145, glyph: '◐' },
  'Freelance':        { hue: 195, glyph: '◑' },
  'Investment':       { hue: 270, glyph: '◇' },
  'Food & Beverage':  { hue:  25, glyph: '●' },
  'Transport':        { hue: 220, glyph: '▲' },
  'Housing':          { hue:  10, glyph: '■' },
  'Utilities':        { hue:  60, glyph: '◆' },
  'Entertainment':    { hue: 320, glyph: '★' },
  'Health':           { hue: 165, glyph: '✚' },
  'Shopping':         { hue: 290, glyph: '◉' },
  'Travel':           { hue: 200, glyph: '✈' },
  'Subscriptions':    { hue:  80, glyph: '◎' },
  'Other':            { hue:   0, glyph: '○' },
};
function categoryColor(cat, dark) {
  const c = CATEGORY_PALETTE[cat] || CATEGORY_PALETTE['Other'];
  const l = dark ? 0.78 : 0.42;
  return `oklch(${l} 0.13 ${c.hue})`;
}

// Category chip — small glyph + label on a translucent pill
function CategoryChip({ category, t, dark, size = 'md' }) {
  const meta = CATEGORY_PALETTE[category] || CATEGORY_PALETTE['Other'];
  const color = categoryColor(category, dark);
  const pad = size === 'sm' ? '2px 7px 2px 5px' : '3px 9px 3px 6px';
  const fs = size === 'sm' ? 11 : 12;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: pad, borderRadius: 999,
      background: t.chipBg, border: `0.5px solid ${t.chipLine}`,
      fontSize: fs, fontWeight: 500, color: t.textSoft,
      whiteSpace: 'nowrap', lineHeight: 1,
    }}>
      <span aria-hidden style={{ color, fontSize: fs + 1, lineHeight: 1, transform: 'translateY(-0.5px)' }}>{meta.glyph}</span>
      {category}
    </span>
  );
}

// ─── Type/Direction pill (Income/Expense) ─────────────────────────────────
function DirectionTag({ type, t }) {
  const isIncome = type === 'Income';
  const fg = isIncome ? t.income : t.expense;
  const bg = isIncome ? t.incomeSoft : t.expenseSoft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 7px 2px 5px', borderRadius: 5,
      background: bg, color: fg,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.02,
      lineHeight: 1, textTransform: 'uppercase',
    }}>
      <Icon name={isIncome ? 'arrowDn' : 'arrowUp'} size={11} color={fg} strokeWidth={2.2} />
      {type}
    </span>
  );
}

// ─── Sidebar shell (Streamlit-flavored, hi-fi) ────────────────────────────
function Sidebar({ t, children, user, onLogout, width = 320 }) {
  return (
    <aside style={{
      width, flexShrink: 0, height: '100%',
      background: t.surface, borderRight: `1px solid ${t.border}`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Brand row */}
      <div style={{
        padding: '20px 22px 18px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${t.divider}`,
      }}>
        <LedgerMark size={22} t={t} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text, letterSpacing: -0.1 }}>Ledger</span>
          <span style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>Personal · v0.4</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {children}
      </div>

      {/* Footer: user + logout */}
      {user && (
        <div style={{
          borderTop: `1px solid ${t.divider}`, padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: `linear-gradient(135deg, ${t.accent} 0%, ${t.info} 100%)`,
            color: t.accentInk, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{user.initials}</div>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: t.text,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: t.muted,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          </div>
          <button onClick={onLogout} title="Sign out" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: t.muted, padding: 6, borderRadius: 6, display: 'flex',
          }}>
            <Icon name="logout" size={15} />
          </button>
        </div>
      )}
    </aside>
  );
}

function SidebarSection({ t, label, children, action }) {
  return (
    <div style={{ padding: '14px 20px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 600, color: t.muted,
          letterSpacing: 0.08, textTransform: 'uppercase',
        }}>{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Form primitives (Streamlit-ish, custom-styled) ───────────────────────
function FieldLabel({ t, children, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: t.textSoft }}>{children}</label>
      {hint && <span style={{ fontSize: 11, color: t.muted }}>{hint}</span>}
    </div>
  );
}

function TextInput({ t, value, placeholder, onChange, prefix, suffix, mono, readOnly, type = 'text' }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: t.inset, border: `1px solid ${focused ? t.accentLine : t.border}`,
      borderRadius: 8, transition: 'border-color .15s, background .15s',
      paddingLeft: prefix ? 12 : 0, paddingRight: suffix ? 12 : 0,
      boxShadow: focused ? `0 0 0 3px ${t.accentSoft}` : 'none',
    }}>
      {prefix && <span style={{ color: t.muted, fontSize: 12.5, fontWeight: 500, marginRight: 8 }}>{prefix}</span>}
      <input
        type={type} value={value} onChange={e => onChange && onChange(e.target.value)}
        placeholder={placeholder} readOnly={readOnly}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className={mono ? 'ledger-mono' : ''}
        style={{
          flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
          padding: '10px 12px', fontSize: 13.5, color: t.text,
          paddingLeft: prefix ? 0 : 12, paddingRight: suffix ? 0 : 12,
        }} />
      {suffix && <span style={{ color: t.muted, fontSize: 12.5, fontWeight: 500, marginLeft: 8 }}>{suffix}</span>}
    </div>
  );
}

function Select({ t, value, options, onChange }) {
  return (
    <div style={{
      position: 'relative', background: t.inset,
      border: `1px solid ${t.border}`, borderRadius: 8,
    }}>
      <select
        value={value} onChange={e => onChange && onChange(e.target.value)}
        style={{
          appearance: 'none', background: 'transparent', border: 'none', outline: 'none',
          width: '100%', padding: '10px 36px 10px 12px',
          fontSize: 13.5, color: t.text, cursor: 'pointer',
        }}>
        {options.map(o => (
          <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}
                  style={{ background: t.surface, color: t.text }}>
            {typeof o === 'string' ? o : o.label}
          </option>
        ))}
      </select>
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: t.muted }}>
        <Icon name="chev" size={14} />
      </span>
    </div>
  );
}

function Segment({ t, value, options, onChange }) {
  return (
    <div style={{
      display: 'flex', padding: 3, background: t.inset, borderRadius: 8,
      border: `1px solid ${t.border}`,
    }}>
      {options.map(o => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        const ic = typeof o === 'string' ? null : o.icon;
        const active = v === value;
        return (
          <button key={v} onClick={() => onChange && onChange(v)} style={{
            flex: 1, padding: '7px 8px', border: 'none', cursor: 'pointer',
            background: active ? t.elevated : 'transparent',
            color: active ? t.text : t.muted,
            borderRadius: 6, fontSize: 12.5, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: active ? `0 1px 2px rgba(0,0,0,0.15)` : 'none',
            transition: 'background .15s, color .15s',
          }}>
            {ic && <Icon name={ic} size={13} color={active ? (l === 'Income' ? t.income : l === 'Expense' ? t.expense : t.text) : t.muted} />}
            {l}
          </button>
        );
      })}
    </div>
  );
}

function Checkbox({ t, checked, onChange, label, sub }) {
  return (
    <button onClick={() => onChange && onChange(!checked)} style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
      background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
      textAlign: 'left',
    }}>
      <span style={{
        width: 16, height: 16, marginTop: 1, flexShrink: 0,
        borderRadius: 4, border: `1.5px solid ${checked ? t.accent : t.borderStrong}`,
        background: checked ? t.accent : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .15s',
      }}>
        {checked && <Icon name="check" size={12} color={t.accentInk} strokeWidth={3} />}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <span style={{ fontSize: 13, color: t.text, lineHeight: 1.3 }}>{label}</span>
        {sub && <span style={{ fontSize: 11, color: t.muted, lineHeight: 1.3 }}>{sub}</span>}
      </span>
    </button>
  );
}

function Button({ t, kind = 'primary', children, onClick, icon, fullWidth, size = 'md', disabled }) {
  const sizes = {
    sm: { pad: '7px 10px', fs: 12.5 },
    md: { pad: '10px 14px', fs: 13 },
    lg: { pad: '12px 18px', fs: 14 },
  }[size];
  const styles = {
    primary: { background: t.accent, color: t.accentInk, border: '1px solid transparent' },
    secondary: { background: t.elevated, color: t.text, border: `1px solid ${t.border}` },
    ghost: { background: 'transparent', color: t.textSoft, border: '1px solid transparent' },
    danger: { background: 'transparent', color: t.expense, border: `1px solid ${t.expenseSoft.replace('0.10','0.30').replace('0.08','0.30')}` },
  }[kind];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      padding: sizes.pad, fontSize: sizes.fs, fontWeight: 600,
      borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      width: fullWidth ? '100%' : 'auto', whiteSpace: 'nowrap',
      transition: 'transform .12s, filter .12s',
      ...styles,
    }}
    onMouseDown={e => !disabled && (e.currentTarget.style.transform = 'translateY(1px)')}
    onMouseUp={e => (e.currentTarget.style.transform = '')}
    onMouseLeave={e => (e.currentTarget.style.transform = '')}>
      {icon && <Icon name={icon} size={14} color="currentColor" strokeWidth={2} />}
      {children}
    </button>
  );
}

// ─── Top header (post-login) ──────────────────────────────────────────────
function TopBar({ t, title, subtitle, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '22px 32px 18px', borderBottom: `1px solid ${t.divider}`,
    }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: t.text, letterSpacing: -0.4 }}>{title}</h1>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: t.muted }}>{subtitle}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{right}</div>
    </div>
  );
}

Object.assign(window, {
  LedgerMark, Icon, CATEGORY_PALETTE, categoryColor, CategoryChip,
  DirectionTag, Sidebar, SidebarSection, FieldLabel, TextInput, Select,
  Segment, Checkbox, Button, TopBar,
});
