-- ============================================================================
-- LSIC Business Hub / Letema Shop — Phase 6
-- Migration 0005: Multi-Branch Stock Transfers
-- Additive only — requires 0001 already applied.
--
-- DESIGN NOTE: products.stock_quantity remains the single company-wide stock
-- figure (as used by POS/GRN since Phase 1) — a transfer between branches
-- doesn't change how much stock the business owns, so that column is
-- untouched here. What moves is *where* the stock physically sits, tracked
-- at the inventory_batches/branch level (already branch-aware since Phase 1).
-- A transfer is a two-step handoff:
--   PENDING → dispatch_stock_transfer() → IN_TRANSIT → confirm_stock_transfer() → CONFIRMED
-- Dispatch pulls stock FIFO from the source branch's batches (mirroring the
-- POS sale logic) and snapshots exactly which batches/costs/expiries were
-- taken; confirm recreates matching batches at the destination branch from
-- that snapshot, so cost price and expiry date travel with the goods.
-- ============================================================================

alter table stock_transfer_items add column if not exists dispatched_breakdown jsonb;
alter table stock_transfer_items add column if not exists quantity_confirmed integer default 0;

-- Convenience view: how much of each product currently sits at each branch.
create or replace view branch_stock_summary as
  select branch_id, product_id, sum(quantity) as quantity
  from inventory_batches
  where is_active = true
  group by branch_id, product_id;

-- ── Create a transfer request (draft — nothing moves yet) ───────────────────
create or replace function create_stock_transfer(payload jsonb)
returns jsonb language plpgsql security definer as $$
declare v_transfer_id uuid; v_item jsonb; begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if (payload->>'from_branch')::uuid = (payload->>'to_branch')::uuid then
    raise exception 'Tawi la kutoa na kupokea haliwezi kuwa sawa.';
  end if;

  insert into stock_transfers (from_branch, to_branch, requested_by, note, status)
  values ((payload->>'from_branch')::uuid, (payload->>'to_branch')::uuid, auth.uid(), payload->>'note', 'PENDING')
  returning id into v_transfer_id;

  for v_item in select * from jsonb_array_elements(payload->'items')
  loop
    insert into stock_transfer_items (transfer_id, product_id, quantity)
    values (v_transfer_id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::int);
  end loop;

  insert into audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'CREATE_TRANSFER', 'stock_transfers', v_transfer_id::text, payload);

  return jsonb_build_object('transfer_id', v_transfer_id);
end; $$;

-- ── Dispatch: goods physically leave the source branch ───────────────────────
create or replace function dispatch_stock_transfer(p_transfer_id uuid)
returns void language plpgsql security definer as $$
declare
  v_from uuid; v_status text; v_item record; v_batch record;
  v_remaining int; v_take int; v_breakdown jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select from_branch, status into v_from, v_status from stock_transfers where id = p_transfer_id;
  if v_status <> 'PENDING' then raise exception 'Uhamisho huu tayari umeshughulikiwa.'; end if;

  for v_item in select * from stock_transfer_items where transfer_id = p_transfer_id
  loop
    v_remaining := v_item.quantity;
    v_breakdown := '[]'::jsonb;

    for v_batch in
      select id, quantity, cost_price, expiry_date, batch_no from inventory_batches
      where product_id = v_item.product_id and branch_id = v_from and is_active = true and quantity > 0
      order by expiry_date nulls last, received_at asc
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, v_batch.quantity);
      update inventory_batches set quantity = quantity - v_take where id = v_batch.id;
      v_breakdown := v_breakdown || jsonb_build_array(jsonb_build_object(
        'quantity', v_take, 'cost_price', v_batch.cost_price,
        'expiry_date', v_batch.expiry_date, 'batch_no', v_batch.batch_no));
      insert into stock_movements (product_id, batch_id, branch_id, movement_type, quantity_delta,
                                    reference_type, reference_id, created_by)
      values (v_item.product_id, v_batch.id, v_from, 'transfer_out', -v_take,
              'stock_transfer', p_transfer_id, auth.uid());
      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      raise exception 'Stoki haitoshi kwa uhamisho — bidhaa % (imebaki %)', v_item.product_id, v_remaining;
    end if;

    update stock_transfer_items set dispatched_breakdown = v_breakdown where id = v_item.id;
  end loop;

  update stock_transfers set status = 'IN_TRANSIT' where id = p_transfer_id;
  insert into audit_logs (actor_id, action, entity_type, entity_id, note)
  values (auth.uid(), 'DISPATCH_TRANSFER', 'stock_transfers', p_transfer_id::text, 'Goods left source branch');
end; $$;

-- ── Confirm: destination branch receives the goods ────────────────────────────
create or replace function confirm_stock_transfer(p_transfer_id uuid)
returns void language plpgsql security definer as $$
declare
  v_to uuid; v_status text; v_item record; v_portion jsonb; v_batch_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select to_branch, status into v_to, v_status from stock_transfers where id = p_transfer_id;
  if v_status <> 'IN_TRANSIT' then raise exception 'Uhamisho huu si tayari kupokewa (bado haujatumwa au tayari umepokewa).'; end if;

  for v_item in select * from stock_transfer_items where transfer_id = p_transfer_id
  loop
    for v_portion in select * from jsonb_array_elements(coalesce(v_item.dispatched_breakdown, '[]'::jsonb))
    loop
      insert into inventory_batches (product_id, branch_id, batch_no, quantity, cost_price, expiry_date, received_at)
      values (v_item.product_id, v_to, v_portion->>'batch_no',
              (v_portion->>'quantity')::int, (v_portion->>'cost_price')::numeric,
              nullif(v_portion->>'expiry_date','')::date, now())
      returning id into v_batch_id;

      insert into stock_movements (product_id, batch_id, branch_id, movement_type, quantity_delta,
                                    reference_type, reference_id, created_by)
      values (v_item.product_id, v_batch_id, v_to, 'transfer_in', (v_portion->>'quantity')::int,
              'stock_transfer', p_transfer_id, auth.uid());
    end loop;
    update stock_transfer_items set quantity_confirmed = quantity where id = v_item.id;
  end loop;

  update stock_transfers set status = 'CONFIRMED', confirmed_by = auth.uid(), confirmed_at = now()
  where id = p_transfer_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, note)
  values (auth.uid(), 'CONFIRM_TRANSFER', 'stock_transfers', p_transfer_id::text, 'Goods received at destination branch');
end; $$;

-- ── Cancel: only while still PENDING (nothing has physically moved yet) ──────
create or replace function cancel_stock_transfer(p_transfer_id uuid)
returns void language plpgsql security definer as $$
declare v_status text; begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select status into v_status from stock_transfers where id = p_transfer_id;
  if v_status <> 'PENDING' then raise exception 'Uhamisho ulioshatumwa hauwezi kughairiwa — tumia mchakato wa kurejesha badala yake.'; end if;
  update stock_transfers set status = 'CANCELLED' where id = p_transfer_id;
  insert into audit_logs (actor_id, action, entity_type, entity_id, note)
  values (auth.uid(), 'CANCEL_TRANSFER', 'stock_transfers', p_transfer_id::text, 'Cancelled before dispatch');
end; $$;
