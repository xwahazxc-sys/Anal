import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { data } from '../data';
import { ScoredProduct } from '../types';
import { EmptyState, Field, Heading, Screen } from '../ui/primitives';
import { ProductCard } from '../ui/ProductCard';
import { space } from '../theme';

export function SearchScreen({ onOpen }: { onOpen: (p: ScoredProduct) => void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<ScoredProduct[]>([]);
  useEffect(() => { data.search(q).then(setRes); }, [q]);
  return (
    <Screen>
      <Heading level="xl">Поиск</Heading>
      <View style={{ height: space[3] }} />
      <Field label="Название или бренд" value={q} onChangeText={setQ} placeholder="Например, йогурт" />
      <View style={{ height: space[3] }} />
      <FlatList
        data={res} keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ProductCard p={item} onPress={() => onOpen(item)} />}
        ListEmptyComponent={<EmptyState title={q.trim().length < 2 ? 'Начните вводить' : 'Ничего не найдено'}
          text={q.trim().length < 2 ? 'Минимум два символа.' : 'Попробуйте другое название или отсканируйте штрихкод.'} />}
      />
    </Screen>
  );
}
