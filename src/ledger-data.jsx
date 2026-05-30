// ledger-data.jsx
// Fixture data for the dashboard mock. Multi-currency (IDR + USD), realistic
// vendors for a Jakarta-based freelancer who also bills US clients.

// `amount` is the final amount actually paid. When has_discount is true the
// row also carries `discount_amount` (how much was knocked off) and the
// `original_amount` is computed (amount + discount_amount).
const SAMPLE_TRANSACTIONS = [
  // — This month —
  { id: 142, date: '2026-05-15', type: 'Income',  amount: 4200,        currency: 'USD', category: 'Freelance',        vendor_location: 'Vercel Inc · Remote',           has_discount: false, is_subscription: false, discount_amount: 0,       original_amount: 4200 },
  { id: 141, date: '2026-05-15', type: 'Expense', amount: 287_500,     currency: 'IDR', category: 'Food & Beverage',  vendor_location: 'Tokyo Skipjack · Senopati',     has_discount: true,  is_subscription: false, discount_amount: 65_000,  original_amount: 352_500 },
  { id: 140, date: '2026-05-14', type: 'Expense', amount: 19.99,       currency: 'USD', category: 'Subscriptions',    vendor_location: 'Figma',                         has_discount: false, is_subscription: true,  discount_amount: 0,       original_amount: 19.99 },
  { id: 139, date: '2026-05-14', type: 'Expense', amount: 145_000,     currency: 'IDR', category: 'Transport',        vendor_location: 'Grab · SCBD → Kemang',          has_discount: false, is_subscription: false, discount_amount: 0,       original_amount: 145_000 },
  { id: 138, date: '2026-05-13', type: 'Expense', amount: 2_850_000,   currency: 'IDR', category: 'Shopping',         vendor_location: 'Uniqlo · Plaza Indonesia',      has_discount: false, is_subscription: false, discount_amount: 0,       original_amount: 2_850_000 },
  { id: 137, date: '2026-05-12', type: 'Income',  amount: 32_500_000,  currency: 'IDR', category: 'Salary',           vendor_location: 'PT Sinarmas · Payroll',         has_discount: false, is_subscription: false, discount_amount: 0,       original_amount: 32_500_000 },
  { id: 136, date: '2026-05-11', type: 'Expense', amount: 89_000,      currency: 'IDR', category: 'Food & Beverage',  vendor_location: 'Kopi Kenangan · Pacific Place', has_discount: true,  is_subscription: false, discount_amount: 15_000,  original_amount: 104_000 },
  { id: 135, date: '2026-05-10', type: 'Expense', amount: 4_500_000,   currency: 'IDR', category: 'Housing',          vendor_location: 'Kost Senayan · May rent',       has_discount: false, is_subscription: true,  discount_amount: 0,       original_amount: 4_500_000 },
  { id: 134, date: '2026-05-09', type: 'Expense', amount: 12.00,       currency: 'USD', category: 'Subscriptions',    vendor_location: 'Notion',                        has_discount: false, is_subscription: true,  discount_amount: 0,       original_amount: 12.00 },
  { id: 133, date: '2026-05-08', type: 'Income',  amount: 850,         currency: 'USD', category: 'Investment',       vendor_location: 'IBKR · Dividend AAPL',          has_discount: false, is_subscription: false, discount_amount: 0,       original_amount: 850 },
  { id: 132, date: '2026-05-07', type: 'Expense', amount: 235_000,     currency: 'IDR', category: 'Utilities',        vendor_location: 'PLN · Electricity Apr',         has_discount: false, is_subscription: true,  discount_amount: 0,       original_amount: 235_000 },
  { id: 131, date: '2026-05-06', type: 'Expense', amount: 175_000,     currency: 'IDR', category: 'Entertainment',    vendor_location: 'XXI · Plaza Senayan',           has_discount: false, is_subscription: false, discount_amount: 0,       original_amount: 175_000 },
  { id: 130, date: '2026-05-04', type: 'Expense', amount: 47.50,       currency: 'USD', category: 'Health',           vendor_location: 'Cigna Telemedicine',            has_discount: false, is_subscription: false, discount_amount: 0,       original_amount: 47.50 },
  { id: 129, date: '2026-05-03', type: 'Income',  amount: 1_200,       currency: 'USD', category: 'Freelance',        vendor_location: 'Stripe · Sandbox audit',        has_discount: false, is_subscription: false, discount_amount: 0,       original_amount: 1_200 },
  { id: 128, date: '2026-05-02', type: 'Expense', amount: 320_000,     currency: 'IDR', category: 'Food & Beverage',  vendor_location: 'Saka Bistro · Kemang',          has_discount: false, is_subscription: false, discount_amount: 0,       original_amount: 320_000 },
  { id: 127, date: '2026-05-01', type: 'Expense', amount: 1_850_000,   currency: 'IDR', category: 'Travel',           vendor_location: 'Garuda · CGK → DPS',            has_discount: true,  is_subscription: false, discount_amount: 320_000, original_amount: 2_170_000 },
];

// Pre-aggregated totals for the previous period — used for KPI deltas.
const PREVIOUS_PERIOD = {
  income:  { USD: 4500,  IDR: 30_800_000 },
  expense: { USD: 380,   IDR: 9_220_000  },
};

function aggregate(rows) {
  const income = { USD: 0, IDR: 0 };
  const expense = { USD: 0, IDR: 0 };
  rows.forEach(r => {
    const bucket = r.type === 'Income' ? income : expense;
    bucket[r.currency] = (bucket[r.currency] || 0) + r.amount;
  });
  return { income, expense, net: {
    USD: income.USD - expense.USD,
    IDR: income.IDR - expense.IDR,
  }};
}

Object.assign(window, { SAMPLE_TRANSACTIONS, PREVIOUS_PERIOD, aggregate });
