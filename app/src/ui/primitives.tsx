import React from 'react';
import { Pressable, Text, View, TextInput, StyleSheet, ActivityIndicator, TextInputProps } from 'react-native';
import { color, radius, space, type, scoreColor, scoreWord, ScoreColor } from '../theme';

export const t = {
  xs: { fontSize: type.xs.size, lineHeight: type.xs.line, fontWeight: String(type.xs.weight) as '500' },
  sm: { fontSize: type.sm.size, lineHeight: type.sm.line, fontWeight: '400' as const },
  base: { fontSize: type.base.size, lineHeight: type.base.line, fontWeight: '400' as const },
  lg: { fontSize: type.lg.size, lineHeight: type.lg.line, fontWeight: '600' as const },
  xl: { fontSize: type.xl.size, lineHeight: type.xl.line, fontWeight: '700' as const },
};

export function Body({ children, muted, style, ...rest }: React.ComponentProps<typeof Text> & { muted?: boolean }) {
  return <Text style={[t.base, { color: muted ? color['text-muted'] : color.text }, style]} {...rest}>{children}</Text>;
}
export function Heading({ children, level = 'lg' }: { children: React.ReactNode; level?: 'lg' | 'xl' }) {
  return <Text accessibilityRole="header" style={[t[level], { color: color.text }]}>{children}</Text>;
}

type BtnProps = {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean; disabled?: boolean; size?: 'sm' | 'md' | 'lg';
};
export function Button({ label, onPress, variant = 'primary', loading, disabled, size = 'md' }: BtnProps) {
  const h = size === 'sm' ? 32 : size === 'lg' ? 48 : 40;
  const bg = variant === 'primary' ? color.accent : variant === 'danger' ? color.danger : variant === 'secondary' ? color.surface : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? color['on-accent'] : color.text;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed, focused }: any) => [
        styles.btn, { height: h, backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1,
          borderColor: variant === 'secondary' ? color.border : focused ? color.accent : 'transparent', borderWidth: 2 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : null}
      <Text style={[t.sm, { color: fg, fontWeight: '600', marginLeft: loading ? space[2] : 0 }]}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View style={{ gap: space[1] }}>
      <Text style={[t.sm, { color: color.text, fontWeight: '600' }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label} placeholderTextColor={color['text-muted']}
        style={[styles.input, t.base, { color: color.text }]} {...rest}
      />
    </View>
  );
}

export function ScoreBadge({ score, c, size = 'sm' }: { score: number; c: ScoreColor; size?: 'sm' | 'lg' }) {
  const d = size === 'lg' ? 64 : 40;
  return (
    <View
      accessible accessibilityLabel={`Оценка ${score} из 100, ${scoreWord[c].toLowerCase()}`}
      style={{ width: d, height: d, borderRadius: radius.pill, backgroundColor: scoreColor[c], alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={[size === 'lg' ? t.xl : t.lg, { color: color['on-score'] }]}>{score}</Text>
    </View>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: space[6], gap: space[2] }}>
      <Heading>{title}</Heading>
      <Body muted style={{ textAlign: 'center' }}>{text}</Body>
      {action}
    </View>
  );
}

export function Skeleton({ h = 72 }: { h?: number }) {
  return <View accessibilityLabel="Загрузка" style={{ height: h, borderRadius: radius.md, backgroundColor: color.surface, marginBottom: space[2] }} />;
}

export function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) {
  return <EmptyState title="Что-то пошло не так" text={text} action={<Button label="Повторить" onPress={onRetry} variant="secondary" />} />;
}

export function Screen({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  return <View style={{ flex: 1, backgroundColor: color.bg, padding: padded ? space[4] : 0 }}>{children}</View>;
}

const styles = StyleSheet.create({
  btn: { borderRadius: radius.md, paddingHorizontal: space[4], alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  input: { minHeight: 44, borderWidth: 1, borderColor: color['border-input'], borderRadius: radius.md, paddingHorizontal: space[3], backgroundColor: color.bg },
});
