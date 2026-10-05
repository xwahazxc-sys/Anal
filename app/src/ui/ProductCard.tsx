import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScoredProduct } from '../types';
import { color, radius, space, scoreWord } from '../theme';
import { ScoreBadge, t } from './primitives';

export function ProductCard({ p, onPress }: { p: ScoredProduct; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={`${p.name}, ${p.brand}. Оценка ${p.score}, ${scoreWord[p.color].toLowerCase()}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 72, padding: space[3],
        backgroundColor: color.surface, borderColor: color.border, borderWidth: 1, borderRadius: radius.md,
        marginBottom: space[2], opacity: pressed ? 0.85 : 1,
      })}
    >
      <ScoreBadge score={p.score} c={p.color} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={[t.base, { color: color.text, fontWeight: '600' }]}>{p.name}</Text>
        <Text numberOfLines={1} style={[t.sm, { color: color['text-muted'] }]}>{p.brand} · {scoreWord[p.color]}</Text>
      </View>
    </Pressable>
  );
}
