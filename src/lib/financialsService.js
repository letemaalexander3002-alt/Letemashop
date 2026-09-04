// ============================================================================
// financialsService.js — P&L, sales breakdown, inventory velocity, expenses,
// cash register (cashflow) reporting, staff/RBAC management.
// Same contract: every fn returns { data, error }, never throws.
// ============================================================================
import { supabase } from '../utils/supabaseClient';

const wrap = async (promise) => {
  try {
    const { data, error } = await promise;
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('[financialsService]', err.message);
    return { data: null, error: err.message || 'Hitilafu isiyojulikana' };
  }
};

// ── SALES (range-filtered, with items + payments + cost for P&L/COGS) ───────
export const fetchSalesInRange = (startISO, endISO, cashierId = null) => {
  let q = supabase.from('pos_sales')
    .select('*, pos_sale_items(product_id, quantity, unit_price, discount_amount, line_total, cost_price_at_sale, products(name, category)), pos_payments(method, amount)')
    .gte('created_at', startISO).lt('created_at', endISO)
    .eq('sale_status', 'COMPLETED')
    .order('created_at', { ascending: false });
  if (cashierId) q = q.eq('cashier_id', cashierId);
  return wrap(q);
};

// ── EXPENSES ─────────────────────────────────────────────────────────────────
export const fetchExpensesInRange = (startISO, endISO) =>
  wrap(
    supabase.from('operating_expenses').select('*')
      .gte('incurred_on', startISO).lte('incurred_on', endISO)
      .order('incurred_on', { ascending: false })
  );

export const createExpense = (expense) =>
  wrap(supabase.from('operating_expenses').insert(expense).select().single());

export const deleteExpense = (id) =>
  wrap(supabase.from('operating_expenses').delete().eq('id', id));

// ── CASHFLOW / REGISTER SESSIONS ─────────────────────────────────────────────
export const fetchCashSessions = () =>
  wrap(
    supabase.from('cash_register_sessions')
      .select('*, cash_movements(*)')
      .order('opened_at', { ascending: false })
      .limit(100)
  );

export const fetchSessionCashSales = (sessionId) =>
  wrap(
    supabase.from('pos_sales').select('id, pos_payments(method, amount)').eq('session_id', sessionId)
  );

export const closeSession = (sessionId, closingBalance, expectedCash) =>
  wrap(
    supabase.from('cash_register_sessions')
      .update({ status: 'CLOSED', closing_balance: closingBalance, expected_cash: expectedCash, closed_at: new Date().toISOString() })
      .eq('id', sessionId).select().single()
  );

export const recordCashMovement = (sessionId, type, amount, reason) =>
  wrap(supabase.from('cash_movements').insert({ session_id: sessionId, type, amount, reason }).select().single());

// ── STAFF / RBAC MANAGEMENT ───────────────────────────────────────────────────
export const listStaff = () => wrap(supabase.rpc('list_staff'));

export const assignRoleByEmail = (email, role, branchId, fullName) =>
  wrap(supabase.rpc('assign_role_by_email', { p_email: email, p_role: role, p_branch_id: branchId, p_full_name: fullName }));

export const removeStaffRole = (userId, role) =>
  wrap(supabase.rpc('remove_staff_role', { p_user_id: userId, p_role: role }));

// ── AUDIT TRAIL ───────────────────────────────────────────────────────────────
export const fetchAuditLogs = (filters = {}) => {
  let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
  if (filters.entityType) q = q.eq('entity_type', filters.entityType);
  if (filters.action) q = q.ilike('action', `%${filters.action}%`);
  if (filters.startISO) q = q.gte('created_at', filters.startISO);
  return wrap(q);
};

export default {
  fetchSalesInRange, fetchExpensesInRange, createExpense, deleteExpense,
  fetchCashSessions, fetchSessionCashSales, closeSession, recordCashMovement,
  listStaff, assignRoleByEmail, removeStaffRole, fetchAuditLogs,
};
