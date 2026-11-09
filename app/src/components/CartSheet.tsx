import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../theme';
import {formatPrice} from '../money';
import type {CartLine, Dish} from '../types';

type Props = {
  visible: boolean;
  lines: CartLine[];
  totalCents: number;
  onClose: () => void;
  onAdd: (dish: Dish) => void;
  onRemove: (dishId: number) => void;
  onClear: () => void;
};

export function CartSheet({
  visible,
  lines,
  totalCents,
  onClose,
  onAdd,
  onRemove,
  onClear,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.panel} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>已选菜品</Text>
            <Pressable onPress={onClear} hitSlop={8}>
              <Text style={styles.clear}>清空</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {lines.length === 0 ? (
              <Text style={styles.empty}>还没有选菜</Text>
            ) : (
              lines.map(line => (
                <View key={line.dish.id} style={styles.line}>
                  <View style={styles.lineInfo}>
                    <Text style={styles.lineName} numberOfLines={1}>
                      {line.dish.name}
                    </Text>
                    <Text style={styles.linePrice}>
                      ¥{formatPrice(line.dish.priceCents)}
                    </Text>
                  </View>
                  <View style={styles.stepper}>
                    <Pressable
                      onPress={() => onRemove(line.dish.id)}
                      style={styles.stepBtn}
                      hitSlop={8}>
                      <Text style={styles.stepText}>−</Text>
                    </Pressable>
                    <Text style={styles.qty}>{line.qty}</Text>
                    <Pressable
                      onPress={() => onAdd(line.dish)}
                      style={[styles.stepBtn, styles.stepBtnSolid]}
                      hitSlop={8}>
                      <Text style={[styles.stepText, styles.stepTextSolid]}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={[styles.footer, {paddingBottom: 14 + insets.bottom}]}>
            <Text style={styles.totalLabel}>
              合计{' '}
              <Text style={styles.total}>¥{formatPrice(totalCents)}</Text>
            </Text>
            <Pressable onPress={onClose} style={styles.done}>
              <Text style={styles.doneText}>收起</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end'},
  panel: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 14,
    maxHeight: '62%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {fontSize: 15, fontWeight: '700', color: colors.text},
  clear: {fontSize: 13, color: colors.textSub},
  list: {flexGrow: 0},
  listContent: {paddingHorizontal: 16},
  empty: {paddingVertical: 24, textAlign: 'center', color: colors.textFaint},
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lineInfo: {flex: 1, marginRight: 12},
  lineName: {fontSize: 14, color: colors.text},
  linePrice: {fontSize: 12, color: colors.textFaint, marginTop: 3},
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  totalLabel: {fontSize: 13, color: colors.textSub},
  total: {fontSize: 17, fontWeight: '700', color: colors.primary},
  done: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
  },
  doneText: {fontSize: 14, color: colors.primary, fontWeight: '600'},
});
