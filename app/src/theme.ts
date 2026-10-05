import tokens from './tokens.json';

export const color = tokens.color as Record<string, string>;
export const space = tokens.space;
export const radius = tokens.radius;
export const type = tokens.type;

export type ScoreColor = 'green' | 'yellow' | 'orange' | 'red';
export const scoreColor: Record<ScoreColor, string> = {
  green: color['score-good'],
  yellow: color['score-ok'],
  orange: color['score-poor'],
  red: color['score-bad'],
};
export const scoreWord: Record<ScoreColor, string> = {
  green: 'Отлично',
  yellow: 'Хорошо',
  orange: 'Посредственно',
  red: 'Плохо',
};
