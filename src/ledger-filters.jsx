// ledger-filters.jsx
// Filtering, per-category sums, and sorting — packaged as one reusable
// <FilteredTable> used by both the main ledger and each wallet's ledger.
//
//   • CategoryBreakdown — a panel listing every spending category with its
//     total in the display currency; click chips to filter (multi-select).
//   • FilterPopover     — direction · currency · subscriptions · date range.
//   • Sorting           — every table column is click-to-sort (asc ⇄ desc).

const { useState: useFState, useMemo: useFMemo, useRef: useFRef, useEffect: useFEffect } = React;

// ─── Display-currency helpers ────────────────────────────────────────────────
function dispCcyOf(ccyMode) { return ccyMode === 'idr' ? 'IDR' : 'USD'; }
function fmtDispShort(v, ccy) {
  const f = fmtMoney(v, ccy, { compact: true });
  return `${f.symbol}${f.whole}${f.frac}`;
}

// ─── Pure filter + sort ──────────────────────────────────────────────────────
function applyFilters(rows, f) {
  return rows.filter(r => {
    if (f.cats && f.cats.length && !f.cats.includes(r.category)) return false;
    if (f.direction && f.direction !== 'all' && r.type !== f.direction) return false;
    if (f.currency && f.currency !== 'all' && r.currency !== f.currency) return false;
    if (f.subsOnly && !r.is_subscription) return false;
    if (f.from && r.date < f.from) return false;
    if (f.to && r.date > f.to) return false;
    return true;
  });
}
function sortRows(rows, key, dir) {
  const m = dir === 'asc' ? 1 : -1;
  const val = (r) => {
    switch (key) {
      case 'amount':   return toUSD(Number(r.amount || 0), r.currency);
      case 'vendor':   return (r.vendor_location || '').toLowerCase();
      case 'category': return (r.category || '').toLowerCase();
      case 'type':     return (r.type || '').toLowerCase();
      case 'currency': return (r.currency || '').toLowerCase();
      case 'date':
      default:         return r.date;
    }
  };
  return [...rows].sort((a, b) => {
    const va = val(a), vb = val(b);
    if (va < vb) return -1 * m;
    if (va > vb) return 1 * m;
    return (a.id - b.id) * m;   // stable-ish tiebreak
  });
}
const activeFilterCount = (f) =>
  (f.cats.length ? 1 : 0) + (f.direction !== 'all' ? 1 : 0) +
  (f.currency !== 'all' ? 1 : 0) + (f.subsOnly ? 1 : 0) + (f.from || f.to ? 1 : 0);

// ─── Category breakdown panel ────────────────────────────────────────────────
function CategoryBreakdown({ t, dark, rows, ccyMode, selected, onToggle, onClear }) {
  const ccy = dispCcyOf(ccyMode);
  const cats = useFMemo(() => {
    const sums = {};
    rows.filter(r => r.type === 'Expense').forEach(r => {
      sums[r.category] = (sums[r.category] || 0) + toDisp(Number(r.amount || 0), r.currency, ccy);
    });
    const arr = Object.entries(sums).map(([cat, v]) => ({ cat, v })).sort((a, b) => b.v - a.v);
    const total = arr.reduce((s, x) => s + x.v, 0);
    return { arr, total, max: arr.length ? arr[0].v : 1 };
  }, [rows, ccy]);

  if (!cats.arr.length) return null;
  const selectedTotal = cats.arr.filter(c => selected.includes(c.cat)).reduce((s, c) => s + c.v, 0);
  const shownTotal = selected.length ? selectedTotal : cats.total;

  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: '16px 18px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: t.muted, letterSpacing: 0.08, textTransform: 'uppercase' }}>
          Spend by category
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="ledger-mono" style={{ fontSize: 12, color: t.textSoft, fontWeight: 600 }}>
            {selected.length ? 'Selected ' : 'Total '}{fmtDispShort(shownTotal, ccy)}
          </span>
          {selected.length > 0 && (
            <button onClick={onClear} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0 }}>
              <Icon name="close" size={11} color={t.muted} /> Clear
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
        {cats.arr.map(({ cat, v }) => {
          const on = selected.includes(cat);
          const color = categoryColor(cat, dark);
          const w = (v / cats.max) * 100;
          const glyph = (CATEGORY_PALETTE[cat] || CATEGORY_PALETTE.Other).glyph;
          return (
            <button key={cat} onClick={() => onToggle(cat)} style={{
              textAlign: 'left', cursor: 'pointer', font: 'inherit',
              background: on ? t.accentSoft : t.inset,
              border: `1px solid ${on ? t.accentLine : t.border}`,
              borderRadius: 10, padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 7,
              transition: 'background .12s, border-color .12s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <span style={{ color, fontSize: 12, lineHeight: 1 }}>{glyph}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                </span>
                {on && <Icon name="check" size={11} color={t.accent} strokeWidth={2.6} />}
              </div>
              <div className="ledger-mono" style={{ fontSize: 13, fontWeight: 600, color: t.textSoft }}>{fmtDispShort(v, ccy)}</div>
              <div style={{ height: 4, borderRadius: 2, background: t.surface, overflow: 'hidden' }}>
                <div style={{ width: `${w}%`, height: '100%', borderRadius: 2, background: color, opacity: 0.85 }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Filter popover (direction lives inline; the rest here) ──────────────────
function FilterPopover({ t, dark, f, set, context, lockCurrency }) {
  const [open, setOpen] = useFState(false);
  const ref = useFRef(null);
  useFEffect(() => {
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, []);
  const count = (f.currency !== 'all' ? 1 : 0) + (f.subsOnly ? 1 : 0) + (f.from || f.to ? 1 : 0);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 11px',
        background: count ? t.accentSoft : t.elevated, border: `1px solid ${count ? t.accentLine : t.border}`,
        borderRadius: 8, cursor: 'pointer', color: t.text, fontSize: 12.5, fontWeight: 500, font: 'inherit',
      }}>
        <Icon name="filter" size={14} color={count ? t.accent : t.muted} />
        Filters{count ? ` · ${count}` : ''}
        <Icon name="chev" size={13} color={t.muted} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 268, zIndex: 30,
          background: t.surface, border: `1px solid ${t.borderStrong}`, borderRadius: 12,
          boxShadow: '0 18px 50px rgba(0,0,0,0.42)', padding: 16, display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {!lockCurrency && (
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: t.muted, letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 8 }}>Currency</div>
              <Segment t={t} value={f.currency} onChange={v => set({ currency: v })}
                options={[{ value: 'all', label: 'All' }, { value: 'IDR', label: 'IDR' }, { value: 'USD', label: 'USD' }]} />
            </div>
          )}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: t.muted, letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 8 }}>Date range</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <TextInput t={t} value={f.from} onChange={v => set({ from: v })} type="date" />
              </div>
              <div style={{ flex: 1 }}>
                <TextInput t={t} value={f.to} onChange={v => set({ to: v })} type="date" />
              </div>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${t.divider}`, paddingTop: 12 }}>
            <Checkbox t={t} checked={f.subsOnly} onChange={v => set({ subsOnly: v })}
              label="Subscriptions only" sub="Recurring bills" />
          </div>
          <button onClick={() => set({ currency: 'all', subsOnly: false, from: '', to: '' })}
            style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px', cursor: 'pointer', color: t.muted, fontSize: 12, fontWeight: 500, font: 'inherit' }}>
            Reset these filters
          </button>
        </div>
      )}
    </div>
  );
}

// ─── The reusable filtered + sortable table ──────────────────────────────────
function FilteredTable({ t, dark, rows, context = 'main', density = 'regular', ccyMode = 'both', onRowClick, onExport }) {
  const lockCurrency = context === 'wallet';
  const [cats, setCats] = useFState([]);
  const [direction, setDirection] = useFState('all');
  const [currency, setCurrency] = useFState('all');
  const [subsOnly, setSubsOnly] = useFState(false);
  const [from, setFrom] = useFState('');
  const [to, setTo] = useFState('');
  const [query, setQuery] = useFState('');
  const [sort, setSort] = useFState({ key: 'date', dir: 'desc' });

  const f = { cats, direction, currency: lockCurrency ? 'all' : currency, subsOnly, from, to };
  const setF = (patch) => {
    if ('currency' in patch) setCurrency(patch.currency);
    if ('subsOnly' in patch) setSubsOnly(patch.subsOnly);
    if ('from' in patch) setFrom(patch.from);
    if ('to' in patch) setTo(patch.to);
  };

  const onSort = (key) => setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'date' || key === 'amount' ? 'desc' : 'asc' });

  // Direction options differ for wallet (taps vs top-ups) vs main.
  const dirOptions = context === 'wallet'
    ? [{ value: 'all', label: 'All' }, { value: 'Expense', label: 'Taps' }, { value: 'Transfer', label: 'Top-ups' }]
    : [{ value: 'all', label: 'All' }, { value: 'Income', label: 'Income' }, { value: 'Expense', label: 'Expense' }];

  const filtered = useFMemo(() => {
    let out = applyFilters(rows, f);
    const q = query.trim().toLowerCase();
    if (q) out = out.filter(r =>
      (r.vendor_location || '').toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q) ||
      (r.type || '').toLowerCase().includes(q));
    return sortRows(out, sort.key, sort.dir);
  }, [rows, cats, direction, currency, subsOnly, from, to, query, sort, lockCurrency]);

  const toggleCat = (c) => setCats(cs => cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]);
  const nActive = activeFilterCount(f);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <CategoryBreakdown t={t} dark={dark} rows={rows} ccyMode={ccyMode}
        selected={cats} onToggle={toggleCat} onClear={() => setCats([])} />

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 180, maxWidth: 320 }}>
          <TextInput t={t} value={query} onChange={setQuery}
            placeholder="Search vendor, category…" prefix={<Icon name="search" size={13} color={t.muted} />} />
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ minWidth: 0 }}>
          <Segment t={t} value={direction} onChange={setDirection} options={dirOptions} />
        </div>
        <FilterPopover t={t} dark={dark} f={f} set={setF} context={context} lockCurrency={lockCurrency} />
        <Button t={t} kind="secondary" size="sm" icon="download" onClick={onExport}>Export CSV</Button>
      </div>

      {/* Active summary */}
      {(nActive > 0 || query) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '-4px 2px 0', fontSize: 11.5, color: t.muted }}>
          <Icon name="filter" size={12} color={t.muted} />
          <span>Showing <b style={{ color: t.textSoft }}>{filtered.length}</b> of {rows.length}</span>
          {cats.length > 0 && <span style={{ color: t.textSoft }}>· {cats.join(', ')}</span>}
          {direction !== 'all' && <span>· {dirOptions.find(o => o.value === direction)?.label}</span>}
          {!lockCurrency && currency !== 'all' && <span>· {currency}</span>}
          {subsOnly && <span>· subscriptions</span>}
          {(from || to) && <span>· {from || '…'} → {to || '…'}</span>}
          <button onClick={() => { setCats([]); setDirection('all'); setCurrency('all'); setSubsOnly(false); setFrom(''); setTo(''); setQuery(''); }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.accent, fontSize: 11.5, fontWeight: 600, padding: 0, marginLeft: 4 }}>
            Clear all
          </button>
        </div>
      )}

      <TransactionTable t={t} dark={dark} rows={filtered} density={density} context={context}
        sort={sort} onSort={onSort} onRowClick={onRowClick} total={rows.length} hideToolbar />
    </div>
  );
}

Object.assign(window, {
  CategoryBreakdown, FilterPopover, FilteredTable,
  applyFilters, sortRows, dispCcyOf,
});
