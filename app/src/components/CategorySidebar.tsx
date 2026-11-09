import React from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, layout} from '../theme';
import type {Category} from '../types';

const ITEM_HEIGHT = 56;

type Props = {
  categories: Category[];
  activeId: number | null;
  totalQtyOf: (categoryId: number) => number;
  onSelect: (categoryId: number, index: number) => void;
};

export function CategorySidebar({
  categories,
  activeId,
  totalQtyOf,
  onSelect,
}: Props): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <FlatList
        data={categories}
        keyExtractor={item => String(item.id)}
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        renderItem={({item, index}) => {
          const active = item.id === activeId;
          const qty = totalQtyOf(item.id);
          return (
            <Pressable
              onPress={() => onSelect(item.id, index)}
              style={({pressed}) => [
                styles.item,
                active && styles.itemActive,
                pressed && styles.pressed,
              ]}>
              {active ? <View style={styles.bar} /> : null}
              <Text
                style={[styles.label, active && styles.labelActive]}
                numberOfLines={1}>
                {item.name}
              </Text>
              {qty > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{qty}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {width: layout.sidebarWidth, backgroundColor: colors.sidebar},
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  itemActive: {backgroundColor: colors.card},
  pressed: {opacity: 0.7},
  bar: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  label: {fontSize: 13, color: colors.textSub, textAlign: 'center'},
  labelActive: {color: colors.text, fontWeight: '700', fontSize: 14},
  badge: {
    position: 'absolute',
    right: 8,
    top: 12,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {fontSize: 10, color: '#fff', fontWeight: '700'},
});
