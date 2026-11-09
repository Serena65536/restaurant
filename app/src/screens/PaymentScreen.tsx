import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  confirmPayment,
  createPayment,
  fetchOrder,
} from '../customerApi';
import type {Order, PayChannel, Payment} from '../customerApi';
import {formatPrice} from '../money';
import {useNav} from '../nav';
import {colors} from '../theme';

type Props = {
  orderId: number;
};

const CHANNELS: {key: PayChannel; name: string; icon: string; desc: string; color: string}[] = [
  {key: 'wechat', name: '微信支付', icon: '💬', desc: '模拟微信收银台', color: '#07c160'},
  {key: 'alipay', name: '支付宝', icon: '🅰️', desc: '模拟支付宝收银台', color: '#1677ff'},
];

export function PaymentScreen({orderId}: Props): React.JSX.Element {
  const nav = useNav();
  const [order, setOrder] = useState<Order | null>(null);
  const [channel, setChannel] = useState<PayChannel>('wechat');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetchOrder(orderId)
      .then(data => {
        if (alive) {
          setOrder(data);
        }
      })
      .catch(err => alive && setError(String(err?.message ?? err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [orderId]);

  const pay = useCallback(async () => {
    if (!order || paying) {
      return;
    }
    setPaying(true);
    setError('');
    try {
      const payment: Payment = await createPayment(order.id, channel);

      // 模拟收银台：真实接入时这里是调起微信/支付宝，等它们回调
      await new Promise(resolve => setTimeout(resolve, 1200));

      const result = await confirmPayment(payment.id);
      nav.push({
        name: 'paymentSuccess',
        orderId: order.id,
        orderNo: result.order.orderNo,
        amountCents: payment.amountCents,
        channel,
      });
    } catch (err: any) {
      const message = String(err?.message ?? err);
      setError(message);
      Alert.alert('支付失败', message);
    } finally {
      setPaying(false);
    }
  }, [order, paying, channel, nav]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={nav.back} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>结账</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>应付金额</Text>
          <Text style={styles.amount}>
            <Text style={styles.amountSymbol}>¥</Text>
            {formatPrice(order?.totalCents ?? 0)}
          </Text>
          {order ? (
            <Text style={styles.orderNo}>
              订单 {order.orderNo} · 共 {order.items.reduce((n, i) => n + i.quantity, 0)} 件
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>选择支付方式</Text>
        {CHANNELS.map(item => {
          const active = channel === item.key;
          return (
            <Pressable
              key={item.key}
              testID={`pay-${item.key}`}
              onPress={() => setChannel(item.key)}
              style={({pressed}) => [
                styles.channelRow,
                active && styles.channelActive,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.channelIcon}>{item.icon}</Text>
              <View style={styles.channelMain}>
                <Text style={styles.channelName}>{item.name}</Text>
                <Text style={styles.channelDesc}>{item.desc}</Text>
              </View>
              <View style={[styles.radio, active && styles.radioActive]}>
                {active ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.tip}>
          当前是模拟支付：不会真的扣钱，但订单状态、收款流水、店主营业额都按真实流程走。
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          testID="pay-now"
          onPress={pay}
          disabled={paying}
          style={({pressed}) => [styles.payBtn, paying && styles.payBtnBusy, pressed && styles.pressed]}>
          {paying ? (
            <View style={styles.payingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.payText}>  支付中…</Text>
            </View>
          ) : (
            <Text style={styles.payText}>确认支付 ¥{formatPrice(order?.totalCents ?? 0)}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  backBtn: {width: 32},
  back: {fontSize: 26, color: colors.text, lineHeight: 28},
  headerTitle: {fontSize: 17, fontWeight: '700', color: colors.text},
  content: {padding: 14, paddingBottom: 24},
  amountCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 22,
    alignItems: 'center',
  },
  amountLabel: {fontSize: 12, color: colors.textFaint},
  amount: {marginTop: 8, fontSize: 40, fontWeight: '700', color: colors.text},
  amountSymbol: {fontSize: 20},
  orderNo: {marginTop: 10, fontSize: 12, color: colors.textSub},
  sectionTitle: {marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: '700', color: colors.textSub},
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.card,
  },
  channelActive: {borderColor: colors.primary, backgroundColor: colors.primarySoft},
  channelIcon: {fontSize: 22, marginRight: 12},
  channelMain: {flex: 1},
  channelName: {fontSize: 15, fontWeight: '600', color: colors.text},
  channelDesc: {fontSize: 11, color: colors.textFaint, marginTop: 2},
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {borderColor: colors.primary},
  radioDot: {width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary},
  error: {marginTop: 12, fontSize: 12, color: colors.danger},
  tip: {marginTop: 14, fontSize: 11, lineHeight: 17, color: colors.textFaint},
  footer: {
    padding: 12,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  payBtn: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  payBtnBusy: {opacity: 0.7},
  payingRow: {flexDirection: 'row', alignItems: 'center'},
  payText: {color: '#fff', fontSize: 16, fontWeight: '700'},
  pressed: {opacity: 0.86},
});
