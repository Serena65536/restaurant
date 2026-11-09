import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, layout} from '../theme';
import {formatPrice} from '../money';

type Props = {
  totalQty: number;
  totalCents: number;
  onOpenCart: () => void;
  onCheckout: () => void;
  checkoutLabel?: string;
  busy?: boolean;
};

export function CartBar({
  totalQty,
  totalCents,
  onOpenCart,
  onCheckout,
  checkoutLabel = '去结算',
  busy = false,
}: Props): React.JSX.Element {
  const empty = totalQty === 0;
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        {height: layout.cartBarHeight + insets.bottom, paddingBottom: insets.bottom},
      ]}>
      <Pressable onPress={onOpenCart} style={styles.cartArea} disabled={empty}>
        <View style={[styles.cartCircle, empty && styles.cartCircleEmpty]}>
          <Text style={styles.cartIcon}>🛒</Text>
          {empty ? null : (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalQty}</Text>
            </View>
          )}
        </View>
        <View style={styles.priceBox}>
          {empty ? (
            <Text style={styles.emptyText}>购物车是空的</Text>
          ) : (
            <>
              <Text style={styles.total}>
                <Text style={styles.totalSymbol}>¥</Text>
                {formatPrice(totalCents)}
              </Text>
              <Text style={styles.hint}>共 {totalQty} 件 · 点购物车看明细</Text>
            </>
          )}
        </View>
      </Pressable>

      <Pressable
        onPress={onCheckout}
        disabled={empty || busy}
        style={({pressed}) => [
          styles.checkout,
          (empty || busy) && styles.checkoutDisabled,
          pressed && !empty && styles.pressed,
        ]}>
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={[styles.checkoutText, empty && styles.checkoutTextDisabled]}>
            {checkoutLabel}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: layout.cartBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cartArea: {flex: 1, flexDirection: 'row', alignItems: 'center'},
  cartCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCircleEmpty: {backgroundColor: '#d9dde3'},
  cartIcon: {fontSize: 22},
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  badgeText: {fontSize: 10, color: '#fff', fontWeight: '700'},
  priceBox: {marginLeft: 12, flex: 1},
  total: {fontSize: 18, fontWeight: '700', color: colors.text},
  totalSymbol: {fontSize: 13},
  hint: {fontSize: 11, color: colors.textFaint, marginTop: 2},
  emptyText: {fontSize: 13, color: colors.textFaint},
  checkout: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
  },
  checkoutDisabled: {backgroundColor: '#d9dde3'},
  checkoutText: {color: '#fff', fontSize: 15, fontWeight: '700'},
  checkoutTextDisabled: {color: '#f2f3f5'},
  pressed: {opacity: 0.85},
});
