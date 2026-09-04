// ============================================================================
// posService.js — Service layer for POS / Inventory / RBAC.
// Every function returns { data, error } (never throws) so UI code can do
// simple `const { data, error } = await fn(...)` without try/catch sprawl.
// ============================================================================
import { supabase } from '../utils/supabaseClient';

const wrap = async (promise) => {
  try {
    const { data, error } = await promise;
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('[posService]', err.message);
    return { data: null, error: err.message || 'Hitilafu isiyojulikana' };
  }
};

// ── ROLES / RBAC ─────────────────────────────────────────────────────────────
export async function fetchMyRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: 'cashier', error: null };
  const { data, error } = await wrap(
    supabase.from('user_roles').select('role').eq('user_id', user.id).limit(1)
  );
  if (error) return { data: 'super_admin', error: null }; // fail-open for the existing single-admin flow
  return { data: data?.[0]?.role || 'super_admin', error: null };
}

export const ROLE_LABELS = {
  super_admin: 'Msimamizi Mkuu',
  branch_manager: 'Meneja wa Tawi',
  cashier: 'Mhasibu (Cashier)',
  inventory_clerk: 'Karani wa Stoo',
};

// permission matrix — what each role can see/do in the new modules
export const canView = (role, section) => {
  const map = {
    super_admin:      ['pos', 'inventory', 'financials', 'roles'],
    branch_manager:   ['pos', 'inventory', 'financials'],
    inventory_clerk:  ['inventory'],
    cashier:          ['pos'],
  };
  return (map[role] || []).includes(section);
};

// ── BRANCHES ─────────────────────────────────────────────────────────────────
export const fetchBranches = () =>
  wrap(supabase.from('branches').select('*').order('is_main', { ascending: false }));

export const createBranch = (name, location) =>
  wrap(supabase.from('branches').insert({ name, location }).select().single());

// ── PRODUCTS (barcode / low-stock aware) ──────────────────────────────────────
export const findProductByBarcode = (code) =>
  wrap(supabase.from('products').select('*').or(`barcode.eq.${code},sku.eq.${code}`).limit(1));

export const searchProducts = (term) =>
  wrap(
    supabase.from('products').select('*')
      .eq('is_active', true)
      .or(`name.ilike.%${term}%,barcode.eq.${term},sku.ilike.%${term}%`)
      .order('name')
      .limit(30)
  );

export const fetchAllActiveProducts = () =>
  wrap(supabase.from('products').select('*').eq('is_active', true).order('name'));

export const fetchLowStockProducts = () =>
  wrap(
    supabase.from('products').select('*')
      .eq('is_active', true)
      .order('stock_quantity', { ascending: true })
  );

// ── INVENTORY BATCHES / EXPIRY ────────────────────────────────────────────────
export const fetchExpiringBatches = (withinDays = 30) => {
  const cutoff = new Date(Date.now() + withinDays * 86400000).toISOString().slice(0, 10);
  return wrap(
    supabase.from('inventory_batches')
      .select('*, products(name, unit)')
      .eq('is_active', true)
      .gt('quantity', 0)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', cutoff)
      .order('expiry_date', { ascending: true })
  );
};

export const fetchBatchesForProduct = (productId) =>
  wrap(
    supabase.from('inventory_batches').select('*')
      .eq('product_id', productId).eq('is_active', true)
      .order('expiry_date', { ascending: true, nullsFirst: false })
  );

export const createBatch = (batch) =>
  wrap(supabase.from('inventory_batches').insert(batch).select().single());

export const adjustStock = (productId, delta, reason) =>
  wrap(supabase.rpc('adjust_stock', { p_product_id: productId, p_delta: delta, p_reason: reason }));

export const fetchStockMovements = (productId, limit = 50) =>
  wrap(
    supabase.from('stock_movements').select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit)
  );

// ── CASH REGISTER SESSIONS ────────────────────────────────────────────────────
export const fetchOpenSession = async (cashierId) =>
  wrap(
    supabase.from('cash_register_sessions').select('*')
      .eq('cashier_id', cashierId).eq('status', 'OPEN')
      .order('opened_at', { ascending: false }).limit(1)
  );

export const openRegisterSession = (cashierId, branchId, openingFloat) =>
  wrap(
    supabase.from('cash_register_sessions')
      .insert({ cashier_id: cashierId, branch_id: branchId, opening_float: openingFloat, status: 'OPEN' })
      .select().single()
  );

export const closeRegisterSession = (sessionId, closingBalance, expectedCash) =>
  wrap(
    supabase.from('cash_register_sessions')
      .update({ status: 'CLOSED', closing_balance: closingBalance, expected_cash: expectedCash, closed_at: new Date().toISOString() })
      .eq('id', sessionId).select().single()
  );

export const recordCashMovement = (sessionId, type, amount, reason) =>
  wrap(supabase.from('cash_movements').insert({ session_id: sessionId, type, amount, reason }));

// ── CUSTOMERS (CRM / Credit) ──────────────────────────────────────────────────
export const searchCustomers = (term) =>
  wrap(supabase.from('customers').select('*').or(`name.ilike.%${term}%,phone.ilike.%${term}%`).limit(20));

export const createCustomer = (customer) =>
  wrap(supabase.from('customers').insert(customer).select().single());

// ── POS SALE (atomic RPC) ─────────────────────────────────────────────────────
export const processSale = (payload) => wrap(supabase.rpc('process_pos_sale', { payload }));

export const fetchRecentSales = (limit = 50) =>
  wrap(
    supabase.from('pos_sales').select('*, customers(name, phone), pos_payments(method, amount)')
      .order('created_at', { ascending: false }).limit(limit)
  );

export const fetchSaleDetail = (saleId) =>
  wrap(
    supabase.from('pos_sales')
      .select('*, customers(name, phone), pos_payments(*), pos_sale_items(*, products(name, unit))')
      .eq('id', saleId).single()
  );

// ── RETURNS / REFUNDS ──────────────────────────────────────────────────────────
export const createReturn = async (saleId, items, reason, processedBy) => {
  const { data: ret, error } = await wrap(
    supabase.from('pos_returns').insert({ sale_id: saleId, reason, processed_by: processedBy, status: 'APPROVED' }).select().single()
  );
  if (error) return { data: null, error };

  const rows = items.map(i => ({ return_id: ret.id, sale_item_id: i.sale_item_id, quantity: i.quantity, restock: i.restock !== false }));
  const { error: itemErr } = await wrap(supabase.from('pos_return_items').insert(rows));
  if (itemErr) return { data: null, error: itemErr };

  // restock + audit trail per item (stock auto-reversion)
  for (const i of items) {
    if (i.restock !== false) {
      await adjustStock(i.product_id, i.quantity, `Return: sale item ${i.sale_item_id}`);
    }
  }

  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('audit_logs').insert({
    actor_id: user?.id, action: 'REFUND_APPROVED', entity_type: 'pos_returns', entity_id: ret.id,
    note: `Sale ${saleId}: ${items.length} item(s), reason: ${reason || 'n/a'}`,
  });

  return { data: ret, error: null };
};

export default {
  fetchMyRole, canView, ROLE_LABELS, fetchBranches, findProductByBarcode, searchProducts,
  fetchAllActiveProducts, fetchLowStockProducts, fetchExpiringBatches, fetchBatchesForProduct,
  createBatch, adjustStock, fetchStockMovements, fetchOpenSession, openRegisterSession,
  closeRegisterSession, recordCashMovement, searchCustomers, createCustomer, processSale,
  fetchRecentSales, fetchSaleDetail, createReturn,
};
