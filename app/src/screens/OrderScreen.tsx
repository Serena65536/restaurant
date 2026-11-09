import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {fetchOrder} from '../customerApi';
import type {Order} from '../customerApi';
import {formatPrice} from '../money';
import {useNav} from '../nav';
import {colors} from '../theme';

type Props = {
  orderId: number;
};

export function OrderScreen({orderId}: Props): React.JSX.Element {
  const nav = useNav();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setOrder(await fetchOrder(orderId));
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load, nav.focusTick]);

  const addMore = useCallback(() => {
    nav.back();
  }, [nav]);

  const checkout = useCallback(() => {
    nav.push({name: 'payment', orderId: order?.id ?? orderId});
  }, [nav, order, orderId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errText}>{error || '订单不存在'}</Text>
          <Pressable onPress={() => nav.reset({name: 'menu'})} style={styles.retry}>
            <Text style={styles.retryText}>回点餐页</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const totalQty = order.items.reduce((n, item) => n + item.quantity, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.reset({name: 'menu'})} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>我的订单</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>订单号</Text>
          <Text style={styles.orderNo} selectable>
            {order.orderNo}
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {order.status === 'OPEN' ? '未结算' : order.status === 'PAID' ? '已结账' : '已取消'}
            </Text>
            <Text style={styles.time}>{order.createdAt}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>菜品 · 共 {totalQty} 件</Text>
          {order.items.map(item => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemMain}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemPrice}>
                  ¥{formatPrice(item.priceCents)} × {item.quantity}
                </Text>
              </View>
              <Text style={styles.itemAmount}>¥{formatPrice(item.amountCents)}</Text>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>合计</Text>
            <Text style={styles.totalValue}>¥{formatPrice(order.totalCents)}</Text>
          </View>
        </View>

        <Text style={styles.tip}>
          这个订单存在服务器上，换手机用同一手机号登录也能找回来。
        </Text>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable onPress={addMore} style={({pressed}) => [styles.ghostBtn, pressed && styles.pressed]}>
          <Text style={styles.ghostText}>继续加菜</Text>
        </Pressable>
        <Pressable
          onPress={checkout}
          disabled={order.status !== 'OPEN'}
          style={({pressed}) => [
            styles.primaryBtn,
            order.status !== 'OPEN' && styles.disabled,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.primaryText}>立刻结账</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
  errText: {fontSize: 13, color: colors.danger, textAlign: 'center'},
  retry: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 18,
  },
  retryText: {color: '#fff', fontSize: 14, fontWeight: '600'},
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
  content: {padding: 12, paddingBottom: 24},
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  label: {fontSize: 12, color: colors.textFaint},
  orderNo: {fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: 1, marginTop: 6},
  statusRow: {flexDirection: 'row', alignItems: 'center', marginTop: 10},
  statusDot: {width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary, marginRight: 6},
  statusText: {fontSize: 12, color: colors.primary, fontWeight: '600', marginRight: 10},
  time: {fontSize: 11, color: colors.textFaint},
  sectionTitle: {fontSize: 13, fontWeight: '700', color: colors.textSub, marginBottom: 4},
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemMain: {flex: 1, marginRight: 10},
  itemName: {fontSize: 14, color: colors.text},
  itemPrice: {fontSize: 11, color: colors.textFaint, marginTop: 3},
  itemAmount: {fontSize: 14, color: colors.text, fontWeight: '600'},
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  totalLabel: {fontSize: 13, color: colors.textSub},
  totalValue: {fontSize: 20, fontWeight: '700', color: colors.primary},
  tip: {marginTop: 6, fontSize: 11, lineHeight: 17, color: colors.textFaint, textAlign: 'center'},
  actions: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  ghostBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 22,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 10,
  },
  ghostText: {fontSize: 15, color: colors.primary, fontWeight: '600'},
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 22,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {fontSize: 15, color: '#fff', fontWeight: '700'},
  disabled: {opacity: 0.5},
  pressed: {opacity: 0.85},
});
