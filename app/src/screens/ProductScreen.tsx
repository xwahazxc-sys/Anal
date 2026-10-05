import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { data } from '../data';
import { Preferences, ScoredProduct, Risk } from '../types';
import { breakdown } from '../scoring';
import { Body, Button, ErrorState, Heading, ScoreBadge, Skeleton, Screen, t } from '../ui/primitives';
import { ProductCard } from '../ui/ProductCard';
import { color, radius, space, scoreWord } from '../theme';

const riskWord: Record<Risk, string> = { none: 'Без риска', low: 'Низкий риск', moderate: 'Умеренный риск', high: 'Высокий риск' };
const riskColor: Record<Risk, string> = {
  none: color['score-good'], low: color['score-ok'], moderate: color['score-poor'], high: color['score-bad'],
};

export function alerts(p: ScoredProduct, pr: Preferences): string[] {
  const out: string[] = [];
  if (p.type !== 'food') return out;
  if (pr.vegan && !p.tags.includes('vegan')) out.push('Не подходит для веганской диеты');
  else if (pr.vegetarian && !p.tags.includes('vegetarian')) out.push('Не подходит для вегетарианской диеты');
  if (pr.noPalmOil && p.tags.includes('palm_oil')) out.push('Содержит пальмовое масло');
  if (pr.noGluten && p.tags.includes('gluten')) out.push('Содержит глютен');
  if (pr.noLactose && p.tags.includes('lactose')) out.push('Содержит лактозу');
  return out;
}

function IngredientRow({ name, risk, note }: { name: string; risk: Risk; note?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ expanded: open }}
      accessibilityLabel={`${name}. ${riskWord[risk]}`} onPress={() => setOpen((v) => !v)}
      style={{ paddingVertical: space[2], borderBottomWidth: 1, borderColor: color.border }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: riskColor[risk] }} />
        <Text style={[t.base, { color: color.text, flex: 1 }]}>{name}</Text>
        <Text style={[t.sm, { color: color['text-muted'] }]}>{riskWord[risk]}</Text>
      </View>
      {open ? <Body muted style={{ marginTop: space[1] }}>{note ?? 'Подробного пояснения пока нет.'}</Body> : null}
    </Pressable>
  );
}

type Props = {
  code?: string; productId?: string; premium: boolean; onOpen: (p: ScoredProduct) => void;
  onAdd: (barcode: string) => void; onPaywall: () => void;
};

export function ProductScreen({ code, premium, onOpen, onAdd, onPaywall }: Props) {
  const [state, setState] = useState<'loading' | 'error' | 'missing' | 'ok'>('loading');
  const [p, setP] = useState<ScoredProduct | null>(null);
  const [alts, setAlts] = useState<ScoredProduct[]>([]);
  const [fav, setFav] = useState(false);
  const [prefs, setPrefs] = useState<Preferences | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const found = await data.getByBarcode(code ?? '');
      if (!found) return setState('missing');
      setP(found);
      await data.recordScan(found);
      setFav(await data.isFavorite(found.id));
      setPrefs(await data.getPrefs());
      setAlts(found.score < 50 ? await data.alternatives(found) : []);
      setState('ok');
    } catch {
      setState('error');
    }
  }, [code]);
  useEffect(() => { load(); }, [load]);

  if (state === 'loading') return <Screen><Skeleton h={96} /><Skeleton /><Skeleton /></Screen>;
  if (state === 'error') return <Screen><ErrorState text="Не удалось загрузить продукт." onRetry={load} /></Screen>;
  if (state === 'missing' || !p) {
    return (
      <Screen>
        <View style={{ gap: space[3], padding: space[4] }}>
          <Heading>Такого продукта пока нет</Heading>
          <Body muted>Штрихкод {code} не найден в базе. Добавьте продукт, чтобы он появился у всех.</Body>
          <Button label="Добавить продукт" onPress={() => onAdd(code ?? '')} size="lg" />
        </View>
      </Screen>
    );
  }
  const al = premium && prefs ? alerts(p, prefs) : [];
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
        <View style={{ flexDirection: 'row', gap: space[4], alignItems: 'center' }}>
          <ScoreBadge score={p.score} c={p.color} size="lg" />
          <View style={{ flex: 1 }}>
            <Heading>{p.name}</Heading>
            <Body muted>{p.brand}</Body>
            <Text style={[t.sm, { color: color.text, fontWeight: '600' }]}>{scoreWord[p.color]}</Text>
          </View>
        </View>
        <View accessibilityLabel="Из чего сложилась оценка" style={{ gap: space[1] }}>
          <Heading>Из чего сложилась оценка</Heading>
          {breakdown(p).map((b) => (
            <Body key={b.label}>{b.label}: {b.points} из {b.max}</Body>
          ))}
          {p.capped ? <Body muted>Оценка ограничена до 49: в составе есть вещество с высоким риском.</Body> : null}
        </View>
        {al.map((a) => (
          <View key={a} accessibilityRole="alert" style={{ backgroundColor: color.surface, borderColor: color.danger, borderWidth: 1, borderRadius: radius.md, padding: space[3] }}>
            <Text style={[t.sm, { color: color.danger, fontWeight: '600' }]}>{a}</Text>
          </View>
        ))}
        {!premium ? (
          <Pressable accessibilityRole="button" onPress={onPaywall}>
            <Body muted>Фильтры по диете и аллергенам — в Premium. Подробнее →</Body>
          </Pressable>
        ) : null}
        <Button label={fav ? 'Убрать из избранного' : 'В избранное'} variant="secondary"
          onPress={async () => setFav(await data.toggleFavorite(p.id))} />
        {p.nutrition ? (
          <View style={{ gap: space[1] }}>
            <Heading>Питательность на 100 г</Heading>
            <Body>Калории: {p.nutrition.energyKcal} ккал · Сахар: {p.nutrition.sugarsG} г</Body>
            <Body>Насыщенные жиры: {p.nutrition.satFatG} г · Натрий: {p.nutrition.sodiumMg} мг</Body>
            <Body>Клетчатка: {p.nutrition.fiberG} г · Белок: {p.nutrition.proteinG} г</Body>
            {p.organic ? <Body muted>Органический продукт</Body> : null}
          </View>
        ) : null}
        <View>
          <Heading>Состав</Heading>
          {p.ingredients.length ? p.ingredients.map((i) => <IngredientRow key={i.name} {...i} />) : <Body muted>Состав не указан.</Body>}
        </View>
        {alts.length ? (
          <View>
            <Heading>Лучшие альтернативы</Heading>
            <View style={{ height: space[2] }} />
            {alts.map((a) => <ProductCard key={a.id} p={a} onPress={() => onOpen(a)} />)}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
