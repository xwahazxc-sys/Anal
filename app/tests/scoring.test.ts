import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreProduct, colorFor, breakdown } from '../src/scoring';
import { Product } from '../src/types';
import { seedProducts } from '../src/data/seed';

const base: Product = { id: 'x', barcode: '1', type: 'food', name: 'x', brand: '', category: 'c', organic: false, ingredients: [], tags: [] };

test('colour bands', () => {
  assert.equal(colorFor(100), 'green'); assert.equal(colorFor(75), 'green');
  assert.equal(colorFor(74), 'yellow'); assert.equal(colorFor(50), 'yellow');
  assert.equal(colorFor(49), 'orange'); assert.equal(colorFor(25), 'orange');
  assert.equal(colorFor(24), 'red'); assert.equal(colorFor(0), 'red');
});

test('scores stay within 0..100 for every seed product', () => {
  for (const p of seedProducts) { const r = scoreProduct(p); assert.ok(r.score >= 0 && r.score <= 100, p.name); }
});

test('a high-risk ingredient caps a good food at 49', () => {
  const good: Product = { ...base, organic: true, nutrition: { energyKcal: 50, sugarsG: 1, satFatG: 0, sodiumMg: 10, fiberG: 6, proteinG: 8 },
    ingredients: [{ name: 'a', risk: 'none' }] };
  assert.ok(scoreProduct(good).score >= 75);
  const bad = { ...good, ingredients: [...good.ingredients, { name: 'b', risk: 'high' as const }] };
  const r = scoreProduct(bad);
  assert.equal(r.score, 49); assert.equal(r.capped, true);
});

test('organic adds up to 10 points', () => {
  const p: Product = { ...base, nutrition: { energyKcal: 300, sugarsG: 10, satFatG: 3, sodiumMg: 300, fiberG: 2, proteinG: 4 }, ingredients: [] };
  const diff = scoreProduct({ ...p, organic: true }).score - scoreProduct(p).score;
  assert.ok(diff >= 9 && diff <= 10, String(diff));
});

test('food without nutrition data gets a neutral nutrition value, not NaN', () => {
  const r = scoreProduct({ ...base, ingredients: [] });
  assert.ok(Number.isFinite(r.score));
});

test('cosmetics: worst ingredient drives the result, no ingredients is clean', () => {
  const c: Product = { ...base, type: 'cosmetic' };
  assert.equal(scoreProduct(c).score, 100);
  assert.ok(scoreProduct({ ...c, ingredients: [{ name: 'p', risk: 'high' }] }).score <= 49);
});

test('alternatives logic input: bad seed product scores below its alternatives', () => {
  const bad = seedProducts.find((p) => p.id === 'p3')!; const good = seedProducts.find((p) => p.id === 'p1')!;
  assert.ok(scoreProduct(bad).score < scoreProduct(good).score);
});

test('breakdown parts add up to the uncapped score for food', () => {
  const p = seedProducts.find((x) => x.id === 'p2')!;
  const sum = breakdown(p).reduce((a, b) => a + b.points, 0);
  assert.ok(Math.abs(sum - scoreProduct(p).score) <= 1, `${sum} vs ${scoreProduct(p).score}`);
});
