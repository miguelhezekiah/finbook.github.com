// ledger-screens.jsx
// The 4 artboard screens:
//   1. Login / auth gateway
//   2. Empty state (first-time user, sidebar form visible)
//   3. Main dashboard (with data, KPIs, table)
//   4. Add-transaction interaction (modal expander open over dashboard)

// ─── Sidebar Form (reused by screens 2 & 3) ───────────────────────────────
function EntryFormSidebar({ t, dark, full }) {
  // `full` toggles every field on (full sheet) vs the compact sidebar.
  const [type, setType] = React.useState('Expense');
  const [currency, setCurrency] = React.useState('IDR');
  const [amount, setAmount] = React.useState('287500');
  const [category, setCategory] = React.useState('Food & Beverage');
  const [vendor, setVendor] = React.useState('Tokyo Skipjack · Senopati');
  const [date, setDate] = React.useState('2026-05-15');
  const [hasDiscount, setHasDiscount] = React.useState(true);
  const [discount, setDiscount] = React.useState('65000');
  const [isSub, setIsSub] = React.useState(false);

  // Compute the original (pre-discount) price for live display.
  const paidNum     = Number(String(amount).replace(/[^\d.]/g, '')) || 0;
  const discountNum = Number(String(discount).replace(/[^\d.]/g, '')) || 0;
  const originalNum = paidNum + discountNum;
  const origFmt     = fmtMoney(originalNum, currency);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <FieldLabel t={t}>Direction</FieldLabel>
        <Segment t={t} value={type} onChange={setType}
          options={[{ value: 'Income', label: 'Income', icon: 'arrowDn' },
                    { value: 'Expense', label: 'Expense', icon: 'arrowUp' }]} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FieldLabel t={t}>Amount</FieldLabel>
          <TextInput t={t} value={amount} onChange={setAmount} mono
            prefix={currency === 'IDR' ? 'Rp' : '$'} />
        </div>
        <div style={{ width: 96 }}>
          <FieldLabel t={t}>Ccy</FieldLabel>
          <Select t={t} value={currency} onChange={setCurrency} options={['IDR', 'USD']} />
        </div>
      </div>

      <div>
        <FieldLabel t={t} hint={fmtDate(date)}>Date</FieldLabel>
        <TextInput t={t} value={date} onChange={setDate} prefix={<Icon name="cal" size={13} color={t.muted} />} />
      </div>

      <div>
        <FieldLabel t={t}>Category</FieldLabel>
        <Select t={t} value={category} onChange={setCategory}
          options={Object.keys(CATEGORY_PALETTE)} />
      </div>

      <div>
        <FieldLabel t={t} hint="optional">Vendor / location</FieldLabel>
        <TextInput t={t} value={vendor} onChange={setVendor} placeholder="e.g. Kopi Kenangan · Pacific Place" />
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: 12, border: `1px solid ${t.border}`, borderRadius: 10,
      }}>
        <Checkbox t={t} checked={hasDiscount} onChange={setHasDiscount}
          label="Discount applied" sub="Receipt shows a discount, voucher, or comp" />

        {/* Discount details — only when the toggle is on. Shows the discount
            amount input and a computed "normal price" line so the user
            understands what gets stored. */}
        {hasDiscount && (
          <div style={{
            marginTop: 2, marginLeft: 26,
            paddingLeft: 12, borderLeft: `2px solid ${t.accentLine}`,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div>
              <FieldLabel t={t} hint="amount knocked off">Discount amount</FieldLabel>
              <TextInput t={t} value={discount} onChange={setDiscount} mono
                prefix={currency === 'IDR' ? 'Rp' : '$'} />
            </div>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              fontSize: 11.5, paddingTop: 2,
            }}>
              <span style={{ color: t.muted }}>Normal price</span>
              <span className="ledger-mono" style={{ color: t.textSoft, fontWeight: 500 }}>
                {origFmt.symbol}{origFmt.whole}{origFmt.frac}
              </span>
            </div>
          </div>
        )}

        <Checkbox t={t} checked={isSub} onChange={setIsSub}
          label="Recurring subscription" sub="Bill repeats on a fixed schedule" />
      </div>

      {full && (
        <div>
          <FieldLabel t={t} hint="optional">Notes</FieldLabel>
          <textarea placeholder="Anything worth remembering later…" style={{
            width: '100%', minHeight: 84, resize: 'vertical',
            background: t.inset, border: `1px solid ${t.border}`,
            borderRadius: 8, padding: 10, fontSize: 13, color: t.text,
            outline: 'none', fontFamily: 'inherit',
          }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Button t={t} kind="primary" icon="check" fullWidth>Save transaction</Button>
      </div>

      <div style={{
        fontSize: 11, color: t.muted, lineHeight: 1.5,
        display: 'flex', alignItems: 'flex-start', gap: 6,
      }}>
        <span style={{ marginTop: 1 }}><Icon name="lock" size={11} color={t.muted} /></span>
        Stored against your user ID. Row-level security enforces single-user access.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN 1 — LOGIN
// ═══════════════════════════════════════════════════════════════════════════
function LoginScreen({ t, dark }) {
  // Sign-in / sign-up is a 2-tab segment so the same screen handles both
  // first-time and returning users. The schema is single-table (transactions)
  // but each row is scoped to user_id, so multi-user works out of the box —
  // Postgres RLS does the enforcement.
  const [mode, setMode] = React.useState('signin');
  const isSignup = mode === 'signup';
  return (
    <div className="ledger-root" style={{
      width: '100%', height: '100%', display: 'flex',
      background: t.bg, color: t.text,
    }}>
      {/* Left rail — brand canvas */}
      <div style={{
        flex: '0 0 44%', position: 'relative', overflow: 'hidden',
        background: dark
          ? `radial-gradient(circle at 25% 30%, ${t.accentSoft}, transparent 55%), ${t.surface}`
          : `radial-gradient(circle at 25% 30%, ${t.accentSoft}, transparent 55%), ${t.inset}`,
        borderRight: `1px solid ${t.border}`,
        padding: '36px 42px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LedgerMark size={26} t={t} />
          <span style={{ fontSize: 16, fontWeight: 600, color: t.text, letterSpacing: -0.2 }}>Ledger</span>
        </div>

        {/* Editorial pull-quote */}
        <div style={{ maxWidth: 420 }}>
          <h2 className="ledger-serif" style={{
            margin: 0, fontSize: 44, lineHeight: 1.05, color: t.text, fontWeight: 400,
            letterSpacing: -0.5,
          }}>
            Every <em style={{ color: t.accent, fontStyle: 'italic' }}>rupiah</em> &amp;<br/>
            every <em style={{ color: t.accent, fontStyle: 'italic' }}>dollar</em>,<br/>
            in one ledger.
          </h2>
          <p style={{
            marginTop: 16, fontSize: 14, lineHeight: 1.55,
            color: t.muted, maxWidth: 360,
          }}>
            A private financial journal for people who bill in multiple currencies and
            don&apos;t want a bank to be in the middle of their notes.
          </p>
        </div>

        {/* Foot stats */}
        <div style={{ display: 'flex', gap: 28 }}>
          {[
            { k: '256-bit', v: 'Postgres-side encryption' },
            { k: 'RLS', v: 'Per-user row scoping' },
            { k: '∞', v: 'Transactions per ledger' },
          ].map(s => (
            <div key={s.k}>
              <div className="ledger-serif" style={{ fontSize: 26, color: t.text, lineHeight: 1 }}>{s.k}</div>
              <div style={{ fontSize: 11, color: t.muted, marginTop: 6, letterSpacing: 0.04 }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — login form */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 48,
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: t.muted,
            letterSpacing: 0.1, textTransform: 'uppercase',
          }}>{isSignup ? 'Create account' : 'Sign in'}</span>
          <h1 style={{
            margin: '6px 0 6px', fontSize: 28, fontWeight: 600, color: t.text,
            letterSpacing: -0.4,
          }}>{isSignup ? 'Start a new ledger.' : 'Welcome back.'}</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: t.muted }}>
            {isSignup ? 'Your ledger is yours alone — row-level security keeps every entry scoped to your user.'
                      : 'Authenticate to open your private ledger.'}
          </p>

          {/* Sign-in / Sign-up tabs */}
          <div style={{ marginTop: 22 }}>
            <Segment t={t} value={mode} onChange={setMode}
              options={[{ value: 'signin', label: 'Sign in' },
                        { value: 'signup', label: 'Create account' }]} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
            {isSignup && (
              <div>
                <FieldLabel t={t}>Display name</FieldLabel>
                <TextInput t={t} value="" placeholder="e.g. Marko Halim" />
              </div>
            )}
            <div>
              <FieldLabel t={t}>Email</FieldLabel>
              <TextInput t={t} value={isSignup ? '' : 'marko@studio.fyi'} placeholder="you@domain.com" />
            </div>
            <div>
              <FieldLabel t={t} hint={!isSignup && <a href="#" style={{ color: t.muted, textDecoration: 'none' }}>Forgot?</a>}>
                {isSignup ? 'Choose a password' : 'Password'}
              </FieldLabel>
              <TextInput t={t} value={isSignup ? '' : '••••••••••••'} type="password"
                placeholder={isSignup ? 'Min 12 characters' : ''}
                suffix={<Icon name="eye" size={14} color={t.muted} />} />
            </div>
            {isSignup ? (
              <Checkbox t={t} checked={false} onChange={() => {}}
                label="I understand my ledger is private to my account"
                sub="Other users on this database cannot read or list my rows." />
            ) : (
              <Checkbox t={t} checked={true} onChange={() => {}} label="Keep me signed in on this device" />
            )}
            <Button t={t} kind="primary" fullWidth size="lg" icon={isSignup ? 'plus' : 'arrowR'}>
              {isSignup ? 'Create my ledger' : 'Sign in to ledger'}
            </Button>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0',
          }}>
            <span style={{ flex: 1, height: 1, background: t.divider }} />
            <span style={{ fontSize: 11, color: t.muted, letterSpacing: 0.08, textTransform: 'uppercase' }}>or</span>
            <span style={{ flex: 1, height: 1, background: t.divider }} />
          </div>

          <Button t={t} kind="secondary" fullWidth>Continue with magic link</Button>

          <p style={{
            marginTop: 28, fontSize: 11.5, color: t.muted, lineHeight: 1.5,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="lock" size={11} color={t.muted} />
            Auth via Supabase. Postgres RLS scopes every row to its owner.
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN 2 — EMPTY STATE (first-time user)
// ═══════════════════════════════════════════════════════════════════════════
function EmptyStateScreen({ t, dark }) {
  const user = { name: 'Marko Halim', email: 'marko@studio.fyi', initials: 'MH' };
  return (
    <div className="ledger-root" style={{
      width: '100%', height: '100%', display: 'flex',
      background: t.bg, color: t.text,
    }}>
      <Sidebar t={t} user={user} onLogout={() => {}}>
        <SidebarSection t={t} label="New transaction">
          <EntryFormSidebar t={t} dark={dark} />
        </SidebarSection>
      </Sidebar>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar t={t} title="Your ledger" subtitle="Welcome, Marko. Let's record your first transaction."
          right={
            <>
              <Button t={t} kind="secondary" icon="download" size="sm" disabled>Export CSV</Button>
              <Button t={t} kind="primary" icon="plus" size="sm">New entry</Button>
            </>
          } />

        {/* Empty KPIs (skeleton-style) */}
        <div style={{ padding: '24px 32px 0', display: 'flex', gap: 16 }}>
          {['Total income', 'Total expenses', 'Net cash flow'].map((lbl, i) => (
            <div key={lbl} style={{
              flex: 1, minWidth: 0,
              background: t.surface, border: `1px dashed ${t.borderStrong}`,
              borderRadius: 14, padding: '20px 22px',
              display: 'flex', flexDirection: 'column', gap: 14,
              opacity: 0.85,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 600, color: t.muted,
                letterSpacing: 0.08, textTransform: 'uppercase',
              }}>{lbl}</span>
              <span className="ledger-serif" style={{
                fontSize: 56, lineHeight: 1, color: t.dim, fontWeight: 400,
              }}>—</span>
              <span style={{ fontSize: 11, color: t.muted }}>Awaiting first entry</span>
            </div>
          ))}
        </div>

        {/* Empty-state hero */}
        <div style={{ padding: '24px 32px', flex: 1, minHeight: 0 }}>
          <div style={{
            height: '100%',
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: 14, padding: '40px 32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 24, textAlign: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Decorative grid */}
            <svg width="100%" height="100%" style={{
              position: 'absolute', inset: 0, opacity: dark ? 0.10 : 0.06, pointerEvents: 'none',
            }}>
              <defs>
                <pattern id="empty-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M32 0H0v32" fill="none" stroke={t.text} strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#empty-grid)" />
            </svg>

            <div style={{
              width: 80, height: 80, borderRadius: 20,
              background: t.accentSoft, border: `1px solid ${t.accentLine}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', zIndex: 1,
            }}>
              <Icon name="chart" size={32} color={t.accent} strokeWidth={1.5} />
            </div>

            <div style={{ maxWidth: 520, position: 'relative', zIndex: 1 }}>
              <h2 className="ledger-serif" style={{
                margin: 0, fontSize: 36, lineHeight: 1.1, color: t.text, fontWeight: 400,
                letterSpacing: -0.4,
              }}>
                A blank ledger. The most honest kind.
              </h2>
              <p style={{
                margin: '14px 0 0', fontSize: 14, lineHeight: 1.55, color: t.muted,
              }}>
                Start by logging today&apos;s coffee, last week&apos;s invoice, or that
                rent transfer you haven&apos;t reconciled. The sidebar form takes 8 seconds.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, position: 'relative', zIndex: 1 }}>
              <Button t={t} kind="primary" icon="plus">Add first transaction</Button>
              <Button t={t} kind="secondary" icon="download">Import from CSV</Button>
            </div>

            {/* Tiny help cards */}
            <div style={{
              display: 'flex', gap: 12, marginTop: 8,
              position: 'relative', zIndex: 1,
            }}>
              {[
                { i: 'cal',    label: 'Date',     hint: 'Defaults to today' },
                { i: 'chip',   label: 'Category', hint: '13 presets' },
                { i: 'lock',   label: 'Private',  hint: 'Only your row' },
              ].map(c => (
                <div key={c.label} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 12px',
                  background: t.inset, border: `0.5px solid ${t.border}`,
                  borderRadius: 999,
                }}>
                  <Icon name={c.i} size={13} color={t.muted} />
                  <span style={{ fontSize: 11.5, color: t.textSoft, fontWeight: 500 }}>{c.label}</span>
                  <span style={{ fontSize: 11.5, color: t.muted }}>· {c.hint}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN 3 — MAIN DASHBOARD (with data)
// ═══════════════════════════════════════════════════════════════════════════
function DashboardScreen({ t, dark, ccyMode, density }) {
  const user = { name: 'Marko Halim', email: 'marko@studio.fyi', initials: 'MH' };
  return (
    <div className="ledger-root" style={{
      width: '100%', height: '100%', display: 'flex',
      background: t.bg, color: t.text,
    }}>
      <Sidebar t={t} user={user} onLogout={() => {}}>
        <SidebarSection t={t} label="New transaction" action={
          <button style={{
            background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer',
            fontSize: 11, fontWeight: 500, padding: 0,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Icon name="sparkle" size={11} /> Expand
          </button>
        }>
          <EntryFormSidebar t={t} dark={dark} />
        </SidebarSection>
      </Sidebar>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar t={t} title="May 2026" subtitle="16 transactions · IDR + USD"
          right={
            <>
              <div style={{ display: 'flex', gap: 6 }}>
                {['7d', '30d', '90d', 'YTD'].map((p, i) => (
                  <button key={p} style={{
                    padding: '7px 11px', fontSize: 12.5, fontWeight: 500,
                    background: i === 1 ? t.elevated : 'transparent',
                    color: i === 1 ? t.text : t.muted,
                    border: `1px solid ${i === 1 ? t.border : 'transparent'}`,
                    borderRadius: 7, cursor: 'pointer',
                  }}>{p}</button>
                ))}
              </div>
              <span style={{ width: 1, height: 22, background: t.divider, margin: '0 4px' }} />
              <Button t={t} kind="secondary" icon="download" size="sm">Export CSV</Button>
              <Button t={t} kind="primary" icon="plus" size="sm">New entry</Button>
            </>
          } />

        <div style={{ padding: '24px 32px 12px' }}>
          <KPIRow t={t} dark={dark} rows={SAMPLE_TRANSACTIONS} prev={PREVIOUS_PERIOD} ccyMode={ccyMode} />
        </div>

        <div style={{ padding: '12px 32px 24px', flex: 1, minHeight: 0, overflow: 'auto' }}>
          <TransactionTable t={t} dark={dark} rows={SAMPLE_TRANSACTIONS} density={density} />
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN 4 — ADD-TRANSACTION (modal expander open over dashboard)
// ═══════════════════════════════════════════════════════════════════════════
function AddTransactionScreen({ t, dark, ccyMode, density }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Dashboard backdrop (dimmed) */}
      <div style={{ position: 'absolute', inset: 0, filter: 'blur(0.5px)' }}>
        <DashboardScreen t={t} dark={dark} ccyMode={ccyMode} density={density} />
      </div>
      {/* Scrim */}
      <div style={{ position: 'absolute', inset: 0, background: dark ? 'rgba(8,10,14,0.55)' : 'rgba(15,17,22,0.30)' }} />

      {/* Modal sheet */}
      <div className="ledger-root" style={{
        position: 'absolute', top: 36, right: 36, bottom: 36, width: 480,
        background: t.surface, border: `1px solid ${t.borderStrong}`,
        borderRadius: 16, boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        color: t.text,
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 22px', borderBottom: `1px solid ${t.divider}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.muted, letterSpacing: 0.08, textTransform: 'uppercase' }}>
              New transaction
            </span>
            <h2 style={{ margin: '4px 0 0', fontSize: 19, fontWeight: 600, color: t.text, letterSpacing: -0.3 }}>
              Record an entry
            </h2>
          </div>
          <button style={{
            width: 32, height: 32, borderRadius: 8,
            background: t.inset, border: `1px solid ${t.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: t.muted,
          }}><Icon name="close" size={14} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px', flex: 1, overflow: 'auto' }}>
          <EntryFormSidebar t={t} dark={dark} full />
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 22px', borderTop: `1px solid ${t.divider}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: t.inset,
        }}>
          <span style={{ fontSize: 11.5, color: t.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="info" size={11} color={t.muted} />
            Press <kbd style={{
              fontFamily: 'inherit', fontSize: 10.5, padding: '1px 5px',
              background: t.elevated, border: `1px solid ${t.border}`, borderRadius: 4,
              color: t.textSoft, marginLeft: 2, marginRight: 2,
            }}>⌘↵</kbd> to save
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button t={t} kind="ghost" size="sm">Cancel</Button>
            <Button t={t} kind="primary" size="sm" icon="check">Save transaction</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  LoginScreen, EmptyStateScreen, DashboardScreen, AddTransactionScreen,
  EntryFormSidebar,
});
