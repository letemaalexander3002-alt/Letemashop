# Letema Shop — POS & Inventory Expansion — Setup Guide

This covers everything added across Phases 1–6: POS, Inventory, Procurement,
CRM/Credit, Financials/Cashflow, RBAC/Audit Trail, and Multi-Branch Transfers.
Your original storefront, checkout, and admin panel are untouched — this is
all additive.

---

## 0. What you're installing

```
supabase/migrations/
  0001_pos_inventory_core.sql        Phase 1 — POS, inventory, RBAC skeleton
  0002_procurement_crm_functions.sql Phase 2/3 — GRN, supplier/credit payment RPCs
  0004_rbac_expenses.sql             Phase 4/5 — expenses, staff mgmt, audit trail
  0005_stock_transfers.sql           Phase 6 — multi-branch transfers

src/lib/
  posService.js, procurementService.js, crmService.js,
  financialsService.js, transferService.js, offlineSync.js

src/components/admin/
  POSTab, InventoryTab, ReceiptModal, SuppliersTab, PurchaseOrdersTab,
  PayablesTab, CustomersDirectoryTab, CreditSalesTab, FinancialsTab,
  CashflowTab, RoleManagementTab, AuditLogTab, StockTransfersTab,
  SyncStatusBadge

src/components/AdminPanel.jsx        Modified — new tabs wired in, RBAC-gated
```

There is no `0003` — that number was reserved during planning and folded
into 0004; nothing is missing.

---

## 1. Apply the database migrations

Open your Supabase project → **SQL Editor** → run each file **in this exact
order** (each depends on the one before it):

```
1) 0001_pos_inventory_core.sql
2) 0002_procurement_crm_functions.sql
3) 0004_rbac_expenses.sql
4) 0005_stock_transfers.sql
```

Alternatively, with the Supabase CLI from the project root:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Each migration is idempotent-safe on a fresh run (`create table if not
exists`, `create or replace function`, etc.) but is **not** designed to be
re-run against a database that already has conflicting hand-made changes —
back up first if you've modified these tables manually.

---

## 2. Install the code

```bash
# from the project root
npm install --legacy-peer-deps
```

No new npm dependencies were introduced — everything (POS, receipts, offline
sync, charts) was built on packages already in your `package.json`
(`@supabase/supabase-js`, `html2pdf.js`, `react`, `react-router-dom`).

Your `.env` is unchanged — same `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
you already have.

---

## 3. Make yourself Super Admin

The first person to log into `/admin` has full access by default (fail-open,
so you're never locked out of your own system). To make role-based access
actually take effect for your staff:

1. Have each staff member sign up / log in once through your existing
   Supabase Auth flow (so their `auth.users` row exists).
2. Log in as yourself, go to **Ruhusa** (Roles) tab.
3. Click **+ Weka Jukumu**, enter their email, full name, and role
   (`Cashier`, `Karani wa Stoo`, `Meneja wa Tawi`, or `Msimamizi Mkuu`).

Until you assign roles, `fetchMyRole()` fails open to `super_admin` for any
authenticated admin user — this matches your original single-admin-table
design and means the app keeps working immediately after deploy.

---

## 4. Local development

```bash
npm run dev
```

Visit `http://localhost:5173/admin`, log in with your existing admin
credentials. You'll see the new tabs: POS, Stoo, Wasambazaji, Ununuzi,
Uhamisho, Madeni Yetu, Wateja (CRM), Kopa, Fedha, Cashflow, Ruhusa, Ukaguzi —
alongside your original Oda/Bidhaa/Kategoria/Ripoti/Mipangilio.

First time in POS: it'll ask for an opening cash float before the till
unlocks (this opens a `cash_register_sessions` row).

---

## 5. Build & deploy

```bash
npm run build      # outputs to dist/
npm run preview    # sanity-check the production build locally
```

Deploy `dist/` the same way you already do (Netlify/Vercel configs already
exist in this repo — `netlify.toml` / `vercel.json` — nothing to change
there).

---

## 6. Smoke-test checklist after deploy

- [ ] Open POS, add a product, complete a cash sale → receipt appears,
      product stock decrements
- [ ] Add a batch with an expiry date in Stoo → shows up under "Muda wa
      Mwisho" if within 45 days
- [ ] Create a supplier → create a PO → receive goods (GRN) → stock goes up,
      cost price updates
- [ ] Add a customer → do a credit ("Kopa") sale → shows in Kopa tab with
      correct balance → record a partial payment → balance updates
- [ ] Fedha tab shows the sale in P&L; Cashflow tab shows the open register
      session
- [ ] Turn off Wi-Fi, make a sale in POS → receipt shows "Nje ya Mtandao",
      stock still decrements on screen → turn Wi-Fi back on → sync badge
      clears and `fetchData()` refreshes from the server
- [ ] Ruhusa tab: assign a teammate as `cashier` → have them log in → they
      should only see POS + Kopa
- [ ] Ukaguzi (Audit) tab shows the sale, the price change, etc.

---

## 7. Rollback

Every migration is additive — no existing table was altered destructively
and no existing column was dropped. To remove the expansion entirely:
revert the `src/` files to their pre-Phase-1 versions (git) and, if you also
want the new tables gone, drop them manually in the SQL editor (not scripted
here deliberately — that's a destructive action you should run by hand,
table by table, after confirming you have a backup).
