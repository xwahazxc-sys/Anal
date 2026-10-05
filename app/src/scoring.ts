import { Product, ScoreResult, Risk } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Points per 100 g: lower is better. Thresholds are our own simplified bands.
function band(v: number, steps: number[]): number {
  let pts = 0;
  for (const s of steps) if (v > s) pts++;
  return pts;
}

/** Nutrition quality 0-100 for food. */
export function nutritionScore(p: Product): number {
  const n = p.nutrition;
  if (!n) return 50;
  const bad =
    band(n.energyKcal, [80, 160, 240, 320, 400, 480, 560, 640, 720, 800]) + // 0-10
    band(n.sugarsG, [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45]) +
    band(n.satFatG, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) +
    band(n.sodiumMg, [90, 180, 270, 360, 450, 540, 630, 720, 810, 900]);
  const good =
    band(n.fiberG, [0.9, 1.9, 2.8, 3.7, 4.7]) + band(n.proteinG, [1.6, 3.2, 4.8, 6.4, 8]); // 0-10
  const net = bad - good; // -10 .. 40
  return clamp(Math.round(100 - ((net + 10) / 50) * 100), 0, 100);
}

const riskPenalty: Record<Risk, number> = { none: 0, low: 8, moderate: 25, high: 60 };

/** Additives 0-100: starts at 100, subtract per ingredient. */
export function additivesScore(p: Product): number {
  const total = p.ingredients.reduce((s, i) => s + riskPenalty[i.risk], 0);
  return clamp(100 - total, 0, 100);
}

export function colorFor(score: number): ScoreResult['color'] {
  if (score >= 75) return 'green';
  if (score >= 50) return 'yellow';
  if (score >= 25) return 'orange';
  return 'red';
}

/** What each part contributed, in points of the final 0-100 score. Shown on the product card. */
export function breakdown(p: Product): { label: string; points: number; max: number }[] {
  if (p.type === 'food') {
    return [
      { label: 'Питательность', points: Math.round(0.6 * nutritionScore(p)), max: 60 },
      { label: 'Добавки', points: Math.round(0.3 * additivesScore(p)), max: 30 },
      { label: 'Органический продукт', points: p.organic ? 10 : 0, max: 10 },
    ];
  }
  return [{ label: 'Состав', points: additivesScore(p), max: 100 }];
}

export function scoreProduct(p: Product): ScoreResult {
  const hasHigh = p.ingredients.some((i) => i.risk === 'high');
  let score: number;
  if (p.type === 'food') {
    score = 0.6 * nutritionScore(p) + 0.3 * additivesScore(p) + 0.1 * (p.organic ? 100 : 0);
  } else {
    // cosmetics: worst ingredient drives the score, a few moderate ones pull it down further
    score = additivesScore(p);
  }
  let capped = false;
  if (hasHigh && score > 49) {
    score = 49;
    capped = true;
  }
  score = Math.round(clamp(score, 0, 100));
  return { score, color: colorFor(score), capped };
}
