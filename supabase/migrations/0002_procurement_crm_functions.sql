-- ============================================================================
-- LSIC Business Hub / Letema Shop — Phase 2 & 3
-- Migration 0002: Procurement (GRN) + Credit/Supplier payment RPCs
-- Additive only — requires 0001_pos_inventory_core.sql to already be applied.
-- ============================================================================

-- Convenience: PO total (ordered qty x unit cost) for list views
create or replace view po_totals as
  select po_id, sum(quantity_ordered * unit_cost) as total_ordered,
         sum(quantity_received * unit_cost) as total_received
  from po_items group by po_id;

-- Convenience: supplier outstanding balance
create or replace view supplier_balances as
  select supplier_id, sum(amount) as total_invoiced, sum(amount_paid) as total_paid,
         sum(amount - amount_paid) as outstanding
  from supplier_invoices group by supplier_id;

-- ── Receive goods against a Purchase Order (Goods Received Note) ────────────
-- Atomically: writes a GRN + grn_items, creates an inventory_batch per line
-- (so expiry/cost tracking + FIFO picks it up immediately), bumps
-- products.stock_quantity + cost_price, updates po_items.quantity_received,
-- flips the PO status, and writes an audit log entry.
create or replace function receive_grn(payload jsonb)
returns jsonb
language plpgsql security definer as $$
declare
  v_grn_id uuid;
  v_po_id uuid := (payload->>'po_id')::uuid;
  v_branch uuid;
  v_line jsonb;
  v_batch_id uuid;
  v_total_ordered int; v_total_received int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select branch_id into v_branch from purchase_orders where id = v_po_id;

  insert into goods_received_notes (po_id, received_by, note)
  values (v_po_id, auth.uid(), payload->>'note')
  returning id into v_grn_id;

  for v_line in select * from jsonb_array_elements(payload->'items')
  loop
    if (v_line->>'quantity_received')::int <= 0 then continue; end if;

    insert into inventory_batches (product_id, branch_id, batch_no, quantity, cost_price, expiry_date, supplier_id, received_at)
    values (
      (v_line->>'product_id')::uuid, v_branch,
      v_line->>'batch_no',
      (v_line->>'quantity_received')::int,
      (v_line->>'unit_cost')::numeric,
      nullif(v_line->>'expiry_date','')::date,
      (payload->>'supplier_id')::uuid,
      now()
    ) returning id into v_batch_id;

    insert into grn_items (grn_id, po_item_id, product_id, quantity_received, unit_cost, batch_id)
    values (v_grn_id, (v_line->>'po_item_id')::uuid, (v_line->>'product_id')::uuid,
            (v_line->>'quantity_received')::int, (v_line->>'unit_cost')::numeric, v_batch_id);

    update po_items set quantity_received = quantity_received + (v_line->>'quantity_received')::int
    where id = (v_line->>'po_item_id')::uuid;

    update products
      set stock_quantity = stock_quantity + (v_line->>'quantity_received')::int,
          cost_price = (v_line->>'unit_cost')::numeric,
          updated_at = now()
    where id = (v_line->>'product_id')::uuid;

    insert into stock_movements (product_id, batch_id, branch_id, movement_type, quantity_delta,
                                  reference_type, reference_id, created_by, note)
    values ((v_line->>'product_id')::uuid, v_batch_id, v_branch, 'purchase',
            (v_line->>'quantity_received')::int, 'goods_received_note', v_grn_id, auth.uid(),
            'GRN for PO ' || v_po_id::text);
  end loop;

  select sum(quantity_ordered), sum(quantity_received) into v_total_ordered, v_total_received
  from po_items where po_id = v_po_id;

  update purchase_orders
    set status = case when v_total_received >= v_total_ordered then 'RECEIVED'::po_status
                       else 'PARTIALLY_RECEIVED'::po_status end
  where id = v_po_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'RECEIVE_GRN', 'purchase_orders', v_po_id::text, payload);

  return jsonb_build_object('grn_id', v_grn_id);
end;
$$;

-- ── Record a supplier payment against an invoice (Accounts Payable) ─────────
create or replace function record_supplier_payment(p_invoice_id uuid, p_amount numeric, p_method payment_method, p_note text)
returns void language plpgsql security definer as $$
declare v_new_paid numeric; v_amount numeric; begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into supplier_payments (invoice_id, amount, method, note, created_by)
  values (p_invoice_id, p_amount, p_method, p_note, auth.uid());

  select amount, amount_paid + p_amount into v_amount, v_new_paid
  from supplier_invoices where id = p_invoice_id;

  update supplier_invoices
    set amount_paid = v_new_paid,
        status = case when v_new_paid >= v_amount then 'PAID'
                      when v_new_paid > 0 then 'PARTIAL'
                      else 'UNPAID' end
  where id = p_invoice_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, note)
  values (auth.uid(), 'SUPPLIER_PAYMENT', 'supplier_invoices', p_invoice_id::text,
          format('Paid %s via %s', p_amount, p_method));
end; $$;

-- ── Record a customer credit (Kopa) installment payment ─────────────────────
create or replace function record_credit_payment(p_credit_sale_id uuid, p_amount numeric, p_method payment_method, p_note text)
returns void language plpgsql security definer as $$
declare v_customer uuid; v_new_balance numeric; begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_amount <= 0 then raise exception 'Kiasi lazima kiwe zaidi ya sifuri'; end if;

  select customer_id, balance - p_amount into v_customer, v_new_balance
  from credit_sales where id = p_credit_sale_id;

  if v_new_balance < 0 then raise exception 'Kiasi kimezidi deni lililobaki'; end if;

  insert into credit_payments (credit_sale_id, amount, method, note, received_by)
  values (p_credit_sale_id, p_amount, p_method, p_note, auth.uid());

  update credit_sales
    set balance = v_new_balance,
        status = case when v_new_balance <= 0 then 'PAID'
                      when v_new_balance < amount then 'PARTIAL'
                      else status end
  where id = p_credit_sale_id;

  update customers set credit_balance = greatest(0, credit_balance - p_amount) where id = v_customer;

  insert into audit_logs (actor_id, action, entity_type, entity_id, note)
  values (auth.uid(), 'CREDIT_PAYMENT', 'credit_sales', p_credit_sale_id::text,
          format('Paid %s via %s, remaining balance %s', p_amount, p_method, v_new_balance));
end; $$;

-- Flag overdue credit sales (call periodically, or compute client-side via due_date < today)
create or replace function overdue_credit_sales()
returns setof credit_sales language sql stable as $$
  select * from credit_sales
  where status in ('OPEN','PARTIAL') and due_date is not null and due_date < current_date
  order by due_date asc;
$$;

-- Enable RLS on the new views' underlying access is inherited from base tables (already enabled in 0001).
