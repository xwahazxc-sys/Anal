import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { supabase } from '../supabase';
import { Body, Button, Field, Heading, Screen } from '../ui/primitives';
import { color, space } from '../theme';

type Mode = 'in' | 'up' | 'reset';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const go = async () => {
    if (!supabase) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg({ ok: false, text: 'Введите корректный email' });
    if (mode !== 'reset' && password.length < 8) return setMsg({ ok: false, text: 'Пароль — не короче 8 символов' });
    setBusy(true); setMsg(null);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMsg({ ok: false, text: 'Неверный email или пароль' });
      } else if (mode === 'up') {
        const { error } = await supabase.auth.signUp({ email, password });
        setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Мы отправили письмо — подтвердите адрес и войдите.' });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Если такой адрес есть, письмо со ссылкой уже в пути.' });
      }
    } finally { setBusy(false); }
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }} keyboardShouldPersistTaps="handled">
        <Heading level="xl">{mode === 'in' ? 'Вход' : mode === 'up' ? 'Регистрация' : 'Сброс пароля'}</Heading>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        {mode !== 'reset' ? <Field label="Пароль" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /> : null}
        {msg ? <Text accessibilityRole="alert" style={{ color: msg.ok ? color.success : color.danger }}>{msg.text}</Text> : null}
        <Button label={mode === 'in' ? 'Войти' : mode === 'up' ? 'Создать аккаунт' : 'Отправить письмо'} onPress={go} loading={busy} size="lg" />
        <View style={{ gap: space[1] }}>
          {mode !== 'in' ? <Button label="У меня есть аккаунт" variant="ghost" onPress={() => { setMode('in'); setMsg(null); }} /> : null}
          {mode !== 'up' ? <Button label="Создать аккаунт" variant="ghost" onPress={() => { setMode('up'); setMsg(null); }} /> : null}
          {mode !== 'reset' ? <Button label="Забыли пароль?" variant="ghost" onPress={() => { setMode('reset'); setMsg(null); }} /> : null}
        </View>
        <Body muted>Нажимая «Создать аккаунт», вы принимаете условия и политику конфиденциальности.</Body>
      </ScrollView>
    </Screen>
  );
}
