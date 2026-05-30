# app.py
# Secure Financial Ledger — Streamlit + Supabase
# ---------------------------------------------------------------------------
# Single-file application. Hosts a personal financial journal that supports:
#   - Email/password authentication via Supabase (sign-in & sign-up)
#   - Multi-user (every row is scoped to user_id; RLS enforces isolation)
#   - Multi-currency (IDR + USD) — transactions are stored & listed in their
#     native currency; aggregated KPIs can be viewed in USD, IDR, or both
#   - Discount tracking — capture discount_amount and persist the original
#     (pre-discount) price
#
# THEME NOTE
# ----------
# Streamlit renders its own widget DOM, so the hi-fi look from the design
# mockup is achieved by injecting a CSS layer (web fonts + the dark/lime
# palette + restyled widgets) and by rendering the KPI cards and the
# transactions table as custom HTML. This is a faithful approximation of the
# mockup, not a 1:1 — auth, forms, and exports remain idiomatic Streamlit.
#
# Schema is documented in sql/schema.sql. Credentials live in
# .streamlit/secrets.toml (see .streamlit/secrets.toml.example).
# ---------------------------------------------------------------------------

import html
import streamlit as st
import pandas as pd
from datetime import date, datetime
from supabase import create_client, Client

ALLOWED_EMAIL = st.secrets["ALLOWED_EMAIL"]
if "user" in st.session_state and st.session_state.user:
    user_email = st.session_state.user.email
    
    # Check if the logged-in email matches your secret email
    if user_email != ALLOWED_EMAIL:
        st.error("🚫 Access Denied: This is a private ledger.")
        
        # Optional: Sign them out immediately via Supabase client if needed
        # supabase.auth.sign_out() 
        
        st.stop() # Halts all further Streamlit execution for this session

# ---------------------------------------------------------------------------
# Page configuration
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="Financial Ledger",
    page_icon="💸",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORIES = [
    "Salary", "Freelance", "Investment",
    "Food & Beverage", "Transport", "Housing", "Utilities",
    "Entertainment", "Health", "Shopping", "Travel",
    "Subscriptions", "Other",
]

# Reference FX. Stored figures are always native; this is only used to render
# aggregate KPIs in a single chosen currency. Update freely.
FX_IDR_PER_USD = 16_400.0

# Per-category accent hue (oklch) + glyph, mirroring the design system.
CATEGORY_META = {
    "Salary":          (145, "◐"),
    "Freelance":       (195, "◑"),
    "Investment":      (270, "◇"),
    "Food & Beverage": (25,  "●"),
    "Transport":       (220, "▲"),
    "Housing":         (10,  "■"),
    "Utilities":       (60,  "◆"),
    "Entertainment":   (320, "★"),
    "Health":          (165, "✚"),
    "Shopping":        (290, "◉"),
    "Travel":          (200, "✈"),
    "Subscriptions":   (80,  "◎"),
    "Other":           (0,   "○"),
}


def category_color(cat: str) -> str:
    hue, _ = CATEGORY_META.get(cat, CATEGORY_META["Other"])
    return f"oklch(0.78 0.13 {hue})"


def category_glyph(cat: str) -> str:
    _, glyph = CATEGORY_META.get(cat, CATEGORY_META["Other"])
    return glyph


# ---------------------------------------------------------------------------
# THEME — injected once per page render.
# Targets Streamlit's stable data-testid hooks + element classes. Selectors
# are intentionally broad so minor Streamlit version bumps don't break the
# look entirely.
# ---------------------------------------------------------------------------
THEME_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap');

:root{
  --bg:#0a0c10; --surface:#14171d; --elevated:#1c2028; --inset:#0e1116;
  --border:rgba(255,255,255,0.08); --border-strong:rgba(255,255,255,0.14);
  --divider:rgba(255,255,255,0.05);
  --text:#f5f6f8; --text-soft:#c8ccd4; --muted:#878c97; --dim:#565b66;
  --accent:#d4ff3a; --accent-ink:#0a0c10; --accent-soft:rgba(212,255,58,0.12);
  --accent-line:rgba(212,255,58,0.35);
  --income:#7be39b; --income-soft:rgba(123,227,155,0.10);
  --expense:#ff8a7a; --expense-soft:rgba(255,138,122,0.10);
  --sans:'Geist',ui-sans-serif,system-ui,sans-serif;
  --mono:'Geist Mono',ui-monospace,monospace;
  --serif:'Instrument Serif','Times New Roman',serif;
}

/* App canvas */
.stApp{ background:var(--bg); color:var(--text); font-family:var(--sans); }
.main .block-container{ padding-top:2.2rem; padding-bottom:3rem; max-width:1320px; }
[data-testid="stHeader"]{ background:transparent; }
#MainMenu, footer, [data-testid="stDecoration"]{ visibility:hidden; }

::selection{ background:rgba(212,255,58,0.35); }

/* Headings */
.stApp h1,.stApp h2,.stApp h3{ font-family:var(--sans); letter-spacing:-0.4px; color:var(--text); }
.stApp h1{ font-weight:600; }

/* Sidebar */
[data-testid="stSidebar"]{ background:var(--surface); border-right:1px solid var(--border); }
[data-testid="stSidebar"] .block-container{ padding-top:1.4rem; }
[data-testid="stSidebar"] h2{ font-size:1.05rem; font-weight:600; }

/* Inputs — text, number, textarea */
.stTextInput input, .stNumberInput input, .stDateInput input, textarea, .stTextArea textarea{
  background:var(--inset) !important; color:var(--text) !important;
  border:1px solid var(--border) !important; border-radius:8px !important;
  font-family:var(--sans) !important;
}
.stTextInput input:focus, .stNumberInput input:focus, .stDateInput input:focus, textarea:focus{
  border-color:var(--accent-line) !important;
  box-shadow:0 0 0 3px var(--accent-soft) !important;
}
.stTextInput label, .stNumberInput label, .stSelectbox label, .stDateInput label,
.stRadio label, .stCheckbox label, .stTextArea label{
  color:var(--text-soft) !important; font-size:0.8rem !important; font-weight:500 !important;
}

/* Selectbox (baseweb) */
[data-baseweb="select"]>div{
  background:var(--inset) !important; border:1px solid var(--border) !important;
  border-radius:8px !important; color:var(--text) !important;
}
[data-baseweb="popover"] *{ color:var(--text); }
[data-baseweb="menu"]{ background:var(--surface) !important; }

/* Number-input +/- steppers */
.stNumberInput button{ background:var(--elevated) !important; border:1px solid var(--border) !important; color:var(--muted) !important; }

/* Buttons — default = secondary, primary = lime */
.stButton>button, .stDownloadButton>button, [data-testid="stFormSubmitButton"] button{
  font-family:var(--sans); font-weight:600; border-radius:8px;
  background:var(--elevated); color:var(--text); border:1px solid var(--border);
  transition:transform .12s, filter .12s;
}
.stButton>button:hover, .stDownloadButton>button:hover, [data-testid="stFormSubmitButton"] button:hover{
  border-color:var(--border-strong); color:var(--text); filter:brightness(1.08);
}
.stButton>button:active{ transform:translateY(1px); }
/* Primary call-to-action (type="primary") + the form submit buttons */
.stButton>button[kind="primary"], [data-testid="stFormSubmitButton"] button{
  background:var(--accent); color:var(--accent-ink); border-color:transparent;
}
.stButton>button[kind="primary"]:hover, [data-testid="stFormSubmitButton"] button:hover{
  color:var(--accent-ink); filter:brightness(1.05);
}

/* Tabs (login) */
[data-baseweb="tab-list"]{ gap:4px; background:var(--inset); padding:4px; border-radius:10px; border:1px solid var(--border); }
button[data-baseweb="tab"]{
  background:transparent; color:var(--muted); border-radius:7px !important;
  font-family:var(--sans); font-weight:500; padding:8px 14px;
}
button[data-baseweb="tab"][aria-selected="true"]{ background:var(--elevated); color:var(--text); }
[data-baseweb="tab-highlight"], [data-baseweb="tab-border"]{ display:none; }

/* Radio rendered as a segmented control (KPI currency) */
[data-testid="stRadio"] [role="radiogroup"]{
  display:inline-flex; gap:4px; background:var(--inset); padding:4px;
  border-radius:9px; border:1px solid var(--border);
}
[data-testid="stRadio"] [role="radiogroup"] label{
  margin:0 !important; padding:6px 14px; border-radius:6px; cursor:pointer;
  color:var(--muted) !important; transition:background .15s,color .15s;
}
[data-testid="stRadio"] [role="radiogroup"] label:has(input:checked){
  background:var(--elevated); color:var(--text) !important;
}
[data-testid="stRadio"] [role="radiogroup"] label>div:first-child{ display:none; } /* hide dot */

/* Checkbox accent */
[data-testid="stCheckbox"] [data-baseweb="checkbox"] span{ border-color:var(--border-strong) !important; }

/* Dividers */
hr, [data-testid="stDivider"]{ border-color:var(--divider) !important; }

/* Alerts a touch darker */
[data-testid="stAlert"]{ border-radius:10px; }

/* ─── Custom components (rendered as raw HTML) ─────────────────────────── */
.lg-mono{ font-family:var(--mono); font-variant-numeric:tabular-nums; letter-spacing:-0.01em; }
.lg-serif{ font-family:var(--serif); letter-spacing:-0.02em; }

.kpi-row{ display:flex; gap:16px; margin:6px 0 4px; }
.kpi-card{
  flex:1; min-width:0; background:var(--surface); border:1px solid var(--border);
  border-radius:14px; padding:20px 22px 18px; display:flex; flex-direction:column; gap:14px;
}
.kpi-head{ display:flex; align-items:center; justify-content:space-between; }
.kpi-label{ font-size:11px; font-weight:600; color:var(--muted); letter-spacing:.08em; text-transform:uppercase; }
.kpi-dot{ width:6px; height:6px; border-radius:50%; }
.kpi-numeral{ display:flex; align-items:baseline; gap:4px; flex-wrap:wrap; }
.kpi-sym{ font-size:14px; font-weight:500; color:var(--muted); align-self:flex-start; margin-top:14px; }
.kpi-big{ font-family:var(--serif); font-size:54px; line-height:1; font-weight:400; }
.kpi-frac{ font-family:var(--serif); font-size:30px; line-height:1; color:var(--muted); }
.kpi-second{ font-family:var(--mono); display:flex; align-items:baseline; gap:6px; font-size:13px; color:var(--text-soft); margin-top:-8px; }
.kpi-foot{ display:flex; align-items:flex-end; justify-content:space-between; gap:14px; margin-top:2px; }
.kpi-deltawrap{ display:flex; flex-direction:column; gap:3px; }
.kpi-deltacap{ font-size:11px; color:var(--muted); }
.kpi-delta{ font-family:var(--mono); font-size:13px; font-weight:600; }
.kpi-spark{ display:flex; align-items:flex-end; gap:3px; height:28px; }
.kpi-spark span{ width:3px; border-radius:1px; }

.ledger-table{ width:100%; border-collapse:collapse; background:var(--surface);
  border:1px solid var(--border); border-radius:14px; overflow:hidden; }
.ledger-table thead th{
  background:var(--inset); color:var(--muted); font-size:10.5px; font-weight:600;
  letter-spacing:.08em; text-transform:uppercase; text-align:left;
  padding:12px 16px; border-bottom:1px solid var(--divider);
}
.ledger-table thead th.num{ text-align:right; }
.ledger-table tbody td{ padding:13px 16px; border-bottom:1px solid var(--divider); vertical-align:middle; font-size:13.5px; color:var(--text); }
.ledger-table tbody tr:last-child td{ border-bottom:none; }
.ledger-table tbody tr:hover td{ background:rgba(255,255,255,0.03); }
.cell-date{ font-family:var(--mono); font-size:12.5px; color:var(--text-soft); white-space:nowrap; }
.cell-ccy{ font-family:var(--mono); font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
.cell-vendor{ font-weight:500; }
.cell-amt{ text-align:right; white-space:nowrap; }
.dir-tag{ display:inline-flex; align-items:center; gap:4px; padding:2px 7px; border-radius:5px;
  font-size:11px; font-weight:600; text-transform:uppercase; }
.cat-chip{ display:inline-flex; align-items:center; gap:6px; padding:3px 9px 3px 6px;
  border-radius:999px; background:rgba(255,255,255,0.05); border:.5px solid rgba(255,255,255,0.08);
  font-size:12px; font-weight:500; color:var(--text-soft); white-space:nowrap; line-height:1; }
.flag{ font-size:10px; font-weight:500; padding:1px 6px; border-radius:3px; margin-top:3px;
  display:inline-block; border:.5px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.05); color:var(--muted); }
.flag.save{ color:var(--income); background:var(--income-soft); border-color:transparent; }
.amt-strike{ font-family:var(--mono); font-size:10.5px; color:var(--dim);
  text-decoration:line-through; text-decoration-color:var(--muted); display:block; }
.amt-main{ font-family:var(--mono); font-size:14px; font-weight:600; }
.amt-sym{ font-family:var(--mono); font-size:11px; color:var(--muted); font-weight:500; }
.amt-frac{ font-family:var(--mono); font-size:12px; color:var(--muted); font-weight:500; }

.brandmark{ display:inline-flex; align-items:center; gap:10px; }
.login-quote{ font-family:var(--serif); font-size:40px; line-height:1.08; font-weight:400; color:var(--text); margin:0; }
.login-quote em{ color:var(--accent); font-style:italic; }
</style>
"""


def inject_theme() -> None:
    st.markdown(THEME_CSS, unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Supabase client bootstrapping
# Credentials pulled from Streamlit secrets — never hardcoded.
# ---------------------------------------------------------------------------
@st.cache_resource(show_spinner=False)
def get_supabase_client() -> Client:
    """Create (and cache) a Supabase client using credentials from st.secrets."""
    url: str = st.secrets["SUPABASE_URL"]
    key: str = st.secrets["SUPABASE_KEY"]
    return create_client(url, key)


supabase: Client = get_supabase_client()

# ---------------------------------------------------------------------------
# Session state initialization
# ---------------------------------------------------------------------------
for k, v in {
    "session": None,
    "user": None,
    "auth_error": None,
    "auth_notice": None,
}.items():
    if k not in st.session_state:
        st.session_state[k] = v


# ---------------------------------------------------------------------------
# Authentication helpers
# ---------------------------------------------------------------------------
def sign_in(email: str, password: str) -> None:
    """Authenticate an existing user against Supabase."""
    try:
        resp = supabase.auth.sign_in_with_password({"email": email, "password": password})
        st.session_state.session = resp.session
        st.session_state.user = resp.user
        st.session_state.auth_error = None
    except Exception as exc:
        st.session_state.session = None
        st.session_state.user = None
        st.session_state.auth_error = str(exc)


def sign_up(email: str, password: str, display_name: str | None = None) -> None:
    """Register a new user. When email confirmation is enabled in the project,
    the session is None until the user clicks the link; surface a notice."""
    try:
        resp = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"display_name": display_name}} if display_name else {},
        })
        if resp.session:
            st.session_state.session = resp.session
            st.session_state.user = resp.user
        else:
            st.session_state.auth_notice = (
                "Account created. Check your inbox for the confirmation link, "
                "then come back and sign in."
            )
        st.session_state.auth_error = None
    except Exception as exc:
        st.session_state.auth_error = str(exc)


def sign_out() -> None:
    """Clear local state and revoke the Supabase token."""
    try:
        supabase.auth.sign_out()
    except Exception:
        pass
    st.session_state.session = None
    st.session_state.user = None
    st.session_state.auth_error = None
    st.session_state.auth_notice = None


# ---------------------------------------------------------------------------
# Data access — every operation is keyed on the authenticated user's id.
# RLS on the database mirrors this; this client-side filter is defense in
# depth and a query-planner hint.
# ---------------------------------------------------------------------------
def insert_transaction(payload: dict) -> dict:
    response = supabase.table("transactions").insert(payload).execute()
    return response.data


def fetch_transactions(user_id: str) -> pd.DataFrame:
    response = (
        supabase.table("transactions")
        .select("*")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .order("id", desc=True)
        .execute()
    )
    rows = response.data or []
    df = pd.DataFrame(rows)
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"]).dt.date
        for col in ("amount", "discount_amount", "original_amount"):
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    return df


# ---------------------------------------------------------------------------
# Money helpers
# ---------------------------------------------------------------------------
def fmt_money(amount: float, currency: str) -> str:
    """Native-currency formatter. IDR is whole rupiah; USD has 2dp."""
    if currency == "IDR":
        return f"Rp {amount:,.0f}"
    return f"$ {amount:,.2f}"


def fmt_compact(amount: float, currency: str):
    """Return (symbol, whole, frac) for the big KPI numerals."""
    v = abs(amount)
    if currency == "IDR":
        sym = "Rp"
        if v >= 1_000_000_000:
            return sym, f"{v/1e9:.2f}", "B"
        if v >= 1_000_000:
            return sym, f"{v/1e6:.2f}", "M"
        if v >= 1_000:
            return sym, f"{v/1e3:.1f}", "k"
        return sym, f"{v:,.0f}", ""
    sym = "$"
    if v >= 1_000_000:
        return sym, f"{v/1e6:.2f}", "M"
    if v >= 10_000:
        return sym, f"{v/1e3:.1f}", "k"
    whole, frac = f"{v:,.2f}".split(".")
    return sym, whole, "." + frac


def to_currency(amount: float, src_ccy: str, dst_ccy: str) -> float:
    """Convert between IDR and USD using the reference FX rate."""
    if src_ccy == dst_ccy:
        return amount
    if src_ccy == "USD" and dst_ccy == "IDR":
        return amount * FX_IDR_PER_USD
    if src_ccy == "IDR" and dst_ccy == "USD":
        return amount / FX_IDR_PER_USD
    return amount


def usd_equiv(amount: float, ccy: str) -> float:
    return to_currency(amount, ccy, "USD")


# ---------------------------------------------------------------------------
# KPI computation + card rendering
# ---------------------------------------------------------------------------
def split_periods(df: pd.DataFrame):
    """Return (current_month_df, previous_month_df) based on the latest month
    present in the data. Used for the 'vs last period' delta."""
    if df.empty:
        return df, df
    months = sorted({(d.year, d.month) for d in df["date"]}, reverse=True)
    cur = months[0]
    cur_df = df[df["date"].apply(lambda d: (d.year, d.month) == cur)]
    if len(months) > 1:
        prev = months[1]
        prev_df = df[df["date"].apply(lambda d: (d.year, d.month) == prev)]
    else:
        prev_df = df.iloc[0:0]
    return cur_df, prev_df


def _spark(kind: str, color: str):
    """Deterministic mini-bars, matching the mockup's decorative sparkline."""
    import math
    seed = ord(kind[0]) % 5
    bars = []
    for i in range(14):
        h = 0.3 + 0.7 * abs(math.sin((i + seed) * 0.85))
        last = i == 13
        c = color if last else "var(--border-strong)"
        op = "1" if last else ".55"
        bars.append(f'<span style="height:{h*100:.0f}%;background:{c};opacity:{op}"></span>')
    return "".join(bars)


def kpi_card_html(label, kind, totals, prev_totals, ccy_view) -> str:
    """Build one KPI card.

    totals / prev_totals: dict {'IDR': x, 'USD': y}
    ccy_view: 'Both' | 'USD' | 'IDR'
    """
    color = {"income": "var(--income)", "expense": "var(--expense)", "net": "var(--text)"}[kind]
    dot_soft = {"income": "var(--income-soft)", "expense": "var(--expense-soft)", "net": "rgba(255,255,255,0.05)"}[kind]

    # Delta is always computed on the combined USD-equivalent so it's stable
    # across display modes.
    cur_usd = usd_equiv(totals["IDR"], "IDR") + usd_equiv(totals["USD"], "USD")
    pre_usd = usd_equiv(prev_totals["IDR"], "IDR") + usd_equiv(prev_totals["USD"], "USD")
    if pre_usd == 0:
        delta_label, delta_color = "—", "var(--muted)"
    else:
        pct = (cur_usd - pre_usd) / abs(pre_usd) * 100
        sign = "+" if pct > 0 else ""
        delta_label = f"{sign}{pct:.1f}%"
        good = pct < 0 if kind == "expense" else pct > 0
        delta_color = "var(--income)" if (pct != 0 and good) else ("var(--expense)" if pct != 0 else "var(--muted)")

    # Primary / secondary figures
    if ccy_view == "Both":
        sym, whole, frac = fmt_compact(totals["IDR"], "IDR")
        neg = "−" if (kind == "net" and totals["IDR"] < 0) else ""
        ssym, swhole, sfrac = fmt_compact(totals["USD"], "USD")
        sneg = "−" if (kind == "net" and totals["USD"] < 0) else ""
        second = (
            f'<div class="kpi-second"><span style="color:var(--muted)">+ {ssym}</span>'
            f'<span>{sneg}{swhole}{sfrac}</span></div>'
        )
    else:
        target = ccy_view
        val = (usd_equiv(totals["IDR"], "IDR") + usd_equiv(totals["USD"], "USD")) if target == "USD" \
            else (totals["IDR"] + totals["USD"] * FX_IDR_PER_USD)
        sym, whole, frac = fmt_compact(val, target)
        neg = "−" if (kind == "net" and val < 0) else ""
        second = ""

    frac_html = f'<span class="kpi-frac">{frac}</span>' if frac else ""

    return f"""
    <div class="kpi-card">
      <div class="kpi-head">
        <span class="kpi-label">{html.escape(label)}</span>
        <span class="kpi-dot" style="background:{color};box-shadow:0 0 0 3px {dot_soft}"></span>
      </div>
      <div class="kpi-numeral">
        <span class="kpi-sym lg-mono">{sym}</span>
        <span class="kpi-big" style="color:{color}">{neg}{whole}</span>
        {frac_html}
      </div>
      {second}
      <div class="kpi-foot">
        <div class="kpi-deltawrap">
          <span class="kpi-deltacap">vs last period</span>
          <span class="kpi-delta" style="color:{delta_color}">{delta_label}</span>
        </div>
        <div class="kpi-spark">{_spark(kind, color)}</div>
      </div>
    </div>
    """


def render_kpis(df: pd.DataFrame, ccy_view: str) -> None:
    cur_df, prev_df = split_periods(df)

    def totals(frame, txn_type):
        out = {"IDR": 0.0, "USD": 0.0}
        if frame.empty:
            return out
        sub = frame[frame["type"] == txn_type]
        for ccy in ("IDR", "USD"):
            out[ccy] = float(sub[sub["currency"] == ccy]["amount"].sum())
        return out

    inc = totals(cur_df, "Income")
    exp = totals(cur_df, "Expense")
    net = {c: inc[c] - exp[c] for c in ("IDR", "USD")}
    p_inc = totals(prev_df, "Income")
    p_exp = totals(prev_df, "Expense")
    p_net = {c: p_inc[c] - p_exp[c] for c in ("IDR", "USD")}

    cards = (
        kpi_card_html("Total income", "income", inc, p_inc, ccy_view)
        + kpi_card_html("Total expenses", "expense", exp, p_exp, ccy_view)
        + kpi_card_html("Net cash flow", "net", net, p_net, ccy_view)
    )
    st.markdown(f'<div class="kpi-row">{cards}</div>', unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Transactions table (custom HTML — always native currency)
# ---------------------------------------------------------------------------
def _fmt_date_rel(d: date) -> str:
    today = date.today()
    diff = (today - d).days
    if diff == 0:
        return "Today"
    if diff == 1:
        return "Yesterday"
    return d.strftime("%-d %b") if hasattr(d, "strftime") else str(d)


def amount_cell_html(row) -> str:
    is_income = row["type"] == "Income"
    sign = "+" if is_income else "−"
    color = "var(--income)" if is_income else "var(--text)"
    parts = fmt_money(row["amount"], row["currency"])
    sym, rest = parts.split(" ", 1)
    show_orig = (
        bool(row.get("has_discount"))
        and row.get("original_amount", 0) and row["original_amount"] > row["amount"]
    )
    strike = ""
    if show_orig:
        strike = f'<span class="amt-strike">{html.escape(fmt_money(row["original_amount"], row["currency"]))}</span>'
    return (
        f'{strike}'
        f'<span class="amt-sym">{html.escape(sym)} </span>'
        f'<span class="amt-main" style="color:{color}">{sign}{html.escape(rest)}</span>'
    )


def flags_html(row) -> str:
    out = []
    if row.get("is_subscription"):
        out.append('<span class="flag">Recurring</span>')
    if row.get("has_discount") and row.get("discount_amount", 0):
        saved = fmt_money(row["discount_amount"], row["currency"])
        out.append(f'<span class="flag save">Saved {html.escape(saved)}</span>')
    elif row.get("has_discount"):
        out.append('<span class="flag save">Discount</span>')
    if not out:
        return ""
    return '<div style="display:flex;gap:6px;flex-wrap:wrap">' + " ".join(out) + "</div>"


def render_table(df: pd.DataFrame) -> None:
    head = """
    <table class="ledger-table">
      <thead><tr>
        <th>Date</th><th>Type</th><th>Vendor / Location</th>
        <th>Category</th><th>Ccy</th><th class="num">Amount</th>
      </tr></thead><tbody>
    """
    body = []
    for _, row in df.iterrows():
        is_income = row["type"] == "Income"
        dir_fg = "var(--income)" if is_income else "var(--expense)"
        dir_bg = "var(--income-soft)" if is_income else "var(--expense-soft)"
        arrow = "↓" if is_income else "↑"
        cat = row["category"]
        chip = (
            f'<span class="cat-chip">'
            f'<span style="color:{category_color(cat)};font-size:13px">{category_glyph(cat)}</span>'
            f'{html.escape(str(cat))}</span>'
        )
        body.append(f"""
        <tr>
          <td class="cell-date">{html.escape(_fmt_date_rel(row["date"]))}</td>
          <td><span class="dir-tag" style="color:{dir_fg};background:{dir_bg}">{arrow} {html.escape(row["type"])}</span></td>
          <td class="cell-vendor">{html.escape(str(row.get("vendor_location") or "—"))}{flags_html(row)}</td>
          <td>{chip}</td>
          <td class="cell-ccy">{html.escape(row["currency"])}</td>
          <td class="cell-amt">{amount_cell_html(row)}</td>
        </tr>
        """)
    st.markdown(head + "".join(body) + "</tbody></table>", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# LOGIN GATEWAY
# ---------------------------------------------------------------------------
def render_login() -> None:
    inject_theme()

    left, right = st.columns([1, 1], gap="large")

    with left:
        st.markdown(
            """
            <div class="brandmark" style="margin-bottom:28px">
              <svg width="26" height="26" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" fill="#d4ff3a"/><path d="M8 12.5 11 15.5 16.5 9" stroke="#0a0c10" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
              <span style="font-size:16px;font-weight:600;color:var(--text)">Ledger</span>
            </div>
            <p class="login-quote">Every <em>rupiah</em> &amp;<br/>every <em>dollar</em>,<br/>in one ledger.</p>
            <p style="margin-top:16px;font-size:14px;line-height:1.55;color:var(--muted);max-width:360px">
              A private financial journal for people who bill in multiple currencies and
              don't want a bank in the middle of their notes.
            </p>
            """,
            unsafe_allow_html=True,
        )

    with right:
        if st.session_state.auth_notice:
            st.info(st.session_state.auth_notice)
            st.session_state.auth_notice = None

        tab_signin, tab_signup = st.tabs(["Sign in", "Create account"])

        with tab_signin:
            with st.form("signin_form"):
                st.markdown("#### Welcome back.")
                email = st.text_input("Email", key="signin_email", autocomplete="username")
                password = st.text_input("Password", type="password", key="signin_pw", autocomplete="current-password")
                st.checkbox("Keep me signed in on this device", value=True)
                submitted = st.form_submit_button("Sign in to ledger", use_container_width=True, type="primary")
                if submitted:
                    if not email or not password:
                        st.warning("Please provide both email and password.")
                    else:
                        sign_in(email.strip(), password)
                        if st.session_state.session is not None:
                            st.rerun()

        with tab_signup:
            with st.form("signup_form"):
                st.markdown("#### Start a new ledger.")
                name = st.text_input("Display name", key="signup_name", placeholder="e.g. Marko Halim")
                email = st.text_input("Email", key="signup_email", autocomplete="email")
                password = st.text_input(
                    "Choose a password", type="password", key="signup_pw",
                    help="Use at least 12 characters.", autocomplete="new-password",
                )
                agreed = st.checkbox("I understand my ledger is private to my account")
                submitted = st.form_submit_button("Create my ledger", use_container_width=True, type="primary")
                if submitted:
                    if not email or not password:
                        st.warning("Please provide email and password.")
                    elif len(password) < 12:
                        st.warning("Password should be at least 12 characters.")
                    elif not agreed:
                        st.warning("Please acknowledge the privacy note.")
                    else:
                        sign_up(email.strip(), password, name.strip() or None)
                        if st.session_state.session is not None:
                            st.rerun()

        if st.session_state.auth_error:
            st.error(f"Authentication failed: {st.session_state.auth_error}")

        st.markdown(
            '<p style="margin-top:18px;font-size:11.5px;color:var(--muted)">🔒 Auth via Supabase. '
            'Postgres RLS scopes every row to its owner.</p>',
            unsafe_allow_html=True,
        )


# ---------------------------------------------------------------------------
# Sidebar — transaction entry form
# ---------------------------------------------------------------------------
def render_sidebar_form(user_id: str) -> None:
    with st.sidebar:
        st.markdown(
            """
            <div class="brandmark" style="margin-bottom:6px">
              <svg width="22" height="22" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" fill="#d4ff3a"/><path d="M8 12.5 11 15.5 16.5 9" stroke="#0a0c10" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
              <span style="font-size:14px;font-weight:600;color:var(--text)">Ledger</span>
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.header("➕ New transaction")

        # has_discount lives OUTSIDE the form so the conditional discount field
        # re-renders the instant it's flipped.
        has_discount = st.checkbox(
            "Discount applied", key="entry_has_discount",
            help="Receipt shows a discount, voucher, or comp.",
        )

        with st.form("entry_form", clear_on_submit=True):
            txn_date = st.date_input("Date", value=date.today())
            txn_type = st.selectbox("Direction", options=["Income", "Expense"])
            col_amt, col_ccy = st.columns([3, 1])
            with col_amt:
                amount = st.number_input(
                    "Amount paid", min_value=0.0, value=0.0, step=1000.0, format="%.2f",
                    help="The final amount actually paid after any discount.",
                )
            with col_ccy:
                currency = st.selectbox("Ccy", options=["IDR", "USD"])

            discount_amount = 0.0
            if has_discount:
                discount_amount = st.number_input(
                    "Discount amount", min_value=0.0, value=0.0, step=1000.0, format="%.2f",
                    help="How much was knocked off the bill.",
                )
                st.caption(f"Normal price: **{fmt_money(amount + discount_amount, currency)}**")
            original_amount = amount + discount_amount

            category = st.selectbox("Category", options=CATEGORIES)
            vendor_location = st.text_input(
                "Vendor / location", placeholder="e.g. Kopi Kenangan · Pacific Place",
            )
            is_subscription = st.checkbox("Recurring subscription")

            submitted = st.form_submit_button("Save transaction", use_container_width=True, type="primary")

            if submitted:
                if amount <= 0:
                    st.error("Amount must be greater than zero.")
                    return
                payload = {
                    "date": txn_date.isoformat(),
                    "type": txn_type,
                    "amount": float(amount),
                    "currency": currency,
                    "category": category,
                    "vendor_location": vendor_location.strip(),
                    "has_discount": bool(has_discount),
                    "discount_amount": float(discount_amount),
                    "original_amount": float(original_amount),
                    "is_subscription": bool(is_subscription),
                    "user_id": user_id,
                }
                try:
                    insert_transaction(payload)
                    st.success("Transaction saved.")
                    st.rerun()
                except Exception as exc:
                    st.error(f"Failed to save transaction: {exc}")

        st.divider()
        if st.button("🚪 Log out", use_container_width=True):
            sign_out()
            st.rerun()


# ---------------------------------------------------------------------------
# Main dashboard
# ---------------------------------------------------------------------------
def render_dashboard() -> None:
    inject_theme()

    user = st.session_state.user
    user_id = user.id
    user_meta = getattr(user, "user_metadata", {}) or {}
    display_name = user_meta.get("display_name") or getattr(user, "email", "you")

    st.title("💸 Financial Ledger")
    st.caption(f"Signed in as **{display_name}** · `{str(user.id)[:8]}…`")

    render_sidebar_form(user_id)

    try:
        df = fetch_transactions(user_id)
    except Exception as exc:
        st.error(f"Failed to load transactions: {exc}")
        df = pd.DataFrame()

    # --- Overview ---
    head_l, head_r = st.columns([2, 1])
    with head_l:
        st.subheader("Overview")
    with head_r:
        ccy_view = st.radio(
            "KPI currency", options=["Both", "USD", "IDR"],
            horizontal=True, label_visibility="collapsed",
            help="Transactions are always listed in their native currency below; "
                 "this only affects the aggregate metrics.",
        )

    if df.empty:
        st.markdown(
            '<div class="kpi-row">'
            + "".join(
                f'<div class="kpi-card"><span class="kpi-label">{l}</span>'
                f'<span class="kpi-big" style="color:var(--dim)">—</span>'
                f'<span class="kpi-deltacap">Awaiting first entry</span></div>'
                for l in ("Total income", "Total expenses", "Net cash flow")
            )
            + "</div>",
            unsafe_allow_html=True,
        )
    else:
        render_kpis(df, ccy_view)

    st.divider()

    # --- Transactions (native currency, always) ---
    st.subheader("Transactions")
    if df.empty:
        st.info("No transactions yet. Use the sidebar to add your first entry.")
    else:
        render_table(df)

        st.write("")
        csv_bytes = df.to_csv(index=False).encode("utf-8")
        st.download_button(
            "⬇️  Export to CSV", data=csv_bytes,
            file_name=f"transactions-{datetime.utcnow().strftime('%Y%m%d')}.csv",
            mime="text/csv",
        )


# ---------------------------------------------------------------------------
# Router — gate the dashboard behind a valid session.
# ---------------------------------------------------------------------------
def main() -> None:
    if st.session_state.session is None or st.session_state.user is None:
        render_login()
    else:
        render_dashboard()


if __name__ == "__main__":
    main()
