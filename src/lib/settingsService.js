// ============================================================================
// settingsService.js — App-wide settings, online-store payment channels, and
// product categories. These were previously hardcoded in JSX; this service
// makes them fully admin-managed (add/edit/delete) and DB-driven everywhere
// they're consumed (Admin Panel, POS receipts, storefront checkout).
// Same contract: every fn returns { data, error }, never throws.
// ============================================================================
import { supabase } from '../utils/supabaseClient';

const wrap = async (promise) => {
  try {
    const { data, error } = await promise;
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('[settingsService]', err.message);
    return { data: null, error: err.message || 'Hitilafu isiyojulikana' };
  }
};

// ── APP SETTINGS (key/value — business name, phone, location, etc.) ─────────
export async function fetchAppSettings() {
  const { data, error } = await wrap(supabase.from('app_settings').select('*'));
  if (error) return { data: {}, error };
  const map = {};
  (data || []).forEach(row => { map[row.key] = row.value; });
  return { data: map, error: null };
}

export const upsertAppSetting = (key, value) =>
  wrap(supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }).select().single());

export const upsertManySettings = async (entries) => {
  const rows = Object.entries(entries).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
  return wrap(supabase.from('app_settings').upsert(rows));
};

// ── STORE PAYMENT CHANNELS (online storefront checkout) ─────────────────────
export const fetchPaymentChannels = (activeOnly = false) => {
  let q = supabase.from('store_payment_channels').select('*').order('sort_order', { ascending: true });
  if (activeOnly) q = q.eq('is_active', true);
  return wrap(q);
};

export const createPaymentChannel = (channel) =>
  wrap(supabase.from('store_payment_channels').insert(channel).select().single());

export const updatePaymentChannel = (id, patch) =>
  wrap(supabase.from('store_payment_channels').update(patch).eq('id', id).select().single());

export const deletePaymentChannel = (id) =>
  wrap(supabase.from('store_payment_channels').delete().eq('id', id));

// ── CATEGORIES (product categorization) ──────────────────────────────────────
export const fetchCategories = (activeOnly = false) => {
  let q = supabase.from('categories').select('*').order('sort_order', { ascending: true });
  if (activeOnly) q = q.eq('is_active', true);
  return wrap(q);
};

export const createCategory = (category) =>
  wrap(supabase.from('categories').insert(category).select().single());

export const updateCategory = (id, patch) =>
  wrap(supabase.from('categories').update(patch).eq('id', id).select().single());

export const deleteCategory = (id) =>
  wrap(supabase.from('categories').delete().eq('id', id));

export default {
  fetchAppSettings, upsertAppSetting, upsertManySettings,
  fetchPaymentChannels, createPaymentChannel, updatePaymentChannel, deletePaymentChannel,
  fetchCategories, createCategory, updateCategory, deleteCategory,
};
