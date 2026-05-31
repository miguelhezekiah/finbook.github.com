// ledger-app.jsx
// The REAL, deployable Financial Ledger — React + Supabase, no Python.
// Reuses the presentational component library (tokens, ui, kpi, table, charts)
// but wires every piece to live Supabase auth + data.
//
// Security model: the browser holds only the anon key. Every query is allowed
// or denied by Postgres Row-Level Security (auth.uid() = user_id). See
// sql/schema.sql. There is no privileged code path in this file.

const { useState, useEffect, useCallback, useMemo, useRef } = React;

// ─── Supabase client ───────────────────────────────────────────────────────
const CFG = window.LEDGER_CONFIG || {};
const CONFIGURED =
  CFG.SUPABASE_URL && CFG.SUPABASE_KEY &&
  !CFG.SUPABASE_URL.includes('YOUR-PROJECT') &&
  !CFG.SUPABASE_KEY.includes('YOUR-ANON');
const db = CONFIGURED ? supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY) : null;

const CATEGORIES = [
  'Salary', 'Freelance', 'Investment', 'Food & Beverage', 'Transport',
  'Housing', 'Utilities', 'Entertainment', 'Health', 'Shopping', 'Travel',
  'Subscriptions', 'Other',
];

// ─── Aggregation (also satisfies KPIRow's global `aggregate`) ───────────────
function aggregateRows(rows) {
  const income = { USD: 0, IDR: 0 };
  const expense = { USD: 0, IDR: 0 };
  (rows || []).forEach(r => {
    const bucket = r.type === 'Income' ? income : expense;
    bucket[r.currency] = (bucket[r.currency] || 0) + Number(r.amount || 0);
  });
  return { income, expense, net: { USD: income.USD - expense.USD, IDR: income.IDR - expense.IDR } };
}
window.aggregate = aggregateRows;

// ─── Month helpers ─────────────────────────────────────────────────────────
const monthKey = (iso) => String(iso).slice(0, 7);                 // "2026-05"
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

function toCSV(rows) {
  if (!rows.length) return '';
  const cols = ['id', 'date', 'type', 'amount', 'currency', 'category',
    'vendor_location', 'has_discount', 'discount_amount', 'original_amount', 'is_subscription'];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}

// ─── Transient banner (success / error) ────────────────────────────────────
function Banner({ t, kind, children, onClose }) {
  const fg = kind === 'error' ? t.expense : t.income;
  const bg = kind === 'error' ? t.expenseSoft : t.incomeSoft;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      background: bg, border: `1px solid ${fg}33`, borderRadius: 10,
      color: t.text, fontSize: 13,
    }}>
      <Icon name={kind === 'error' ? 'close' : 'check'} size={14} color={fg} strokeWidth={2.4} />
      <span style={{ flex: 1 }}>{children}</span>
      {onClose && (
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.muted, display: 'flex' }}>
          <Icon name="close" size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Entry form (controlled) — used for both Add and Edit ──────────────────
function EntryForm({ t, dark, initial, onSubmit, onDelete, busy, submitLabel = 'Save transaction' }) {
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState(initial?.type || 'Expense');
  const [currency, setCurrency] = useState(initial?.currency || 'IDR');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [category, setCategory] = useState(initial?.category || 'Food & Beverage');
  const [vendor, setVendor] = useState(initial?.vendor_location || '');
  const [date, setDate] = useState(initial?.date || today);
  const [hasDiscount, setHasDiscount] = useState(Boolean(initial?.has_discount));
  const [discount, setDiscount] = useState(initial ? String(initial.discount_amount || '') : '');
  const [isSub, setIsSub] = useState(Boolean(initial?.is_subscription));
  const [err, setErr] = useState(null);

  const paidNum = Number(String(amount).replace(/[^\d.]/g, '')) || 0;
  const discNum = Number(String(discount).replace(/[^\d.]/g, '')) || 0;
  const originalNum = paidNum + discNum;
  const origFmt = fmtMoney(originalNum, currency);

  const submit = () => {
    if (paidNum <= 0) { setErr('Amount must be greater than zero.'); return; }
    setErr(null);
    onSubmit({
      date,
      type,
      amount: paidNum,
      currency,
      category,
      vendor_location: vendor.trim(),
      has_discount: hasDiscount,
      discount_amount: hasDiscount ? discNum : 0,
      original_amount: hasDiscount ? originalNum : paidNum,
      is_subscription: isSub,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <FieldLabel t={t}>Direction</FieldLabel>
        <Segment t={t} value={type} onChange={setType}
          options={[{ value: 'Income', label: 'Income', icon: 'arrowDn' },
                    { value: 'Expense', label: 'Expense', icon: 'arrowUp' }]} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FieldLabel t={t}>Amount paid</FieldLabel>
          <TextInput t={t} value={amount} onChange={setAmount} mono
            placeholder="0" prefix={currency === 'IDR' ? 'Rp' : '$'} />
        </div>
        <div style={{ width: 96 }}>
          <FieldLabel t={t}>Ccy</FieldLabel>
          <Select t={t} value={currency} onChange={setCurrency} options={['IDR', 'USD']} />
        </div>
      </div>

      <div>
        <FieldLabel t={t} hint={fmtDate(date)}>Date</FieldLabel>
        <TextInput t={t} value={date} onChange={setDate} type="date"
          prefix={<Icon name="cal" size={13} color={t.muted} />} />
      </div>

      <div>
        <FieldLabel t={t}>Category</FieldLabel>
        <Select t={t} value={category} onChange={setCategory} options={CATEGORIES} />
      </div>

      <div>
        <FieldLabel t={t} hint="optional">Vendor / location</FieldLabel>
        <TextInput t={t} value={vendor} onChange={setVendor} placeholder="e.g. Kopi Kenangan · Pacific Place" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, border: `1px solid ${t.border}`, borderRadius: 10 }}>
        <Checkbox t={t} checked={hasDiscount} onChange={setHasDiscount}
          label="Discount applied" sub="Receipt shows a discount, voucher, or comp" />
        {hasDiscount && (
          <div style={{ marginTop: 2, marginLeft: 26, paddingLeft: 12, borderLeft: `2px solid ${t.accentLine}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <FieldLabel t={t} hint="amount knocked off">Discount amount</FieldLabel>
              <TextInput t={t} value={discount} onChange={setDiscount} mono placeholder="0" prefix={currency === 'IDR' ? 'Rp' : '$'} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontSize: 11.5, paddingTop: 2 }}>
              <span style={{ color: t.muted }}>Normal price</span>
              <span className="ledger-mono" style={{ color: t.textSoft, fontWeight: 500 }}>{origFmt.symbol}{origFmt.whole}{origFmt.frac}</span>
            </div>
          </div>
        )}
        <Checkbox t={t} checked={isSub} onChange={setIsSub}
          label="Recurring subscription" sub="Bill repeats on a fixed schedule" />
      </div>

      {err && <div style={{ fontSize: 12, color: t.expense }}>{err}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <Button t={t} kind="primary" icon="check" fullWidth onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
        {onDelete && (
          <Button t={t} kind="danger" icon="close" onClick={onDelete} disabled={busy}>Delete</Button>
        )}
      </div>

      <div style={{ fontSize: 11, color: t.muted, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ marginTop: 1 }}><Icon name="lock" size={11} color={t.muted} /></span>
        Stored against your user ID. Row-level security keeps every entry private to your account.
      </div>
    </div>
  );
}

// ─── Auth screen (sign in / sign up) ───────────────────────────────────────
function AuthScreen({ t, dark, onAuthed }) {
  const [mode, setMode] = useState('signin');
  const isSignup = mode === 'signup';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [notice, setNotice] = useState(null);

  const submit = async () => {
    setErr(null); setNotice(null);
    if (!CONFIGURED) { setErr('Supabase isn’t connected yet — fill in config.js with your project URL and anon key.'); return; }
    if (!email || !password) { setErr('Please provide both email and password.'); return; }
    if (isSignup && password.length < 12) { setErr('Password should be at least 12 characters.'); return; }
    setBusy(true);
    try {
      if (isSignup) {
        const { data, error } = await db.auth.signUp({
          email: email.trim(), password,
          options: name.trim() ? { data: { display_name: name.trim() } } : {},
        });
        if (error) throw error;
        if (data.session) onAuthed(data.session);
        else { setNotice('Account created. Check your inbox for the confirmation link, then sign in.'); setMode('signin'); }
      } else {
        const { data, error } = await db.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        onAuthed(data.session);
      }
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <div className="ledger-root" style={{ width: '100%', minHeight: '100vh', display: 'flex', background: t.bg, color: t.text }}>
      {/* Left rail */}
      <div style={{
        flex: '0 0 44%', position: 'relative', overflow: 'hidden',
        background: dark
          ? `radial-gradient(circle at 25% 30%, ${t.accentSoft}, transparent 55%), ${t.surface}`
          : `radial-gradient(circle at 25% 30%, ${t.accentSoft}, transparent 55%), ${t.inset}`,
        borderRight: `1px solid ${t.border}`, padding: '48px 56px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LedgerMark size={26} t={t} />
          <span style={{ fontSize: 16, fontWeight: 600, color: t.text, letterSpacing: -0.2 }}>Ledger</span>
        </div>
        <div style={{ maxWidth: 420 }}>
          <h2 className="ledger-serif" style={{ margin: 0, fontSize: 48, lineHeight: 1.05, color: t.text, fontWeight: 400, letterSpacing: -0.5 }}>
            Every <em style={{ color: t.accent, fontStyle: 'italic' }}>rupiah</em> &amp;<br />
            every <em style={{ color: t.accent, fontStyle: 'italic' }}>dollar</em>,<br />in one ledger.
          </h2>
          <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.55, color: t.muted, maxWidth: 360 }}>
            A private financial journal for people who bill in multiple currencies and
            don&apos;t want a bank in the middle of their notes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 28 }}>
          {[['256-bit', 'Postgres-side encryption'], ['RLS', 'Per-user row scoping'], ['∞', 'Transactions per ledger']].map(([k, v]) => (
            <div key={k}>
              <div className="ledger-serif" style={{ fontSize: 26, color: t.text, lineHeight: 1 }}>{k}</div>
              <div style={{ fontSize: 11, color: t.muted, marginTop: 6 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.muted, letterSpacing: 0.1, textTransform: 'uppercase' }}>
            {isSignup ? 'Create account' : 'Sign in'}
          </span>
          <h1 style={{ margin: '6px 0 6px', fontSize: 28, fontWeight: 600, color: t.text, letterSpacing: -0.4 }}>
            {isSignup ? 'Start a new ledger.' : 'Welcome back.'}
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: t.muted }}>
            {isSignup ? 'Your ledger is yours alone — row-level security keeps every entry scoped to your user.'
                      : 'Authenticate to open your private ledger.'}
          </p>

          <div style={{ marginTop: 22 }}>
            <Segment t={t} value={mode} onChange={setMode}
              options={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }]} />
          </div>

          {notice && <div style={{ marginTop: 16 }}><Banner t={t} kind="success">{notice}</Banner></div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
            {isSignup && (
              <div>
                <FieldLabel t={t}>Display name</FieldLabel>
                <TextInput t={t} value={name} onChange={setName} placeholder="e.g. Marko Halim" />
              </div>
            )}
            <div>
              <FieldLabel t={t}>Email</FieldLabel>
              <TextInput t={t} value={email} onChange={setEmail} placeholder="you@domain.com" type="email" />
            </div>
            <div onKeyDown={onKey}>
              <FieldLabel t={t} hint={!isSignup && <a href="#" onClick={e => e.preventDefault()} style={{ color: t.muted, textDecoration: 'none' }}>Forgot?</a>}>
                {isSignup ? 'Choose a password' : 'Password'}
              </FieldLabel>
              <TextInput t={t} value={password} onChange={setPassword}
                type={showPw ? 'text' : 'password'}
                placeholder={isSignup ? 'Min 12 characters' : ''}
                suffix={
                  <span onClick={() => setShowPw(s => !s)} style={{ cursor: 'pointer', display: 'flex' }}>
                    <Icon name={showPw ? 'eyeoff' : 'eye'} size={14} color={t.muted} />
                  </span>
                } />
            </div>

            {err && <Banner t={t} kind="error">{err}</Banner>}

            <Button t={t} kind="primary" fullWidth size="lg" icon={isSignup ? 'plus' : 'arrowR'} onClick={submit} disabled={busy}>
              {busy ? 'Please wait…' : (isSignup ? 'Create my ledger' : 'Sign in to ledger')}
            </Button>
          </div>

          <p style={{ marginTop: 28, fontSize: 11.5, color: t.muted, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="lock" size={11} color={t.muted} />
            Auth via Supabase. Postgres RLS scopes every row to its owner.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Edit modal ────────────────────────────────────────────────────────────
function EditModal({ t, dark, row, onClose, onSave, onDelete, busy }) {
  return (
    <div className="ledger-root" style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: dark ? 'rgba(8,10,14,0.6)' : 'rgba(15,17,22,0.35)', backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(480px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 48px)', overflow: 'auto',
        background: t.surface, border: `1px solid ${t.borderStrong}`, borderRadius: 16,
        boxShadow: '0 32px 80px rgba(0,0,0,0.45)', color: t.text,
      }}>
        <div style={{ padding: '20px 22px', borderBottom: `1px solid ${t.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: t.surface, zIndex: 1 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.muted, letterSpacing: 0.08, textTransform: 'uppercase' }}>Edit transaction</span>
            <h2 style={{ margin: '4px 0 0', fontSize: 19, fontWeight: 600, color: t.text, letterSpacing: -0.3 }}>#{row.id}</h2>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: t.inset, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.muted }}>
            <Icon name="close" size={14} />
          </button>
        </div>
        <div style={{ padding: 22 }}>
          <EntryForm t={t} dark={dark} initial={row} onSubmit={onSave} onDelete={onDelete} busy={busy} submitLabel="Save changes" />
        </div>
      </div>
    </div>
  );
}

// ─── Settings popover ──────────────────────────────────────────────────────
function SettingsMenu({ t, dark, settings, setSettings }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} title="Settings" style={{
        width: 36, height: 36, borderRadius: 8, background: t.elevated, border: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textSoft,
      }}>
        <Icon name="sparkle" size={15} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 220, background: t.surface, border: `1px solid ${t.borderStrong}`, borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.4)', padding: 14, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: t.muted, letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 8 }}>Appearance</div>
            <Checkbox t={t} checked={dark} onChange={v => setSettings(s => ({ ...s, dark: v }))} label="Dark mode" />
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: t.muted, letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 8 }}>Table density</div>
            <Segment t={t} value={settings.density} onChange={v => setSettings(s => ({ ...s, density: v }))}
              options={[{ value: 'compact', label: 'Compact' }, { value: 'regular', label: 'Regular' }, { value: 'comfy', label: 'Comfy' }]} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────
function EmptyHero({ t, dark }) {
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: '52px 32px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 22, textAlign: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ width: 80, height: 80, borderRadius: 20, background: t.accentSoft, border: `1px solid ${t.accentLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="chart" size={32} color={t.accent} strokeWidth={1.5} />
      </div>
      <div style={{ maxWidth: 520 }}>
        <h2 className="ledger-serif" style={{ margin: 0, fontSize: 34, lineHeight: 1.1, color: t.text, fontWeight: 400, letterSpacing: -0.4 }}>
          A blank ledger. The most honest kind.
        </h2>
        <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.55, color: t.muted }}>
          Use the form on the left to log today&apos;s coffee, last week&apos;s invoice, or that
          rent transfer you haven&apos;t reconciled. Your KPIs and charts appear here as soon as you do.
        </p>
      </div>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
function Dashboard({ t, dark, session, settings, setSettings, onLogout }) {
  const user = session.user;
  const meta = user.user_metadata || {};
  const displayName = meta.display_name || user.email;
  const initials = (meta.display_name || user.email || '?').slice(0, 2).toUpperCase();

  const [rows, setRows] = useState(null);   // null = loading
  const [loadErr, setLoadErr] = useState(null);
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [month, setMonth] = useState(null);

  const flash = (kind, msg) => { setBanner({ kind, msg }); setTimeout(() => setBanner(null), 3500); };

  const load = useCallback(async () => {
    if (!db) { setRows([]); return; }
    setLoadErr(null);
    const { data, error } = await db
      .from('transactions').select('*')
      .order('date', { ascending: false }).order('id', { ascending: false });
    if (error) { setLoadErr(error.message); setRows([]); return; }
    setRows(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Months present, current selection, and the slice the dashboard shows.
  const months = useMemo(() => {
    if (!rows) return [];
    return [...new Set(rows.map(r => monthKey(r.date)))].sort().reverse();
  }, [rows]);
  const curMonth = month || months[0] || monthKey(new Date().toISOString());
  const monthRows = useMemo(() => (rows || []).filter(r => monthKey(r.date) === curMonth), [rows, curMonth]);
  const prevMonthKey = months[months.indexOf(curMonth) + 1];
  const prevRows = useMemo(() => (rows || []).filter(r => monthKey(r.date) === prevMonthKey), [rows, prevMonthKey]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return monthRows;
    return monthRows.filter(r =>
      (r.vendor_location || '').toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q) ||
      (r.type || '').toLowerCase().includes(q));
  }, [monthRows, query]);

  // ── CRUD handlers ──
  const addTxn = async (fields) => {
    if (!db) { flash('error', 'Supabase isn’t connected.'); return; }
    setBusy(true);
    const { error } = await db.from('transactions').insert({ ...fields, user_id: user.id });
    setBusy(false);
    if (error) { flash('error', error.message); return; }
    flash('success', 'Transaction saved.');
    setMonth(monthKey(fields.date));
    load();
  };

  const saveTxn = async (fields) => {
    if (!editing) return;
    setBusy(true);
    const { error } = await db.from('transactions').update(fields).eq('id', editing.id);
    setBusy(false);
    if (error) { flash('error', error.message); return; }
    flash('success', 'Transaction updated.');
    setEditing(null);
    load();
  };

  const deleteTxn = async () => {
    if (!editing) return;
    setBusy(true);
    const { error } = await db.from('transactions').delete().eq('id', editing.id);
    setBusy(false);
    if (error) { flash('error', error.message); return; }
    flash('success', 'Transaction deleted.');
    setEditing(null);
    load();
  };

  const exportCSV = () => {
    const csv = toCSV(rows || []);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const loading = rows === null;
  const empty = rows && rows.length === 0;

  return (
    <div className="ledger-root" style={{ width: '100%', minHeight: '100vh', display: 'flex', background: t.bg, color: t.text }}>
      <Sidebar t={t} user={{ name: displayName, email: user.email, initials }} onLogout={onLogout}>
        <SidebarSection t={t} label="New transaction">
          <EntryForm t={t} dark={dark} onSubmit={addTxn} busy={busy} />
        </SidebarSection>
      </Sidebar>

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar t={t} title={months.length ? monthLabel(curMonth) : 'Your ledger'}
          subtitle={loading ? 'Loading…' : `${monthRows.length} transaction${monthRows.length === 1 ? '' : 's'} · ${displayName}`}
          right={
            <>
              {months.length > 1 && (
                <div style={{ width: 150 }}>
                  <Select t={t} value={curMonth} onChange={setMonth}
                    options={months.map(m => ({ value: m, label: monthLabel(m) }))} />
                </div>
              )}
              <Button t={t} kind="secondary" icon="download" size="sm" onClick={exportCSV} disabled={empty}>Export CSV</Button>
              <SettingsMenu t={t} dark={dark} settings={settings} setSettings={setSettings} />
            </>
          } />

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 32px 28px' }}>
          {banner && <Banner t={t} kind={banner.kind} onClose={() => setBanner(null)}>{banner.msg}</Banner>}
          {loadErr && <Banner t={t} kind="error">{loadErr}</Banner>}
          {!CONFIGURED && <Banner t={t} kind="error">Demo mode — connect Supabase in config.js to load and save real data.</Banner>}

          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: t.muted }}>Loading your ledger…</div>
          ) : empty ? (
            <EmptyHero t={t} dark={dark} />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 2px -4px' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Overview</span>
                <Segment t={t} value={settings.ccyMode} onChange={v => setSettings(s => ({ ...s, ccyMode: v }))}
                  options={[{ value: 'both', label: 'Both' }, { value: 'usd', label: 'USD' }, { value: 'idr', label: 'IDR' }]} />
              </div>
              <KPIRow t={t} dark={dark} rows={monthRows} prev={aggregateRows(prevRows)} ccyMode={settings.ccyMode} />
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '6px 2px 12px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Insights</span>
                  <span style={{ fontSize: 11.5, color: t.muted }}>{monthLabel(curMonth)}{prevMonthKey ? ` · vs ${monthLabel(prevMonthKey)}` : ''}</span>
                </div>
                <InsightsBand t={t} dark={dark} rows={monthRows} ccyMode={settings.ccyMode} />
              </div>
              <TransactionTable t={t} dark={dark} rows={visibleRows} density={settings.density}
                query={query} onQueryChange={setQuery} onExport={exportCSV}
                onRowClick={setEditing} total={monthRows.length} />
            </>
          )}
        </div>
      </main>

      {editing && (
        <EditModal t={t} dark={dark} row={editing} busy={busy}
          onClose={() => setEditing(null)} onSave={saveTxn} onDelete={deleteTxn} />
      )}
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────
function loadSettings() {
  try { return JSON.parse(localStorage.getItem('ledger:settings')) || {}; } catch { return {}; }
}

function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!CONFIGURED);  // if unconfigured, no auth to wait for
  const [settings, setSettingsRaw] = useState(() => ({
    dark: true, ccyMode: 'both', density: 'regular', ...loadSettings(),
  }));
  const setSettings = (upd) => setSettingsRaw(s => {
    const next = typeof upd === 'function' ? upd(s) : { ...s, ...upd };
    try { localStorage.setItem('ledger:settings', JSON.stringify(next)); } catch {}
    return next;
  });

  const t = useTokens(settings.dark);

  // Restore session + subscribe to auth changes.
  useEffect(() => {
    if (!db) { setReady(true); return; }
    db.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = db.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const logout = async () => {
    if (db) { try { await db.auth.signOut(); } catch {} }
    setSession(null);
  };

  // Keep the page background in sync with the theme.
  useEffect(() => { document.body.style.background = t.bg; }, [t.bg]);

  if (!ready) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, color: t.muted, fontFamily: 'system-ui' }}>Loading…</div>;
  }

  return session
    ? <Dashboard t={t} dark={settings.dark} session={session} settings={settings} setSettings={setSettings} onLogout={logout} />
    : <AuthScreen t={t} dark={settings.dark} onAuthed={setSession} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
