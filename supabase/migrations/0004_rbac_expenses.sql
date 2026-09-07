-- ============================================================================
-- LSIC Business Hub / Letema Shop — Phase 4 & 5
-- Migration 0004: Financials (expenses), deeper RBAC (staff management),
-- immutable audit trail access control.
-- Additive only — requires 0001, 0002 already applied.
-- ============================================================================

-- ── OPERATING EXPENSES (for Net Profit calculation) ──────────────────────────
create table if not exists operating_expenses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  category text not null,          -- 'Rent','Salaries','Utilities','Transport', etc.
  amount numeric(12,2) not null check (amount > 0),
  note text,
  incurred_on date not null default current_date,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table operating_expenses enable row level security;
drop policy if exists staff_all on operating_expenses;
create policy staff_all on operating_expenses for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create index if not exists idx_expenses_date on operating_expenses(incurred_on);
create index if not exists idx_pos_sales_cashier on pos_sales(cashier_id, created_at);

-- ── STAFF PROFILE (display name for RBAC + reporting) ────────────────────────
alter table user_roles add column if not exists full_name text;

-- Assign (or update) a role for an existing Supabase Auth user, looked up by
-- email. The user must already exist (i.e. have signed up) — this function
-- cannot create login credentials, only grant a role to an existing account.
create or replace function assign_role_by_email(p_email text, p_role app_role, p_branch_id uuid, p_full_name text)
returns jsonb language plpgsql security definer as $$
declare v_uid uuid; begin
  if current_user_role() not in ('super_admin','branch_manager') then
    raise exception 'Huna ruhusa ya kubadilisha majukumu ya wafanyakazi.';
  end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_uid is null then
    raise exception 'Hakuna mtumiaji mwenye barua pepe hiyo. Lazima ajisajili kwenye mfumo kwanza.';
  end if;
  insert into user_roles (user_id, role, branch_id, full_name)
  values (v_uid, p_role, p_branch_id, p_full_name)
  on conflict (user_id, role, branch_id) do update set full_name = excluded.full_name;

  insert into audit_logs (actor_id, action, entity_type, entity_id, note)
  values (auth.uid(), 'ASSIGN_ROLE', 'user_roles', v_uid::text, format('role=%s email=%s', p_role, p_email));

  return jsonb_build_object('user_id', v_uid);
end; $$;

create or replace function remove_staff_role(p_user_id uuid, p_role app_role)
returns void language plpgsql security definer as $$
begin
  if current_user_role() not in ('super_admin','branch_manager') then
    raise exception 'Huna ruhusa ya kuondoa jukumu hili.';
  end if;
  delete from user_roles where user_id = p_user_id and role = p_role;
  insert into audit_logs (actor_id, action, entity_type, entity_id, note)
  values (auth.uid(), 'REMOVE_ROLE', 'user_roles', p_user_id::text, format('role=%s removed', p_role));
end; $$;

-- List staff with their auth email joined in (client can never query
-- auth.users directly — this security-definer function is the only path).
create or replace function list_staff()
returns table(user_id uuid, email text, full_name text, role app_role, branch_id uuid, created_at timestamptz)
language plpgsql stable security definer as $$
begin
  if current_user_role() not in ('super_admin','branch_manager') then
    raise exception 'Huna ruhusa ya kuona orodha ya wafanyakazi.';
  end if;
  return query
    select ur.user_id, u.email, ur.full_name, ur.role, ur.branch_id, ur.created_at
    from user_roles ur join auth.users u on u.id = ur.user_id
    order by ur.created_at desc;
end; $$;

-- ── IMMUTABLE AUDIT TRAIL ──────────────────────────────────────────────────
-- Anyone authenticated may write an audit entry (our RPCs and a few client
-- actions do); only managers/super admins may read the trail; nobody may
-- update or delete it (no update/delete policy exists → RLS denies both).
drop policy if exists staff_all on audit_logs;
drop policy if exists audit_insert on audit_logs;
drop policy if exists audit_select on audit_logs;
create policy audit_insert on audit_logs for insert with check (auth.uid() is not null);
create policy audit_select on audit_logs for select using (current_user_role() in ('super_admin','branch_manager'));
