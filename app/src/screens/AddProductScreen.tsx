import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { data } from '../data';
import { ProductType } from '../types';
import { Body, Button, Field, Heading, Screen } from '../ui/primitives';
import { color, space } from '../theme';

export function AddProductScreen({ barcode, onDone }: { barcode: string; onDone: (code: string) => void }) {
  const [type, setType] = useState<ProductType>('food');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [code, setCode] = useState(barcode);
  const [ingredients, setIngredients] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    if (name.trim().length < 2) return setErr('Укажите название продукта');
    if (code.replace(/\D/g, '').length < 8) return setErr('Штрихкод — от 8 цифр');
    if (!ingredients.trim()) return setErr('Перечислите состав через запятую');
    setErr(''); setBusy(true);
    try {
      await data.submit({ barcode: code, type, name, brand, ingredientsText: ingredients });
      onDone(code);
    } catch { setErr('Не удалось отправить. Попробуйте ещё раз.'); } finally { setBusy(false); }
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }} keyboardShouldPersistTaps="handled">
        <Heading level="xl">Новый продукт</Heading>
        <Body muted>Фото упаковки можно будет приложить в приложении на телефоне. Здесь — введите данные вручную.</Body>
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Button label="Еда" variant={type === 'food' ? 'primary' : 'secondary'} onPress={() => setType('food')} />
          <Button label="Косметика" variant={type === 'cosmetic' ? 'primary' : 'secondary'} onPress={() => setType('cosmetic')} />
        </View>
        <Field label="Штрихкод" value={code} onChangeText={setCode} keyboardType="number-pad" />
        <Field label="Название" value={name} onChangeText={setName} />
        <Field label="Бренд" value={brand} onChangeText={setBrand} />
        <Field label="Состав (через запятую)" value={ingredients} onChangeText={setIngredients} multiline />
        {err ? <Text accessibilityRole="alert" style={{ color: color.danger }}>{err}</Text> : null}
        <Button label="Отправить" onPress={send} loading={busy} size="lg" />
      </ScrollView>
    </Screen>
  );
}
