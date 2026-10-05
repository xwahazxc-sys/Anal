import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { data } from '../data';
import { ScoredProduct } from '../types';
import { Button, EmptyState, ErrorState, Heading, Screen, Skeleton } from '../ui/primitives';
import { ProductCard } from '../ui/ProductCard';
import { space } from '../theme';

type Props = { kind: 'history' | 'favorites'; onOpen: (p: ScoredProduct) => void; onGoScan: () => void };

export function ListScreen({ kind, onOpen, onGoScan }: Props) {
  const [items, setItems] = useState<ScoredProduct[] | null>(null);
  const [err, setErr] = useState(false);
  const load = useCallback(async () => {
    setErr(false);
    try { setItems(await (kind === 'history' ? data.history() : data.favorites())); } catch { setErr(true); }
  }, [kind]);
  useEffect(() => { load(); }, [load]);

  if (err) return <Screen><ErrorState text="Не удалось загрузить список." onRetry={load} /></Screen>;
  if (!items) return <Screen><Skeleton /><Skeleton /><Skeleton /></Screen>;
  return (
    <Screen>
      <Heading level="xl">{kind === 'history' ? 'История' : 'Избранное'}</Heading>
      <View style={{ height: space[3] }} />
      <FlatList
        data={items} keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ProductCard p={item} onPress={() => onOpen(item)} />}
        ListEmptyComponent={
          kind === 'history'
            ? <EmptyState title="Пока пусто" text="Отсканированные продукты появятся здесь." action={<Button label="Сканировать" onPress={onGoScan} />} />
            : <EmptyState title="Нет избранного" text="Отмечайте продукты на их карточке, чтобы вернуться к ним позже." />
        }
      />
    </Screen>
  );
}
