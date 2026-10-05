import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataLayer, Preferences, Product, ScoredProduct, Submission, Risk, Tag } from '../types';
import { scoreProduct } from '../scoring';
import { seedProducts } from './seed';

const KEYS = {
  history: 'h', favs: 'f', prefs: 'p', premium: 'pr', userProducts: 'up',
};
const defaultPrefs: Preferences = { vegetarian: false, vegan: false, noPalmOil: false, noGluten: false, noLactose: false };

async function read<T>(k: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const write = (k: string, v: unknown) => AsyncStorage.setItem(k, JSON.stringify(v));
const score = (p: Product): ScoredProduct => ({ ...p, ...scoreProduct(p) });

async function allProducts(): Promise<ScoredProduct[]> {
  const user = await read<Product[]>(KEYS.userProducts, []);
  return [...seedProducts, ...user].map(score);
}

// Words that map to ingredient risk when a user types a list. Deliberately small; the real
// dictionary lives in the ingredients table on the server.
function parseIngredients(text: string) {
  const high = ['краситель красный', 'консервант'];
  const moderate = ['ароматизатор', 'пальмовое', 'краситель'];
  return text.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).map((name) => {
    const l = name.toLowerCase();
    const risk: Risk = high.some((w) => l.includes(w)) ? 'high' : moderate.some((w) => l.includes(w)) ? 'moderate' : 'none';
    return { name, risk };
  });
}

export const localData: DataLayer = {
  testPurchases: true,
  async getByBarcode(code) {
    const c = code.replace(/\D/g, '');
    return (await allProducts()).find((p) => p.barcode === c) ?? null;
  },
  async alternatives(p) {
    const all = await allProducts();
    return all
      .filter((x) => x.type === p.type && x.category === p.category && x.id !== p.id && x.score > p.score)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  },
  async history() {
    const ids = await read<string[]>(KEYS.history, []);
    const all = await allProducts();
    return ids.map((id) => all.find((p) => p.id === id)).filter(Boolean) as ScoredProduct[];
  },
  async recordScan(p) {
    const ids = await read<string[]>(KEYS.history, []);
    await write(KEYS.history, [p.id, ...ids.filter((i) => i !== p.id)].slice(0, 200));
  },
  async favorites() {
    const ids = await read<string[]>(KEYS.favs, []);
    const all = await allProducts();
    return ids.map((id) => all.find((p) => p.id === id)).filter(Boolean) as ScoredProduct[];
  },
  async isFavorite(id) {
    return (await read<string[]>(KEYS.favs, [])).includes(id);
  },
  async toggleFavorite(id) {
    const ids = await read<string[]>(KEYS.favs, []);
    const has = ids.includes(id);
    await write(KEYS.favs, has ? ids.filter((i) => i !== id) : [id, ...ids]);
    return !has;
  },
  async search(q) {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return (await allProducts()).filter((p) => (p.name + ' ' + p.brand).toLowerCase().includes(s));
  },
  async submit(s: Submission) {
    const user = await read<Product[]>(KEYS.userProducts, []);
    const p: Product = {
      id: 'u' + Date.now(), barcode: s.barcode.replace(/\D/g, ''), type: s.type, name: s.name.trim(),
      brand: s.brand.trim(), category: 'user', organic: false, ingredients: parseIngredients(s.ingredientsText),
      tags: [] as Tag[],
    };
    await write(KEYS.userProducts, [p, ...user]);
    return { status: 'published' as const };
  },
  getPrefs: () => read(KEYS.prefs, defaultPrefs),
  setPrefs: (p) => write(KEYS.prefs, p),
  isPremium: () => read(KEYS.premium, false),
  setPremium: (v) => write(KEYS.premium, v),
};
