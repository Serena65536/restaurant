import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {fetchMenu, getBaseUrl, getCachedMenu} from '../api';
import {
  clearCustomerToken,
  fetchOpenOrder,
  getCustomerPhone,
  hasCustomerToken,
  submitOrder,
} from '../customerApi';
import type {Order} from '../customerApi';
import {useCart} from '../cart';
import {useNav} from '../nav';
import {AccountSheet} from '../components/AccountSheet';
import {CartBar} from '../components/CartBar';
import {CartSheet} from '../components/CartSheet';
import {CategorySidebar} from '../components/CategorySidebar';
import {DishRow} from '../components/DishRow';
import {colors, layout} from '../theme';
import {formatPrice} from '../money';
import {APP_VERSION} from '../version';
import type {Category} from '../types';

type Props = {
  onOpenSettings: () => void;
};

export function MenuScreen({onOpenSettings}: Props): React.JSX.Element {
  const cart = useCart();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<Category[]>(() => getCachedMenu() ?? []);
  const [loading, setLoading] = useState(() => !getCachedMenu());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [cartVisible, setCartVisible] = useState(false);
  const [accountVisible, setAccountVisible] = useState(false);
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const offsets = useRef<Record<number, number>>({});
  const scrollRef = useRef<ScrollView>(null);
  const lockUntil = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const data = await fetchMenu();
      setCategories(data);
      setActiveId(prev => (prev && data.some(c => c.id === prev) ? prev : data[0]?.id ?? null));
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 每次回到点餐页都问一下有没有未结算订单（换手机登录、退出重进都靠这个恢复）
  useEffect(() => {
    let alive = true;
    if (!hasCustomerToken()) {
      setOpenOrder(null);
      return () => {
        alive = false;
      };
    }
    fetchOpenOrder()
      .then(order => {
        if (alive) {
          setOpenOrder(order);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [nav.focusTick]);

  const categoryOfDish = useMemo(() => {
    const map: Record<number, number> = {};
    categories.forEach(c => c.dishes.forEach(d => (map[d.id] = c.id)));
    return map;
  }, [categories]);

  const totalQtyOf = useCallback(
    (categoryId: number) =>
      cart.lines
        .filter(line => categoryOfDish[line.dish.id] === categoryId)
        .reduce((sum, line) => sum + line.qty, 0),
    [cart.lines, categoryOfDish],
  );

  const handleScroll = useCallback(
    (e: {
      nativeEvent: {
        contentOffset: {y: number};
        contentSize: {height: number};
        layoutMeasurement: {height: number};
      };
    }) => {
      if (Date.now() < lockUntil.current) {
        return;
      }
      const {contentOffset, contentSize, layoutMeasurement} = e.nativeEvent;
      const y = contentOffset.y;

      // 滑到底时把最后一个分区点亮，否则最后一段菜品永远选不中
      if (y + layoutMeasurement.height >= contentSize.height - 8) {
        const last = categories[categories.length - 1];
        if (last) {
          setActiveId(last.id);
        }
        return;
      }

      let current = categories[0]?.id ?? null;
      for (const category of categories) {
        const offset = offsets.current[category.id];
        if (offset !== undefined && offset <= y + 4) {
          current = category.id;
        }
      }
      if (current !== null) {
        setActiveId(current);
      }
    },
    [categories],
  );

  const handleSelectCategory = useCallback((categoryId: number) => {
    lockUntil.current = Date.now() + 450;
    setActiveId(categoryId);
    const offset = offsets.current[categoryId];
    if (offset !== undefined) {
      scrollRef.current?.scrollTo({y: Math.max(0, offset - 2), animated: true});
    }
  }, []);

  const handleCheckout = useCallback(async () => {
    if (cart.lines.length === 0 || submitting) {
      return;
    }
    if (!hasCustomerToken()) {
      nav.push({name: 'customerLogin'});
      return;
    }
    setSubmitting(true);
    try {
      const items = cart.lines.map(line => ({dishId: line.dish.id, qty: line.qty}));
      const result = await submitOrder(items);
      cart.clear();
      setOpenOrder(result.order);
      nav.push({name: 'order', orderId: result.order.id});
    } catch (err: any) {
      Alert.alert('下单失败', String(err?.message ?? err));
    } finally {
      setSubmitting(false);
    }
  }, [cart, submitting, nav]);

  const body = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.centerText}>正在取菜单…</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>菜单没取到</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Text style={styles.errorHint}>服务器地址：{getBaseUrl()}</Text>
          <View style={styles.errorActions}>
            <Pressable style={styles.retry} onPress={() => load()}>
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
            <Pressable style={styles.changeUrl} onPress={onOpenSettings}>
              <Text style={styles.changeUrlText}>改服务器地址</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    if (categories.length === 0) {
      return (
        <View style={styles.center}>
          <Text style={styles.centerText}>店主还没上菜</Text>
        </View>
      );
    }

    return (
      <View style={styles.row}>
        <CategorySidebar
          categories={categories}
          activeId={activeId}
          totalQtyOf={totalQtyOf}
          onSelect={handleSelectCategory}
        />
        <ScrollView
          ref={scrollRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.primary}
            />
          }>
          {categories.map(category => (
            <View
              key={category.id}
              onLayout={e => {
                offsets.current[category.id] = e.nativeEvent.layout.y;
              }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{category.name}</Text>
                <Text style={styles.sectionCount}>{category.dishes.length} 道</Text>
              </View>
              <View style={styles.sectionCard}>
                {category.dishes.length === 0 ? (
                  <Text style={styles.emptySection}>这个分区还没有菜</Text>
                ) : (
                  category.dishes.map((dish, index) => (
                    <View
                      key={dish.id}
                      style={index > 0 ? styles.divider : undefined}>
                      <DishRow
                        dish={dish}
                        qty={cart.qtyOf(dish.id)}
                        onAdd={() => cart.add(dish)}
                        onRemove={() => cart.remove(dish.id)}
                      />
                    </View>
                  ))
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.shopName}>饭店点餐</Text>
          <Text style={styles.shopSub}>堂食点餐 · 选好菜去结算 · v{APP_VERSION}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setAccountVisible(true)}
            hitSlop={8}
            style={styles.accountBtn}>
            <Text style={styles.accountText}>账号</Text>
          </Pressable>
          <Pressable onPress={onOpenSettings} hitSlop={8} style={styles.settingsBtn}>
            <Text style={styles.settingsText}>地址</Text>
          </Pressable>
        </View>
      </View>

      {body()}

      {openOrder ? (
        <Pressable
          onPress={() => nav.push({name: 'order', orderId: openOrder.id})}
          style={[
            styles.orderBanner,
            {bottom: layout.cartBarHeight + insets.bottom},
          ]}>
          <View style={styles.orderBannerMain}>
            <Text style={styles.orderBannerTitle}>未结算订单 {openOrder.orderNo}</Text>
            <Text style={styles.orderBannerSub}>
              已点 {openOrder.items.reduce((n, i) => n + i.quantity, 0)} 件 · ¥
              {formatPrice(openOrder.totalCents)}
            </Text>
          </View>
          <Text style={styles.orderBannerAction}>查看 ›</Text>
        </Pressable>
      ) : null}

      <CartBar
        totalQty={cart.totalQty}
        totalCents={cart.totalCents}
        onOpenCart={() => setCartVisible(true)}
        onCheckout={handleCheckout}
        checkoutLabel={openOrder ? '加入订单' : '去结算'}
        busy={submitting}
      />

      <CartSheet
        visible={cartVisible}
        lines={cart.lines}
        totalCents={cart.totalCents}
        onClose={() => setCartVisible(false)}
        onAdd={cart.add}
        onRemove={cart.remove}
        onClear={cart.clear}
      />

      <AccountSheet
        visible={accountVisible}
        phone={getCustomerPhone()}
        onClose={() => setAccountVisible(false)}
        onLogout={async () => {
          setAccountVisible(false);
          await clearCustomerToken();
          cart.clear();
          setOpenOrder(null);
          nav.reset({name: 'setup'});
        }}
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
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  shopName: {fontSize: 19, fontWeight: '700', color: colors.text},
  shopSub: {fontSize: 11, color: colors.textFaint, marginTop: 2},
  settingsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
  },
  settingsText: {fontSize: 12, color: colors.primary, fontWeight: '600'},
  headerActions: {flexDirection: 'row', alignItems: 'center'},
  accountBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  accountText: {fontSize: 12, color: colors.textSub, fontWeight: '600'},
  orderBanner: {
    position: 'absolute',
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffd8b5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  orderBannerMain: {flex: 1},
  orderBannerTitle: {fontSize: 12, color: '#8a4b12', fontWeight: '700'},
  orderBannerSub: {fontSize: 11, color: '#a86b2d', marginTop: 2},
  orderBannerAction: {fontSize: 12, color: colors.primary, fontWeight: '600'},
  row: {flex: 1, flexDirection: 'row'},
  list: {flex: 1, backgroundColor: colors.bg},
  listContent: {paddingBottom: layout.cartBarHeight + 40},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sectionTitle: {fontSize: 13, fontWeight: '700', color: colors.textSub},
  sectionCount: {fontSize: 11, color: colors.textFaint},
  sectionCard: {
    backgroundColor: colors.card,
    marginHorizontal: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  divider: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border},
  emptySection: {padding: 16, fontSize: 12, color: colors.textFaint},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
  centerText: {marginTop: 10, fontSize: 13, color: colors.textSub},
  errorTitle: {fontSize: 16, fontWeight: '700', color: colors.text},
  errorBody: {marginTop: 8, fontSize: 12, color: colors.danger, textAlign: 'center'},
  errorHint: {marginTop: 8, fontSize: 11, color: colors.textFaint},
  errorActions: {flexDirection: 'row', marginTop: 18},
  retry: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 18,
    marginRight: 10,
  },
  retryText: {color: '#fff', fontSize: 14, fontWeight: '600'},
  changeUrl: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  changeUrlText: {color: colors.textSub, fontSize: 14},
});
