// ============================================================================
// procurementService.js — Suppliers, Purchase Orders, GRN, Accounts Payable.
// Same contract as posService: every fn returns { data, error }, never throws.
// ============================================================================
import { supabase } from '../utils/supabaseClient';

const wrap = async (promise) => {
  try {
    const { data, error } = await promise;
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('[procurementService]', err.message);
    return { data: null, error: err.message || 'Hitilafu isiyojulikana' };
  }
};

// ── SUPPLIERS ────────────────────────────────────────────────────────────────
export const fetchSuppliers = () =>
  wrap(supabase.from('suppliers').select('*').order('name'));

export const createSupplier = (supplier) =>
  wrap(supabase.from('suppliers').insert(supplier).select().single());

export const updateSupplier = (id, patch) =>
  wrap(supabase.from('suppliers').update(patch).eq('id', id).select().single());

export const deleteSupplier = (id) =>
  wrap(supabase.from('suppliers').delete().eq('id', id));

export const fetchSupplierHistory = (supplierId) =>
  wrap(
    supabase.from('purchase_orders')
      .select('*, po_items(*, products(name))')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
  );

export const fetchSupplierBalance = (supplierId) =>
  wrap(supabase.from('supplier_balances').select('*').eq('supplier_id', supplierId).maybeSingle());

// ── PURCHASE ORDERS ────────────────────────────────────────────────────────────
export const fetchPurchaseOrders = () =>
  wrap(
    supabase.from('purchase_orders')
      .select('*, suppliers(name), po_items(*, products(name, unit))')
      .order('created_at', { ascending: false })
  );

export const fetchPurchaseOrder = (id) =>
  wrap(
    supabase.from('purchase_orders')
      .select('*, suppliers(name, phone), po_items(*, products(name, unit, cost_price))')
      .eq('id', id).single()
  );

export const createPurchaseOrder = async ({ supplier_id, branch_id, expected_date, notes, created_by, items }) => {
  const { data: po, error } = await wrap(
    supabase.from('purchase_orders')
      .insert({ supplier_id, branch_id, expected_date: expected_date || null, notes, created_by, status: 'ORDERED' })
      .select().single()
  );
  if (error) return { data: null, error };

  const rows = items.map(i => ({
    po_id: po.id, product_id: i.product_id,
    quantity_ordered: i.quantity_ordered, unit_cost: i.unit_cost,
  }));
  const { error: itemErr } = await wrap(supabase.from('po_items').insert(rows));
  if (itemErr) return { data: null, error: itemErr };

  return { data: po, error: null };
};

export const cancelPurchaseOrder = (id) =>
  wrap(supabase.from('purchase_orders').update({ status: 'CANCELLED' }).eq('id', id));

export const receiveGoods = (payload) => wrap(supabase.rpc('receive_grn', { payload }));

// ── ACCOUNTS PAYABLE ────────────────────────────────────────────────────────────
export const fetchSupplierInvoices = () =>
  wrap(
    supabase.from('supplier_invoices')
      .select('*, suppliers(name), supplier_payments(*)')
      .order('due_date', { ascending: true, nullsFirst: false })
  );

export const createSupplierInvoice = (invoice) =>
  wrap(supabase.from('supplier_invoices').insert(invoice).select().single());

export const recordSupplierPayment = (invoiceId, amount, method, note) =>
  wrap(supabase.rpc('record_supplier_payment', { p_invoice_id: invoiceId, p_amount: amount, p_method: method, p_note: note }));

export default {
  fetchSuppliers, createSupplier, updateSupplier, deleteSupplier, fetchSupplierHistory, fetchSupplierBalance,
  fetchPurchaseOrders, fetchPurchaseOrder, createPurchaseOrder, cancelPurchaseOrder, receiveGoods,
  fetchSupplierInvoices, createSupplierInvoice, recordSupplierPayment,
};
