// ledger-charts.jsx
// The "Insights" band that sits between the KPI cards and the transaction
// table. Three coordinated panels — cash-flow over time, a category
// breakdown, and a savings-rate gauge — all driven off the same rows so the
// numbers reconcile with the table. Charts are data-viz SVG/CSS, drawn in the
// chosen display currency (USD by default; IDR when the KPI tweak is set to
// IDR) so everything shares one unit.

// Convert any row's native amount into the chart's display currency.
function toDisp(amount, srcCcy, dispCcy) {
  if (srcCcy === dispCcy) return amount;
  if (dispCcy === 'USD') return toUSD(amount, srcCcy);
  // dispCcy === 'IDR'
  return srcCcy === 'IDR' ? amount : amount * FX.IDR_PER_USD;
}

// Compact axis label for the display currency.
function axisLabel(v, ccy) {
  const a = Math.abs(v);
  if (ccy === 'IDR') {
    if (a >= 1e9) return `${(v/1e9).toFixed(1)}B`;
    if (a >= 1e6) return `${(v/1e6).toFixed(0)}M`;
    if (a >= 1e3) return `${(v/1e3).toFixed(0)}k`;
    return `${v.toFixed(0)}`;
  }
  if (a >= 1e6) return `${(v/1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v/1e3).toFixed(0)}k`;
  return `${v.toFixed(0)}`;
}

// ─── Panel shell ───────────────────────────────────────────────────────────
function Panel({ t, title, right, children, style }) {
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`,
      borderRadius: 14, padding: '18px 20px 16px',
      display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0,
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: t.muted, letterSpacing: 0.08, textTransform: 'uppercase' }}>{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

// ─── Cash-flow chart — income above / expense below a zero baseline, with a
//     cumulative running-balance line overlaid in lime. ────────────────────
function CashFlowPanel({ t, dark, rows, dispCcy }) {
  const data = React.useMemo(() => {
    // Bucket by date (ascending).
    const byDate = {};
    rows.forEach(r => {
      const v = toDisp(r.amount, r.currency, dispCcy);
      const b = (byDate[r.date] ||= { date: r.date, income: 0, expense: 0 });
      if (r.type === 'Income') b.income += v; else b.expense += v;
    });
    const days = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    let run = 0;
    days.forEach(d => { run += d.income - d.expense; d.balance = run; });
    return days;
  }, [rows, dispCcy]);

  const W = 560, H = 150, padX = 8, midGap = 16;
  const topH = (H - midGap) * 0.56;      // income region
  const botH = (H - midGap) * 0.44;      // expense region
  const baseY = topH + midGap / 2;
  const maxBar = Math.max(1, ...data.map(d => Math.max(d.income, d.expense)));
  const n = data.length;
  const slot = (W - padX * 2) / n;
  const barW = Math.min(18, slot * 0.46);

  // Balance line points
  const balVals = data.map(d => d.balance);
  const balMin = Math.min(0, ...balVals), balMax = Math.max(1, ...balVals);
  const balY = (v) => {
    const tnorm = (v - balMin) / (balMax - balMin || 1);
    return H - tnorm * (H - 12) - 6;
  };
  const cx = (i) => padX + slot * i + slot / 2;
  const linePts = data.map((d, i) => `${cx(i)},${balY(d.balance).toFixed(1)}`).join(' ');

  const totalIn = data.reduce((s, d) => s + d.income, 0);
  const totalOut = data.reduce((s, d) => s + d.expense, 0);

  return (
    <Panel t={t} title="Cash flow · May"
      right={
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {[['Income', t.income], ['Expense', t.expense], ['Balance', t.accent]].map(([l, c]) => (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: t.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
            </span>
          ))}
        </div>
      }
      style={{ flex: '2 1 0', position: 'relative', overflow: 'hidden' }}>
      {/* subtle accent glow top-right */}
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 160, height: 160,
        background: `radial-gradient(circle, ${t.accentSoft}, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block', position: 'relative' }}>
        <defs>
          <linearGradient id="balfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.accent} stopOpacity="0.25" />
            <stop offset="100%" stopColor={t.accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* zero baseline */}
        <line x1={padX} y1={baseY} x2={W - padX} y2={baseY} stroke={t.border} strokeWidth="1" />
        {/* bars */}
        {data.map((d, i) => {
          const ih = (d.income / maxBar) * topH;
          const eh = (d.expense / maxBar) * botH;
          const x = cx(i) - barW / 2;
          return (
            <g key={i}>
              {d.income > 0 && <rect x={x} y={baseY - ih} width={barW} height={ih} rx="2.5" fill={t.income} opacity="0.9" />}
              {d.expense > 0 && <rect x={x} y={baseY} width={barW} height={eh} rx="2.5" fill={t.expense} opacity="0.85" />}
            </g>
          );
        })}
        {/* balance area + line */}
        <polygon points={`${cx(0)},${H} ${linePts} ${cx(n-1)},${H}`} fill="url(#balfill)" />
        <polyline points={linePts} fill="none" stroke={t.accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => <circle key={i} cx={cx(i)} cy={balY(d.balance)} r="2.4" fill={t.bg} stroke={t.accent} strokeWidth="1.5" />)}
      </svg>

      {/* footer totals */}
      <div style={{ display: 'flex', gap: 24, marginTop: 2 }}>
        <Stat t={t} label="In" value={`${dispCcy === 'IDR' ? 'Rp' : '$'}${axisLabel(totalIn, dispCcy)}`} color={t.income} />
        <Stat t={t} label="Out" value={`${dispCcy === 'IDR' ? 'Rp' : '$'}${axisLabel(totalOut, dispCcy)}`} color={t.expense} />
        <Stat t={t} label="Net" value={`${dispCcy === 'IDR' ? 'Rp' : '$'}${axisLabel(totalIn - totalOut, dispCcy)}`} color={t.accent} />
        <div style={{ flex: 1 }} />
        <span style={{ alignSelf: 'flex-end', fontSize: 10.5, color: t.dim }} className="ledger-mono">
          ≈ {dispCcy}{dispCcy !== 'IDR' ? ' · FX 16,400' : ''}
        </span>
      </div>
    </Panel>
  );
}

function Stat({ t, label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10.5, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.06 }}>{label}</span>
      <span className="ledger-mono" style={{ fontSize: 14, fontWeight: 600, color: color || t.text }}>{value}</span>
    </div>
  );
}

// ─── Category breakdown — horizontal bars of expense share. ────────────────
function CategoryPanel({ t, dark, rows, dispCcy }) {
  const cats = React.useMemo(() => {
    const sums = {};
    rows.filter(r => r.type === 'Expense').forEach(r => {
      sums[r.category] = (sums[r.category] || 0) + toDisp(r.amount, r.currency, dispCcy);
    });
    const arr = Object.entries(sums).map(([cat, v]) => ({ cat, v })).sort((a, b) => b.v - a.v);
    const total = arr.reduce((s, x) => s + x.v, 0) || 1;
    return { arr: arr.slice(0, 6), total, max: arr.length ? arr[0].v : 1 };
  }, [rows, dispCcy]);

  return (
    <Panel t={t} title="Where it goes" style={{ flex: '1 1 0' }}
      right={<span style={{ fontSize: 11, color: t.muted }} className="ledger-mono">{cats.arr.length} categories</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {cats.arr.map(({ cat, v }) => {
          const pct = (v / cats.total) * 100;
          const w = (v / cats.max) * 100;
          const color = categoryColor(cat, dark);
          return (
            <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <span style={{ color, fontSize: 12 }}>{(CATEGORY_PALETTE[cat] || CATEGORY_PALETTE.Other).glyph}</span>
                  <span style={{ fontSize: 12.5, color: t.textSoft, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                </span>
                <span className="ledger-mono" style={{ fontSize: 11.5, color: t.muted, flexShrink: 0 }}>{pct.toFixed(0)}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: t.inset, overflow: 'hidden' }}>
                <div style={{ width: `${w}%`, height: '100%', borderRadius: 3, background: color, opacity: 0.85 }} />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── Savings-rate gauge — radial ring. ─────────────────────────────────────
function SavingsPanel({ t, dark, rows, dispCcy }) {
  const { rate, saved, income } = React.useMemo(() => {
    let inc = 0, exp = 0;
    rows.forEach(r => {
      const v = toDisp(r.amount, r.currency, dispCcy);
      if (r.type === 'Income') inc += v; else exp += v;
    });
    return { rate: inc > 0 ? (inc - exp) / inc : 0, saved: inc - exp, income: inc };
  }, [rows, dispCcy]);

  const R = 46, C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(1, rate));
  const dash = C * pct;

  return (
    <Panel t={t} title="Savings rate" style={{ flex: '0 0 200px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0 2px' }}>
        <div style={{ position: 'relative', width: 120, height: 120 }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={R} fill="none" stroke={t.inset} strokeWidth="10" />
            <circle cx="60" cy="60" r={R} fill="none" stroke={t.accent} strokeWidth="10"
              strokeLinecap="round" strokeDasharray={`${dash} ${C}`}
              transform="rotate(-90 60 60)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span className="ledger-serif" style={{ fontSize: 34, color: t.text, lineHeight: 1 }}>{Math.round(rate * 100)}%</span>
            <span style={{ fontSize: 10.5, color: t.muted, marginTop: 2 }}>of income kept</span>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="ledger-mono" style={{ fontSize: 14, fontWeight: 600, color: t.accent }}>
            {dispCcy === 'IDR' ? 'Rp' : '$'}{axisLabel(saved, dispCcy)}
          </div>
          <div style={{ fontSize: 10.5, color: t.muted, marginTop: 2 }}>net saved this month</div>
        </div>
      </div>
    </Panel>
  );
}

// ─── The band ──────────────────────────────────────────────────────────────
function InsightsBand({ t, dark, rows, ccyMode }) {
  const dispCcy = ccyMode === 'idr' ? 'IDR' : 'USD';
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
      <CashFlowPanel t={t} dark={dark} rows={rows} dispCcy={dispCcy} />
      <CategoryPanel t={t} dark={dark} rows={rows} dispCcy={dispCcy} />
      <SavingsPanel  t={t} dark={dark} rows={rows} dispCcy={dispCcy} />
    </div>
  );
}

Object.assign(window, {
  InsightsBand, CashFlowPanel, CategoryPanel, SavingsPanel, toDisp, axisLabel,
});
