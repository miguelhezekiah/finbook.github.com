# app.py
# Secure Financial Ledger — Streamlit + Supabase
# ---------------------------------------------------------------------------
# Single-file application. Hosts a personal financial journal that supports:
#   - Email/password authentication via Supabase (sign-in & sign-up)
#   - Multi-user (every row is scoped to user_id; RLS enforces isolation)
#   - Multi-currency (IDR + USD) — transactions are stored & displayed in
#     their native currency; aggregated KPIs can be viewed in USD, IDR, or
#     both at once
#   - Discount tracking — when has_discount is checked, capture the
#     discount_amount and persist the original (pre-discount) price too
#
# Schema is documented in sql/schema.sql. Credentials live in
# .streamlit/secrets.toml (see .streamlit/secrets.toml.example).
# ---------------------------------------------------------------------------

import streamlit as st
import pandas as pd
from datetime import date, datetime
from supabase import create_client, Client

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
    "auth_mode": "signin",   # 'signin' | 'signup'
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
    """Register a new user. Supabase may require email verification depending
    on the project's auth settings — when verification is on, the session is
    None until the user clicks the link in their inbox; surface a notice."""
    try:
        resp = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"display_name": display_name}} if display_name else {},
        })
        if resp.session:
            # Email confirmation is off — the user is immediately signed in.
            st.session_state.session = resp.session
            st.session_state.user = resp.user
            st.session_state.auth_error = None
        else:
            # Email confirmation required.
            st.session_state.auth_notice = (
                "Account created. Check your inbox for the confirmation link, "
                "then come back and sign in."
            )
            st.session_state.auth_mode = "signin"
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


def to_currency(amount: float, src_ccy: str, dst_ccy: str) -> float:
    """Convert between IDR and USD using the reference FX rate."""
    if src_ccy == dst_ccy:
        return amount
    if src_ccy == "USD" and dst_ccy == "IDR":
        return amount * FX_IDR_PER_USD
    if src_ccy == "IDR" and dst_ccy == "USD":
        return amount / FX_IDR_PER_USD
    return amount  # unknown pair


# ---------------------------------------------------------------------------
# LOGIN GATEWAY
# ---------------------------------------------------------------------------
def render_login() -> None:
    """Render the login/sign-up form. Sets session_state on success."""
    st.title("🔐 Financial Ledger")
    st.caption("Multi-user · multi-currency · row-level secure")

    # Sign-in / sign-up tabs
    mode_label = "Sign in" if st.session_state.auth_mode == "signin" else "Create account"
    tab_signin, tab_signup = st.tabs(["Sign in", "Create account"])

    if st.session_state.auth_notice:
        st.info(st.session_state.auth_notice)
        st.session_state.auth_notice = None

    with tab_signin:
        with st.form("signin_form"):
            email = st.text_input("Email", key="signin_email", autocomplete="username")
            password = st.text_input("Password", type="password", key="signin_pw", autocomplete="current-password")
            keep = st.checkbox("Keep me signed in on this device", value=True)
            submitted = st.form_submit_button("Sign in to ledger", use_container_width=True)
            if submitted:
                if not email or not password:
                    st.warning("Please provide both email and password.")
                else:
                    sign_in(email.strip(), password)
                    if st.session_state.session is not None:
                        st.rerun()

    with tab_signup:
        with st.form("signup_form"):
            name = st.text_input("Display name", key="signup_name", placeholder="e.g. Marko Halim")
            email = st.text_input("Email", key="signup_email", autocomplete="email")
            password = st.text_input(
                "Choose a password", type="password", key="signup_pw",
                help="Use at least 12 characters.",
                autocomplete="new-password",
            )
            agreed = st.checkbox(
                "I understand my ledger is private to my account",
                help="Other users on this database cannot read or list your rows.",
            )
            submitted = st.form_submit_button("Create my ledger", use_container_width=True)
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


# ---------------------------------------------------------------------------
# Sidebar — transaction entry form
# ---------------------------------------------------------------------------
def render_sidebar_form(user_id: str) -> None:
    with st.sidebar:
        st.header("➕ New transaction")

        # has_discount toggle lives OUTSIDE the form so the conditional
        # discount-amount field can re-render the moment it's flipped.
        # The form submits a single insert.
        has_discount = st.checkbox(
            "Discount applied",
            key="entry_has_discount",
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

            # Conditional: discount amount + live "normal price" readout.
            discount_amount = 0.0
            if has_discount:
                discount_amount = st.number_input(
                    "Discount amount",
                    min_value=0.0, value=0.0, step=1000.0, format="%.2f",
                    help="How much was knocked off the bill.",
                )
                original = amount + discount_amount
                st.caption(f"Normal price: **{fmt_money(original, currency)}**")
            original_amount = amount + discount_amount

            category = st.selectbox("Category", options=CATEGORIES)
            vendor_location = st.text_input(
                "Vendor / location", placeholder="e.g. Kopi Kenangan · Pacific Place",
            )
            is_subscription = st.checkbox("Recurring subscription")

            submitted = st.form_submit_button("Save transaction", use_container_width=True)

            if submitted:
                # Validation — amount must be > 0. discount_amount may be 0
                # even when has_discount is true (rare but legal).
                if amount <= 0:
                    st.error("Amount must be greater than zero.")
                    return
                if has_discount and discount_amount < 0:
                    st.error("Discount amount cannot be negative.")
                    return

                # user_id is always pulled from the authenticated session,
                # never trusted from the client form.
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
# Main panel
# ---------------------------------------------------------------------------
def render_metrics(df: pd.DataFrame, ccy_view: str) -> None:
    """Render the three KPI cards.

    ccy_view ∈ {'Both', 'USD', 'IDR'}:
      - 'Both' — show IDR and USD side-by-side in their native currencies
                 (no conversion mixing).
      - 'USD' or 'IDR' — show one converted total per card.
    """
    col1, col2, col3 = st.columns(3)

    if df.empty:
        col1.metric("Total income", "—")
        col2.metric("Total expenses", "—")
        col3.metric("Net cash flow", "—")
        return

    if ccy_view == "Both":
        # Native aggregation, no FX. The metric line shows the larger-volume
        # currency; the delta line shows the other.
        grouped = (
            df.groupby(["currency", "type"])["amount"].sum().unstack(fill_value=0.0)
        )
        income = grouped.get("Income",  pd.Series(dtype=float))
        expense = grouped.get("Expense", pd.Series(dtype=float))
        net = income.subtract(expense, fill_value=0.0)

        def render(card, label, series):
            if series.empty:
                card.metric(label, "—")
                return
            ordered = series.reindex(["IDR", "USD"]).fillna(0.0)
            primary_ccy = "IDR" if ordered["IDR"] != 0 or ordered["USD"] == 0 else "USD"
            secondary_ccy = "USD" if primary_ccy == "IDR" else "IDR"
            card.metric(
                label,
                fmt_money(ordered[primary_ccy], primary_ccy),
                delta=f"+ {fmt_money(ordered[secondary_ccy], secondary_ccy)}",
                delta_color="off",
            )

        render(col1, "Total income",   income)
        render(col2, "Total expenses", expense)
        render(col3, "Net cash flow",  net)
        return

    # Single-currency view — convert and sum.
    target = ccy_view  # 'USD' or 'IDR'

    def converted_sum(rows: pd.DataFrame) -> float:
        return float(sum(
            to_currency(r["amount"], r["currency"], target) for _, r in rows.iterrows()
        ))

    income = converted_sum(df[df["type"] == "Income"])
    expense = converted_sum(df[df["type"] == "Expense"])
    net = income - expense

    col1.metric("Total income",   fmt_money(income,  target))
    col2.metric("Total expenses", fmt_money(expense, target))
    col3.metric("Net cash flow",  fmt_money(net,     target))


def render_dashboard() -> None:
    user = st.session_state.user
    user_id = user.id
    user_meta = getattr(user, "user_metadata", {}) or {}
    display_name = user_meta.get("display_name") or getattr(user, "email", "you")

    # Header
    st.title("💸 Financial Ledger")
    st.caption(f"Signed in as **{display_name}** · `{user.id[:8]}…`")

    # Sidebar entry form
    render_sidebar_form(user_id)

    # Load data
    try:
        df = fetch_transactions(user_id)
    except Exception as exc:
        st.error(f"Failed to load transactions: {exc}")
        df = pd.DataFrame()

    # --- KPI currency selector ---
    st.subheader("Overview")
    ccy_view = st.radio(
        "KPI currency",
        options=["Both", "USD", "IDR"],
        horizontal=True, label_visibility="collapsed",
        help="Transactions are always listed in their native currency below; "
             "this only affects the aggregate metrics.",
    )
    render_metrics(df, ccy_view)

    st.divider()

    # --- Transactions table ---
    # Always native currency — never converted. The user can read off the
    # actual amount that hit their bank statement.
    st.subheader("Transactions")
    if df.empty:
        st.info("No transactions yet. Use the sidebar to add your first entry.")
    else:
        # Build a display copy with a formatted "amount" string per row.
        display = df.copy()
        display["Amount"] = display.apply(
            lambda r: ("+ " if r["type"] == "Income" else "− ")
                      + fmt_money(r["amount"], r["currency"]),
            axis=1,
        )
        if "original_amount" in display.columns:
            display["Original"] = display.apply(
                lambda r: fmt_money(r["original_amount"], r["currency"])
                if r.get("has_discount") and r.get("original_amount") and r["original_amount"] > r["amount"]
                else "",
                axis=1,
            )
        if "discount_amount" in display.columns:
            display["Discount"] = display.apply(
                lambda r: fmt_money(r["discount_amount"], r["currency"])
                if r.get("has_discount") and r.get("discount_amount") else "",
                axis=1,
            )

        cols_in_order = [
            "date", "type", "category", "vendor_location",
            "currency", "Amount", "Original", "Discount",
            "has_discount", "is_subscription",
        ]
        present = [c for c in cols_in_order if c in display.columns]
        st.dataframe(
            display[present].rename(columns={
                "date": "Date", "type": "Type", "category": "Category",
                "vendor_location": "Vendor / Location", "currency": "Ccy",
                "has_discount": "Disc?", "is_subscription": "Sub?",
            }),
            use_container_width=True, hide_index=True,
        )

    st.divider()

    # --- CSV export ---
    st.subheader("Export")
    if df.empty:
        st.download_button(
            "⬇️ Export to CSV", data="", file_name="transactions.csv",
            mime="text/csv", disabled=True,
        )
    else:
        csv_bytes = df.to_csv(index=False).encode("utf-8")
        st.download_button(
            "⬇️ Export to CSV", data=csv_bytes,
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
