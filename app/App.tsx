import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { data } from './src/data';
import { ScoredProduct } from './src/types';
import { color, space } from './src/theme';
import { Button, Heading, Screen, Body, t } from './src/ui/primitives';
import { ScanScreen } from './src/screens/ScanScreen';
import { ProductScreen } from './src/screens/ProductScreen';
import { ListScreen } from './src/screens/ListScreen';
import { AddProductScreen } from './src/screens/AddProductScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { PrefsScreen } from './src/screens/PrefsScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { supabase } from './src/supabase';

type Tab = 'scan' | 'history' | 'favorites' | 'more';
type Route =
  | { name: 'product'; code: string; key: number }
  | { name: 'add'; code: string }
  | { name: 'search' } | { name: 'prefs' } | { name: 'paywall' } | { name: 'account' };

const tabs: [Tab, string][] = [['scan', 'Сканер'], ['history', 'История'], ['favorites', 'Избранное'], ['more', 'Ещё']];

export default function App() {
  const [tab, setTab] = useState<Tab>('scan');
  const [stack, setStack] = useState<Route[]>([]);
  const [premium, setPremium] = useState(false);
  const [session, setSession] = useState<'loading' | 'out' | 'in'>(supabase ? 'loading' : 'in');
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: d }) => setSession(d.session ? 'in' : 'out'));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setStack([]); setSession(s ? 'in' : 'out'); });
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session === 'in') data.isPremium().then(setPremium).catch(() => setPremium(false)); }, [session]);

  const push = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const pop = () => setStack((s) => s.slice(0, -1));
  const openProduct = (p: ScoredProduct) => push({ name: 'product', code: p.barcode, key: Date.now() });
  const openCode = (code: string) => push({ name: 'product', code, key: Date.now() });
  const gated = (r: Route) => (premium ? push(r) : push({ name: 'paywall' }));

  if (session === 'loading') return <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}><Screen><Body muted>Загрузка…</Body></Screen></SafeAreaView>;
  if (session === 'out') return <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}><View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}><AuthScreen /></View></SafeAreaView>;

  const top = stack[stack.length - 1];
  let content: React.ReactNode;
  let title = '';
  if (top) {
    switch (top.name) {
      case 'product':
        title = 'Продукт';
        content = <ProductScreen key={top.key} code={top.code} premium={premium} onOpen={openProduct}
          onAdd={(c) => push({ name: 'add', code: c })} onPaywall={() => push({ name: 'paywall' })} />;
        break;
      case 'add':
        title = 'Добавить продукт';
        content = <AddProductScreen barcode={top.code} onDone={(c) => { pop(); setStack((s) => [...s.slice(0, -1), { name: 'product', code: c, key: Date.now() }]); }} />;
        break;
      case 'search': title = 'Поиск'; content = <SearchScreen onOpen={openProduct} />; break;
      case 'prefs': title = 'Предпочтения'; content = <PrefsScreen />; break;
      case 'account': title = 'Аккаунт'; content = <AccountScreen />; break;
      case 'paywall': title = 'Premium'; content = <PaywallScreen premium={premium} onChange={setPremium} />; break;
    }
  } else if (tab === 'scan') content = <ScanScreen onCode={openCode} />;
  else if (tab === 'history') content = <ListScreen key="h" kind="history" onOpen={openProduct} onGoScan={() => setTab('scan')} />;
  else if (tab === 'favorites') content = <ListScreen key="f" kind="favorites" onOpen={openProduct} onGoScan={() => setTab('scan')} />;
  else content = (
    <Screen>
      <Heading level="xl">Ещё</Heading>
      <View style={{ gap: space[2], marginTop: space[3] }}>
        <Button label="Поиск продукта" variant="secondary" onPress={() => gated({ name: 'search' })} />
        <Button label="Мои предпочтения" variant="secondary" onPress={() => gated({ name: 'prefs' })} />
        <Button label={premium ? 'Premium активен' : 'Premium'} onPress={() => push({ name: 'paywall' })} />
        {supabase ? <Button label="Аккаунт" variant="secondary" onPress={() => push({ name: 'account' })} /> : null}
        <Body muted style={{ marginTop: space[3] }}>Оценка не является медицинской рекомендацией.</Body>
      </View>
    </Screen>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <StatusBar style="dark" />
      {top ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: space[2], borderBottomWidth: 1, borderColor: color.border }}>
          <Button label="Назад" variant="ghost" size="sm" onPress={pop} />
          <Text accessibilityRole="header" style={[t.lg, { color: color.text, marginLeft: space[2] }]}>{title}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}>{content}</View>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: color.border, backgroundColor: color.bg }}>
        {tabs.map(([k, label]) => {
          const active = !top && tab === k;
          return (
            <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: active }}
              onPress={() => { setStack([]); setTab(k); }}
              style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[t.xs, { color: active ? color.accent : color['text-muted'], fontWeight: active ? '700' : '500' }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
