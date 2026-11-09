import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../theme';

type Props = {
  visible: boolean;
  phone: string;
  onClose: () => void;
  onLogout: () => void;
};

function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) {
    return phone || '未登录';
  }
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export function AccountSheet({visible, phone, onClose, onLogout}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.panel, {paddingBottom: 16 + insets.bottom}]}
          onPress={() => {}}>
          <Text style={styles.title}>当前账号</Text>
          <Text style={styles.phone}>{maskPhone(phone)}</Text>
          <Text style={styles.tip}>
            退出后可以用另一个手机号登录。原来的账号不会被删除，下次用原来的手机号登录，订单还在。
          </Text>

          <Pressable onPress={onLogout} style={({pressed}) => [styles.logout, pressed && styles.pressed]}>
            <Text style={styles.logoutText}>退出登录 / 切换账号</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>取消</Text>
          </Pressable>
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
    padding: 20,
  },
  title: {fontSize: 13, color: colors.textFaint},
  phone: {marginTop: 8, fontSize: 22, fontWeight: '700', color: colors.text},
  tip: {marginTop: 10, fontSize: 12, lineHeight: 18, color: colors.textSub},
  logout: {
    marginTop: 20,
    borderRadius: 22,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#fff1f1',
  },
  logoutText: {fontSize: 15, color: colors.danger, fontWeight: '600'},
  cancel: {marginTop: 8, paddingVertical: 12, alignItems: 'center'},
  cancelText: {fontSize: 14, color: colors.textSub},
  pressed: {opacity: 0.85},
});
