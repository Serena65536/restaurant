import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors} from '../theme';
import {fetchCategories, hasOwnerToken, loginOwner} from '../adminApi';
import {useNav} from '../nav';

export function OwnerLoginScreen(): React.JSX.Element {
  const nav = useNav();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 之前登录过就直接进管理页；token 失效时 AdminHome 会把人踢回这里
  useEffect(() => {
    let alive = true;
    if (!hasOwnerToken()) {
      return () => {
        alive = false;
      };
    }
    fetchCategories()
      .then(() => {
        if (alive) {
          nav.reset({name: 'adminHome'});
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(async () => {
    if (!phone.trim() || !password) {
      setError('手机号和密码都要填');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await loginOwner(phone.trim(), password);
      nav.reset({name: 'adminHome'});
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  }, [phone, password, nav]);
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => nav.reset({name: 'setup'})} hitSlop={8}>
            <Text style={styles.back}>‹ 返回身份选择</Text>
          </Pressable>

          <Text style={styles.title}>店主登录</Text>
          <Text style={styles.subtitle}>
            任意手机号 + 密码都能登录；没见过的手机号会自动创建店主账号
          </Text>

          <Text style={styles.label}>手机号</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="13800000000"
            placeholderTextColor={colors.textFaint}
            editable={!busy}
          />

          <Text style={styles.label}>密码</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="admin123"
            placeholderTextColor={colors.textFaint}
            onSubmitEditing={submit}
            returnKeyType="go"
            editable={!busy}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={busy}
            style={({pressed}) => [styles.button, busy && styles.buttonBusy, pressed && styles.pressed]}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>登录</Text>
            )}
          </Pressable>

          <Text style={styles.hint}>内置测试账号：13800000000 / admin123（也可以直接用自己的手机号）</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  flex: {flex: 1},
  content: {padding: 24, paddingTop: 24},
  back: {fontSize: 14, color: colors.textSub},
  title: {marginTop: 28, fontSize: 26, fontWeight: '700', color: colors.text},
  subtitle: {marginTop: 8, fontSize: 13, color: colors.textSub},
  label: {marginTop: 22, fontSize: 13, fontWeight: '600', color: colors.text},
  input: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  error: {marginTop: 12, fontSize: 12, color: colors.danger},
  button: {
    marginTop: 22,
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonBusy: {opacity: 0.7},
  pressed: {opacity: 0.85},
  buttonText: {color: '#fff', fontSize: 16, fontWeight: '700'},
  hint: {marginTop: 16, fontSize: 11, color: colors.textFaint, textAlign: 'center'},
});
