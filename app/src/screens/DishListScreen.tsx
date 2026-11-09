import React, {useCallback, useEffect, useState} from 'react';
import {
  Image,
  Pressable,
  
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ApiError, clearOwnerToken, fetchAdminDishes} from '../adminApi';
import type {AdminDish} from '../adminApi';
import {absoluteImage} from '../api';
import {formatPrice} from '../money';
import {useNav} from '../nav';
import {colors} from '../theme';

type Props = {
  categoryId: number;
  categoryName: string;
};

export function DishListScreen({categoryId, categoryName}: Props): React.JSX.Element {
  const nav = useNav();
  const [dishes, setDishes] = useState<AdminDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setDishes(await fetchAdminDishes(categoryId));
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
  }, [categoryId, nav]);

  useEffect(() => {
    load();
  }, [load, nav.focusTick]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={nav.back} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={styles.headerMain}>
          <Text style={styles.title}>{categoryName}</Text>
          <Text style={styles.subtitle}>{dishes.length} 道菜</Text>
        </View>
        <Pressable
          onPress={() => nav.push({name: 'dishEdit', categoryId})}
          style={({pressed}) => [styles.addBtn, pressed && styles.pressed]}>
          <Text style={styles.addBtnText}>+ 新增</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView contentContainerStyle={styles.listContent}>
        {loading ? <Text style={styles.hint}>加载中…</Text> : null}
        {!loading && dishes.length === 0 ? (
          <Text style={styles.hint}>这个分区还没有菜，点右上角新增</Text>
        ) : null}

        {dishes.map(dish => {
          const uri = absoluteImage(dish.image);
          return (
            <Pressable
              key={dish.id}
              onPress={() => nav.push({name: 'dishEdit', categoryId, dishId: dish.id})}
              style={({pressed}) => [styles.row, pressed && styles.pressedRow]}>
              {uri ? (
                <Image source={{uri}} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Text style={styles.thumbText}>{dish.name.slice(0, 1)}</Text>
                </View>
              )}
              <View style={styles.rowMain}>
                <Text style={styles.dishName} numberOfLines={1}>
                  {dish.name}
                </Text>
                <View style={styles.badges}>
                  <Text style={styles.price}>¥{formatPrice(dish.priceCents)}</Text>
                  {!dish.available ? <Text style={[styles.badge, styles.badgeOff]}>已下架</Text> : null}
                  {dish.soldOut ? <Text style={[styles.badge, styles.badgeSold]}>售罄</Text> : null}
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  backBtn: {width: 32},
  back: {fontSize: 26, color: colors.text, lineHeight: 28},
  headerMain: {flex: 1},
  title: {fontSize: 17, fontWeight: '700', color: colors.text},
  subtitle: {fontSize: 11, color: colors.textFaint, marginTop: 1},
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addBtnText: {color: '#fff', fontSize: 13, fontWeight: '600'},
  pressed: {opacity: 0.85},
  error: {paddingHorizontal: 16, paddingTop: 10, color: colors.danger, fontSize: 12},
  listContent: {padding: 12, paddingBottom: 40},
  hint: {padding: 20, textAlign: 'center', fontSize: 13, color: colors.textFaint},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  pressedRow: {opacity: 0.9},
  thumb: {width: 56, height: 56, borderRadius: 8, backgroundColor: colors.sidebar},
  thumbEmpty: {alignItems: 'center', justifyContent: 'center'},
  thumbText: {fontSize: 20, color: colors.textFaint, fontWeight: '600'},
  rowMain: {flex: 1, marginLeft: 10},
  dishName: {fontSize: 15, color: colors.text, fontWeight: '600'},
  badges: {flexDirection: 'row', alignItems: 'center', marginTop: 6},
  price: {fontSize: 14, color: colors.primary, fontWeight: '700', marginRight: 8},
  badge: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
    overflow: 'hidden',
  },
  badgeOff: {backgroundColor: '#eef0f3', color: colors.textSub},
  badgeSold: {backgroundColor: '#fff1e6', color: colors.primary},
  chevron: {fontSize: 22, color: colors.textFaint},
});
