# Financial Ledger

A private, multi-currency financial journal built with **Streamlit** and **Supabase**. Designed for people who bill in more than one currency and don't want a bank in the middle of their notes.

> **Stack:** Streamlit · Supabase (Postgres + Auth) · Pandas
> **Auth:** email/password sign-in & sign-up · row-level security
> **Currencies:** IDR + USD (native storage, on-the-fly KPI conversion)

---

## Features

- 🔐 **Login gateway** — Supabase email/password auth. Sign-in and sign-up tabs. Sessions kept in `st.session_state`. The dashboard never renders until a valid session exists.
- 👥 **Multi-user out of the box** — every row is scoped to `user_id`. Row-Level Security policies in Postgres enforce isolation; the client filter is defense in depth.
- 💱 **True multi-currency** — transactions are stored and listed in their **native currency** (IDR or USD). KPI cards can be viewed in **USD only**, **IDR only**, or **both side-by-side**.
- 🏷️ **Discount tracking** — when a discount is applied, capture the discount amount; the **original (pre-discount) price** is stored alongside.
- ♻️ **Recurring flag** — mark bills that repeat on a fixed schedule.
- 📊 **KPI overview** — Total Income, Total Expenses, Net Cash Flow.
- 📥 **CSV export** — one click, dated filename.

---

## Repository layout

```
.
├── app.py                       # Streamlit application (single file)
├── requirements.txt             # Pinned Python dependencies
├── sql/
│   └── schema.sql               # Table DDL, indexes, RLS policies, triggers
├── .streamlit/
│   ├── config.toml              # Visual theme (dark + electric-lime)
│   └── secrets.toml.example     # Template for SUPABASE_URL / SUPABASE_KEY
├── Finance Ledger.html          # Hi-fi design preview (open in browser)
├── src/                         # JSX building blocks for the design preview
└── .gitignore
```

---

## Setup

### 1. Provision the Supabase project

1. Create a project at <https://supabase.com>.
2. Open the SQL editor and run `sql/schema.sql`. This creates the `transactions` table, indexes, and the four RLS policies that scope every row to its owner.
3. Confirm RLS is **on** for `public.transactions` (Supabase shows a green shield in the Table editor).

### 2. Configure secrets

```bash
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
```

Open `.streamlit/secrets.toml` and paste your project's **URL** and **anon public key** (`Project Settings → API`). The anon key is safe for the client because RLS enforces all access. Never put the `service_role` key here.

### 3. Install dependencies

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Run locally

```bash
streamlit run app.py
```

The app opens at <http://localhost:8501>. Create an account from the **Create account** tab, then sign in.

---

## Deployment

### Streamlit Community Cloud

1. Push this repo to GitHub.
2. Connect the repo at <https://share.streamlit.io>.
3. In the app's **Secrets** panel, paste the same two keys from `.streamlit/secrets.toml`.

### Other hosts

The app is a vanilla Streamlit script — it will run on any host that supports Python 3.11+ and can serve a process on a port (Hugging Face Spaces, Fly.io, Render, a VPS, …). Set `SUPABASE_URL` / `SUPABASE_KEY` as environment variables or as Streamlit secrets, whichever the host prefers.

---

## Database schema (summary)

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary key |
| `date` | `date` | Transaction date |
| `type` | `text` | `'Income'` or `'Expense'` |
| `amount` | `float8` | **Final amount actually paid** |
| `currency` | `text` | `'IDR'` or `'USD'` |
| `category` | `text` | One of 13 presets |
| `vendor_location` | `text` | Free text |
| `has_discount` | `boolean` | If true, the next two fields describe it |
| `discount_amount` | `float8` | Amount knocked off the bill |
| `original_amount` | `float8` | `amount + discount_amount` (stored, validated) |
| `is_subscription` | `boolean` | Recurring bill flag |
| `user_id` | `uuid` | Owner — references `auth.users(id)` |
| `created_at` / `updated_at` | `timestamptz` | Auto-managed |

A `check` constraint enforces `original_amount = amount + discount_amount` whenever `has_discount` is true.

---

## Design preview

`Finance Ledger.html` is a hi-fi mockup of the target UI rendered with React + inline JSX (no build step). Open it directly in any modern browser, or serve the repo root with GitHub Pages:

1. In repo **Settings → Pages**, set the source to `main` / `/`.
2. Rename `Finance Ledger.html` to `index.html` (or add a small `index.html` that redirects to it).
3. Visit `https://<user>.github.io/<repo>`.

The preview includes 4 artboards on a design canvas:

1. **Login gateway** (sign-in / sign-up)
2. **Empty state** (first-time user)
3. **Main dashboard** (KPIs + transactions)
4. **Add-transaction modal** (rich form with conditional discount fields)

A live **Tweaks** panel toggles dark/light, KPI currency mode (Both / USD / IDR), and table density.

---

## Security notes

- Every database operation goes through RLS policies keyed on `auth.uid()`. There is no admin bypass in this codebase.
- The anon public key is the only credential the app holds. Rotating it via Supabase invalidates any forked deploys.
- Passwords never reach the application — Supabase Auth handles hashing and verification.
- Sign-up may require email verification depending on your project's Auth settings. The app surfaces the verification notice and stays at the sign-in tab until the link is clicked.

---

## License

MIT — do what you want, attribution appreciated.
