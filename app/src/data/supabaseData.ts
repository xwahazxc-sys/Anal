import { SupabaseClient } from '@supabase/supabase-js';
import { DataLayer, Preferences, Product, ScoredProduct } from '../types';
import { scoreProduct } from '../scoring';

const defaultPrefs: Preferences = { vegetarian: false, vegan: false, noPalmOil: false, noGluten: false, noLactose: false };

const score = (p: Product): ScoredProduct => ({ ...p, ...scoreProduct(p) });
const toProduct = (j: any): Product => ({
  id: j.id, barcode: j.barcode, type: j.type, name: j.name, brand: j.brand ?? '', category: j.category ?? 'other',
  organic: !!j.organic, nutrition: j.nutrition && Object.keys(j.nutrition).length ? j.nutrition : undefined,
  ingredients: j.ingredients ?? [], tags: j.tags ?? [],
});
const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

export function createSupabaseData(sb: SupabaseClient): DataLayer {
  const uid = async () => {
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new Error('not signed in');
    return data.user.id;
  };
  const byIds = async (ids: string[]) => {
    if (!ids.length) return [] as ScoredProduct[];
    const { data, error } = await sb.rpc('product_json_by_ids', { ids });
    fail(error);
    const map = new Map((data as any[]).map((j) => [j.id, score(toProduct(j))]));
    return ids.map((i) => map.get(i)).filter(Boolean) as ScoredProduct[];
  };
  return {
    testPurchases: false,
    async getByBarcode(code) {
      const { data, error } = await sb.rpc('product_by_barcode', { code });
      fail(error);
      return data ? score(toProduct(data)) : null;
    },
    async alternatives(p) {
      const { data, error } = await sb.rpc('product_alternatives', { pid: p.id });
      fail(error);
      return (data as any[]).map((j) => score(toProduct(j))).filter((x) => x.score > p.score);
    },
    async history() {
      const { data, error } = await sb.from('scan_events').select('product_id, scanned_at').order('scanned_at', { ascending: false }).limit(200);
      fail(error);
      const ids = Array.from(new Set((data ?? []).map((r) => r.product_id as string)));
      return byIds(ids);
    },
    async recordScan(p) {
      const { error } = await sb.from('scan_events').insert({ user_id: await uid(), product_id: p.id });
      fail(error);
    },
    async favorites() {
      const { data, error } = await sb.from('favorites').select('product_id, created_at').order('created_at', { ascending: false });
      fail(error);
      return byIds((data ?? []).map((r) => r.product_id as string));
    },
    async isFavorite(id) {
      const { data, error } = await sb.from('favorites').select('product_id').eq('product_id', id).maybeSingle();
      fail(error);
      return !!data;
    },
    async toggleFavorite(id) {
      const user = await uid();
      const { data } = await sb.from('favorites').select('product_id').eq('product_id', id).maybeSingle();
      if (data) { fail((await sb.from('favorites').delete().eq('product_id', id)).error); return false; }
      fail((await sb.from('favorites').insert({ user_id: user, product_id: id })).error);
      return true;
    },
    async search(q) {
      if (q.trim().length < 2) return [];
      const { data, error } = await sb.rpc('search_products', { q: q.trim() });
      fail(error);
      return (data as any[]).map((j) => score(toProduct(j)));
    },
    async submit(s) {
      const { error } = await sb.from('submissions').insert({
        user_id: await uid(), barcode: s.barcode.replace(/\D/g, ''), type: s.type, name: s.name.trim(),
        brand: s.brand.trim(), ingredients_text: s.ingredientsText.trim(), status: 'pending',
      });
      fail(error);
      return { status: 'pending' as const };
    },
    async getPrefs() {
      const { data, error } = await sb.from('profiles').select('preferences').maybeSingle();
      fail(error);
      return { ...defaultPrefs, ...((data?.preferences as Partial<Preferences>) ?? {}) };
    },
    async setPrefs(p) {
      fail((await sb.from('profiles').update({ preferences: p, updated_at: new Date().toISOString() }).eq('id', await uid())).error);
    },
    async isPremium() {
      const { data, error } = await sb.from('profiles').select('premium_until').maybeSingle();
      fail(error);
      return !!data?.premium_until && new Date(data.premium_until as string) > new Date();
    },
    async setPremium() { /* server-owned: set by the RevenueCat webhook only */ },
  };
}
