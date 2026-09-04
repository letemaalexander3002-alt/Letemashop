// ============================================================================
// crmService.js — Customer directory, credit (Kopa) sales, loyalty ledger.
// Same contract: every fn returns { data, error }, never throws.
// ============================================================================
import { supabase } from '../utils/supabaseClient';

const wrap = async (promise) => {
  try {
    const { data, error } = await promise;
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('[crmService]', err.message);
    return { data: null, error: err.message || 'Hitilafu isiyojulikana' };
  }
};

// ── CUSTOMER DIRECTORY ────────────────────────────────────────────────────────
export const fetchCustomers = (search = '') => {
  let q = supabase.from('customers').select('*').order('created_at', { ascending: false });
  if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
  return wrap(q);
};

export const fetchCustomer = (id) =>
  wrap(supabase.from('customers').select('*').eq('id', id).single());

export const createCustomer = (customer) =>
  wrap(supabase.from('customers').insert(customer).select().single());

export const updateCustomer = (id, patch) =>
  wrap(supabase.from('customers').update(patch).eq('id', id).select().single());

export const deleteCustomer = (id) =>
  wrap(supabase.from('customers').delete().eq('id', id));

export const fetchCustomerPurchaseHistory = (customerId) =>
  wrap(
    supabase.from('pos_sales')
      .select('*, pos_sale_items(*, products(name))')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
  );

export const fetchLoyaltyLedger = (customerId) =>
  wrap(
    supabase.from('loyalty_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
  );

// ── CREDIT / KOPA SALES ─────────────────────────────────────────────────────
export const fetchCreditSales = () =>
  wrap(
    supabase.from('credit_sales')
      .select('*, customers(name, phone), credit_payments(*)')
      .order('due_date', { ascending: true, nullsFirst: false })
  );

export const fetchCustomerCreditSales = (customerId) =>
  wrap(
    supabase.from('credit_sales')
      .select('*, credit_payments(*)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
  );

export const recordCreditPayment = (creditSaleId, amount, method, note) =>
  wrap(supabase.rpc('record_credit_payment', { p_credit_sale_id: creditSaleId, p_amount: amount, p_method: method, p_note: note }));

export const fetchOverdueCreditSales = () =>
  wrap(supabase.rpc('overdue_credit_sales'));

export default {
  fetchCustomers, fetchCustomer, createCustomer, updateCustomer, deleteCustomer,
  fetchCustomerPurchaseHistory, fetchLoyaltyLedger,
  fetchCreditSales, fetchCustomerCreditSales, recordCreditPayment, fetchOverdueCreditSales,
};
