// ledger-tokens.jsx
// Single source of truth for the Financial Ledger design system.
// Exposes a `useTokens(dark)` hook that returns the active palette, plus
// helper formatters for money / dates / deltas. Aspirational hi-fi — we're
// designing as if Streamlit could render anything, so these tokens diverge
// from Streamlit's default look on purpose (banker-grade dark UI + lime).

const TOKENS_DARK = {
  // Surfaces
  bg:         '#0a0c10',
  surface:    '#14171d',
  elevated:   '#1c2028',
  inset:      '#0e1116',
  // Lines
  border:     'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.12)',
  divider:    'rgba(255,255,255,0.04)',
  // Text
  text:       '#f5f6f8',
  textSoft:   '#c8ccd4',
  muted:      '#878c97',
  dim:        '#565b66',
  // Accent (electric lime — the brand color)
  accent:     '#d4ff3a',
  accentInk:  '#0a0c10',          // text on accent
  accentSoft: 'rgba(212,255,58,0.12)',
  accentLine: 'rgba(212,255,58,0.35)',
  // Semantic
  income:     '#7be39b',
  incomeSoft: 'rgba(123,227,155,0.10)',
  expense:    '#ff8a7a',
  expenseSoft:'rgba(255,138,122,0.10)',
  info:       '#7bb7ff',
  warn:       '#f5c971',
  // Status pill backgrounds for categories
  chipBg:     'rgba(255,255,255,0.05)',
  chipLine:   'rgba(255,255,255,0.08)',
  // Shadow
  shadow:     '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 28px rgba(0,0,0,0.4)',
};

const TOKENS_LIGHT = {
  bg:         '#f6f5f0',
  surface:    '#ffffff',
  elevated:   '#ffffff',
  inset:      '#f0eee8',
  border:     'rgba(15,17,22,0.08)',
  borderStrong: 'rgba(15,17,22,0.16)',
  divider:    'rgba(15,17,22,0.05)',
  text:       '#15171c',
  textSoft:   '#2c2f37',
  muted:      '#6b6e78',
  dim:        '#a4a7b0',
  accent:     '#1a6f3f',
  accentInk:  '#ffffff',
  accentSoft: 'rgba(26,111,63,0.10)',
  accentLine: 'rgba(26,111,63,0.35)',
  income:     '#0e7a40',
  incomeSoft: 'rgba(14,122,64,0.10)',
  expense:    '#b03a2a',
  expenseSoft:'rgba(176,58,42,0.08)',
  info:       '#2563eb',
  warn:       '#b58423',
  chipBg:     'rgba(15,17,22,0.04)',
  chipLine:   'rgba(15,17,22,0.08)',
  shadow:     '0 1px 0 rgba(255,255,255,1) inset, 0 6px 24px rgba(15,17,22,0.08)',
};

function useTokens(dark) {
  return dark ? TOKENS_DARK : TOKENS_LIGHT;
}

// ─── Type scale ────────────────────────────────────────────────────────────
// UI: Geist (sans). Numerals on KPIs: Instrument Serif (editorial).
// Tabular: Geist Mono.
const TYPE = {
  sans:    "'Geist', ui-sans-serif, system-ui, sans-serif",
  mono:    "'Geist Mono', ui-monospace, monospace",
  serif:   "'Instrument Serif', 'Times New Roman', serif",
};

// ─── Money formatting ─────────────────────────────────────────────────────
// IDR has no minor unit in practice (show whole rupiah, "k"/"M"/"B" optional).
// USD uses 2 decimals. fmtMoney returns a {whole, frac} split so we can render
// the fractional part in a smaller weight — an editorial banker move.
function fmtMoney(amount, currency, opts = {}) {
  const compact = opts.compact;
  if (currency === 'IDR') {
    const v = Math.round(Math.abs(amount));
    if (compact && v >= 1_000_000_000) return { whole: (v / 1e9).toFixed(2), frac: 'B', symbol: 'Rp' };
    if (compact && v >= 1_000_000)     return { whole: (v / 1e6).toFixed(2), frac: 'M', symbol: 'Rp' };
    if (compact && v >= 1_000)         return { whole: (v / 1e3).toFixed(1), frac: 'k', symbol: 'Rp' };
    return { whole: v.toLocaleString('en-US'), frac: '', symbol: 'Rp' };
  }
  // USD
  const v = Math.abs(amount);
  if (compact && v >= 1_000_000) return { whole: (v / 1e6).toFixed(2), frac: 'M', symbol: '$' };
  if (compact && v >= 10_000)    return { whole: (v / 1e3).toFixed(1), frac: 'k', symbol: '$' };
  const [w, f] = v.toFixed(2).split('.');
  return { whole: Number(w).toLocaleString('en-US'), frac: '.' + f, symbol: '$' };
}

// Approx FX so "converted" Tweak mode can show one unified figure.
const FX = { IDR_PER_USD: 16400 };
function toUSD(amount, currency) {
  return currency === 'USD' ? amount : amount / FX.IDR_PER_USD;
}

// Date formatter — "12 May" / "Yesterday" / "Today"
function fmtDate(iso, now = new Date()) {
  const d = new Date(iso);
  const today = new Date(now); today.setHours(0,0,0,0);
  const that  = new Date(d);   that.setHours(0,0,0,0);
  const diff = Math.round((today - that) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// Inject Google Fonts + a few global rules. Idempotent.
(function injectGlobal() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ledger-fonts')) return;
  const link = document.createElement('link');
  link.id = 'ledger-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap';
  document.head.appendChild(link);

  const s = document.createElement('style');
  s.id = 'ledger-global';
  s.textContent = `
    .ledger-root { font-family: ${TYPE.sans}; -webkit-font-smoothing: antialiased; }
    .ledger-root *::selection { background: rgba(212,255,58,0.35); }
    .ledger-tab { font-variant-numeric: tabular-nums; }
    .ledger-serif { font-family: ${TYPE.serif}; font-feature-settings: "ss01"; letter-spacing: -0.02em; }
    .ledger-mono { font-family: ${TYPE.mono}; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
    .ledger-root button { font-family: inherit; }
    .ledger-root input, .ledger-root select, .ledger-root textarea { font-family: inherit; }
  `;
  document.head.appendChild(s);
})();

Object.assign(window, {
  TOKENS_DARK, TOKENS_LIGHT, useTokens, TYPE,
  fmtMoney, fmtDate, toUSD, FX,
});
