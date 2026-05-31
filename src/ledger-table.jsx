// ledger-table.jsx
// Custom-styled transactions table. Each row has a subtle color hint along
// the left edge (green = income, coral = expense), a date cell that shows
// "Today / Yesterday / 12 May", a category chip, and a right-aligned amount
// where the currency symbol and decimals are dimmed for editorial weight.

function AmountCell({ row, t }) {
  // Always render the row in its native currency — conversions are a KPI-only
  // concern. When a discount applied, the original (pre-discount) figure is
  // shown struck-through above the paid amount.
  const isIncome = row.type === 'Income';
  const sign = isIncome ? '+' : '−';
  const color = isIncome ? t.income : t.text;
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

function FlagRow({ row, t }) {
  // Small icon flags next to the vendor name — discount (with savings amount)
  // / subscription.
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

function TransactionRow({ row, t, dark, density, onClick }) {
  const isIncome = row.type === 'Income';
  const hint = isIncome ? t.income : t.expense;
  const pad = density === 'compact' ? '8px 18px' : density === 'comfy' ? '18px 18px' : '13px 18px';

  return (
    <div onClick={onClick} style={{
      display: 'grid',
      gridTemplateColumns: '100px 90px 1.6fr 1.2fr 70px 1fr',
      alignItems: 'center', gap: 14,
      padding: pad,
      borderBottom: `1px solid ${t.divider}`,
      position: 'relative',
      transition: 'background .12s',
      cursor: 'pointer',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = t.chipBg)}
    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {/* Left color hint */}
      <span style={{
        position: 'absolute', left: 0, top: 8, bottom: 8, width: 2,
        background: hint, opacity: 0.6, borderRadius: 0,
      }} />
      {/* Date */}
      <div className="ledger-mono" style={{ fontSize: 12.5, color: t.textSoft }}>
        {fmtDate(row.date)}
      </div>
      {/* Direction */}
      <div><DirectionTag type={row.type} t={t} /></div>
      {/* Vendor */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 500, color: t.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{row.vendor_location}</div>
        {density !== 'compact' && <FlagRow row={row} t={t} />}
      </div>
      {/* Category */}
      <div><CategoryChip category={row.category} t={t} dark={dark} size={density === 'compact' ? 'sm' : 'md'} /></div>
      {/* Currency — always native */}
      <div className="ledger-mono" style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.08 }}>
        {row.currency}
      </div>
      {/* Amount */}
      <AmountCell row={row} t={t} />
    </div>
  );
}

function TransactionTable({ t, dark, rows, density = 'regular', onRowClick, query = '', onQueryChange, onExport, total }) {
  const padHeader = '12px 18px';
  const shown = rows.length;
  const grand = total == null ? shown : total;
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 18px', borderBottom: `1px solid ${t.divider}`,
      }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: t.text }}>Transactions</span>
        <span style={{
          fontSize: 11, fontWeight: 500, color: t.muted,
          padding: '2px 7px', borderRadius: 999,
          background: t.chipBg, border: `0.5px solid ${t.chipLine}`,
        }}>{shown}</span>
        <div style={{ flex: 1 }} />
        <div style={{ width: 220 }}>
          <TextInput t={t} value={query} onChange={onQueryChange}
            placeholder="Search vendor, category…"
            prefix={<Icon name="search" size={13} color={t.muted} />} />
        </div>
        <Button t={t} kind="secondary" size="sm" icon="download" onClick={onExport}>Export CSV</Button>
      </div>

      {/* Column header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '100px 90px 1.6fr 1.2fr 70px 1fr',
        alignItems: 'center', gap: 14,
        padding: padHeader,
        background: t.inset, borderBottom: `1px solid ${t.divider}`,
        fontSize: 10.5, fontWeight: 600, color: t.muted,
        letterSpacing: 0.08, textTransform: 'uppercase',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Date <Icon name="sort" size={10} color={t.dim} /></span>
        <span>Type</span>
        <span>Vendor / Location</span>
        <span>Category</span>
        <span>Ccy</span>
        <span style={{ textAlign: 'right' }}>Amount</span>
      </div>

      {/* Rows */}
      <div>
        {rows.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', color: t.muted, fontSize: 13 }}>
            No transactions match your search.
          </div>
        ) : rows.map(row => (
          <TransactionRow key={row.id} row={row} t={t} dark={dark} density={density}
            onClick={() => onRowClick && onRowClick(row)} />
        ))}
      </div>

      {/* Footer summary */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px', background: t.inset, borderTop: `1px solid ${t.divider}`,
        fontSize: 11.5, color: t.muted,
      }}>
        <span>Showing {shown} of {grand} transactions</span>
        <span className="ledger-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="info" size={11} color={t.muted} /> Click a row to edit
        </span>
      </div>
    </div>
  );
}

Object.assign(window, { TransactionTable, TransactionRow, AmountCell });
