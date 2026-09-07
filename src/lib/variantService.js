// ============================================================================
// variantService.js — Product variants (size/color/SKU). Closes the gap
// where product_variants existed in the schema since Phase 1 with zero UI.
// Same contract: every fn returns { data, error }, never throws.
// ============================================================================
import { supabase } from '../utils/supabaseClient';

const wrap = async (promise) => {
  try {
    const { data, error } = await promise;
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('[variantService]', err.message);
    return { data: null, error: err.message || 'Hitilafu isiyojulikana' };
  }
};

export const fetchVariants = (productId) =>
  wrap(supabase.from('product_variants').select('*').eq('product_id', productId).order('variant_name'));

export const createVariant = (variant) =>
  wrap(supabase.from('product_variants').insert(variant).select().single());

export const updateVariant = (id, patch) =>
  wrap(supabase.from('product_variants').update(patch).eq('id', id).select().single());

export const deleteVariant = (id) =>
  wrap(supabase.from('product_variants').delete().eq('id', id));

export default { fetchVariants, createVariant, updateVariant, deleteVariant };
