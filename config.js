// config.js
// ───────────────────────────────────────────────────────────────────────────
// Supabase connection settings for the Financial Ledger frontend.
//
// These two values are PUBLIC by design. The anon (publishable) key only ever
// lets a caller do what your Row-Level Security policies allow — and our
// policies (see sql/schema.sql) scope every read/write to the signed-in user's
// own rows. So it is safe to commit this file and ship it to the browser.
//
// NEVER put the `service_role` key here — that key bypasses RLS.
//
// Find these in your Supabase dashboard:
//   Project Settings → API → Project URL   → SUPABASE_URL
//   Project Settings → API → anon  public  → SUPABASE_KEY
// ───────────────────────────────────────────────────────────────────────────
window.LEDGER_CONFIG = {
  SUPABASE_URL: "https://eiuwndqehkidlnympjcb.supabase.co",
  SUPABASE_KEY: "sb_publishable_vwRJVGD11JqAd86fzHtuZw_oHdMNamN",
};
