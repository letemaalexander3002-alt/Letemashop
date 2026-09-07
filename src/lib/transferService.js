// ============================================================================
// transferService.js — Multi-branch stock transfer requests, dispatch, and
// confirm-on-receipt. Same contract: every fn returns { data, error }.
// ============================================================================
import { supabase } from '../utils/supabaseClient';

const wrap = async (promise) => {
  try {
    const { data, error } = await promise;
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('[transferService]', err.message);
    return { data: null, error: err.message || 'Hitilafu isiyojulikana' };
  }
};

export const fetchTransfers = () =>
  wrap(
    supabase.from('stock_transfers')
      .select('*, stock_transfer_items(*, products(name, unit)), from:branches!stock_transfers_from_branch_fkey(name), to:branches!stock_transfers_to_branch_fkey(name)')
      .order('created_at', { ascending: false })
  );

export const fetchBranchStock = (branchId) =>
  wrap(supabase.from('branch_stock_summary').select('*, products(name, unit)').eq('branch_id', branchId).gt('quantity', 0));

export const createTransfer = (payload) => wrap(supabase.rpc('create_stock_transfer', { payload }));
export const dispatchTransfer = (id) => wrap(supabase.rpc('dispatch_stock_transfer', { p_transfer_id: id }));
export const confirmTransfer = (id) => wrap(supabase.rpc('confirm_stock_transfer', { p_transfer_id: id }));
export const cancelTransfer = (id) => wrap(supabase.rpc('cancel_stock_transfer', { p_transfer_id: id }));

export default { fetchTransfers, fetchBranchStock, createTransfer, dispatchTransfer, confirmTransfer, cancelTransfer };
