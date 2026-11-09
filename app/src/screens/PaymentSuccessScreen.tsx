import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {formatPrice} from '../money';
import {useNav} from '../nav';
import {colors} from '../theme';

type Props = {
  orderNo: string;
  amountCents: number;
  channel: string;
};

export function PaymentSuccessScreen({orderNo, amountCents, channel}: Props): React.JSX.Element {
  const nav = useNav();
  const channelName = channel === 'alipay' ? '支付宝' : '微信支付';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.check}>✓</Text>
        </View>

        <Text style={styles.title}>结账成功</Text>
        <Text style={styles.amount}>
          <Text style={styles.symbol}>¥</Text>
          {formatPrice(amountCents)}
        </Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>订单号</Text>
            <Text style={styles.value} selectable>
              {orderNo}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>支付方式</Text>
            <Text style={styles.value}>{channelName}（模拟）</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>状态</Text>
            <Text style={[styles.value, styles.paid]}>已结账</Text>
          </View>
        </View>

        <Text style={styles.tip}>这笔钱已记进店主的收款流水，可在「我是店主 → 今日营业额」看到。</Text>

        <Pressable
          testID="back-to-menu"
          onPress={() => nav.reset({name: 'menu'})}
          style={({pressed}) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>返回点餐</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  content: {padding: 24, paddingTop: 56, alignItems: 'center'},
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#e7f8ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {fontSize: 38, color: colors.success, fontWeight: '700'},
  title: {marginTop: 18, fontSize: 22, fontWeight: '700', color: colors.text},
  amount: {marginTop: 14, fontSize: 38, fontWeight: '700', color: colors.text},
  symbol: {fontSize: 20},
  card: {
    width: '100%',
    marginTop: 28,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },
  label: {fontSize: 13, color: colors.textSub},
  value: {fontSize: 14, color: colors.text, fontWeight: '600'},
  paid: {color: colors.success},
  tip: {marginTop: 18, fontSize: 11, lineHeight: 17, color: colors.textFaint, textAlign: 'center'},
  button: {
    marginTop: 26,
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pressed: {opacity: 0.86},
  buttonText: {color: '#fff', fontSize: 16, fontWeight: '700'},
});
