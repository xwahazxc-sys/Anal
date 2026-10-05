import React, { useState } from 'react';
import { Platform, View, Text } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Body, Button, Field, Heading, Screen } from '../ui/primitives';
import { color, radius, space } from '../theme';

type Props = { onCode: (code: string) => void };

function NativeScanner({ onCode }: Props) {
  const [perm, request] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [done, setDone] = useState(false);
  if (!perm) return <Body muted>Проверяем доступ к камере…</Body>;
  if (!perm.granted) {
    return (
      <View style={{ gap: space[2] }}>
        <Heading>Нужен доступ к камере</Heading>
        <Body muted>Камера нужна только чтобы считать штрихкод. Фото не сохраняются.</Body>
        <Button label="Разрешить камеру" onPress={request} />
      </View>
    );
  }
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ height: 280, borderRadius: radius.lg, overflow: 'hidden' }}>
        <CameraView
          style={{ flex: 1 }} enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={({ data }) => { if (!done) { setDone(true); onCode(data); setTimeout(() => setDone(false), 1500); } }}
        />
      </View>
      <Button label={torch ? 'Выключить фонарик' : 'Включить фонарик'} variant="secondary" onPress={() => setTorch((v) => !v)} />
    </View>
  );
}

export function ScanScreen({ onCode }: Props) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const submit = () => {
    const c = code.replace(/\D/g, '');
    if (c.length < 8) return setErr('Штрихкод — от 8 цифр');
    setErr('');
    onCode(c);
  };
  return (
    <Screen>
      <View style={{ gap: space[4] }}>
        <Heading level="xl">Сканер</Heading>
        {Platform.OS !== 'web' ? (
          <NativeScanner onCode={onCode} />
        ) : (
          <Body muted>В браузере камера недоступна — введите штрихкод вручную.</Body>
        )}
        <View style={{ gap: space[2] }}>
          <Field label="Штрихкод вручную" value={code} onChangeText={setCode} keyboardType="number-pad"
            placeholder="Например, 4600000000011" onSubmitEditing={submit} />
          {err ? <Text accessibilityRole="alert" style={{ color: color.danger }}>{err}</Text> : null}
          <Button label="Найти продукт" onPress={submit} size="lg" />
        </View>
      </View>
    </Screen>
  );
}
