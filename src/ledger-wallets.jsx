// ledger-wallets.jsx
// Indonesian e-wallet "pockets" layered on top of the main ledger.
//
// Model — a top-up is a single `Transfer` row (money leaving the main account,
// landing in a wallet). A wallet's balance therefore stays in sync with the
// main account automatically: top-ups credit it, wallet expenses debit it.
//
//   walletBalance = Σ(top-ups) + Σ(wallet income) − Σ(wallet expense)
//   mainBalance   = Σ(main income) − Σ(main expense) − Σ(all top-ups)

// ─── Wallet registry (brand-coloured) ───────────────────────────────────────
const WALLETS = [
  { id: 'gopay',     name: 'GoPay',     mono: 'G', color: '#00AAD2', ink: '#04222a', tag: 'Gojek' },
  { id: 'ovo',       name: 'OVO',       mono: 'O', color: '#4C2A86', ink: '#ffffff', tag: 'Grab · Tokopedia' },
  { id: 'dana',      name: 'DANA',      mono: 'd', color: '#108EE9', ink: '#ffffff', tag: 'Everyday' },
  { id: 'shopeepay', name: 'ShopeePay', mono: 'S', color: '#EE4D2D', ink: '#ffffff', tag: 'Shopee' },
  { id: 'linkaja',   name: 'LinkAja',   mono: 'L', color: '#E2231A', ink: '#ffffff', tag: 'Bills · Transit' },
];
const WALLET_BY_ID = Object.fromEntries(WALLETS.map(w => [w.id, w]));

// ─── Row partitioning + balances ─────────────────────────────────────────────
const isTransfer = (r) => r.type === 'Transfer';

// Rows shown in the MAIN ledger: main income/expense + every top-up (outflow).
function mainLedgerRows(rows) {
  return rows.filter(r => isTransfer(r) || !r.wallet_id);
}
// Only true income/expense on the main account (feeds KPIs + insights).
function mainCashRows(rows) {
  return rows.filter(r => !r.wallet_id && !isTransfer(r));
}
// Everything tied to one wallet: its top-ups (credits) + its taps (debits).
function walletLedgerRows(rows, id) {
  return rows.filter(r => r.wallet_id === id);
}

function walletBalance(rows, id) {
  return walletLedgerRows(rows, id).reduce((s, r) => {
    if (isTransfer(r) || r.type === 'Income') return s + Number(r.amount || 0);
    return s - Number(r.amount || 0);
  }, 0);
}
function walletToppedUp(rows, id) {
  return walletLedgerRows(rows, id).filter(isTransfer)
    .reduce((s, r) => s + Number(r.amount || 0), 0);
}
function walletSpent(rows, id) {
  return walletLedgerRows(rows, id).filter(r => r.type === 'Expense')
    .reduce((s, r) => s + Number(r.amount || 0), 0);
}
function mainBalance(rows) {
  const bal = { IDR: 0, USD: 0 };
  rows.forEach(r => {
    const a = Number(r.amount || 0);
    if (isTransfer(r)) bal[r.currency] -= a;              // leaves the main account
    else if (!r.wallet_id) bal[r.currency] += (r.type === 'Income' ? a : -a);
  });
  return bal;
}

// ─── Brand mark ──────────────────────────────────────────────────────────────
function WalletMark({ wallet, size = 40, radius }) {
  const r = radius != null ? radius : Math.round(size * 0.3);
  return (
    <div style={{
      width: size, height: size, borderRadius: r, background: wallet.color, color: wallet.ink,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: Math.round(size * 0.44), lineHeight: 1, letterSpacing: -0.5,
      flexShrink: 0, boxShadow: `0 4px 14px ${wallet.color}40`,
    }}>{wallet.mono}</div>
  );
}

function RpAmount({ value, t, size = 'md', color }) {
  const f = fmtMoney(Math.abs(value), 'IDR', { compact: false });
  const sizes = { sm: [11, 15], md: [13, 22], lg: [15, 34], xl: [17, 44] }[size];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
      <span className="ledger-mono" style={{ fontSize: sizes[0], color: t.muted, fontWeight: 500 }}>Rp</span>
      <span className="ledger-serif" style={{ fontSize: sizes[1], color: color || t.text, lineHeight: 1, fontWeight: 400 }}>
        {value < 0 ? '−' : ''}{f.whole}
      </span>
    </span>
  );
}

// ─── Wallet card (overview grid) ─────────────────────────────────────────────
function WalletCard({ t, dark, wallet, rows, onOpen }) {
  const bal = walletBalance(rows, wallet.id);
  const topped = walletToppedUp(rows, wallet.id);
  const spent = walletSpent(rows, wallet.id);
  const taps = walletLedgerRows(rows, wallet.id).filter(r => r.type === 'Expense').length;
  const usedPct = topped > 0 ? Math.min(100, (spent / topped) * 100) : 0;

  return (
    <button onClick={onOpen} style={{
      textAlign: 'left', cursor: 'pointer', font: 'inherit',
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16,
      padding: 0, overflow: 'hidden', position: 'relative',
      display: 'flex', flexDirection: 'column',
      transition: 'transform .14s, border-color .14s, box-shadow .14s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = wallet.color + '88'; e.currentTarget.style.boxShadow = `0 18px 40px rgba(0,0,0,0.28)`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = 'none'; }}>
      {/* brand wash */}
      <div style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, background: `radial-gradient(circle, ${wallet.color}33, transparent 68%)`, pointerEvents: 'none' }} />
      <div style={{ padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <WalletMark wallet={wallet} size={42} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: t.text, letterSpacing: -0.2 }}>{wallet.name}</div>
            <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{wallet.tag}</div>
          </div>
          <span style={{ color: t.dim, display: 'flex' }}><Icon name="arrowR" size={16} color={t.dim} /></span>
        </div>

        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: t.muted, letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 4 }}>Balance</div>
          <RpAmount value={bal} t={t} size="lg" color={bal <= 0 ? t.expense : t.text} />
        </div>

        {/* used bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 6, borderRadius: 3, background: t.inset, overflow: 'hidden' }}>
            <div style={{ width: `${usedPct}%`, height: '100%', borderRadius: 3, background: wallet.color, opacity: 0.9 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.muted }}>
            <span className="ledger-mono">{usedPct.toFixed(0)}% spent</span>
            <span className="ledger-mono">{taps} tap{taps === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', borderTop: `1px solid ${t.divider}` }}>
        <div style={{ flex: 1, padding: '10px 14px', borderRight: `1px solid ${t.divider}` }}>
          <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.06 }}>Topped up</div>
          <div className="ledger-mono" style={{ fontSize: 12.5, color: t.income, fontWeight: 600, marginTop: 2 }}>Rp {fmtMoney(topped, 'IDR').whole}</div>
        </div>
        <div style={{ flex: 1, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.06 }}>Spent</div>
          <div className="ledger-mono" style={{ fontSize: 12.5, color: t.textSoft, fontWeight: 600, marginTop: 2 }}>Rp {fmtMoney(spent, 'IDR').whole}</div>
        </div>
      </div>
    </button>
  );
}

// ─── Pockets overview screen ─────────────────────────────────────────────────
function PocketsScreen({ t, dark, rows, onOpen, onTopUp }) {
  const main = mainBalance(rows);
  const inPockets = WALLETS.reduce((s, w) => s + walletBalance(rows, w.id), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Main account banner */}
      <div style={{
        background: dark
          ? `radial-gradient(circle at 12% 20%, ${t.accentSoft}, transparent 60%), ${t.surface}`
          : `radial-gradient(circle at 12% 20%, ${t.accentSoft}, transparent 60%), ${t.surface}`,
        border: `1px solid ${t.border}`, borderRadius: 16, padding: '22px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
            <LedgerMark size={20} t={t} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: t.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>Main account · available</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
            <RpAmount value={main.IDR} t={t} size="xl" color={t.accent} />
            <span className="ledger-mono" style={{ fontSize: 15, color: t.textSoft }}>
              + ${Math.abs(main.USD).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10.5, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.06 }}>In pockets</div>
            <div className="ledger-mono" style={{ fontSize: 16, fontWeight: 600, color: t.text, marginTop: 3 }}>Rp {fmtMoney(inPockets, 'IDR').whole}</div>
          </div>
          <Button t={t} kind="primary" icon="topup" onClick={() => onTopUp(null)}>Top up a pocket</Button>
        </div>
      </div>

      {/* Section label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 2px -2px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Your pockets</span>
        <span style={{ fontSize: 11.5, color: t.muted }}>{WALLETS.length} wallets · taps draw down their balance</span>
      </div>

      {/* Wallet grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {WALLETS.map(w => (
          <WalletCard key={w.id} t={t} dark={dark} wallet={w} rows={rows} onOpen={() => onOpen(w.id)} />
        ))}
      </div>
    </div>
  );
}

// ─── Wallet detail header (stat band) ────────────────────────────────────────
function WalletStat({ t, label, children, accent }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: t.muted, letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function WalletDetailView({ t, dark, wallet, rows, density, onRowClick, onExport, onTopUp }) {
  const ledger = walletLedgerRows(rows, wallet.id);
  const bal = walletBalance(rows, wallet.id);
  const topped = walletToppedUp(rows, wallet.id);
  const spent = walletSpent(rows, wallet.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(120deg, ${wallet.color}22, transparent 55%), ${t.surface}`,
        border: `1px solid ${t.border}`, borderRadius: 16, padding: '20px 22px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <WalletMark wallet={wallet} size={54} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: t.text, letterSpacing: -0.3 }}>{wallet.name}</div>
            <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{ledger.filter(r => r.type === 'Expense').length} taps · IDR pocket</div>
          </div>
        </div>
        <Button t={t} kind="primary" icon="topup" onClick={() => onTopUp(wallet.id)}>Top up {wallet.name}</Button>
      </div>

      {/* Stat band */}
      <div style={{ display: 'flex', gap: 14 }}>
        <WalletStat t={t} label="Current balance"><RpAmount value={bal} t={t} size="lg" color={bal <= 0 ? t.expense : t.accent} /></WalletStat>
        <WalletStat t={t} label="Topped up"><RpAmount value={topped} t={t} size="lg" color={t.income} /></WalletStat>
        <WalletStat t={t} label="Spent"><RpAmount value={spent} t={t} size="lg" color={t.textSoft} /></WalletStat>
      </div>

      {/* Ledger */}
      <FilteredTable t={t} dark={dark} rows={ledger} context="wallet" density={density}
        ccyMode="idr" onRowClick={onRowClick} onExport={onExport} />
    </div>
  );
}

Object.assign(window, {
  WALLETS, WALLET_BY_ID, isTransfer,
  mainLedgerRows, mainCashRows, walletLedgerRows,
  walletBalance, walletToppedUp, walletSpent, mainBalance,
  WalletMark, RpAmount, WalletCard, PocketsScreen, WalletDetailView,
});
