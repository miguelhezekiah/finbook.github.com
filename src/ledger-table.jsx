// ledger-table.jsx
// Custom-styled transactions table. Each row has a subtle color hint along the
// left edge (green = income, coral = expense, blue = transfer/top-up), a date
// cell that shows "Today / Yesterday / 12 May", a category chip, and a right-
// aligned amount where the currency symbol and decimals are dimmed.
//
// Columns are click-to-sort; a top-up (Transfer) row shows its destination
// wallet instead of a category chip, and its amount sign flips by context
// (out of the main account, into the wallet).

function AmountCell({ row, t, context }) {
  const isIncome = row.type === 'Income';
  const isTransferRow = row.type === 'Transfer';
  let sign, color;
  if (isTransferRow) {
    sign = context === 'wallet' ? '+' : '−';
    color = context === 'wallet' ? t.income : t.textSoft;
  } else {
    sign = isIncome ? '+' : '−';
    color = isIncome ? t.income : t.text;
  }
  const parts = fmtMoney(row.amount, row.currency);
  const showOriginal = row.has_discount && row.original_amount && row.original_amount > row.amount;
  const origParts = showOriginal ? fmtMoney(row.original_amount, row.currency) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, lineHeight: 1.1 }}>
      {showOriginal && (
        <span className="ledger-mono" style={{
          fontSize: 10.5, color: t.dim, textDecoration: 'line-through',
          textDecorationColor: t.muted, textDecorationThickness: '0.5px',
        }}>
          {origParts.symbol}{origParts.whole}{origParts.frac}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span className="ledger-mono" style={{ color: t.muted, fontSize: 11, fontWeight: 500, marginRight: 4 }}>
          {parts.symbol}
        </span>
        <span className="ledger-mono" style={{ color, fontSize: 14, fontWeight: 600 }}>
          {sign}{parts.whole}
        </span>
        {parts.frac && (
          <span className="ledger-mono" style={{ color: t.muted, fontSize: 12, fontWeight: 500 }}>
            {parts.frac}
          </span>
        )}
      </div>
    </div>
  );
}

// Destination-wallet pill (used in the Category column for top-up rows).
function WalletPill({ id, t }) {
  const w = (typeof WALLET_BY_ID !== 'undefined' && WALLET_BY_ID[id]) || null;
  if (!w) return <CategoryChip category="Transfer" t={t} dark size="sm" />;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 9px 2px 4px',
      borderRadius: 999, background: t.chipBg, border: `0.5px solid ${t.chipLine}`,
      fontSize: 12, fontWeight: 500, color: t.textSoft, whiteSpace: 'nowrap', lineHeight: 1,
    }}>
      <span style={{ width: 16, height: 16, borderRadius: 5, background: w.color, color: w.ink, fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{w.mono}</span>
      {w.name}
    </span>
  );
}

function FlagRow({ row, t }) {
  const items = [];
  if (row.is_subscription) items.push({ key: 'sub', label: 'Recurring' });
  if (row.has_discount && row.discount_amount > 0) {
    const d = fmtMoney(row.discount_amount, row.currency);
    items.push({ key: 'disc', label: `Saved ${d.symbol}${d.whole}${d.frac}`, accent: true });
  } else if (row.has_discount) {
    items.push({ key: 'disc', label: 'Discount', accent: true });
  }
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
      {items.map(i => (
        <span key={i.key} style={{
          fontSize: 10, fontWeight: 500,
          color: i.accent ? t.income : t.muted,
          padding: '1px 6px', borderRadius: 3,
          border: `0.5px solid ${i.accent ? 'transparent' : t.chipLine}`,
          background: i.accent ? t.incomeSoft : t.chipBg,
        }}>{i.label}</span>
      ))}
    </div>
  );
}

const GRID_COLS = '100px 92px 1.6fr 1.2fr 64px 1fr';

function TransactionRow({ row, t, dark, density, context, onClick }) {
  const isTransferRow = row.type === 'Transfer';
  const hint = row.type === 'Income' ? t.income : isTransferRow ? t.info : t.expense;
  const pad = density === 'compact' ? '8px 18px' : density === 'comfy' ? '18px 18px' : '13px 18px';

  return (
    <div onClick={onClick} style={{
      display: 'grid', gridTemplateColumns: GRID_COLS,
      alignItems: 'center', gap: 14, padding: pad,
      borderBottom: `1px solid ${t.divider}`, position: 'relative',
      transition: 'background .12s', cursor: 'pointer',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = t.chipBg)}
    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, background: hint, opacity: 0.6 }} />
      <div className="ledger-mono" style={{ fontSize: 12.5, color: t.textSoft }}>{fmtDate(row.date)}</div>
      <div><DirectionTag type={row.type} t={t} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.vendor_location || (isTransferRow ? 'Top-up' : '—')}
        </div>
        {density !== 'compact' && <FlagRow row={row} t={t} />}
      </div>
      <div>
        {isTransferRow
          ? <WalletPill id={row.wallet_id} t={t} />
          : <CategoryChip category={row.category} t={t} dark={dark} size={density === 'compact' ? 'sm' : 'md'} />}
      </div>
      <div className="ledger-mono" style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.08 }}>{row.currency}</div>
      <AmountCell row={row} t={t} context={context} />
    </div>
  );
}

// ─── Sortable column header ──────────────────────────────────────────────────
function SortHeader({ t, label, col, sort, onSort, align }) {
  const active = sort && sort.key === col;
  return (
    <button onClick={() => onSort && onSort(col)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, font: 'inherit',
      background: 'transparent', border: 'none', cursor: onSort ? 'pointer' : 'default',
      color: active ? t.text : t.muted, fontSize: 10.5, fontWeight: 600,
      letterSpacing: 0.08, textTransform: 'uppercase',
      justifyContent: align === 'right' ? 'flex-end' : 'flex-start', width: '100%',
    }}>
      {align === 'right' && (active
        ? <Icon name={sort.dir === 'asc' ? 'caretUp' : 'caretDn'} size={11} color={t.accent} strokeWidth={2.4} />
        : <Icon name="sort" size={10} color={t.dim} />)}
      {label}
      {align !== 'right' && (active
        ? <Icon name={sort.dir === 'asc' ? 'caretUp' : 'caretDn'} size={11} color={t.accent} strokeWidth={2.4} />
        : <Icon name="sort" size={10} color={t.dim} />)}
    </button>
  );
}

function TransactionTable({ t, dark, rows, density = 'regular', context = 'main', sort, onSort,
  onRowClick, query = '', onQueryChange, onExport, total, hideToolbar }) {
  const shown = rows.length;
  const grand = total == null ? shown : total;
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
      {!hideToolbar && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${t.divider}` }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: t.text }}>Transactions</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: t.muted, padding: '2px 7px', borderRadius: 999, background: t.chipBg, border: `0.5px solid ${t.chipLine}` }}>{shown}</span>
          <div style={{ flex: 1 }} />
          <div style={{ width: 220 }}>
            <TextInput t={t} value={query} onChange={onQueryChange} placeholder="Search vendor, category…" prefix={<Icon name="search" size={13} color={t.muted} />} />
          </div>
          <Button t={t} kind="secondary" size="sm" icon="download" onClick={onExport}>Export CSV</Button>
        </div>
      )}

      {/* Column header (sortable) */}
      <div style={{
        display: 'grid', gridTemplateColumns: GRID_COLS, alignItems: 'center', gap: 14,
        padding: '12px 18px', background: t.inset, borderBottom: `1px solid ${t.divider}`,
      }}>
        <SortHeader t={t} label="Date" col="date" sort={sort} onSort={onSort} />
        <SortHeader t={t} label="Type" col="type" sort={sort} onSort={onSort} />
        <SortHeader t={t} label={context === 'wallet' ? 'Merchant' : 'Vendor / Location'} col="vendor" sort={sort} onSort={onSort} />
        <SortHeader t={t} label={context === 'wallet' ? 'Category / To' : 'Category'} col="category" sort={sort} onSort={onSort} />
        <SortHeader t={t} label="Ccy" col="currency" sort={sort} onSort={onSort} />
        <SortHeader t={t} label="Amount" col="amount" sort={sort} onSort={onSort} align="right" />
      </div>

      {/* Rows */}
      <div>
        {rows.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', color: t.muted, fontSize: 13 }}>
            No transactions match these filters.
          </div>
        ) : rows.map(row => (
          <TransactionRow key={row.id} row={row} t={t} dark={dark} density={density} context={context}
            onClick={() => onRowClick && onRowClick(row)} />
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: t.inset, borderTop: `1px solid ${t.divider}`, fontSize: 11.5, color: t.muted }}>
        <span>Showing {shown} of {grand} transactions</span>
        <span className="ledger-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="info" size={11} color={t.muted} /> Click a row to edit
        </span>
      </div>
    </div>
  );
}

Object.assign(window, { TransactionTable, TransactionRow, AmountCell, WalletPill, SortHeader });
