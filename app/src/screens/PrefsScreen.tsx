import React, { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { data } from '../data';
import { Preferences } from '../types';
import { Body, Heading, Screen, t } from '../ui/primitives';
import { color, space } from '../theme';

const rows: [keyof Preferences, string][] = [
  ['vegetarian', 'Вегетарианская диета'], ['vegan', 'Веганская диета'], ['noPalmOil', 'Без пальмового масла'],
  ['noGluten', 'Без глютена'], ['noLactose', 'Без лактозы'],
];

export function PrefsScreen() {
  const [p, setP] = useState<Preferences | null>(null);
  useEffect(() => { data.getPrefs().then(setP); }, []);
  if (!p) return <Screen><Body muted>Загрузка…</Body></Screen>;
  return (
    <Screen>
      <Heading level="xl">Мои предпочтения</Heading>
      <Body muted>Приложение предупредит, если продукт вам не подходит.</Body>
      <View style={{ height: space[3] }} />
      {rows.map(([k, label]) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, borderBottomWidth: 1, borderColor: color.border }}>
          <Text style={[t.base, { color: color.text }]}>{label}</Text>
          <Switch accessibilityLabel={label} value={p[k]} trackColor={{ true: color.accent, false: color['border-input'] }}
            onValueChange={(v) => { const n = { ...p, [k]: v }; setP(n); data.setPrefs(n); }} />
        </View>
      ))}
    </Screen>
  );
}
