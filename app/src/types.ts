export type ProductType = 'food' | 'cosmetic';
export type Risk = 'none' | 'low' | 'moderate' | 'high';
export type Tag = 'vegetarian' | 'vegan' | 'palm_oil' | 'gluten' | 'lactose';

export interface Ingredient {
  name: string;
  risk: Risk;
  note?: string;
}

export interface Nutrition {
  energyKcal: number;
  sugarsG: number;
  satFatG: number;
  sodiumMg: number;
  fiberG: number;
  proteinG: number;
}

export interface Product {
  id: string;
  barcode: string;
  type: ProductType;
  name: string;
  brand: string;
  category: string;
  organic: boolean;
  nutrition?: Nutrition;
  ingredients: Ingredient[];
  tags: Tag[]; // facts about the product: 'palm_oil', 'gluten', 'lactose' present; 'vegetarian','vegan' suitable
}

export type ScoreResult = { score: number; color: 'green' | 'yellow' | 'orange' | 'red'; capped: boolean };
export type ScoredProduct = Product & ScoreResult;

export interface Preferences {
  vegetarian: boolean;
  vegan: boolean;
  noPalmOil: boolean;
  noGluten: boolean;
  noLactose: boolean;
}

export interface Submission {
  barcode: string;
  type: ProductType;
  name: string;
  brand: string;
  ingredientsText: string;
}

export interface DataLayer {
  getByBarcode(code: string): Promise<ScoredProduct | null>;
  alternatives(p: ScoredProduct): Promise<ScoredProduct[]>;
  history(): Promise<ScoredProduct[]>;
  recordScan(p: ScoredProduct): Promise<void>;
  favorites(): Promise<ScoredProduct[]>;
  isFavorite(id: string): Promise<boolean>;
  toggleFavorite(id: string): Promise<boolean>;
  search(q: string): Promise<ScoredProduct[]>;
  submit(s: Submission): Promise<{ status: 'pending' | 'published' }>;
  getPrefs(): Promise<Preferences>;
  setPrefs(p: Preferences): Promise<void>;
  isPremium(): Promise<boolean>;
  setPremium(v: boolean): Promise<void>;
}
