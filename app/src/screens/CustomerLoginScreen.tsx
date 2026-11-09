import React, {useCallback, useState} from 'react';
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
import {customerLogin} from '../customerApi';
import {useNav} from '../nav';
import {colors} from '../theme';

export function CustomerLoginScreen(): React.JSX.Element {
  const nav = useNav();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = useCallback(async () => {
    const p = phone.trim();
    if (!/^1\d{10}$/.test(p)) {
      setError('手机号要是 11 位数字');
      return;
    }
    if (password.length < 4) {
      setError('密码至少 4 位');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await customerLogin(p, password);
      if (result.created) {
        setNotice('新手机号，已自动注册');
      }
      nav.reset({name: 'menu'});
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

          <Text style={styles.title}>手机号登录</Text>
          <Text style={styles.subtitle}>
            第一次用这个手机号就是注册，之后凭手机号找回你自己的订单
          </Text>

          <Text style={styles.label}>手机号</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={11}
            placeholder="11 位手机号"
            placeholderTextColor={colors.textFaint}
            editable={!busy}
          />

          <Text style={styles.label}>密码</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="至少 4 位"
            placeholderTextColor={colors.textFaint}
            onSubmitEditing={submit}
            returnKeyType="go"
            editable={!busy}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={busy}
            style={({pressed}) => [styles.button, busy && styles.buttonBusy, pressed && styles.pressed]}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>登录 / 注册</Text>
            )}
          </Pressable>

          <Text style={styles.hint}>
            登录状态会记住，下次打开直接进点餐页；换手机用同一手机号登录也能看到未结算的订单。
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  flex: {flex: 1},
  content: {padding: 24, paddingTop: 20},
  back: {fontSize: 14, color: colors.textSub},
  title: {marginTop: 26, fontSize: 26, fontWeight: '700', color: colors.text},
  subtitle: {marginTop: 8, fontSize: 13, lineHeight: 20, color: colors.textSub},
  label: {marginTop: 22, fontSize: 13, fontWeight: '600', color: colors.text},
  input: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  error: {marginTop: 12, fontSize: 12, color: colors.danger},
  notice: {marginTop: 12, fontSize: 12, color: colors.success},
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
  hint: {marginTop: 16, fontSize: 11, lineHeight: 17, color: colors.textFaint},
});
