import React, {useEffect, useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {colors} from '../theme';

type Props = {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
};

export function TextPrompt({
  visible,
  title,
  placeholder,
  initialValue = '',
  confirmText = '确定',
  onSubmit,
  onCancel,
}: Props): React.JSX.Element {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>{title}</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor={colors.textFaint}
              autoFocus
              onSubmitEditing={() => onSubmit(value.trim())}
              returnKeyType="done"
            />
            <View style={styles.actions}>
              <Pressable style={styles.cancel} onPress={onCancel}>
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.confirm} onPress={() => onSubmit(value.trim())}>
                <Text style={styles.confirmText}>{confirmText}</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {width: '100%', backgroundColor: colors.card, borderRadius: 14, padding: 18},
  title: {fontSize: 15, fontWeight: '700', color: colors.text},
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  actions: {flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16},
  cancel: {paddingHorizontal: 14, paddingVertical: 8},
  cancelText: {fontSize: 14, color: colors.textSub},
  confirm: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    marginLeft: 8,
  },
  confirmText: {fontSize: 14, color: '#fff', fontWeight: '600'},
});
