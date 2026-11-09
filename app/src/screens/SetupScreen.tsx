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
import {normalizeBaseUrl, probeEndpoint, saveBaseUrl} from '../api';
import {APP_VERSION} from '../version';
import {colors} from '../theme';

export type Role = 'customer' | 'owner';

type Props = {
  initialUrl: string;
  onConnected: (role: Role) => void;
};

type Step = {
  key: string;
  label: string;
  status: 'pending' | 'ok' | 'fail';
  detail: string;
};

function makeSteps(): Step[] {
  return [
    {key: 'save', label: '① 保存服务器地址', status: 'pending', detail: ''},
    {key: 'health', label: '② 连后端 /api/health', status: 'pending', detail: ''},
    {key: 'menu', label: '③ 拉菜单 /api/menu', status: 'pending', detail: ''},
  ];
}

export function SetupScreen({initialUrl, onConnected}: Props): React.JSX.Element {
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!busy) {
      return;
    }
    setElapsed(0);
    const timer = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  const patch = useCallback((key: string, next: Partial<Step>) => {
    setSteps(prev => prev.map(step => (step.key === key ? {...step, ...next} : step)));
  }, []);

  const enter = useCallback(
    async (role: Role) => {
      const base = normalizeBaseUrl(url);
      if (!base) {
        setError('请先填服务器地址');
        return;
      }
      setUrl(base);
      setError('');
      setSteps(makeSteps());
      setBusy(true);

      try {
        await saveBaseUrl(base);
        patch('save', {status: 'ok', detail: base});

        const health = await probeEndpoint(base, '/api/health', 6000);
        if (!health.ok) {
          patch('health', {status: 'fail', detail: health.error ?? `HTTP ${health.status}`});
          throw new Error(`连接失败：${health.error ?? `HTTP ${health.status}`}`);
        }
        patch('health', {status: 'ok', detail: `HTTP ${health.status} · ${health.ms}ms`});

        const menu = await probeEndpoint(base, '/api/menu', 8000);
        if (!menu.ok) {
          patch('menu', {status: 'fail', detail: menu.error ?? `HTTP ${menu.status}`});
          throw new Error(`菜单接口失败：${menu.error ?? `HTTP ${menu.status}`}`);
        }
        let dishCount = 0;
        try {
          const parsed = JSON.parse(menu.body ?? '{}');
          dishCount = (parsed.categories ?? []).reduce(
            (n: number, c: any) => n + (c.dishes?.length ?? 0),
            0,
          );
        } catch {}
        patch('menu', {
          status: 'ok',
          detail: `HTTP ${menu.status} · ${menu.ms}ms · ${dishCount} 道菜`,
        });

        onConnected(role);
      } catch (err: any) {
        setError(String(err?.message ?? err));
      } finally {
        setBusy(false);
      }
    },
    [url, onConnected, patch],
  );

  const stepColor = (status: Step['status']) =>
    status === 'ok' ? colors.success : status === 'fail' ? colors.danger : colors.textFaint;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>🍽️</Text>
          <Text style={styles.title}>饭店点餐</Text>
          <Text style={styles.subtitle}>
            填电脑上 start.ps1 打印的地址（https://xxx.trycloudflare.com），
            再选择你的身份。
          </Text>

          <Text style={styles.label}>服务器地址</Text>
          <TextInput
            testID="server-url"
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            keyboardType="url"
            placeholder="https://xxxx.trycloudflare.com"
            placeholderTextColor={colors.textFaint}
            editable={!busy}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>没连上</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            testID="role-customer"
            onPress={() => enter('customer')}
            disabled={busy}
            style={({pressed}) => [styles.roleBtn, busy && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.roleIcon}>🍜</Text>
            <View style={styles.roleText}>
              <Text style={styles.roleTitle}>我是顾客</Text>
              <Text style={styles.roleSub}>看菜单、点菜、下单</Text>
            </View>
            <Text style={styles.roleArrow}>›</Text>
          </Pressable>

          <Pressable
            testID="role-owner"
            onPress={() => enter('owner')}
            disabled={busy}
            style={({pressed}) => [
              styles.roleBtn,
              styles.roleBtnOwner,
              busy && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.roleIcon}>📋</Text>
            <View style={styles.roleText}>
              <Text style={styles.roleTitle}>我是店主</Text>
              <Text style={styles.roleSub}>管理分区、菜品和图片</Text>
            </View>
            <Text style={styles.roleArrow}>›</Text>
          </Pressable>

          {busy ? (
            <View style={styles.checking}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.checkingText}>正在连接…已等待 {elapsed} 秒</Text>
            </View>
          ) : null}

          {steps.length > 0 ? (
            <View style={styles.stepBox}>
              {steps.map(step => (
                <View key={step.key} style={styles.stepRow}>
                  <View style={[styles.dot, {backgroundColor: stepColor(step.status)}]} />
                  <View style={styles.stepTextWrap}>
                    <Text style={styles.stepLabel}>{step.label}</Text>
                    <Text style={[styles.stepDetail, {color: stepColor(step.status)}]}>
                      {step.status === 'pending'
                        ? '等待中…'
                        : step.status === 'ok'
                        ? `成功 · ${step.detail}`
                        : `失败 · ${step.detail}`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.note}>
            地址只存在这台手机上。连不上时先看三步面板哪一步红了；也可以用手机浏览器
            打开同一地址对照，能看到 {'{"ok":true,...}'} 就说明网络通。
          </Text>
          <Text style={styles.version}>v{APP_VERSION} · 启动先进身份选择</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  flex: {flex: 1},
  content: {padding: 24, paddingTop: 20, paddingBottom: 40},
  logo: {fontSize: 40},
  title: {marginTop: 10, fontSize: 26, fontWeight: '700', color: colors.text},
  subtitle: {marginTop: 10, fontSize: 13, lineHeight: 20, color: colors.textSub},
  label: {marginTop: 22, fontSize: 13, fontWeight: '600', color: colors.text},
  input: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  errorBox: {marginTop: 12, backgroundColor: '#fff5f5', borderRadius: 8, padding: 10},
  errorTitle: {fontSize: 12, fontWeight: '700', color: colors.danger},
  errorText: {marginTop: 4, fontSize: 12, lineHeight: 18, color: colors.danger},
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleBtnOwner: {borderColor: colors.primary, backgroundColor: colors.primarySoft},
  roleIcon: {fontSize: 22, marginRight: 12},
  roleText: {flex: 1},
  roleTitle: {fontSize: 16, fontWeight: '700', color: colors.text},
  roleSub: {fontSize: 12, color: colors.textSub, marginTop: 3},
  roleArrow: {fontSize: 22, color: colors.textFaint},
  disabled: {opacity: 0.6},
  pressed: {opacity: 0.85},
  checking: {flexDirection: 'row', alignItems: 'center', marginTop: 16},
  checkingText: {marginLeft: 8, fontSize: 12, color: colors.textSub},
  stepBox: {marginTop: 12, backgroundColor: colors.card, borderRadius: 10, padding: 12},
  stepRow: {flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10},
  dot: {width: 8, height: 8, borderRadius: 4, marginTop: 5, marginRight: 8},
  stepTextWrap: {flex: 1},
  stepLabel: {fontSize: 12, color: colors.text},
  stepDetail: {fontSize: 11, marginTop: 2, lineHeight: 16},
  note: {marginTop: 16, fontSize: 11, lineHeight: 17, color: colors.textFaint},
  version: {marginTop: 14, fontSize: 11, color: colors.textFaint, textAlign: 'center'},
});
