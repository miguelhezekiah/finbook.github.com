// ledger-kpi.jsx
// The three big editorial KPI cards. Numerals are set in Instrument Serif at
// ~64px so they feel like print, not like a Bloomberg terminal. The deltas
// vs last period sit beneath in small tabular mono.

// One KPI card — handles both split-currency and converted display modes.
function KPICard({ t, dark, label, totals, prev, kind, ccyMode }) {
  // kind: 'income' | 'expense' | 'net'
  // ccyMode: 'both' | 'usd' | 'idr'
  const accentColor = kind === 'income' ? t.income
                    : kind === 'expense' ? t.expense
                    : t.text;

  // Compute the figures we'll render.
  let primary, secondary, deltaPct;
  if (ccyMode === 'both') {
    // Two-line stacked: IDR primary, USD secondary (or whichever is larger).
    primary   = { currency: 'IDR', value: totals.IDR, prev: prev.IDR };
    secondary = { currency: 'USD', value: totals.USD, prev: prev.USD };
    // Delta uses the *combined* USD-equivalent so split vs converted give
    // the same delta number.
    const cur = toUSD(totals.IDR, 'IDR') + toUSD(totals.USD, 'USD');
    const pre = toUSD(prev.IDR,   'IDR') + toUSD(prev.USD,   'USD');
    deltaPct = pre === 0 ? null : ((cur - pre) / Math.abs(pre)) * 100;
  } else {
    const ccy = ccyMode.toUpperCase();
    const cur = ccy === 'USD'
      ? toUSD(totals.IDR, 'IDR') + toUSD(totals.USD, 'USD')
      : totals.IDR + totals.USD * FX.IDR_PER_USD;
    const pre = ccy === 'USD'
      ? toUSD(prev.IDR, 'IDR') + toUSD(prev.USD, 'USD')
      : prev.IDR + prev.USD * FX.IDR_PER_USD;
    primary = { currency: ccy, value: cur, prev: pre };
    secondary = null;
    deltaPct = pre === 0 ? null : ((cur - pre) / Math.abs(pre)) * 100;
  }

  // For "Net Cash Flow" we want delta to mean "improved" / "worsened", not just %.
  let deltaLabel = '';
  let deltaColor = t.muted;
  if (deltaPct !== null && Number.isFinite(deltaPct)) {
    const sign = deltaPct > 0 ? '+' : '';
    deltaLabel = `${sign}${deltaPct.toFixed(1)}%`;
    if (kind === 'income' || kind === 'net') {
      deltaColor = deltaPct > 0 ? t.income : deltaPct < 0 ? t.expense : t.muted;
    } else { // expense: down is good
      deltaColor = deltaPct < 0 ? t.income : deltaPct > 0 ? t.expense : t.muted;
    }
  }

  const formatted = fmtMoney(primary.value, primary.currency, { compact: true });
  const formattedSec = secondary ? fmtMoney(secondary.value, secondary.currency, { compact: true }) : null;

  // Mini bar series — last 8 days, fictional but bounded — gives an
  // editorial chart hint without a full chart.
  const series = React.useMemo(
    () => Array.from({ length: 14 }, (_, i) =>
      0.3 + 0.7 * Math.abs(Math.sin((i + (kind.charCodeAt(0) % 5)) * 0.85))),
    [kind],
  );

  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: t.surface, border: `1px solid ${t.border}`,
      borderRadius: 14, padding: '20px 22px 18px',
      display: 'flex', flexDirection: 'column', gap: 14,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: t.muted,
          letterSpacing: 0.08, textTransform: 'uppercase',
        }}>{label}</span>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: accentColor, boxShadow: `0 0 0 3px ${kind === 'income' ? t.incomeSoft : kind === 'expense' ? t.expenseSoft : t.chipBg}`,
        }} />
      </div>

      {/* Numeral */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 14, fontWeight: 500, color: t.muted,
          alignSelf: 'flex-start', marginTop: 14,
        }} className="ledger-mono">{primary.currency === 'IDR' ? 'Rp' : '$'}</span>
        <span className="ledger-serif" style={{
          fontSize: 56, lineHeight: 1, color: accentColor,
          fontWeight: 400,
          marginRight: 2,
        }}>
          {kind === 'net' && primary.value < 0 ? '−' : ''}{formatted.whole}
        </span>
        {formatted.frac && (
          <span className="ledger-serif" style={{
            fontSize: 32, lineHeight: 1, color: t.muted, fontWeight: 400,
          }}>{formatted.frac}</span>
        )}
      </div>

      {/* Secondary currency (split mode only) */}
      {formattedSec && (
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
          fontSize: 13, color: t.textSoft, marginTop: -8,
        }} className="ledger-mono">
          <span style={{ color: t.muted }}>+ {formattedSec.symbol}</span>
          <span>{kind === 'net' && secondary.value < 0 ? '−' : ''}{formattedSec.whole}{formattedSec.frac}</span>
        </div>
      )}

      {/* Delta + sparkbars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginTop: 2 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 11, color: t.muted }}>vs last period</span>
          <span className="ledger-mono" style={{ fontSize: 13, fontWeight: 600, color: deltaColor }}>
            {deltaLabel || '—'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 28 }}>
          {series.map((v, i) => (
            <span key={i} style={{
              width: 3, height: `${v * 100}%`, borderRadius: 1,
              background: i === series.length - 1 ? accentColor : t.borderStrong,
              opacity: i === series.length - 1 ? 1 : 0.55,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function KPIRow({ t, dark, rows, prev, ccyMode }) {
  const agg = aggregate(rows);
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <KPICard t={t} dark={dark} label="Total income"     totals={agg.income}  prev={prev.income}  kind="income"  ccyMode={ccyMode} />
      <KPICard t={t} dark={dark} label="Total expenses"   totals={agg.expense} prev={prev.expense} kind="expense" ccyMode={ccyMode} />
      <KPICard t={t} dark={dark} label="Net cash flow"    totals={agg.net}     prev={{ USD: prev.income.USD - prev.expense.USD, IDR: prev.income.IDR - prev.expense.IDR }} kind="net" ccyMode={ccyMode} />
    </div>
  );
}

Object.assign(window, { KPICard, KPIRow });
