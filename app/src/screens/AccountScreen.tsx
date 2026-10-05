import React, { useState } from 'react';
import { View } from 'react-native';
import { supabase } from '../supabase';
import { Body, Button, Heading, Screen } from '../ui/primitives';
import { space } from '../theme';

export function AccountScreen() {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!supabase) return <Screen><Body muted>Аккаунты включатся, когда будет подключён сервер.</Body></Screen>;
  const del = async () => {
    setBusy(true);
    const { error } = await supabase!.rpc('delete_my_account');
    if (!error) await supabase!.auth.signOut();
    setBusy(false);
  };
  return (
    <Screen>
      <View style={{ gap: space[3] }}>
        <Heading level="xl">Аккаунт</Heading>
        <Button label="Выйти" variant="secondary" onPress={() => supabase!.auth.signOut({ scope: 'global' })} />
        <Body muted>Удаление аккаунта необратимо: история, избранное и подписка на сервере будут удалены.</Body>
        {confirm ? (
          <>
            <Body>Точно удалить аккаунт?</Body>
            <Button label="Да, удалить навсегда" variant="danger" onPress={del} loading={busy} />
            <Button label="Отмена" variant="ghost" onPress={() => setConfirm(false)} />
          </>
        ) : <Button label="Удалить аккаунт" variant="danger" onPress={() => setConfirm(true)} />}
      </View>
    </Screen>
  );
}
