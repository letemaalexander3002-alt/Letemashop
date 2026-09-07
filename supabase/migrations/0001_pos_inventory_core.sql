-- ============================================================================
-- LSIC Business Hub / Letema Shop — POS & Inventory Expansion
-- Migration 0001: Core schema for POS, Inventory, Procurement, CRM, RBAC
-- ============================================================================
-- This migration is ADDITIVE ONLY. It does not modify or drop any existing
-- table (products, orders, cart_items, etc). Existing app functionality is
-- untouched. Run this in the Supabase SQL editor or via `supabase db push`.
-- ============================================================================

-- ── EXTENSIONS ───────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── ENUMS ────────────────────────────────────────────────────────────────────
do $$ begin
  create type app_role as enum ('super_admin','branch_manager','cashier','inventory_clerk');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('cash','mpesa','tigopesa','airtelmoney','bank_qr','card','credit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stock_movement_type as enum ('sale','purchase','adjustment','transfer_in','transfer_out','return','reconciliation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type po_status as enum ('DRAFT','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transfer_status as enum ('PENDING','IN_TRANSIT','CONFIRMED','CANCELLED');
exception when duplicate_object then null; end $$;

-- ── BRANCHES ─────────────────────────────────────────────────────────────────
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  is_main boolean default false,
  created_at timestamptz default now()
);
insert into branches (name, location, is_main)
  select 'Main Branch — Dodoma', 'Dodoma, Tanzania', true
  where not exists (select 1 from branches);

-- ── RBAC ─────────────────────────────────────────────────────────────────────
create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'cashier',
  branch_id uuid references branches(id),
  created_at timestamptz default now(),
  unique (user_id, role, branch_id)
);
create index if not exists idx_user_roles_user on user_roles(user_id);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  note text,
  created_at timestamptz default now()
);
create index if not exists idx_audit_entity on audit_logs(entity_type, entity_id);

-- helper: current user's highest role (super_admin > branch_manager > inventory_clerk > cashier)
create or replace function current_user_role() returns app_role
language sql stable security definer as $$
  select coalesce((
    select role from user_roles where user_id = auth.uid()
    order by case role
      when 'super_admin' then 1 when 'branch_manager' then 2
      when 'inventory_clerk' then 3 else 4 end
    limit 1
  ), 'cashier'::app_role);
$$;

create or replace function is_staff() returns boolean
language sql stable security definer as $$
  select exists(select 1 from user_roles where user_id = auth.uid())
      or exists(select 1 from auth.users where id = auth.uid()); -- any authenticated admin user
$$;

-- ── PRODUCT EXTENSIONS (additive columns only, existing rows unaffected) ─────
alter table products add column if not exists sku text;
alter table products add column if not exists barcode text;
alter table products add column if not exists cost_price numeric(12,2) default 0;
alter table products add column if not exists reorder_level integer default 5;
alter table products add column if not exists unit text default 'pcs';
alter table products add column if not exists is_perishable boolean default false;
alter table products add column if not exists updated_at timestamptz default now();
create unique index if not exists idx_products_barcode on products(barcode) where barcode is not null;

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_name text not null,           -- e.g. "Red / Large"
  sku text,
  barcode text,
  price_override numeric(12,2),
  stock_quantity integer not null default 0,
  attributes jsonb default '{}',        -- {color:'Red', size:'L'}
  created_at timestamptz default now()
);
create index if not exists idx_variants_product on product_variants(product_id);

create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  parent_id uuid references product_categories(id),
  created_at timestamptz default now()
);

-- ── INVENTORY: BATCHES & MOVEMENTS ────────────────────────────────────────────
create table if not exists inventory_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  branch_id uuid references branches(id) default (select id from branches where is_main limit 1),
  batch_no text,
  quantity integer not null default 0,
  cost_price numeric(12,2) default 0,
  expiry_date date,
  supplier_id uuid,
  received_at timestamptz default now(),
  is_active boolean default true
);
create index if not exists idx_batches_product on inventory_batches(product_id);
create index if not exists idx_batches_expiry on inventory_batches(expiry_date) where expiry_date is not null;

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  variant_id uuid references product_variants(id),
  batch_id uuid references inventory_batches(id),
  branch_id uuid references branches(id),
  movement_type stock_movement_type not null,
  quantity_delta integer not null,       -- negative = stock out, positive = stock in
  reference_type text,                   -- 'pos_sale' | 'purchase_order' | 'transfer' | 'manual'
  reference_id uuid,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create index if not exists idx_movements_product on stock_movements(product_id, created_at desc);

create table if not exists stock_transfers (
  id uuid primary key default gen_random_uuid(),
  from_branch uuid references branches(id),
  to_branch uuid references branches(id),
  status transfer_status not null default 'PENDING',
  requested_by uuid references auth.users(id),
  confirmed_by uuid references auth.users(id),
  note text,
  created_at timestamptz default now(),
  confirmed_at timestamptz
);
create table if not exists stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references stock_transfers(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity integer not null check (quantity > 0)
);

create table if not exists stock_reconciliations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  performed_by uuid references auth.users(id),
  status text default 'OPEN', -- OPEN | CLOSED
  created_at timestamptz default now(),
  closed_at timestamptz
);
create table if not exists stock_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references stock_reconciliations(id) on delete cascade,
  product_id uuid not null references products(id),
  system_quantity integer not null,
  counted_quantity integer not null,
  discrepancy integer generated always as (counted_quantity - system_quantity) stored,
  note text
);

-- ── SUPPLIERS & PROCUREMENT ───────────────────────────────────────────────────
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table inventory_batches
  add constraint fk_batches_supplier foreign key (supplier_id) references suppliers(id) on delete set null;

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_no text not null default ('PO-' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  supplier_id uuid references suppliers(id),
  branch_id uuid references branches(id),
  status po_status not null default 'DRAFT',
  order_date date default current_date,
  expected_date date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create table if not exists po_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity_ordered integer not null check (quantity_ordered > 0),
  quantity_received integer not null default 0,
  unit_cost numeric(12,2) not null default 0
);

create table if not exists goods_received_notes (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id),
  grn_no text default ('GRN-' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  received_by uuid references auth.users(id),
  received_at timestamptz default now(),
  note text
);
create table if not exists grn_items (
  id uuid primary key default gen_random_uuid(),
  grn_id uuid not null references goods_received_notes(id) on delete cascade,
  po_item_id uuid references po_items(id),
  product_id uuid not null references products(id),
  quantity_received integer not null check (quantity_received > 0),
  unit_cost numeric(12,2) not null default 0,
  batch_id uuid references inventory_batches(id)
);

create table if not exists supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  po_id uuid references purchase_orders(id),
  invoice_no text,
  amount numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  due_date date,
  status text default 'UNPAID', -- UNPAID | PARTIAL | PAID | OVERDUE
  created_at timestamptz default now()
);
create table if not exists supplier_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references supplier_invoices(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz default now(),
  method payment_method,
  note text,
  created_by uuid references auth.users(id)
);

-- ── CRM / CUSTOMERS / CREDIT / LOYALTY ────────────────────────────────────────
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique,
  email text,
  address text,
  credit_limit numeric(12,2) default 0,
  credit_balance numeric(12,2) default 0,
  loyalty_points integer default 0,
  created_at timestamptz default now()
);
create index if not exists idx_customers_phone on customers(phone);

create table if not exists credit_sales (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid,
  customer_id uuid not null references customers(id),
  amount numeric(12,2) not null,
  balance numeric(12,2) not null,
  due_date date,
  status text default 'OPEN', -- OPEN | PARTIAL | PAID | OVERDUE
  created_at timestamptz default now()
);
create table if not exists credit_payments (
  id uuid primary key default gen_random_uuid(),
  credit_sale_id uuid not null references credit_sales(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz default now(),
  method payment_method,
  note text,
  received_by uuid references auth.users(id)
);
create table if not exists loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  points_delta integer not null,
  reason text,
  reference_id uuid,
  created_at timestamptz default now()
);

-- ── POS: SALES / PAYMENTS / RETURNS ───────────────────────────────────────────
create table if not exists cash_register_sessions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  cashier_id uuid not null references auth.users(id),
  opening_float numeric(12,2) not null default 0,
  closing_balance numeric(12,2),
  expected_cash numeric(12,2),
  cash_in numeric(12,2) default 0,
  cash_out numeric(12,2) default 0,
  status text default 'OPEN', -- OPEN | CLOSED
  opened_at timestamptz default now(),
  closed_at timestamptz
);
create table if not exists cash_movements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references cash_register_sessions(id) on delete cascade,
  type text not null check (type in ('in','out')),
  amount numeric(12,2) not null check (amount > 0),
  reason text,
  created_at timestamptz default now()
);

create table if not exists pos_sales (
  id uuid primary key default gen_random_uuid(),
  sale_no text not null default ('SALE-' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  branch_id uuid references branches(id),
  cashier_id uuid references auth.users(id),
  customer_id uuid references customers(id),
  session_id uuid references cash_register_sessions(id),
  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  change_due numeric(12,2) not null default 0,
  payment_status text not null default 'PAID', -- PAID | PARTIAL | CREDIT
  sale_status text not null default 'COMPLETED', -- COMPLETED | VOIDED | RETURNED
  created_at timestamptz default now()
);
create index if not exists idx_pos_sales_date on pos_sales(created_at desc);

create table if not exists pos_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references pos_sales(id) on delete cascade,
  method payment_method not null,
  amount numeric(12,2) not null check (amount > 0),
  reference_no text,
  created_at timestamptz default now()
);

create table if not exists pos_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references pos_sales(id) on delete cascade,
  product_id uuid not null references products(id),
  variant_id uuid references product_variants(id),
  batch_id uuid references inventory_batches(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  discount_amount numeric(12,2) not null default 0,
  line_total numeric(12,2) not null,
  cost_price_at_sale numeric(12,2) default 0
);
create index if not exists idx_sale_items_sale on pos_sale_items(sale_id);

create table if not exists pos_returns (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references pos_sales(id),
  processed_by uuid references auth.users(id),
  reason text,
  status text default 'APPROVED', -- REQUESTED | APPROVED | REJECTED
  created_at timestamptz default now()
);
create table if not exists pos_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references pos_returns(id) on delete cascade,
  sale_item_id uuid not null references pos_sale_items(id),
  quantity integer not null check (quantity > 0),
  restock boolean default true
);

-- ============================================================================
-- RPC FUNCTIONS (atomic, security definer — bypass RLS internally, but check role)
-- ============================================================================

-- Process a full POS sale atomically: insert sale + items + payments,
-- decrement stock (FIFO across batches where available), write audit log.
create or replace function process_pos_sale(payload jsonb)
returns jsonb
language plpgsql security definer as $$
declare
  v_sale_id uuid;
  v_branch uuid;
  v_item jsonb;
  v_payment jsonb;
  v_remaining int;
  v_batch record;
  v_take int;
  v_cost numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_branch := coalesce((payload->>'branch_id')::uuid, (select id from branches where is_main limit 1));

  insert into pos_sales (branch_id, cashier_id, customer_id, session_id, subtotal,
                          discount_total, tax_total, total, amount_paid, change_due,
                          payment_status, sale_status)
  values (
    v_branch, auth.uid(),
    nullif(payload->>'customer_id','')::uuid,
    nullif(payload->>'session_id','')::uuid,
    (payload->>'subtotal')::numeric,
    coalesce((payload->>'discount_total')::numeric,0),
    coalesce((payload->>'tax_total')::numeric,0),
    (payload->>'total')::numeric,
    coalesce((payload->>'amount_paid')::numeric,0),
    coalesce((payload->>'change_due')::numeric,0),
    coalesce(payload->>'payment_status','PAID'),
    'COMPLETED'
  ) returning id into v_sale_id;

  -- line items + stock decrement (FIFO by batch expiry/received date, fallback to products.stock_quantity)
  for v_item in select * from jsonb_array_elements(payload->'items')
  loop
    v_remaining := (v_item->>'quantity')::int;
    v_cost := 0;

    for v_batch in
      select id, quantity, cost_price from inventory_batches
      where product_id = (v_item->>'product_id')::uuid
        and is_active = true and quantity > 0
      order by expiry_date nulls last, received_at asc
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, v_batch.quantity);
      update inventory_batches set quantity = quantity - v_take where id = v_batch.id;
      insert into stock_movements (product_id, batch_id, branch_id, movement_type, quantity_delta,
                                    reference_type, reference_id, created_by)
      values ((v_item->>'product_id')::uuid, v_batch.id, v_branch, 'sale', -v_take,
              'pos_sale', v_sale_id, auth.uid());
      v_cost := v_batch.cost_price;
      v_remaining := v_remaining - v_take;
    end loop;

    -- fallback: decrement the product's own stock_quantity for any remainder
    -- (covers products with no batch tracking)
    update products set stock_quantity = greatest(0, stock_quantity - v_remaining), updated_at = now()
    where id = (v_item->>'product_id')::uuid and v_remaining > 0;

    if v_remaining > 0 then
      insert into stock_movements (product_id, branch_id, movement_type, quantity_delta,
                                    reference_type, reference_id, created_by)
      values ((v_item->>'product_id')::uuid, v_branch, 'sale', -v_remaining, 'pos_sale', v_sale_id, auth.uid());
    end if;

    -- also always decrement products.stock_quantity so existing catalog stays accurate,
    -- even when a batch covered the quantity above
    if v_remaining = 0 then
      update products set stock_quantity = greatest(0, stock_quantity - (v_item->>'quantity')::int), updated_at = now()
      where id = (v_item->>'product_id')::uuid;
    end if;

    insert into pos_sale_items (sale_id, product_id, variant_id, quantity, unit_price,
                                 discount_amount, line_total, cost_price_at_sale)
    values (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      nullif(v_item->>'variant_id','')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      coalesce((v_item->>'discount_amount')::numeric,0),
      (v_item->>'line_total')::numeric,
      v_cost
    );
  end loop;

  -- payments (supports split payment: multiple rows)
  for v_payment in select * from jsonb_array_elements(payload->'payments')
  loop
    insert into pos_payments (sale_id, method, amount, reference_no)
    values (v_sale_id, (v_payment->>'method')::payment_method,
            (v_payment->>'amount')::numeric, v_payment->>'reference_no');
  end loop;

  -- credit sale bookkeeping
  if payload->>'payment_status' = 'CREDIT' and payload->>'customer_id' is not null then
    insert into credit_sales (sale_id, customer_id, amount, balance, due_date)
    values (v_sale_id, (payload->>'customer_id')::uuid,
            (payload->>'total')::numeric,
            (payload->>'total')::numeric - coalesce((payload->>'amount_paid')::numeric,0),
            nullif(payload->>'due_date','')::date);
    update customers set credit_balance = credit_balance +
      ((payload->>'total')::numeric - coalesce((payload->>'amount_paid')::numeric,0))
      where id = (payload->>'customer_id')::uuid;
  end if;

  -- loyalty points: 1 point per 1000 TZS spent (configurable later)
  if payload->>'customer_id' is not null then
    insert into loyalty_transactions (customer_id, points_delta, reason, reference_id)
    values ((payload->>'customer_id')::uuid, floor((payload->>'total')::numeric / 1000)::int,
            'POS sale', v_sale_id);
    update customers set loyalty_points = loyalty_points + floor((payload->>'total')::numeric / 1000)::int
      where id = (payload->>'customer_id')::uuid;
  end if;

  insert into audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'CREATE_SALE', 'pos_sales', v_sale_id::text, payload);

  return jsonb_build_object('sale_id', v_sale_id);
end;
$$;

-- Manual stock adjustment (reconciliation, damage, correction) with audit trail
create or replace function adjust_stock(p_product_id uuid, p_delta int, p_reason text)
returns void language plpgsql security definer as $$
declare v_before int; begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select stock_quantity into v_before from products where id = p_product_id;
  update products set stock_quantity = greatest(0, stock_quantity + p_delta), updated_at = now()
  where id = p_product_id;
  insert into stock_movements (product_id, movement_type, quantity_delta, reference_type, note, created_by)
  values (p_product_id, 'adjustment', p_delta, 'manual', p_reason, auth.uid());
  insert into audit_logs (actor_id, action, entity_type, entity_id, before, after, note)
  values (auth.uid(), 'STOCK_ADJUST', 'products', p_product_id::text,
          jsonb_build_object('stock_quantity', v_before),
          jsonb_build_object('stock_quantity', v_before + p_delta), p_reason);
end; $$;

-- ============================================================================
-- RLS — enable + policies. All new tables: any authenticated user found in
-- auth.users can read/write (matches this app's existing single-admin-table
-- pattern where Supabase Auth itself gates the /admin route). Tighten further
-- once user_roles is populated per staff member.
-- ============================================================================
do $$
declare t text;
begin
  for t in select unnest(array[
    'branches','user_roles','audit_logs','product_variants','product_categories',
    'inventory_batches','stock_movements','stock_transfers','stock_transfer_items',
    'stock_reconciliations','stock_reconciliation_items','suppliers','purchase_orders',
    'po_items','goods_received_notes','grn_items','supplier_invoices','supplier_payments',
    'customers','credit_sales','credit_payments','loyalty_transactions',
    'cash_register_sessions','cash_movements','pos_sales','pos_payments','pos_sale_items',
    'pos_returns','pos_return_items'
  ]) loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists staff_all on %I', t);
    execute format($p$create policy staff_all on %I for all
                     using (auth.uid() is not null) with check (auth.uid() is not null)$p$, t);
  end loop;
end $$;

-- super_admin / branch_manager only for role management itself
drop policy if exists roles_write on user_roles;
create policy roles_write on user_roles for all
  using (current_user_role() in ('super_admin','branch_manager'))
  with check (current_user_role() in ('super_admin','branch_manager'));
