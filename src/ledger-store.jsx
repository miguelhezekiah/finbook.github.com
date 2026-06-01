// ledger-store.jsx
// Unified data layer. Two interchangeable back-ends behind one async API:
//
//   • Supabase  — used when config.js holds real project credentials. Every
//                 call is scoped by Postgres RLS to the signed-in user.
//   • Demo      — used when Supabase is NOT configured. Persists to
//                 localStorage so wallets, top-ups, filtering and sorting are
//                 all fully usable offline, with no backend.
//
// Both stores speak the same shape:  list() · insert(fields) · update(id, f) ·
// remove(id).  Rows now carry two extra fields beyond the original schema:
//
//   wallet_id : null  → the main account
//               'gopay' | 'ovo' | 'dana' | 'shopeepay' | 'linkaja'
//   type      : 'Income' | 'Expense' | 'Transfer'
//               A 'Transfer' is a top-up: money leaving the main account and
//               landing in `wallet_id`. One record keeps both sides in sync.

const DEMO_KEY = 'ledger:demo:v1';

// ─── Demo seed ──────────────────────────────────────────────────────────────
// A Jakarta freelancer's May 2026 — main-account income/spend, five wallet
// top-ups, and the day-to-day e-wallet taps that draw each pocket down. A
// little April history gives the KPI deltas something to compare against.
const DEMO_SEED = [
  // ── Main account · May 2026 ──
  { id: 142, date: '2026-05-15', type: 'Income',  amount: 4200,       currency: 'USD', category: 'Freelance',     vendor_location: 'Vercel Inc · Remote',           wallet_id: null, has_discount: false, discount_amount: 0,      original_amount: 4200,      is_subscription: false },
  { id: 141, date: '2026-05-15', type: 'Expense', amount: 287500,     currency: 'IDR', category: 'Food & Beverage', vendor_location: 'Tokyo Skipjack · Senopati',    wallet_id: null, has_discount: true,  discount_amount: 65000,  original_amount: 352500,    is_subscription: false },
  { id: 140, date: '2026-05-14', type: 'Expense', amount: 19.99,      currency: 'USD', category: 'Subscriptions',  vendor_location: 'Figma',                         wallet_id: null, has_discount: false, discount_amount: 0,      original_amount: 19.99,     is_subscription: true },
  { id: 138, date: '2026-05-13', type: 'Expense', amount: 2850000,    currency: 'IDR', category: 'Shopping',       vendor_location: 'Uniqlo · Plaza Indonesia',      wallet_id: null, has_discount: false, discount_amount: 0,      original_amount: 2850000,   is_subscription: false },
  { id: 137, date: '2026-05-12', type: 'Income',  amount: 32500000,   currency: 'IDR', category: 'Salary',         vendor_location: 'PT Sinarmas · Payroll',         wallet_id: null, has_discount: false, discount_amount: 0,      original_amount: 32500000,  is_subscription: false },
  { id: 135, date: '2026-05-10', type: 'Expense', amount: 4500000,    currency: 'IDR', category: 'Housing',        vendor_location: 'Kost Senayan · May rent',       wallet_id: null, has_discount: false, discount_amount: 0,      original_amount: 4500000,   is_subscription: true },
  { id: 134, date: '2026-05-09', type: 'Expense', amount: 12.00,      currency: 'USD', category: 'Subscriptions',  vendor_location: 'Notion',                        wallet_id: null, has_discount: false, discount_amount: 0,      original_amount: 12.00,     is_subscription: true },
  { id: 133, date: '2026-05-08', type: 'Income',  amount: 850,        currency: 'USD', category: 'Investment',     vendor_location: 'IBKR · Dividend AAPL',          wallet_id: null, has_discount: false, discount_amount: 0,      original_amount: 850,       is_subscription: false },
  { id: 132, date: '2026-05-07', type: 'Expense', amount: 235000,     currency: 'IDR', category: 'Utilities',      vendor_location: 'PLN · Electricity Apr',         wallet_id: null, has_discount: false, discount_amount: 0,      original_amount: 235000,    is_subscription: true },
  { id: 131, date: '2026-05-06', type: 'Expense', amount: 175000,     currency: 'IDR', category: 'Entertainment',  vendor_location: 'XXI · Plaza Senayan',           wallet_id: null, has_discount: false, discount_amount: 0,      original_amount: 175000,    is_subscription: false },
  { id: 130, date: '2026-05-04', type: 'Expense', amount: 47.50,      currency: 'USD', category: 'Health',         vendor_location: 'Cigna Telemedicine',            wallet_id: null, has_discount: false, discount_amount: 0,      original_amount: 47.50,     is_subscription: false },
  { id: 129, date: '2026-05-03', type: 'Income',  amount: 1200,       currency: 'USD', category: 'Freelance',      vendor_location: 'Stripe · Sandbox audit',        wallet_id: null, has_discount: false, discount_amount: 0,      original_amount: 1200,      is_subscription: false },
  { id: 128, date: '2026-05-02', type: 'Expense', amount: 320000,     currency: 'IDR', category: 'Food & Beverage', vendor_location: 'Saka Bistro · Kemang',         wallet_id: null, has_discount: false, discount_amount: 0,      original_amount: 320000,    is_subscription: false },
  { id: 127, date: '2026-05-01', type: 'Expense', amount: 1850000,    currency: 'IDR', category: 'Travel',         vendor_location: 'Garuda · CGK → DPS',            wallet_id: null, has_discount: true,  discount_amount: 320000, original_amount: 2170000,   is_subscription: false },

  // ── Top-ups (main → wallet) ──
  { id: 120, date: '2026-05-01', type: 'Transfer', amount: 500000, currency: 'IDR', category: 'Transfer', vendor_location: 'Top-up → GoPay',     wallet_id: 'gopay',     has_discount: false, discount_amount: 0, original_amount: 500000, is_subscription: false },
  { id: 121, date: '2026-05-02', type: 'Transfer', amount: 600000, currency: 'IDR', category: 'Transfer', vendor_location: 'Top-up → ShopeePay', wallet_id: 'shopeepay', has_discount: false, discount_amount: 0, original_amount: 600000, is_subscription: false },
  { id: 122, date: '2026-05-03', type: 'Transfer', amount: 400000, currency: 'IDR', category: 'Transfer', vendor_location: 'Top-up → OVO',       wallet_id: 'ovo',       has_discount: false, discount_amount: 0, original_amount: 400000, is_subscription: false },
  { id: 123, date: '2026-05-05', type: 'Transfer', amount: 250000, currency: 'IDR', category: 'Transfer', vendor_location: 'Top-up → DANA',      wallet_id: 'dana',      has_discount: false, discount_amount: 0, original_amount: 250000, is_subscription: false },
  { id: 124, date: '2026-05-08', type: 'Transfer', amount: 150000, currency: 'IDR', category: 'Transfer', vendor_location: 'Top-up → LinkAja',   wallet_id: 'linkaja',   has_discount: false, discount_amount: 0, original_amount: 150000, is_subscription: false },
  { id: 125, date: '2026-05-12', type: 'Transfer', amount: 300000, currency: 'IDR', category: 'Transfer', vendor_location: 'Top-up → GoPay',     wallet_id: 'gopay',     has_discount: false, discount_amount: 0, original_amount: 300000, is_subscription: false },

  // ── GoPay taps ──
  { id: 200, date: '2026-05-04', type: 'Expense', amount: 32000, currency: 'IDR', category: 'Food & Beverage', vendor_location: 'GoFood · Kopi Kenangan', wallet_id: 'gopay', has_discount: false, discount_amount: 0, original_amount: 32000, is_subscription: false },
  { id: 201, date: '2026-05-06', type: 'Expense', amount: 28000, currency: 'IDR', category: 'Transport',       vendor_location: 'Gojek · SCBD → Kuningan', wallet_id: 'gopay', has_discount: false, discount_amount: 0, original_amount: 28000, is_subscription: false },
  { id: 202, date: '2026-05-11', type: 'Expense', amount: 58000, currency: 'IDR', category: 'Food & Beverage', vendor_location: 'GoFood · Mangkokku',      wallet_id: 'gopay', has_discount: true,  discount_amount: 12000, original_amount: 70000, is_subscription: false },
  { id: 203, date: '2026-05-14', type: 'Expense', amount: 24000, currency: 'IDR', category: 'Transport',       vendor_location: 'Gojek · Senayan',         wallet_id: 'gopay', has_discount: false, discount_amount: 0, original_amount: 24000, is_subscription: false },

  // ── OVO taps ──
  { id: 210, date: '2026-05-05', type: 'Expense', amount: 35000,  currency: 'IDR', category: 'Transport', vendor_location: 'Grab · Kemang',          wallet_id: 'ovo', has_discount: false, discount_amount: 0, original_amount: 35000,  is_subscription: false },
  { id: 211, date: '2026-05-09', type: 'Expense', amount: 145000, currency: 'IDR', category: 'Shopping',  vendor_location: 'Hypermart · Gandaria',   wallet_id: 'ovo', has_discount: false, discount_amount: 0, original_amount: 145000, is_subscription: false },
  { id: 212, date: '2026-05-13', type: 'Expense', amount: 41000,  currency: 'IDR', category: 'Transport', vendor_location: 'Grab · SCBD',            wallet_id: 'ovo', has_discount: false, discount_amount: 0, original_amount: 41000,  is_subscription: false },

  // ── DANA taps ──
  { id: 220, date: '2026-05-06', type: 'Expense', amount: 50000, currency: 'IDR', category: 'Utilities', vendor_location: 'Pulsa · Telkomsel', wallet_id: 'dana', has_discount: false, discount_amount: 0, original_amount: 50000, is_subscription: false },
  { id: 221, date: '2026-05-10', type: 'Expense', amount: 89000, currency: 'IDR', category: 'Shopping',  vendor_location: 'Tokopedia · Case',  wallet_id: 'dana', has_discount: false, discount_amount: 0, original_amount: 89000, is_subscription: false },

  // ── ShopeePay taps ──
  { id: 230, date: '2026-05-03', type: 'Expense', amount: 178000, currency: 'IDR', category: 'Shopping',        vendor_location: 'Shopee · Skincare',  wallet_id: 'shopeepay', has_discount: true,  discount_amount: 22000, original_amount: 200000, is_subscription: false },
  { id: 231, date: '2026-05-12', type: 'Expense', amount: 95000,  currency: 'IDR', category: 'Shopping',        vendor_location: 'Shopee · Cable',     wallet_id: 'shopeepay', has_discount: false, discount_amount: 0,     original_amount: 95000,  is_subscription: false },
  { id: 232, date: '2026-05-14', type: 'Expense', amount: 47000,  currency: 'IDR', category: 'Food & Beverage', vendor_location: 'ShopeeFood · Geprek', wallet_id: 'shopeepay', has_discount: false, discount_amount: 0,     original_amount: 47000,  is_subscription: false },

  // ── LinkAja taps ──
  { id: 240, date: '2026-05-08', type: 'Expense', amount: 40000, currency: 'IDR', category: 'Utilities', vendor_location: 'PLN token · Prepaid', wallet_id: 'linkaja', has_discount: false, discount_amount: 0, original_amount: 40000, is_subscription: false },
  { id: 241, date: '2026-05-11', type: 'Expense', amount: 25000, currency: 'IDR', category: 'Transport', vendor_location: 'Transjakarta',        wallet_id: 'linkaja', has_discount: false, discount_amount: 0, original_amount: 25000, is_subscription: false },

  // ── Main account · April 2026 (for KPI deltas) ──
  { id: 110, date: '2026-04-12', type: 'Income',  amount: 30800000, currency: 'IDR', category: 'Salary',         vendor_location: 'PT Sinarmas · Payroll', wallet_id: null, has_discount: false, discount_amount: 0, original_amount: 30800000, is_subscription: false },
  { id: 111, date: '2026-04-20', type: 'Income',  amount: 3500,     currency: 'USD', category: 'Freelance',      vendor_location: 'Linear · Retainer',     wallet_id: null, has_discount: false, discount_amount: 0, original_amount: 3500,     is_subscription: false },
  { id: 112, date: '2026-04-10', type: 'Expense', amount: 4500000,  currency: 'IDR', category: 'Housing',        vendor_location: 'Kost Senayan · Apr rent', wallet_id: null, has_discount: false, discount_amount: 0, original_amount: 4500000, is_subscription: true },
  { id: 113, date: '2026-04-15', type: 'Expense', amount: 280000,   currency: 'IDR', category: 'Food & Beverage', vendor_location: 'Sate Khas · Senayan',  wallet_id: null, has_discount: false, discount_amount: 0, original_amount: 280000,  is_subscription: false },
  { id: 114, date: '2026-04-08', type: 'Expense', amount: 130000,   currency: 'IDR', category: 'Transport',      vendor_location: 'Grab · Airport',        wallet_id: null, has_discount: false, discount_amount: 0, original_amount: 130000,  is_subscription: false },
  { id: 115, date: '2026-04-22', type: 'Expense', amount: 1200000,  currency: 'IDR', category: 'Shopping',       vendor_location: 'IKEA · Alam Sutera',    wallet_id: null, has_discount: false, discount_amount: 0, original_amount: 1200000, is_subscription: false },
];

// ─── localStorage helpers ────────────────────────────────────────────────────
function loadDemo() {
  try { const raw = localStorage.getItem(DEMO_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  return null;
}
function saveDemo(rows) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(rows)); } catch (e) {}
}
function sortByDate(rows) {
  return [...rows].sort((a, b) =>
    b.date.localeCompare(a.date) || (b.id - a.id));
}

// ─── Demo store (localStorage) ───────────────────────────────────────────────
function demoStore() {
  let rows = loadDemo();
  if (!rows) { rows = DEMO_SEED.map(r => ({ ...r })); saveDemo(rows); }
  const nextId = () => (loadDemo() || rows).reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
  return {
    demo: true,
    async list() { return sortByDate(loadDemo() || rows); },
    async insert(fields) {
      const all = loadDemo() || rows;
      const row = { id: nextId(), created_at: new Date().toISOString(), ...fields };
      all.push(row); saveDemo(all); rows = all; return row;
    },
    async update(id, fields) {
      const all = loadDemo() || rows;
      const i = all.findIndex(r => r.id === id);
      if (i >= 0) { all[i] = { ...all[i], ...fields }; saveDemo(all); rows = all; }
    },
    async remove(id) {
      const all = (loadDemo() || rows).filter(r => r.id !== id);
      saveDemo(all); rows = all;
    },
    async reset() {
      rows = DEMO_SEED.map(r => ({ ...r })); saveDemo(rows);
    },
  };
}

// ─── Supabase store ──────────────────────────────────────────────────────────
function supaStore(db, userId) {
  return {
    demo: false,
    async list() {
      const { data, error } = await db.from('transactions').select('*')
        .order('date', { ascending: false }).order('id', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async insert(fields) {
      const { data, error } = await db.from('transactions')
        .insert({ ...fields, user_id: userId }).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, fields) {
      const { error } = await db.from('transactions').update(fields).eq('id', id);
      if (error) throw error;
    },
    async remove(id) {
      const { error } = await db.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },
  };
}

function createStore(db, userId) {
  return db ? supaStore(db, userId) : demoStore();
}

Object.assign(window, { createStore, DEMO_SEED });
