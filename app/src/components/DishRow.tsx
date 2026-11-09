import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {absoluteImage} from '../api';
import {colors} from '../theme';
import {formatPrice} from '../money';
import type {Dish} from '../types';

type Props = {
  dish: Dish;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
};

export function DishRow({dish, qty, onAdd, onRemove}: Props): React.JSX.Element {
  const imageUri = absoluteImage(dish.image);
  const disabled = !dish.available;

  return (
    <View style={styles.row}>
      <View style={styles.imageBox}>
        {imageUri ? (
          <Image source={{uri: imageUri}} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>{dish.name.slice(0, 1)}</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {dish.name}
        </Text>
        {dish.description ? (
          <Text style={styles.desc} numberOfLines={1}>
            {dish.description}
          </Text>
        ) : null}

        <View style={styles.bottomRow}>
          <Text style={styles.price}>
            <Text style={styles.priceSymbol}>¥</Text>
            {formatPrice(dish.priceCents)}
          </Text>

          {disabled ? (
            <View style={styles.soldOut}>
              <Text style={styles.soldOutText}>已售罄</Text>
            </View>
          ) : (
            <View style={styles.stepper}>
              {qty > 0 ? (
                <>
                  <Pressable
                    onPress={onRemove}
                    hitSlop={8}
                    style={({pressed}) => [styles.stepBtn, pressed && styles.pressed]}>
                    <Text style={styles.stepText}>−</Text>
                  </Pressable>
                  <Text style={styles.qty}>{qty}</Text>
                </>
              ) : null}
              <Pressable
                onPress={onAdd}
                hitSlop={8}
                style={({pressed}) => [
                  styles.stepBtn,
                  styles.stepBtnSolid,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.stepText, styles.stepTextSolid]}>+</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
  },
  imageBox: {width: 74, height: 74},
  image: {width: 74, height: 74, borderRadius: 8, backgroundColor: colors.sidebar},
  imagePlaceholder: {alignItems: 'center', justifyContent: 'center'},
  placeholderText: {fontSize: 24, color: colors.textFaint, fontWeight: '600'},
  info: {flex: 1, marginLeft: 10, justifyContent: 'space-between'},
  name: {fontSize: 15, fontWeight: '600', color: colors.text},
  desc: {fontSize: 12, color: colors.textFaint, marginTop: 3},
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  price: {fontSize: 16, fontWeight: '700', color: colors.primary},
  priceSymbol: {fontSize: 12, fontWeight: '600'},
  stepper: {flexDirection: 'row', alignItems: 'center'},
  stepBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  stepBtnSolid: {backgroundColor: colors.primary},
  stepText: {fontSize: 15, lineHeight: 18, color: colors.primary, fontWeight: '700'},
  stepTextSolid: {color: '#fff'},
  qty: {minWidth: 26, textAlign: 'center', fontSize: 14, color: colors.text},
  pressed: {opacity: 0.6},
  soldOut: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.sidebar,
  },
  soldOutText: {fontSize: 12, color: colors.textFaint},
});
