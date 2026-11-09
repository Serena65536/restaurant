import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  Pressable,
  
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  ApiError,
  clearOwnerToken,
  createCategory,
  deleteCategory,
  fetchDashboard,
  resetRevenue,
  updateCategory,
} from '../adminApi';
import type {AdminCategory, AdminOrderRow, AdminSummary} from '../adminApi';
import {TextPrompt} from '../components/TextPrompt';
import {formatPrice} from '../money';
import {useNav} from '../nav';
import {colors} from '../theme';

export function AdminHomeScreen(): React.JSX.Element {
  const nav = useNav();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<AdminCategory | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchDashboard();
      setCategories(data.categories);
      setSummary(data.summary);
      setRecentOrders(data.orders);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        await clearOwnerToken();
        nav.reset({name: 'ownerLogin'});
        return;
      }
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }, [nav]);

  useEffect(() => {
    load();
  }, [load, nav.focusTick]);

  const addCategory = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      return;
    }
    try {
      await createCategory(name);
      setNewName('');
      await load();
    } catch (err: any) {
      Alert.alert('新增失败', String(err?.message ?? err));
    }
  }, [newName, load]);

  const rename = useCallback(
    async (value: string) => {
      const target = renaming;
      setRenaming(null);
      if (!target || !value || value === target.name) {
        return;
      }
      try {
        await updateCategory(target.id, {name: value});
        await load();
      } catch (err: any) {
        Alert.alert('改名失败', String(err?.message ?? err));
      }
    },
    [renaming, load],
  );

  const toggleVisible = useCallback(
    async (category: AdminCategory) => {
      try {
        await updateCategory(category.id, {visible: !category.visible});
        await load();
      } catch (err: any) {
        Alert.alert('操作失败', String(err?.message ?? err));
      }
    },
    [load],
  );

  const remove = useCallback(
    (category: AdminCategory) => {
      Alert.alert('删除分区', `确定删掉「${category.name}」？`, [
        {text: '取消', style: 'cancel'},
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(category.id);
              await load();
            } catch (err: any) {
              Alert.alert('删不掉', String(err?.message ?? err));
            }
          },
        },
      ]);
    },
    [load],
  );

  const showActions = useCallback(
    (category: AdminCategory) => {
      Alert.alert(category.name, undefined, [
        {text: '改名', onPress: () => setRenaming(category)},
        {text: category.visible ? '在菜单里隐藏' : '在菜单里显示', onPress: () => toggleVisible(category)},
        {text: '删除', style: 'destructive', onPress: () => remove(category)},
        {text: '取消', style: 'cancel'},
      ]);
    },
    [remove, toggleVisible],
  );

  const logout = useCallback(() => {
    Alert.alert('退出登录', '退出后可以换一个账号登录；原来的订单和菜品都还在。', [
      {text: '取消', style: 'cancel'},
      {
        text: '退出登录',
        style: 'destructive',
        onPress: async () => {
          await clearOwnerToken();
          nav.reset({name: 'setup'});
        },
      },
    ]);
  }, [nav]);

  const confirmResetRevenue = useCallback(() => {
    Alert.alert('清零营业额', '历史订单和收款记录都会保留，只是累计金额从 0 重新开始计。', [
      {text: '取消', style: 'cancel'},
      {
        text: '清零',
        style: 'destructive',
        onPress: async () => {
          try {
            await resetRevenue();
            await load();
          } catch (err: any) {
            Alert.alert('清零失败', String(err?.message ?? err));
          }
        },
      },
    ]);
  }, [load]);

  const sinceText = summary?.revenueSince
    ? `自 ${summary.revenueSince.slice(5, 10)} ${summary.revenueSince.slice(11, 16)} 起`
    : '全部时间';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>店主管理</Text>
          <Text style={styles.subtitle}>分区可以自定义，菜品归到分区里</Text>
        </View>
        <Pressable onPress={logout} hitSlop={8}>
          <Text style={styles.logout}>退出登录</Text>
        </Pressable>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>累计营业额 · {sinceText}</Text>
            <Text style={styles.summaryValue}>
              <Text style={styles.summarySymbol}>¥</Text>
              {formatPrice(summary?.revenueCents ?? 0)}
            </Text>
          </View>
          <Pressable onPress={confirmResetRevenue} hitSlop={8} style={styles.resetBtn}>
            <Text style={styles.resetText}>清零</Text>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryMeta}>今日 ¥{formatPrice(summary?.todayRevenueCents ?? 0)}</Text>
          <Text style={styles.summaryMeta}>已结账 {summary?.todayPaidCount ?? 0} 单</Text>
          <Text style={styles.summaryMeta}>今日订单 {summary?.todayOrderCount ?? 0} 单</Text>
          <Text style={styles.summaryMeta}>未结算 {summary?.openOrderCount ?? 0} 单</Text>
        </View>

        {recentOrders.length > 0 ? (
          <View style={styles.flowList}>
            <Text style={styles.flowTitle}>最近订单</Text>
            {recentOrders.map(order => (
              <View key={order.id} style={styles.flowRow}>
                <Text style={styles.flowNo}>{order.orderNo}</Text>
                <Text style={styles.flowMeta}>
                  {order.itemQty} 件 ·{' '}
                  {order.payChannel === 'alipay'
                    ? '支付宝'
                    : order.payChannel === 'wechat'
                    ? '微信'
                    : '—'}
                </Text>
                <Text style={[styles.flowAmount, order.status !== 'PAID' && styles.flowPending]}>
                  {order.status === 'PAID' ? '已收 ' : '待收 '}¥{formatPrice(order.totalCents)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={newName}
          onChangeText={setNewName}
          placeholder="新分区名，例如：特色菜"
          placeholderTextColor={colors.textFaint}
          onSubmitEditing={addCategory}
          returnKeyType="done"
        />
        <Pressable
          onPress={addCategory}
          style={({pressed}) => [styles.addBtn, pressed && styles.pressed]}>
          <Text style={styles.addBtnText}>添加</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView contentContainerStyle={styles.listContent}>
        {loading ? <Text style={styles.loading}>加载中…</Text> : null}
        {!loading && categories.length === 0 ? (
          <Text style={styles.loading}>还没有分区，先在上面加一个</Text>
        ) : null}

        {categories.map(category => (
          <Pressable
            key={category.id}
            onPress={() =>
              nav.push({
                name: 'dishList',
                categoryId: category.id,
                categoryName: category.name,
              })
            }
            onLongPress={() => showActions(category)}
            style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>
                {category.name}
                {category.visible ? '' : '  (已隐藏)'}
              </Text>
              <Text style={styles.rowSub}>{category.dishCount} 道菜</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}

        <Text style={styles.tip}>长按分区可以改名、隐藏或删除</Text>
      </ScrollView>

      <TextPrompt
        visible={!!renaming}
        title="分区改名"
        initialValue={renaming?.name ?? ''}
        onSubmit={rename}
        onCancel={() => setRenaming(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: colors.card,
  },
  title: {fontSize: 19, fontWeight: '700', color: colors.text},
  subtitle: {fontSize: 11, color: colors.textFaint, marginTop: 2},
  logout: {fontSize: 13, color: colors.textSub},
  summaryCard: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  summaryLabel: {fontSize: 12, color: colors.textFaint},
  summaryTop: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between'},
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetText: {fontSize: 12, color: colors.textSub},
  summaryValue: {marginTop: 6, fontSize: 30, fontWeight: '700', color: colors.text},
  summarySymbol: {fontSize: 16},
  summaryRow: {flexDirection: 'row', flexWrap: 'wrap', marginTop: 10},
  summaryMeta: {fontSize: 11, color: colors.textSub, marginRight: 12},
  flowList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  flowTitle: {fontSize: 11, color: colors.textFaint, marginBottom: 6},
  flowRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 5},
  flowNo: {fontSize: 13, fontWeight: '700', color: colors.text, width: 56},
  flowMeta: {flex: 1, fontSize: 11, color: colors.textFaint},
  flowAmount: {fontSize: 13, fontWeight: '600', color: colors.success},
  flowPending: {color: colors.textSub},
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  addBtn: {
    marginLeft: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addBtnText: {color: '#fff', fontWeight: '600', fontSize: 14},
  pressed: {opacity: 0.85},
  error: {paddingHorizontal: 16, paddingTop: 10, color: colors.danger, fontSize: 12},
  listContent: {padding: 12, paddingBottom: 40},
  loading: {padding: 20, textAlign: 'center', fontSize: 13, color: colors.textFaint},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  rowPressed: {opacity: 0.9},
  rowMain: {flex: 1},
  rowTitle: {fontSize: 15, color: colors.text, fontWeight: '600'},
  rowSub: {fontSize: 12, color: colors.textFaint, marginTop: 3},
  chevron: {fontSize: 22, color: colors.textFaint},
  tip: {marginTop: 8, textAlign: 'center', fontSize: 11, color: colors.textFaint},
});
