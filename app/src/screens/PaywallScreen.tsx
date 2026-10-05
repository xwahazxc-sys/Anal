import React, { useState } from 'react';
import { View } from 'react-native';
import { data } from '../data';
import { Body, Button, Heading, Screen } from '../ui/primitives';
import { space } from '../theme';

// Purchase is stubbed. Real purchases go through RevenueCat (see replica/architecture.md).
export function PaywallScreen({ premium, onChange }: { premium: boolean; onChange: (v: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const run = async (v: boolean) => { setBusy(true); await data.setPremium(v); onChange(v); setBusy(false); };
  return (
    <Screen>
      <View style={{ gap: space[3] }}>
        <Heading level="xl">Premium</Heading>
        <Body>Поиск без сканирования, работа без интернета, предупреждения по вашей диете и аллергенам.</Body>
        <Body muted>Цена и период берутся из магазина приложений.</Body>
        {premium ? (
          <>
            <Body>Premium активен.</Body>
            <Button label="Отключить (тестовый режим)" variant="secondary" onPress={() => run(false)} loading={busy} />
          </>
        ) : (
          <Button label="Оформить Premium (тест)" onPress={() => run(true)} loading={busy} size="lg" />
        )}
        <Button label="Восстановить покупки" variant="ghost" onPress={() => run(premium)} />
      </View>
    </Screen>
  );
}
